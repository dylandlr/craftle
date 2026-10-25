import test from 'node:test';
import assert from 'node:assert/strict';
import {createLearningOptionController} from '../src/learning-options.js';
const observed=(food=16)=>({health:20,food,foodAvailable:true,hostileDistance:24,inventoryCount:1,blocked:false,displacement:1,position:{x:0,z:0}});
test('v3 only credits a verified recovery once, never attempts or unknown-source deaths',()=>{
 const events=[],ctl=createLearningOptionController({mode:'training',rewardVersion:'v3',epsilon:0,seed:3,log:e=>events.push(e)});
 ctl.choose(observed());
 const action=events.find(e=>e.type==='option_decision').action;
 const recovery={kind:'option_outcome',evidence:'verified_hunger_recovery',option:action,life:0,optionId:'0:2',sequence:8};
 assert.equal(ctl.creditOutcome({...recovery,evidence:'attempt_only'}),false);
 assert.equal(ctl.creditOutcome({...recovery,option:'unrelated'}),false);
 assert.equal(ctl.creditOutcome(recovery),true);
 assert.equal(ctl.creditOutcome(recovery),false);
 ctl.choose(observed());
 assert.equal(events.filter(e=>e.type==='option_verified_reward').length,1);
 assert.ok(events.find(e=>e.type==='option_transition').reward>=0.97);
 ctl.stop();
});
test('v1 and v2 never grant v3 evidence rewards',()=>{
 for(const rewardVersion of ['v1','v2']){
  const ctl=createLearningOptionController({mode:'training',rewardVersion,seed:1});
  ctl.choose(observed());
  assert.equal(ctl.creditOutcome({kind:'option_outcome',evidence:'verified_hunger_recovery',option:'forage',life:0,optionId:'0:1',sequence:1}),false);
  ctl.stop();
 }
});
