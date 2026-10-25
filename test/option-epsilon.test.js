import test from 'node:test';
import assert from 'node:assert/strict';
import {createLearningOptionController} from '../src/learning-options.js';
const observation={health:20,food:14,foodAvailable:false,hostileDistance:24,inventoryCount:0,blocked:false,displacement:0,position:{x:0,z:0}};
test('exploration rate is validated and logged without changing option contract',()=>{
 assert.throws(()=>createLearningOptionController({mode:'random',epsilon:1.2}),/epsilon/);
 const events=[];
 const agent=createLearningOptionController({mode:'training',epsilon:0.7,seed:17,log:e=>events.push(e)});
 agent.choose(observation);
 const decision=events.find(e=>e.type==='option_decision');
 assert.equal(decision.epsilon,0.7);
 assert.equal(decision.capabilityTier,'scripted_assisted_options');
 agent.stop();
});
