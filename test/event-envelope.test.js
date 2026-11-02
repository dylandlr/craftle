import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventEnvelope} from '../src/event-envelope.js';

test('all producers in a process share an immutable session and increasing sequence', () => {
  let wall=1000, mono=10;
  const log=createEventEnvelope({wallNow:()=>wall,monotonicNow:()=>mono});
  const decision=log('a','decision_trace_v1',{decisionId:1});
  wall=900;mono=11;
  const event=log('b','target_transition',{sessionId:'spoof',eventSequence:99,timestamp:'bad'});
  assert.equal(event.sessionId,decision.sessionId);
  assert.equal(decision.eventSequence,1);assert.equal(event.eventSequence,2);
  assert.ok(event.monotonicMs>decision.monotonicMs);
  assert.equal(Date.parse(event.timestamp),900);
  assert.notEqual(createEventEnvelope()('a','connecting').sessionId,decision.sessionId);
});
