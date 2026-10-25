import test from 'node:test';
import assert from 'node:assert/strict';
import {createOptionDQN} from '../src/option-dqn.js';
import {seededOptionRandom} from '../src/learning-options.js';
const state=[1,0.8,0,1,0,0,0],mask=[false,true,true,true];
const transition={state,index:2,reward:0.2,steps:2,nextState:state,nextMask:mask,terminal:false};
test('resuming DQN restores target network, experience replay and RNG for identical next updates',()=>{
 const original=createOptionDQN({random:seededOptionRandom(812)});
 for(let i=0;i<30;i++)original.observe({...transition,reward:i/100});
 const saved=original.snapshot();
 assert.equal(saved.trainingState.replay.length,30);
 const resumed=createOptionDQN({random:seededOptionRandom(999),snapshot:structuredClone(saved)});
 assert.deepEqual(resumed.snapshot(),saved);
 original.observe(transition);resumed.observe(transition);
 assert.deepEqual(resumed.snapshot(),original.snapshot());
 assert.deepEqual(resumed.choose(state,mask),original.choose(state,mask));
});
test('malformed saved replay rejects checkpoint',()=>{
 const original=createOptionDQN({random:seededOptionRandom(2)});
 original.observe(transition);const saved=original.snapshot();saved.trainingState.replay[0].reward=NaN;
 assert.throws(()=>createOptionDQN({random:seededOptionRandom(1),snapshot:saved}),/replay transition/);
});
