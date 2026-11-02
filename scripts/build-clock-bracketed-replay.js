import fs from 'node:fs';
import readline from 'node:readline';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createClockIndex, boundDuration, relateDecisionEvents} from '../src/clock-event-correlation.js';

const relevant = new Set(['decision_trace_v1', 'target_transition', 'target_terminal',
  'target_navigation_result', 'connected_exploration_audit', 'connected_retreat_audit',
  'target_verified_recovery', 'navigation_recovery_outcome']);
const closing = new Set(['target_transition', 'target_terminal']);
const validIdentity = e => typeof e?.agent_id === 'string' && e.agent_id.trim() &&
  Number.isSafeInteger(e.decisionId) && e.decisionId >= 0 &&
  (e.sessionId == null || (typeof e.sessionId === 'string' && e.sessionId.trim()));
const keyOf = e => JSON.stringify([e.agent_id, e.sessionId ?? null, e.sessionId == null ? e.replaySegment : null, e.decisionId]);
const count = (object, key) => { object[key] = (object[key] ?? 0) + 1; };

function widthSummary(values) {
  const sorted = values.toSorted((a, b) => a - b);
  const percentile = p => sorted.length ? sorted[Math.ceil(p * sorted.length) - 1] : null;
  return {count: sorted.length, min: sorted[0] ?? null, p50: percentile(0.5),
    p95: percentile(0.95), max: sorted.at(-1) ?? null, method: 'nearest_rank', unit: 'ticks'};
}

export function summarizeRecords(records) {
  const bracketStatuses = {}, durationStatuses = {}, bracketFailureReasons = {}, eventBracketStatuses = {}, rejectedEvents = {};
  const widths = [], durationWidths = [];
  let boundedDurations = 0, zeroLowerBoundDurations = 0, legacyDecisions = 0;
  for (const record of records) {
    count(bracketStatuses, record.tickBracket.status);
    count(durationStatuses, record.duration.status);
    if (record.tickBracket.status === 'bracketed') widths.push(record.tickBracket.tickWidth);
    else count(bracketFailureReasons, record.tickBracket.reason ?? record.tickBracket.status);
    if (record.duration.status === 'bounded') {
      boundedDurations++;
      durationWidths.push(record.duration.tickWidth);
      if (record.duration.minTicks === 0) zeroLowerBoundDurations++;
    }
    if (record.sessionId == null) legacyDecisions++;
    for (const event of record.eventBrackets) count(eventBracketStatuses, event.bracket.status);
    for (const [reason, n] of Object.entries(record.correlated.rejected)) rejectedEvents[reason] = (rejectedEvents[reason] ?? 0) + n;
  }
  return {bracketStatuses, durationStatuses, bracketFailureReasons, eventBracketStatuses, rejectedEvents,
    summary: {decisions: records.length, bracketedDecisions: widths.length,
      coveragePercent: records.length ? 100 * widths.length / records.length : null,
      boundedDurations, zeroLowerBoundDurations, legacyDecisions,
      decisionBracketWidth: widthSummary(widths), durationBoundWidth: widthSummary(durationWidths),
      trainingEligible: false}};
}

// A fixed prefix on an open descriptor allows appends/rotation without chasing
// the live writer. Hash both passes to detect edits/truncation of that prefix.
async function* lines(snapshot, digest) {
  if (!snapshot.size) return;
  const input = fs.createReadStream(null, {fd: snapshot.fd, autoClose: false, start: 0, end: snapshot.size - 1});
  input.on('data', chunk => digest?.update(chunk));
  for await (const line of readline.createInterface({input, crlfDelay: Infinity})) yield line;
}
const snapshot = path => {
  const fd = fs.openSync(path, 'r');
  return {fd, size: fs.fstatSync(fd).size};
};
async function* annotatedEvents(source, diagnostics, digest) {
  const agents = new Map();
  let replayLine = 0;
  for await (const line of lines(source, digest)) {
    replayLine++;
    let e;
    try { e = JSON.parse(line); } catch { if (line.trim()) diagnostics.malformedLines++; continue; }
    if (!e || typeof e !== 'object') { diagnostics.malformedLines++; continue; }
    if (typeof e.agent_id !== 'string') {
      if (relevant.has(e.type)) diagnostics.missingIdentity++;
      continue;
    }
    const state = agents.get(e.agent_id) ?? {segment: 0, previousDecision: null};
    agents.set(e.agent_id, state);
    if (e.type === 'connecting') { state.segment++; state.previousDecision = null; }
    if (!relevant.has(e.type)) continue;
    if (!validIdentity(e)) { diagnostics.missingIdentity++; continue; }
    if (e.sessionId == null && e.type === 'decision_trace_v1') {
      if (state.previousDecision !== null && e.decisionId < state.previousDecision) state.segment++;
      state.previousDecision = e.decisionId;
    }
    yield {...e, replayLine, replaySegment: e.sessionId == null ? state.segment : null};
  }
}

