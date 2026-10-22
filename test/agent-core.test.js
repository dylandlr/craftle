import test from 'node:test';
import assert from 'node:assert/strict';
import {AGENT_STAGES,validateAgent,stepAgent,createScriptedControl} from '../src/agent-core.js';
test('every treatment must support common agent lifecycle',()=>{assert.throws(()=>validateAgent({observe:()=>{}}),/updateBeliefs/);assert.equal(AGENT_STAGES.length,6);});
test('scripted control maintains beliefs and chooses recovery after repeated stalls',async()=>{
 const a=createScriptedControl();
 const input={danger:false,displacement:0,forwardBlocked:false,groundAhead:true};
 assert.equal((await stepAgent(a,input)).goal,'explore');
 const result=await stepAgent(a,input);
 assert.equal(result.goal,'recover');
 assert.equal(result.action.turn,true);
 assert.equal(a.state.steps,2);
});
test('scripted control prioritizes survival goal',async()=>{
 const a=createScriptedControl();
 assert.equal((await stepAgent(a,{danger:true,displacement:1,forwardBlocked:false,groundAhead:true})).goal,'survive');
});
