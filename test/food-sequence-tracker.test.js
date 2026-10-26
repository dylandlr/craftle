import test from 'node:test';
import assert from 'node:assert/strict';
import {createFoodSequenceTracker} from '../src/food-sequence-tracker.js';
test('tracks attempted acquisition through observed inventory and verified eating',()=>{
 const events=[],tracker=createFoodSequenceTracker({log:e=>events.push(e),clock:()=>100});
 tracker.decision({skill:'approach',targetId:'plant:1',decisionId:1});
 tracker.decision({skill:'harvest',targetId:'plant:1',decisionId:2});
 tracker.inventory({before:0,after:2});
 tracker.decision({skill:'eat',targetId:null,decisionId:3});
 tracker.consumed({before:12,after:16,decisionId:3});
 const recovery=events.find(e=>e.type==='food_sequence_recovery');
 assert.equal(recovery.status,'sequence_with_observed_inventory_gain');
 assert.deepEqual(recovery.stages,['approach','harvest','inventory_gain','eat']);
 assert.match(recovery.evidence,/not_complete_causal_chain/);
 assert.equal(events.at(-1).status,'recovery_observed');
});
test('does not invent food attribution on no gain; clears on death',()=>{
 const events=[],tracker=createFoodSequenceTracker({log:e=>events.push(e)});
 tracker.decision({skill:'approach',targetId:'cow:4',decisionId:1});
 tracker.decision({skill:'attack',targetId:'cow:4',decisionId:2});
 tracker.inventory({before:4,after:4});
 tracker.consumed({before:10,after:10,decisionId:3});
 tracker.death();
 assert.equal(events.filter(e=>e.type==='food_sequence_recovery').length,0);
 assert.equal(events.at(-1).status,'death');
});
