import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('paired-seed plan gives isolated state and world for each treatment',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-plan-'));
 try{
  const file=path.join(dir,'plan.json');
  const result=spawnSync(process.execPath,['scripts/plan-experiments.js',file,'17,23'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const plan=JSON.parse(fs.readFileSync(file));
  assert.equal(plan.runs.length,10);
  assert.equal(new Set(plan.runs.map(x=>x.isolatedWorld)).size,10);
  assert.equal(new Set(plan.runs.map(x=>x.isolatedState)).size,10);
  assert.equal(plan.constraints.instinctIntegrationRequired,true);
  const second=spawnSync(process.execPath,['scripts/plan-experiments.js',file],{encoding:'utf8'});
  assert.notEqual(second.status,0,'never overwrite a plan');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('normalization does not invent durations',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-compare-'));
 try{
  fs.mkdirSync(path.join(dir,'one'));
  fs.writeFileSync(path.join(dir,'one','run.json'),JSON.stringify({configuration:{runId:'one',instinctProfile:'tabula_rasa',trainingSeed:17,worldSeed:'17',policy:'dqn',checkpointSha256:'abc'},metrics:{decisions:100,deaths:2,successfulEats:1,discoveredCells:4,meanReward:-0.1}}));
  const result=spawnSync(process.execPath,['scripts/compare-normalized.js',dir],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const row=JSON.parse(result.stdout).results[0];
  assert.equal(row.deathsPerHour,null);assert.equal(row.eatingPerThousandDecisions,10);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
