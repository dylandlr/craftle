import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {verifyPredecessor,writeLineage} from '../scripts/checkpoint-lineage.js';
const prefix='craftle-options-v3-structured7-assisted4-commit4-audited-v1-';
test('signed lineage binds the cache-run identifier and exact checkpoint bytes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-lineage-'));try{
 const checkpoint=path.join(dir,'policy.json'),metadata=path.join(dir,'lineage.json');
 fs.writeFileSync(checkpoint,JSON.stringify({updates:500,trainingState:{replay:[]}}));
 writeLineage({checkpoint,metadata,runId:'900',runAttempt:1});
 assert.equal(verifyPredecessor({checkpoint,metadata,cacheKey:prefix+'900-1',currentRunId:'901'}).updates,500);
 assert.throws(()=>verifyPredecessor({checkpoint,metadata,cacheKey:prefix+'902-1',currentRunId:'901'}),/mismatch/);
 fs.appendFileSync(checkpoint,' ');assert.throws(()=>verifyPredecessor({checkpoint,metadata,cacheKey:prefix+'900-1',currentRunId:'901'}),/mismatch/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('no checkpoint is an explicitly marked cold start',()=>{
 assert.deepEqual(verifyPredecessor({checkpoint:'/definitely/nonexistent/craftle.json',cacheKey:'',currentRunId:'3'}),{coldStart:true,predecessor:null});
});
