import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';

// One envelope per process, shared by all agent log producers. Never persisted
// in policy state, and never used as a policy observation or reward.
export function createEventEnvelope({sessionId = randomUUID(), wallNow = Date.now, monotonicNow = () => performance.now()} = {}) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw Error('Invalid event session ID');
  let eventSequence = 0;
  return (agent, type, extra = {}) => ({...extra, agent, type,
    timestamp: new Date(wallNow()).toISOString(), sessionId,
    eventSequence: ++eventSequence, monotonicMs: monotonicNow()});
}
