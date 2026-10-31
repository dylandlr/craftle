import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('experiment preflight refuses to launch, even for isolated plan',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-preflight-'));
 try {
  const file=path.join(temp,'plan.json');
  fs.writeFileSync(file,JSON.stringify({schema:'craftle.experiment-plan.v1',runs:[{runId:'one',profile:'tabula_rasa',trainingSeed:17,trainingBudgetDecisions:10000,isolatedWorld:'worlds/one',isolatedState:'states/one',phase:'planned'}]}));
  const p=spawnSync(process.execPath,['scripts/preflight-experiments.js',file,path.join(temp,'runs')],{encoding:'utf8'});
  assert.equal(p.status,2,p.stderr);
  const result=JSON.parse(p.stdout);
  assert.equal(result.ready,false);
  assert.equal(result.failures.length,1);
  assert.equal(fs.existsSync(path.join(temp,'runs')),false);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('preflight rejects traversal paths',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-preflight-bad-'));
 try{
  const file=path.join(temp,'plan.json');
  fs.writeFileSync(file,JSON.stringify({schema:'craftle.experiment-plan.v1',runs:[{runId:'one',profile:'tabula_rasa',trainingSeed:17,trainingBudgetDecisions:100,isolatedWorld:'../filming',isolatedState:'states/one',phase:'planned'}]}));
  const p=spawnSync(process.execPath,['scripts/preflight-experiments.js',file,path.join(temp,'runs')],{encoding:'utf8'});
  assert.equal(p.status,1,p.stderr);
  assert.match(p.stdout,/unsafe isolatedWorld/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
