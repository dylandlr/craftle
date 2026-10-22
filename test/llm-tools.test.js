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
