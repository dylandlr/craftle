import test from 'node:test';import assert from 'node:assert/strict';import {createTargetedController} from '../src/targeted-controller.js';
test('auto-eat control never selects eat or updates neural state',()=>{
 const decisions=[];const c=createTargetedController({mode:'auto_eat',log:e=>decisions.push(e)});
 const o={health:20,food:9,foodAvailable:true,foodUnits:2,foodPoints:8,hostileDistance:24,blocked:false,displacement:0,position:{x:0,y:64,z:0},targets:[]};
 for(let i=0;i<10;i++){const a=c.choose(o);assert.notEqual(a.skill,'eat');}
 assert.equal(c.stats().updates,0);assert.equal(c.stats().training,false);
 assert.ok(decisions.some(d=>d.type==='target_decision'&&d.mode==='auto_eat'));c.stop();
});
