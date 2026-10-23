import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseSurvivalGoal,HOSTILE_MOBS} from '../src/survival-reference.js';
test('reference prioritizes threats and critical health over food',()=>{
 assert.equal(chooseSurvivalGoal({hostileDistance:3,food:5,foodAvailable:true}),'retreat');
 assert.equal(chooseSurvivalGoal({health:5,food:20}),'retreat');
});
test('reference eats when hungry, forages when missing food, and explores otherwise',()=>{
 assert.equal(chooseSurvivalGoal({food:8,foodAvailable:true}),'eat');
 assert.equal(chooseSurvivalGoal({food:20,foodAvailable:false,hasFood:false}),'forage');
 assert.equal(chooseSurvivalGoal({food:20,hasFood:true}),'explore');
 assert.equal(chooseSurvivalGoal({food:20,hasFood:true,blocked:true}),'reroute');
});
test('hazard set contains a few common survival threats',()=>{
 for(const mob of ['creeper','zombie','skeleton'])assert.equal(HOSTILE_MOBS.has(mob),true);
 assert.equal(HOSTILE_MOBS.has('cow'),false);
});
