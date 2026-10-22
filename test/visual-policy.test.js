import test from 'node:test';
import assert from 'node:assert/strict';
import {makeVisualObservation} from '../src/vision-observation.js';
import {evaluateVisualPolicy,applyVisualAction} from '../src/visual-policy.js';
const observation=()=>makeVisualObservation({rgb:new Uint8Array([1,2,3]),width:1,height:1,frameId:7,capturedAt:'2026-10-21T12:00:00Z'});
test('RGB agent acts on pixels without block queries',async()=>{
 const policy={predict:async input=>{assert.equal(input.rgb[0],1);assert.equal(input.blocks,undefined);return 'forward';}};
 const result=await evaluateVisualPolicy(policy,observation());
 assert.equal(result.action,'forward');assert.equal(result.frameId,7);
 const calls=[];const bot={clearControlStates:()=>calls.push('clear'),setControlState:(...args)=>calls.push(args)};
 applyVisualAction(bot,result.action);
 assert.deepEqual(calls,['clear',['forward',true]]);
});
test('rejects unsupported actions and privileged observations',async()=>{
 await assert.rejects(evaluateVisualPolicy({predict:()=> 'mine_diamond'},observation()),/Unsupported/);
 await assert.rejects(evaluateVisualPolicy({predict:()=> 'forward'},{source:'block_state',blocks:[]}),/RGB/);
});
test('rejects policy without inference interface',async()=>{await assert.rejects(evaluateVisualPolicy({},observation()),/predict/);});
