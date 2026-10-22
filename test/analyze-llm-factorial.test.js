import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('factorial analysis pairs identical seeds and reports missing runs',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-analysis-'));
 try{
  const manifest={trials:[{id:'seed_10__agent_001',seed:10,agentId:'agent_001',condition:'baseline'},{id:'seed_10__agent_002',seed:10,agentId:'agent_002',condition:'foveal'},{id:'seed_11__agent_001',seed:11,agentId:'agent_001',condition:'baseline'}]};
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest));
  for(const [id,agentId,actions,moved] of [['seed_10__agent_001','agent_001',2,1],['seed_10__agent_002','agent_002',5,3]]){
    const dir=path.join(root,'runs',id);fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'trial.json'),JSON.stringify({status:'completed',seed:10,agentId}));
    fs.writeFileSync(path.join(dir,'episode-report.json'),JSON.stringify({appliedActions:actions,measuredEffects:{moved},deaths:0}));
  }
  const output=execFileSync('node',['scripts/analyze-llm-factorial.js',path.join(root,'manifest.json'),path.join(root,'runs')],{encoding:'utf8'});
  const report=JSON.parse(output);
  assert.equal(report.completed,2);assert.equal(report.missing,1);assert.equal(report.pairedComparisons,1);
  assert.equal(report.conditions[0].meanDeltaActions,3);
  assert.equal(report.conditions[0].meanDeltaMovementEvents,2);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
