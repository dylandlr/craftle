import test from 'node:test';
import assert from 'node:assert/strict';
import {createGroundedVoyagerAdapter,groundProposal} from '../src/voyager-grounding.js';
import {TARGET_ACTIONS} from '../src/target-opportunities.js';
const observation={health:20,food:16,foodAvailable:false,foodUnits:0,foodPoints:0,hostileDistance:24,blocked:false,displacement:0,position:{x:100,y:64,z:0},targets:[{id:'entity:42',kind:'animal',position:{x:102,y:64,z:0},distance:2,visible:true,reachable:true}]};
test('grounding rejects hidden capabilities, arbitrary code, stale observations and unavailable actions',()=>{
 assert.throws(()=>groundProposal({observationId:'a',index:0},observation,'a'),/Unavailable/);
 assert.throws(()=>groundProposal({observationId:'old',index:1},observation,'a'),/Stale/);
 assert.throws(()=>groundProposal({observationId:'a',index:1,code:'bot.chat("/give")'},observation,'a'),/only/);
 assert.throws(()=>groundProposal({observationId:'a',index:1,success:true},observation,'a'),/only/);
});
test('adapted baseline sees the neural sensory contract and retains pretrained-prior provenance',async()=>{
 const events=[];let supplied;
 const c=createGroundedVoyagerAdapter({log:e=>events.push(e),maxDecisions:1,propose:async o=>{supplied=o;return {observationId:o.observationId,index:TARGET_ACTIONS.indexOf('attack_0')};}});
 const choice=await c.choose(observation);assert.equal(choice.targetId,'entity:42');assert.equal(choice.skill,'attack');
 assert.equal(supplied.features.length,44);assert.equal(supplied.position,undefined);assert.equal(supplied.targets,undefined);
 assert.equal(events[0].provenance,'pretrained_language_prior');assert.equal(events[0].nativeVoyager,false);
 await assert.rejects(c.choose(observation),/budget/);
});
test('pending model responses from an ended life never become executable choices',async()=>{
 let release;const c=createGroundedVoyagerAdapter({propose:o=>new Promise(resolve=>release=()=>resolve({observationId:o.observationId,index:1}))});
 const pending=c.choose(observation);c.terminal();release();await assert.rejects(pending,/ended life/);
});
