import test from 'node:test';
import assert from 'node:assert/strict';
import {createLearningOptionController} from '../src/learning-options.js';
function observation(food=16,x=0){return {health:20,food,foodAvailable:true,hostileDistance:24,inventoryCount:1,blocked:false,displacement:0,position:{x,z:0}};}
test('v1 reward remains unchanged and v2 puts more value on observed food recovery',()=>{
 const logs1=[],logs2=[];
 for(const [version,events] of [['v1',logs1],['v2',logs2]]){
  const ctl=createLearningOptionController({mode:'scripted',rewardVersion:version,log:e=>events.push(e),seed:17});
  ctl.choose(observation(16,0));ctl.choose(observation(18,0));ctl.stop();
 }
 const a=logs1.find(x=>x.type==='option_transition'),b=logs2.find(x=>x.type==='option_transition');
 assert.equal(a.reward,0.08); // 2 hunger gained * .05 - .02
 assert.equal(b.reward,0.97); // 2 hunger gained * .5 - .03
 assert.equal(a.rewardVersion,'v1');assert.equal(b.rewardVersion,'v2');
});
test('invalid reward version is rejected',()=>assert.throws(()=>createLearningOptionController({mode:'random',rewardVersion:'v3'}),/reward version/));
