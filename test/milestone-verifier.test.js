import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMilestones} from '../src/milestone-verifier.js';
test('verifies inventory and dimension facts without trusting LLM claims',()=>{
 const e=[
 {type:'llm_decision',goal:'I entered the End',timestamp:'t0'},
 {type:'llm_action_applied',action:'craft',success:true,timestamp:'t1'},
 {type:'inventory_snapshot',items:[{name:'oak_log',count:1},{name:'oak_planks',count:4}],timestamp:'t2'},
 {type:'inventory_snapshot',items:[{name:'stone_pickaxe',count:1}],timestamp:'t3'},
 {type:'minecraft_dimension',dimension:'minecraft:the_nether',timestamp:'t4'}
 ];
 const m=verifyMilestones(e);
 assert.deepEqual(m.map(x=>x.id),['acquired_wood','acquired_planks','acquired_stone_or_better_tool','entered_nether']);
 assert.equal(m[0].evidence,'inventory_snapshot');
 assert.ok(!m.some(x=>x.id==='entered_end'));
});
test('invalid, empty and zero-count inventory cannot count',()=>{
 assert.deepEqual(verifyMilestones([{type:'inventory_snapshot',items:[{name:'oak_log',count:0},{name:'oak_planks',count:-1}]},{type:'minecraft_dimension',dimension:'unknown'}]),[]);
});
