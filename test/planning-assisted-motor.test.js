import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotorQPolicy,encodeMotorCandidate} from '../src/motor-q-policy.js';
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import {searchMutableTerrain} from '../src/mutable-terrain-search-control.js';
test('generic-search samples can alter candidate ranking via imitation',()=>{
 const world=createMutableTerrain({layout:'chasm',span:3,platformHeight:5});
 const plan=searchMutableTerrain(world,{depth:8,beamWidth:36});
 assert.equal(plan.solved,true);
 const state=world.observe(),candidates=world.affordances();
 const first=plan.trace[0],chosen=candidates.find(c=>c.operation===first.operation&&
  JSON.stringify(c.arguments)===JSON.stringify(first.args));
 assert.ok(chosen);
 const policy=createMotorQPolicy({seed:19,epsilon:0,alpha:0.008});
 const positiveFeatures=encodeMotorCandidate(state,chosen);
 const negativeFeatures=candidates.filter(c=>c.id!==chosen.id)
  .map(c=>encodeMotorCandidate(state,c));
 let updated=0;
 for(let i=0;i<300;i++)updated+=Number(policy.imitate({
  positiveFeatures,negativeFeatures,margin:0.3}).updated);
 assert.ok(updated>0);
 assert.equal(policy.choose(state,candidates).candidate.id,chosen.id);
});
test('imitation refuses a frozen policy and invalid features',()=>{
 const world=createMutableTerrain();
 const p=createMotorQPolicy({training:false});
 const vec=encodeMotorCandidate(world.observe(),world.affordances()[0]);
 assert.throws(()=>p.imitate({positiveFeatures:vec,negativeFeatures:[vec]}),/frozen/);
 assert.throws(()=>createMotorQPolicy().imitate({positiveFeatures:[1],
  negativeFeatures:[vec]}),/Invalid imitation/);
});
test('planning examples do not execute against or mutate their source world',()=>{
 const world=createMutableTerrain({layout:'chasm',span:3,platformHeight:5});
 const before=world.exportState();
 searchMutableTerrain(world,{depth:8,beamWidth:36});
 assert.deepEqual(world.exportState(),before);
});
