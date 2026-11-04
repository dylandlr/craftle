import test from 'node:test';
import assert from 'node:assert/strict';
import {createStateNovelty,localMotorStateKey} from '../src/motor-state-novelty.js';
import {createMotorQPolicy} from '../src/motor-q-policy.js';
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
test('local novelty is a state property, not a reward for named actions',()=>{
 const world=createMutableTerrain({layout:'chasm',span:3});
 const novelty=createStateNovelty({coefficient:0.3});
 const first=world.observe();
 assert.equal(novelty.observe(first).bonus,0);
 assert.equal(novelty.observe(first).bonus,0);
 const candidate=world.affordances().find(c=>c.operation==='place');
 assert.ok(candidate);
 world.act(candidate);
 const after=novelty.observe(world.observe());
 assert.equal(after.firstVisit,true);
 assert.ok(after.bonus>0);
 assert.notEqual(localMotorStateKey(first),localMotorStateKey(world.observe()));
 assert.equal(novelty.observe(world.observe()).bonus,0);
});
test('balanced exploratory policy samples multiple executable action families',()=>{
 const world=createMutableTerrain({layout:'chasm'});
 const candidates=world.affordances();
 const policy=createMotorQPolicy({seed:44,epsilon:1,explorationMode:'operation_balanced'});
 const counts={};
 for(let i=0;i<100;i++){
  const choice=policy.choose(world.observe(),candidates);
  counts[choice.candidate.operation]=(counts[choice.candidate.operation]??0)+1;
 }
 for(const op of ['move','dig','place','wait'])assert.ok(counts[op]>0,op);
});
test('invalid exploration mode fails instead of silently defaulting',()=>{
 assert.throws(()=>createMotorQPolicy({explorationMode:'construction_first'}),/Invalid exploration/);
});
