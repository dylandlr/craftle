import test from 'node:test';
import assert from 'node:assert/strict';
import {makeVisualObservation,policyInput} from '../src/vision-observation.js';
test('accepts true RGB24 with frame identity and basic proprioception',()=>{
 const raw=new Uint8Array([255,0,0,0,255,0]);
 const o=makeVisualObservation({rgb:raw,width:2,height:1,frameId:3,capturedAt:'2026-10-21T12:00:00.000Z',health:20});
 raw[0]=0;
 assert.equal(o.rgb[0],255);
 assert.equal(o.source,'first_person_rgb');
 assert.deepEqual(Array.from(policyInput(o).rgb),[255,0,0,0,255,0]);
});
test('refuses invalid image buffers or malformed identity',()=>{
 const args={rgb:new Uint8Array(6),width:2,height:1,frameId:0,capturedAt:'2026-10-21T12:00:00.000Z'};
 assert.throws(()=>makeVisualObservation({...args,rgb:new Uint8Array(5)}),/RGB24/);
 assert.throws(()=>makeVisualObservation({...args,frameId:-1}),/frameId/);
 assert.throws(()=>makeVisualObservation({...args,capturedAt:'not-a-date'}),/capturedAt/);
});
test('rejects privileged observation masquerading as a frame',()=>{
 assert.throws(()=>policyInput({source:'block_state',blocks:[1,2]}),/RGB/);
 const o=makeVisualObservation({rgb:new Uint8Array(3),width:1,height:1,frameId:2,capturedAt:'2026-10-21T12:00:00.000Z'});
 const suspicious={...o,blocks:[{name:'diamond_ore'}],world:{secret:7}};
 assert.deepEqual(Object.keys(policyInput(suspicious)).sort(),['capturedAt','frameId','height','proprioception','rgb','width']);
});
