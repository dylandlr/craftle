import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createVisualDatasetWriter} from '../src/visual-dataset.js';
import {makeVisualObservation} from '../src/vision-observation.js';
test('datasets contain the exact RGB action pair and no privileged data',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-rgb-'));
 try{
   const writer=createVisualDatasetWriter(root);
   const observation={...makeVisualObservation({rgb:new Uint8Array([4,5,6]),width:1,height:1,frameId:3,capturedAt:'2026-10-22T01:00:00Z'}),blocks:['diamond']};
   const entry=writer.append(observation,'forward',{policy:'test'});
   assert.deepEqual([...fs.readFileSync(path.join(root,entry.image))],[4,5,6]);
   assert.equal(entry.observationSource,'first_person_rgb');
   assert.equal(entry.blocks,undefined);
   assert.throws(()=>writer.append(observation,'forward'),/increase/);
   assert.throws(()=>writer.append({...observation,frameId:4},'dig_secret'),/Unsupported/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
