import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotAgentState,summarizeActionEffect} from '../src/llm-effects.js';
test('measures displacement inventory and survival changes without block access',()=>{
 const before={position:{x:0,y:64,z:0},health:20,hunger:20,inventory:[{name:'oak_log',count:1}]};
 const after={position:{x:0,y:64,z:1},health:19,hunger:19,inventory:[{name:'oak_log',count:2}]};
 const e=summarizeActionEffect(before,after,'forward',{success:true});
 assert.equal(e.moved,true);assert.equal(e.displacement,1);
 assert.deepEqual(e.inventoryDelta,{oak_log:1});
 assert.equal(e.healthDelta,-1);
});
test('command acknowledged but not physically executed counts as no movement',()=>{
 const state={position:{x:0,y:0,z:0},health:20,hunger:20,inventory:[]};
 const e=summarizeActionEffect(state,state,'forward',{success:true});
 assert.equal(e.toolReportedSuccess,true);assert.equal(e.moved,false);
});
test('snapshot excludes privileged world blocks',()=>{
 const bot={entity:{position:{x:1,y:2,z:3}},health:20,food:18,inventory:{items:()=>[{name:'dirt',count:3}]}};
 assert.deepEqual(snapshotAgentState(bot),{position:{x:1,y:2,z:3},health:20,hunger:18,inventory:[{name:'dirt',count:3}]});
});
