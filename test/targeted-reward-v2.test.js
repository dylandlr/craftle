import test from 'node:test';
import assert from 'node:assert/strict';
import {createTargetedController} from '../src/targeted-controller.js';

function observation(position,foodUnits=0,displacement=0){
 return {health:20,food:12,foodAvailable:false,foodUnits,foodPoints:0,
 hostileDistance:24,blocked:false,displacement,position,targets:[]};
}
test('targeted reward v1 unchanged and v2 rewards bounded observed progress',()=>{
 const old=[],next=[];
 const first=observation({x:0,y:65,z:0});
 const changed=observation({x:10,y:65,z:0},2,2);
 const v1=createTargetedController({mode:'scripted',seed:7,rewardVersion:'v1',log:e=>old.push(e)});
 const v2=createTargetedController({mode:'scripted',seed:7,rewardVersion:'v2',log:e=>next.push(e)});
 v1.choose(first);v2.choose(first);
 v1.choose(changed);v2.choose(changed);
 const r1=old.find(e=>e.type==='target_transition').reward;
 const r2=next.find(e=>e.type==='target_transition').reward;
 assert.equal(r1,-0.03);
 assert.ok(r2>r1);
 const components=next.find(e=>e.type==='target_reward_components');
 assert.equal(components.novelty,0.12);
 assert.equal(components.inventoryProgress,0.3);
 assert.equal(components.movement,0.02);
 assert.equal(components.causalAttribution,'unverified_observation');
 v1.stop();v2.stop();
});
test('targeted reward v2 does not repeatedly credit old spatial cells',()=>{
 const events=[],policy=createTargetedController({mode:'scripted',seed:7,rewardVersion:'v2',log:e=>events.push(e)});
 const home=observation({x:0,y:65,z:0}),newCell=observation({x:9,y:65,z:0});
 policy.choose(home);policy.choose(newCell);policy.choose(home);policy.choose(newCell);
 const rewards=events.filter(e=>e.type==='target_reward_components');
 assert.equal(rewards[0].novelty,0.12);
 assert.equal(rewards[1].novelty,0);
 assert.equal(rewards[2].novelty,0);
 policy.stop();
});
test('unknown targeted reward contract is rejected',()=>{
 assert.throws(()=>createTargetedController({rewardVersion:'v999'}),/Invalid targeted reward version/);
});
