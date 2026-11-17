import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyMotorBaselineActionEvidence
} from '../src/verified-motor-baseline-action.js';

function fixture(operation='dig') {
  const run={
    schema:'craftle.motor-learning-manifest.v1',
    runId:'baseline-run',learningEnabled:false,
    trainingEligible:false,isolated:true,
    assistance:'scripted_planner',policy:'scripted_nonlearning_smoke',
    reward:'terminal_world_state_only_not_action_id'
  };
  const decision={
    id:'chain-001',runId:run.runId,
    serverBootId:'boot1',playerUuid:'player1',
    operation,world:'minecraft:overworld',
    x:1,y:81,z:0,placedBlock:'minecraft:dirt',features:[0.1,0.2]
  };
  const base={
    schema:'craftle.server-event.v1',
    experimentId:run.runId,
    serverBootId:decision.serverBootId,
    playerUuid:decision.playerUuid,
    world:decision.world,
    x:decision.x,y:decision.y,z:decision.z
  };
  const actorType=operation==='dig'?'block_break_event':'block_place_event';
  const events=[
    {...base,event:'motor_action_binding',decisionId:decision.id,
      operation,phase:'server_bound_intent',onlinePlayers:1,
      beforeBlock:operation==='dig'?'minecraft:dirt':'minecraft:air',
      serverTick:100,sequence:10},
    {...base,event:actorType,boundDecisionId:decision.id,
      phase:'event_before_world_mutation',serverTick:102,sequence:11,
      monotonicNsSinceBoot:1000000},
    {...base,event:'block_state_post_tick',
      sourceEvent:actorType,sourceEventSequence:11,
      phase:'scheduled_next_tick_read_only',
      block:operation==='dig'?'minecraft:air':'minecraft:dirt',
      serverTick:103,sequence:12,monotonicNsSinceBoot:2000000}
  ];
  return {run,decision,events};
}
const result=x=>verifyMotorBaselineActionEvidence(x);

test('server-bound scripted dig has independent action proof with ZERO reward permission',()=>{
  const proof=result(fixture());
  assert.equal(proof.actionVerified,true);
  assert.equal(proof.trainingRewardEligible,false);
  assert.equal(proof.rewardEligible,false);
  assert.equal(Object.hasOwn(proof,'reward'),false);
  assert.equal(Object.hasOwn(proof,'features'),false);
  assert.equal(proof.evidenceKey,'boot1:11');
  assert.equal(proof.decisionKey,'baseline-run:chain-001');
  assert.equal(proof.eventSequence,11);
  assert.equal(proof.steps,3);
});
test('server-bound scripted placement proves exactly dirt at bound target',()=>{
  assert.equal(result(fixture('place')).actionVerified,true);
  const f=fixture('place');f.events[2].block='minecraft:stone';
  assert.equal(result(f).reason,'unverified_post_state');
});
test('training or unassisted manifests may NEVER obtain baseline proof',()=>{
  for(const altered of [
    {learningEnabled:true},{trainingEligible:true},
    {assistance:'none'},{isolated:false},
    {policy:'learner'},{schema:'craftle.some-other-schema'},
    {runId:''}
  ]){
    const f=fixture();Object.assign(f.run,altered);
    assert.equal(result(f).reason,'not_scripted_baseline');
  }
});
test('missing, duplicate or fake binding refuses action proof',()=>{
  const f=fixture();f.events.shift();
  assert.equal(result(f).reason,'missing_or_ambiguous_binding');
  const d=fixture();d.events.push({...d.events[0],sequence:14});
  assert.equal(result(d).reason,'missing_or_ambiguous_binding');
  for(const altered of [
    {onlinePlayers:2},{phase:'client_intent'},{operation:'place'},
    {playerUuid:'other'},{world:'minecraft:the_nether'},
    {beforeBlock:'minecraft:air'},{experimentId:'other'}
  ]){
    const q=fixture();Object.assign(q.events[0],altered);
    assert.equal(result(q).actionVerified,false);
  }
});
test('wrong actor, event type, target or ambiguous mutation fails closed',()=>{
  for(const altered of [
    {boundDecisionId:'other'}, {phase:'client_action'},
    {serverTick:203},{sequence:10},
    {event:'block_place_event'},{world:'minecraft:the_nether'}
  ]){
    const f=fixture();Object.assign(f.events[1],altered);
    assert.equal(result(f).actionVerified,false,
      'unexpected actor acceptance: '+JSON.stringify(altered));
  }
  const duplicate=fixture();duplicate.events.push({...duplicate.events[1],sequence:14});
  assert.equal(result(duplicate).reason,'missing_or_ambiguous_actor_event');
});
test('wrong or duplicated post-state and missing parent link fail closed',()=>{
  for(const altered of [
    {block:'minecraft:dirt'},{sourceEvent:'block_place_event'},
    {phase:'client_post_state'},{sourceEventSequence:22},
    {serverTick:108},{sequence:11},
    {playerUuid:'other'}
  ]){
    const f=fixture();Object.assign(f.events[2],altered);
    assert.equal(result(f).actionVerified,false,
      'unexpected post acceptance: '+JSON.stringify(altered));
  }
  const duplicate=fixture();duplicate.events.push({...duplicate.events[2],sequence:13});
  assert.equal(result(duplicate).reason,'missing_or_ambiguous_post_state');
});
test('post sampled in same tick requires later server monotonic ordering',()=>{
  const f=fixture();
  f.events[2].serverTick=f.events[1].serverTick;
  f.events[2].monotonicNsSinceBoot=f.events[1].monotonicNsSinceBoot+1;
  assert.equal(result(f).actionVerified,true);
  f.events[2].monotonicNsSinceBoot=f.events[1].monotonicNsSinceBoot;
  assert.equal(result(f).reason,'unverified_post_state');
  delete f.events[2].monotonicNsSinceBoot;
  assert.equal(result(f).reason,'unverified_post_state');
});
test('invalid or canceled bound decision is rejected even after world changes',()=>{
  for(const event of ['motor_binding_cancelled','motor_binding_invalidated']){
    const f=fixture();
    f.events.push({event,decisionId:f.decision.id,
      serverBootId:f.decision.serverBootId,sequence:14});
    assert.equal(result(f).reason,'binding_revoked');
  }
  const f=fixture();f.decision.runId='other';
  assert.equal(result(f).reason,'invalid_decision');
  const g=fixture('place');g.events[0].beforeBlock='minecraft:dirt';
  assert.equal(result(g).reason,'invalid_initial_block');
});
test('binding must precede actor and leave positive observed server duration',()=>{
  const f=fixture();f.events[0].serverTick=102;
  f.events[1].serverTick=102;
  f.events[2].serverTick=102;
  assert.equal(result(f).reason,'invalid_duration');
  const g=fixture();g.events[1].serverTick=99;
  assert.equal(result(g).reason,'missing_or_ambiguous_actor_event');
  const h=fixture();h.events[0].sequence=100;
  assert.equal(result(h).reason,'unbound_actor_event');
});
