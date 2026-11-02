// Wall timestamps bound logging instants, not authoritative action execution ticks.
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const timeOf = event => typeof event?.timestamp === 'string' ? Date.parse(event.timestamp) : NaN;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const sameClock = (a, b) => a.worldId === b.worldId && a.epoch === b.epoch &&
  (a.collectorSessionId ?? null) === (b.collectorSessionId ?? null);

function validSample(s) {
  return s && integer(s.gameTime) && integer(s.epoch) && nonempty(s.worldId) &&
    Number.isFinite(s.requestedAt) && Number.isFinite(s.completedAt) &&
    s.requestedAt <= s.completedAt &&
    (s.source == null || ['server_query', 'server_packet'].includes(s.source)) &&
    (s.schema !== 'craftle.server-clock.v2' || (nonempty(s.collectorSessionId) && integer(s.sampleSequence))) &&
    (s.collectorSessionId == null || nonempty(s.collectorSessionId)) &&
    (s.sampleSequence == null || integer(s.sampleSequence));
}

function lowerBound(items, value, field, strict = false) {
  let lo = 0, hi = items.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (items[mid][field] < value || (strict && items[mid][field] === value)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function createClockIndex(samples, {maxSampleGapMs = 15000, clockSkewMs = 0} = {}) {
  if (!Number.isFinite(maxSampleGapMs) || maxSampleGapMs <= 0 ||
      !Number.isFinite(clockSkewMs) || clockSkewMs < 0) throw Error('Invalid clock bounds options');
  // Preserve acquisition order: sorting first can hide rollbacks and restarts.
  const segments = [];
  let current = null, invalidSamples = 0, validSamples = 0;
  let firstRequest = Infinity, lastCompletion = -Infinity;
  for (const sample of samples) {
    if (!validSample(sample)) { invalidSamples++; current = null; continue; }
    const previous = current?.samples.at(-1);
    if (!previous || !sameClock(previous, sample) || sample.gameTime < previous.gameTime ||
        sample.requestedAt < previous.completedAt ||
        (sample.sampleSequence != null && previous.sampleSequence != null && sample.sampleSequence <= previous.sampleSequence)) {
      current = {id: segments.length, samples: []};
      segments.push(current);
    }
    current.samples.push({...sample});
    firstRequest = Math.min(firstRequest, sample.requestedAt);
    lastCompletion = Math.max(lastCompletion, sample.completedAt);
    validSamples++;
  }
  return {
    diagnostics: {validSamples, invalidSamples, clockSegments: segments.length,
      firstSampleRequestedAt: validSamples ? firstRequest : null,
      lastSampleCompletedAt: validSamples ? lastCompletion : null},
    bracket(event) {
      const time = timeOf(event);
      if (!Number.isFinite(time)) return {status: 'invalid_event_timestamp', reason: 'invalid_event_timestamp'};
      if (!validSamples) return {status: 'unbounded', reason: 'no_valid_clock_samples', eventTime: time};
      const low = time - clockSkewMs, high = time + clockSkewMs;
      const enclosing = [];
      // Wall rollback can produce multiple plausible timelines: reject ambiguity.
      for (const segment of segments) {
        const items = segment.samples;
        if (items[0].requestedAt > high || items.at(-1).completedAt < low) continue;
        enclosing.push(segment);
      }
      if (enclosing.length > 1) return {status: 'clock_discontinuity', reason: 'ambiguous_clock_segments', eventTime: time};
      const items = enclosing[0]?.samples;
      if (!items) {
        const inside = time >= firstRequest && time <= lastCompletion;
        return {status: inside ? 'clock_discontinuity' : 'unbounded',
          reason: inside ? 'between_clock_segments' : time < firstRequest ? 'before_clock_coverage' : 'after_clock_coverage', eventTime: time};
      }
      // Equal millisecond stamps do not establish sub-millisecond ordering.
      const beforeIndex = lowerBound(items, low, 'completedAt') - 1;
      const before = items[beforeIndex], after = items[lowerBound(items, high, 'requestedAt', true)];
      if (!before || !after) return {status: 'unbounded', eventTime: time,
        reason: !before && !after ? 'missing_both_enclosing_samples' : !before ? 'missing_before_sample' : 'missing_after_sample'};
      if (event.worldId != null && event.worldId !== before.worldId) return {status: 'world_mismatch', reason: 'event_world_mismatch', eventTime: time};
      const sampleSpanMs = after.completedAt - before.requestedAt;
      if (sampleSpanMs > maxSampleGapMs) return {status: 'stale_clock_gap', reason: 'sample_span_exceeds_limit', eventTime: time, sampleSpanMs};
      return {
        status: 'bracketed', eventTime: time, worldId: before.worldId, epoch: before.epoch,
        collectorSessionId: before.collectorSessionId ?? null, clockSegment: enclosing[0].id,
        continuity: before.collectorSessionId ? 'collector_session_and_epoch' : 'legacy_inferred',
        minTick: before.gameTime, maxTick: after.gameTime, tickWidth: after.gameTime - before.gameTime,
        beforeSampleCompletedAt: before.completedAt, afterSampleRequestedAt: after.requestedAt,
        sampleSpanMs, clockSkewMs, precision: 'interval_only',
        assumption: 'event_and_collector_wall_clocks_within_configured_skew; no_unobserved_world_reset'
      };
    }
  };
}

export function bracketEvent(event, samples, options) {
  return createClockIndex(samples, options).bracket(event);
}

export function boundDuration(start, end) {
  const rejected = status => ({status, trainingEligible: false});
  if (start?.status !== 'bracketed' || end?.status !== 'bracketed') return {
    ...rejected('unbounded_endpoint'), startStatus: start?.status ?? 'missing', endStatus: end?.status ?? 'missing',
    startReason: start?.reason ?? null, endReason: end?.reason ?? null};
  for (const bracket of [start, end]) {
    if (!integer(bracket.minTick) || !integer(bracket.maxTick) || bracket.minTick > bracket.maxTick ||
        !Number.isFinite(bracket.eventTime) || !nonempty(bracket.worldId) || !integer(bracket.epoch) ||
        !integer(bracket.clockSegment)) return rejected('invalid_bracket');
  }
  if (!sameClock(start, end) || start.clockSegment !== end.clockSegment) return rejected('clock_discontinuity');
  if (end.eventTime < start.eventTime) return rejected('reversed_event_time');
  const minTicks = Math.max(0, end.minTick - start.maxTick);
  const maxTicks = end.maxTick - start.minTick;
  if (maxTicks < minTicks) return rejected('inconsistent_tick_order');
  return {status: 'bounded', minTicks, maxTicks, tickWidth: maxTicks - minTicks,
    wallDurationMs: end.eventTime - start.eventTime, precision: 'interval_only',
    trainingEligible: false, meaning: 'elapsed_between_log_records_not_verified_option_duration'};
}

export function relateDecisionEvents(decision, events) {
  const matched = [], rejected = {};
  const reject = reason => { rejected[reason] = (rejected[reason] ?? 0) + 1; };
  const validIdentity = integer(decision?.decisionId) && nonempty(decision?.agent_id);
  for (const e of events) {
    if (!validIdentity || !integer(e?.decisionId) || !nonempty(e?.agent_id)) { reject('missing_identity'); continue; }
    if (e.decisionId !== decision.decisionId || e.agent_id !== decision.agent_id) { reject('different_identity'); continue; }
    if ((decision.sessionId ?? null) !== (e.sessionId ?? null) ||
        (decision.sessionId != null && !nonempty(decision.sessionId))) { reject('session_mismatch'); continue; }
    if (decision.sessionId == null && (decision.replaySegment == null || decision.replaySegment !== e.replaySegment)) {
      reject('missing_legacy_scope'); continue;
    }
    if (!Number.isFinite(timeOf(decision)) || !Number.isFinite(timeOf(e))) { reject('invalid_timestamp'); continue; }
    if (timeOf(e) < timeOf(decision) ||
        (integer(decision.eventSequence) && integer(e.eventSequence) && e.eventSequence <= decision.eventSequence) ||
        (integer(decision.replayLine) && integer(e.replayLine) && e.replayLine <= decision.replayLine) ||
        (Number.isFinite(decision.monotonicMs) && Number.isFinite(e.monotonicMs) && e.monotonicMs < decision.monotonicMs)) {
      reject('event_precedes_decision'); continue;
    }
    if (e.action != null && decision.selection != null && e.action !== decision.selection) { reject('action_mismatch'); continue; }
    matched.push(e);
  }
  return {decisionId: decision.decisionId, agentId: decision.agent_id, sessionId: decision.sessionId ?? null,
    events: matched, rejected,
    identity: decision.sessionId ? 'explicit_session' : 'legacy_inferred_segment',
    evidence: 'id_association_not_causal_proof'};
}
