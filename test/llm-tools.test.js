import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLlmAction,validateLlmAction} from '../src/llm-tools.js';
import {parseAgentDecision} from '../src/llm-agent.js';
const decision=action=>JSON.stringify({action,goal:'explore',belief:'looks like stone',plan:'test',memory:''});
test('LLM accepts mining but rejects arbitrary code/tools',()=>{
 assert.equal(parseAgentDecision(decision('mine')).action,'mine');
 assert.throws(()=>parseAgentDecision(decision('run_shell')),/action/);
 assert.throws(()=>validateLlmAction('inspect_world_chunks'),/Unsupported/);
});
test('mine resolves only crosshair target, no target returns failure',async()=>{
 const bot={entity:{},clearControlStates(){},blockAtCursor:()=>null};
 assert.deepEqual(await executeLlmAction(bot,'mine'),{action:'mine',success:false,detail:'nothing_under_crosshair'});
});
test('mine uses targeted block solely at execution layer',async()=>{
 const target={name:'stone'};let used,stopped=false;
 const bot={entity:{},clearControlStates(){},blockAtCursor:r=>{assert.equal(r,4.5);return target;},canDigBlock:()=>true,dig:async block=>{used=block;},stopDigging:()=>{stopped=true;}};
 assert.equal((await executeLlmAction(bot,'mine')).success,true);
 assert.equal(used,target);assert.equal(stopped,true);
});
test('use and attack dispatch bounded embodied controls',async()=>{
 let used=0,attacked=0;
 const bot={entity:{},clearControlStates(){},activateItem(){used++;},entityAtCursor:()=>({id:3}),attack(){attacked++;}};
 assert.equal((await executeLlmAction(bot,'use')).success,true);
 assert.equal((await executeLlmAction(bot,'attack')).success,true);
 assert.equal(used,1);assert.equal(attacked,1);
});

test('craft accepts a named target and executes only inventory recipe',async()=>{
 let requested,calls=0;
 const bot={entity:{},clearControlStates(){},registry:{itemsByName:{oak_planks:{id:5}}},recipesFor:(id,meta,count,table)=>{requested=[id,meta,count,table];return [{result:'planks'}];},craft:async(recipe,count,table)=>{calls++;assert.equal(recipe.result,'planks');assert.equal(count,1);assert.equal(table,null);}};
 assert.equal((await executeLlmAction(bot,'craft',{target:'oak_planks'})).success,true);
 assert.deepEqual(requested,[5,null,1,null]);assert.equal(calls,1);
 assert.equal((await executeLlmAction(bot,'craft',{target:'invalid/item'})).success,false);
});
test('equip requires owned inventory item',async()=>{
 let equipped;
 const bot={entity:{},clearControlStates(){},inventory:{items:()=>[{name:'stone_axe'}]},equip:async(item,hand)=>{equipped=[item.name,hand];}};
 assert.equal((await executeLlmAction(bot,'equip',{target:'stone_axe'})).success,true);
 assert.deepEqual(equipped,['stone_axe','hand']);
 assert.equal((await executeLlmAction(bot,'equip',{target:'diamond_sword'})).success,false);
});
