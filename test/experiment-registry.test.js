import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('register and compare runs without overwriting the baseline',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-exps-'));
 try{
  const registry=path.join(dir,'registry'),manifest=path.join(dir,'manifest.json'),report=path.join(dir,'report.json');
  fs.writeFileSync(manifest,JSON.stringify({runId:'control_001',agentId:'Turesla',worldSeed:'20261205',minecraftVersion:'1.21.1',
   instinctProfile:'tabula_rasa',policy:'targeted_dqn',observationSchema:'v1',actionSchema:'v1',
   rewardVersion:'v1',trainingSeed:17,checkpointSha256:'sha256-example'}));
  fs.writeFileSync(report,JSON.stringify({schema:'craftle.survival-progress-report.v1',decisions:100,
   actions:{explore:100},discoveredCells:5,verified:{deaths:2,eatEvents:0,observedInventoryGain:0},learning:{transitions:99,meanReward:-0.1}}));
  const run=()=>spawnSync(process.execPath,['scripts/register-experiment.js',registry,manifest,report],{encoding:'utf8'});
  assert.equal(run().status,0);assert.notEqual(run().status,0,'run ID must be immutable');
  const compare=spawnSync(process.execPath,['scripts/compare-experiments.js',registry],{encoding:'utf8'});
  assert.equal(compare.status,0,compare.stderr);
  const result=JSON.parse(compare.stdout);
  assert.equal(result.runs,1);assert.equal(result.results[0].deaths,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