export async function buildReplay({agentLog, clockLog, lastN = 200, maxEventsPerDecision = 1000,
  maxSampleGapMs = 15000, clockSkewMs = 0}) {
  if (!Number.isInteger(lastN) || lastN < 1 || lastN > 2000) throw Error('lastN must be an integer from 1 to 2000');
  if (!Number.isInteger(maxEventsPerDecision) || maxEventsPerDecision < 1) throw Error('Invalid event limit');
  let agent, clock;
  try {
    agent = snapshot(agentLog);
    clock = snapshot(clockLog);
    const clocks = [];
    let clockSampleCount = 0, malformedClockLines = 0;
    for await (const line of lines(clock)) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); } catch { malformedClockLines++; clocks.push(null); continue; }
      if (e?.type === 'server_clock_sample') { clocks.push(e); clockSampleCount++; }
      else { clocks.push(null); } // Error/unknown records are continuity barriers.
    }
    const index = createClockIndex(clocks, {maxSampleGapMs, clockSkewMs});
    const diagnostics = {malformedLines: 0, missingIdentity: 0};
    const recent = [], firstHash = createHash('sha256');
    for await (const event of annotatedEvents(agent, diagnostics, firstHash)) {
      if (event.type !== 'decision_trace_v1') continue;
      recent.push(event);
      if (recent.length > lastN) recent.shift();
    }
    const selected = new Map(recent.map(e => [keyOf(e), {decisions: 0, events: [], dropped: 0}]));
    const secondHash = createHash('sha256');
    for await (const event of annotatedEvents(agent, {malformedLines: 0, missingIdentity: 0}, secondHash)) {
      const group = selected.get(keyOf(event));
      if (!group) continue;
      if (event.type === 'decision_trace_v1') { group.decisions++; continue; }
      if (group.events.length < maxEventsPerDecision) group.events.push(event);
      else group.dropped++;
    }
    if (firstHash.digest('hex') !== secondHash.digest('hex')) throw Error('Agent log prefix changed during replay; retry using a stable copy');
    const records = recent.map(e => {
      const group = selected.get(keyOf(e));
      const tickBracket = index.bracket(e);
      const related = relateDecisionEvents(e, group.events);
      const ambiguous = group.decisions !== 1;
      const eventBrackets = related.events.map(event => {
        const bracket = index.bracket(event);
        return {type: event.type, timestamp: event.timestamp, eventSequence: event.eventSequence ?? null,
          bracket, durationFromDecision: ambiguous ? {status: 'ambiguous_decision', trainingEligible: false} : boundDuration(tickBracket, bracket)};
      });
      const endpoints = eventBrackets.filter(x => closing.has(x.type));
      let duration;
      if (ambiguous) duration = {status: 'ambiguous_decision', trainingEligible: false};
      else if (group.dropped) duration = {status: 'truncated_events', trainingEligible: false};
      else if (endpoints.length !== 1) duration = {status: endpoints.length ? 'ambiguous_endpoint' : 'missing_endpoint', trainingEligible: false};
      else duration = {...endpoints[0].durationFromDecision, endEventType: endpoints[0].type};
      return {decisionId: e.decisionId, segment: e.replaySegment, sessionId: e.sessionId ?? null,
        agentId: e.agent_id, action: e.selection, timestamp: e.timestamp, tickBracket, duration,
        correlated: {...related, events: related.events.map(x => ({type: x.type, timestamp: x.timestamp,
          eventSequence: x.eventSequence ?? null, reason: x.reason ?? x.status ?? null})),
          decisionOccurrences: group.decisions, ambiguous, droppedEvents: group.dropped}, eventBrackets};
    });
    const {summary, ...recordDiagnostics} = summarizeRecords(records);
    return {schema: 'craftle.clock-bracketed-replay.v2', readOnly: true, trainingEligible: false,
      agentLog, clockLog, snapshotBytes: {agent: agent.size, clock: clock.size},
      clockSampleCount, recordCount: records.length, options: {lastN, maxEventsPerDecision, maxSampleGapMs, clockSkewMs},
      summary,
      diagnostics: {...diagnostics, malformedClockLines, ...index.diagnostics, ...recordDiagnostics},
      caveat: 'Bounds describe log instants under declared clock assumptions, not exact event ticks or causal option outcomes. Legacy session identity is inferred. Never train SMDP from this report.',
      records};
  } finally {
    if (agent) fs.closeSync(agent.fd);
    if (clock) fs.closeSync(clock.fd);
  }
}

export async function main(args = process.argv.slice(2)) {
  const [agentLog = 'deploy/filming/state/agent/continuous/agent.log',
    clockLog = 'deploy/filming/state/observer/server-clock.jsonl',
    output = 'clock-bracketed-events.json', last = '200', ...flags] = args;
  const options = {};
  for (let i = 0; i < flags.length; i += 2) {
    const name = {'--max-sample-gap-ms': 'maxSampleGapMs', '--clock-skew-ms': 'clockSkewMs'}[flags[i]];
    if (typeof name !== 'string' || flags[i + 1] == null) throw Error('Unknown or incomplete replay option: ' + flags[i]);
    options[name] = Number(flags[i + 1]);
  }
  const report = await buildReplay({agentLog, clockLog, lastN: Number(last), ...options});
  // Exclusive creation also protects inputs/checkpoints from accidental overwrite.
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({output, clockSampleCount: report.clockSampleCount, recordCount: report.recordCount,
    bracketed: report.diagnostics.bracketStatuses.bracketed ?? 0, summary: report.summary,
    bracketFailureReasons: report.diagnostics.bracketFailureReasons, durationStatuses: report.diagnostics.durationStatuses}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
