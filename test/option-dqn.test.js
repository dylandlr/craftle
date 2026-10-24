import test from 'node:test';
import assert from 'node:assert/strict';
import {createOptionDQN} from '../src/option-dqn.js';
test('DQN changes weights from real transitions and supports compatible reload',()=>{
 const p=createOptionDQN({random:()=>0.5,epsilon:0});const x=[1,1,0,1,0,0,0];
 const before=p.snapshot();p.observe({state:x,index:2,reward:1,nextState:x,nextMask:[false,true,true,true]});
 assert.notDeepEqual(p.snapshot().v,before.v);assert.equal(p.stats().updates,4);
 const loaded=createOptionDQN({snapshot:p.snapshot(),training:false,random:()=>0.5});
 assert.equal(loaded.choose(x,[false,false,true,false]).action,'explore');
 assert.throws(()=>loaded.observe({}),/Frozen/);
});
test('terminal updates do not require a next-life observation or bootstrap',()=>{
 const p=createOptionDQN();p.observe({state:[1,1,0,1,0,0,0],index:1,reward:-5,terminal:true});
 assert.equal(p.stats().updates,4);assert.throws(()=>p.choose([NaN],[true,true,true,true]),/observation/);
});
