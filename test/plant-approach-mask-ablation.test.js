import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeTargets,decodeTargetAction,TARGET_ACTIONS} from '../src/target-opportunities.js';
import {createTargetedController} from '../src/targeted-controller.js';
const plant={id:'plant:2',kind:'plant',position:{x:2,y:70,z:0},distance:2,visible:true,reachable:true};
const drop={id:'entity:17',kind:'drop',position:{x:1,y:70,z:0},distance:1,visible:true,reachable:false};
const animal={id:'entity:18',kind:'animal',position:{x:2,y:70,z:0},distance:2,visible:true,reachable:true};
const obs=targets=>({health:20,food:10,foodUnits:0,foodPoints:0,foodAvailable:false,
 hostileDistance:24,blocked:false,displacement:0,position:{x:0,y:70,z:0},targets});
const available=(o,enabled)=>TARGET_ACTIONS.filter((_,i)=>encodeTargets(o,{maskRedundantPlantApproach:enabled}).mask[i]);
test('baseline unchanged: reachable plants still permit approach',()=>{
 const actions=available(obs([plant]),false);
 assert.ok(actions.includes('approach_0'));
 assert.ok(actions.includes('harvest_0'));
});
test('ablation removes only redundant approach to visible reachable plant',()=>{
 const actions=available(obs([plant,drop,animal]),true);
 assert.equal(actions.includes('approach_0'),false);
 assert.equal(actions.includes('harvest_0'),true);
 assert.equal(actions.includes('approach_1'),true);
 assert.equal(actions.includes('approach_2'),true);
 assert.equal(actions.includes('attack_2'),true);
});
test('approach remains enabled before plant is reachable',()=>{
 const actions=available(obs([{...plant,reachable:false,distance:10}]),true);
 assert.ok(actions.includes('approach_0'));
 assert.equal(actions.includes('harvest_0'),false);
});
test('decoder and controller respect identical opt-in mask',()=>{
 const o=obs([plant]);
 assert.throws(()=>decodeTargetAction(TARGET_ACTIONS.indexOf('approach_0'),o,{maskRedundantPlantApproach:true}),/Unavailable/);
 assert.equal(decodeTargetAction(TARGET_ACTIONS.indexOf('harvest_0'),o,{maskRedundantPlantApproach:true}).skill,'harvest');
 const controller=createTargetedController({mode:'random',seed:19,rewardVersion:'v1',maskRedundantPlantApproach:true});
 for(let i=0;i<30;i++){
  const choice=controller.choose(o);
  assert.notEqual(choice.skill,'approach');
 }
 controller.stop();
});
