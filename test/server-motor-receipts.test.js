import test from 'node:test';
import assert from 'node:assert/strict';
import {matchServerMotorReceipts} from '../src/server-motor-receipts.js';
const base={schema:'craftle.server-event.v1',serverBootId:'boot-A',
 playerUuid:'agent-uuid',world:'minecraft:overworld',x:3,y:5,z:0};
const intent={decisionId:7,operation:'dig',serverBootId:'boot-A',
 playerUuid:'agent-uuid',world:'minecraft:overworld',x:3,y:5,z:0,
 notBeforeServerTick:100};
const record=(sequence,serverTick,event,extras={})=>({
 ...base,sequence,serverTick,event,...extras});
test('pre-mutation break callback alone cannot confirm block removal',()=>{
 const output=matchServerMotorReceipts([intent],[
  record(1,101,'block_break_event',{block:'minecraft:stone'})]);
 assert.equal(output.outcomes[0].status,'unconfirmed');
 assert.equal(output.confirmedStateObservations,0);
 assert.equal(output.rewardEligible,0);
});
test('later matching server post-tick observation confirms state but not causality',()=>{
 const output=matchServerMotorReceipts([intent],[
  record(1,101,'block_break_event'),
  record(2,102,'block_state_post_tick',{block:'minecraft:air'})]);
 assert.equal(output.outcomes[0].status,'observed_expected_state');
 assert.deepEqual(output.outcomes[0].evidenceSequences,[2]);
 assert.equal(output.outcomes[0].causallyAttributed,false);
 assert.equal(output.rewardEligible,0);
});
test('wrong actor, boot, world or time does not confirm',()=>{
 const output=matchServerMotorReceipts([intent],[
  record(1,100,'block_state_post_tick',{block:'minecraft:air',playerUuid:'someone-else'}),
  record(2,101,'block_state_post_tick',{block:'minecraft:air',serverBootId:'boot-B'}),
  record(3,102,'block_state_post_tick',{block:'minecraft:air',world:'minecraft:the_nether'}),
  record(4,200,'block_state_post_tick',{block:'minecraft:air'})]);
 assert.equal(output.outcomes[0].status,'unconfirmed');
});
test('different or conflicting post-tick states do not count as success',()=>{
 const observedDifferent=matchServerMotorReceipts([intent],[
  record(1,101,'block_state_post_tick',{block:'minecraft:stone'})]);
 assert.equal(observedDifferent.outcomes[0].status,'observed_different_state');
 const ambiguous=matchServerMotorReceipts([intent],[
  record(1,101,'block_state_post_tick',{block:'minecraft:stone'}),
  record(2,102,'block_state_post_tick',{block:'minecraft:air'})]);
 assert.equal(ambiguous.outcomes[0].status,'ambiguous_observations');
 assert.equal(ambiguous.confirmedStateObservations,0);
});
test('concurrent competing intents cannot share one confirming observation',()=>{
 const output=matchServerMotorReceipts([intent,{...intent,decisionId:8}],[
  record(1,101,'block_state_post_tick',{block:'minecraft:air'})]);
 assert.equal(output.outcomes[0].status,'ambiguous_shared_observation');
 assert.equal(output.outcomes[1].status,'ambiguous_shared_observation');
 assert.equal(output.confirmedStateObservations,0);
});
test('place expects explicit server block state, not generic non-air',()=>{
 const placed={...intent,decisionId:9,operation:'place',
  itemBlockState:'minecraft:dirt'};
 const yes=matchServerMotorReceipts([placed],[
  record(1,101,'block_state_post_tick',{block:'minecraft:dirt'})]);
 assert.equal(yes.outcomes[0].confirmedState,true);
 const no=matchServerMotorReceipts([placed],[
  record(1,101,'block_state_post_tick',{block:'minecraft:stone'})]);
 assert.equal(no.outcomes[0].confirmedState,false);
 assert.throws(()=>matchServerMotorReceipts([{...placed,itemBlockState:null}],[]),
  /Placement needs expected/);
});
test('server records must be monotonic within a boot',()=>{
 assert.throws(()=>matchServerMotorReceipts([],[record(2,102,'observer_boot'),
  record(1,103,'observer_shutdown')]),/Nonmonotonic/);
});
