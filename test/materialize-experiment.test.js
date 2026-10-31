import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('materializes isolated spec without launching any process',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-spec-'));
 try{
  const plan=path.join(dir,'plan.json'),root=path.join(dir,'root');
  fs.writeFileSync(plan,JSON.stringify({schema:'craftle.experiment-plan.v1',runs:[{runId:'trial_17',profile:'tabula_rasa',worldSeed:'17',trainingSeed:17,trainingBudgetDecisions:10000,isolatedWorld:'worlds/trial_17',isolatedState:'state/trial_17',phase:'planned'}]}));
  const run=()=>spawnSync(process.execPath,['scripts/materialize-experiment.js',plan,root,'trial_17'],{encoding:'utf8'});
  const p=run();assert.equal(p.status,0,p.stderr);
  const spec=JSON.parse(fs.readFileSync(path.join(root,'specs/trial_17/spec.json')));
  assert.equal(spec.status,'unlaunched');
  assert.equal(spec.config.hostPortPublished,false);
  assert.equal(fs.existsSync(spec.worldDir),false);
  assert.equal(fs.existsSync(spec.stateDir),false);
  assert.notEqual(run().status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
