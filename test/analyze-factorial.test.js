import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('matched-seed analyzer does not invent results for absent trials',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-factorial-'));
 try{
  const manifest={trials:[
   {id:'seed_7__agent_001',seed:7,agentId:'agent_001',condition:'baseline'},
   {id:'seed_7__agent_002',seed:7,agentId:'agent_002',condition:'foveatedVision'},
   {id:'seed_8__agent_001',seed:8,agentId:'agent_001',condition:'baseline'}
  ]};
  fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(manifest));
  for(const [id,agentId,moved] of [['seed_7__agent_001','agent_001',2],['seed_7__agent_002','agent_002',5]]){
    const dir=path.join(temp,id);fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir,'trial.json'),JSON.stringify({trialId:id,seed:7,agentId,status:'completed'}));
    fs.writeFileSync(path.join(dir,'episode-report.json'),JSON.stringify({appliedActions:10,deaths:0,measuredEffects:{moved},minecraftMilestonesVerified:agentId==='agent_002'?[{id:'acquired_wood',evidence:'inventory_snapshot'}]:[]}));
  }
  const output=path.join(temp,'summary.json');
  execFileSync('node',['scripts/analyze-factorial.js','--manifest',path.join(temp,'manifest.json'),'--root',temp,'--output',output]);
  const report=JSON.parse(fs.readFileSync(output));
  assert.equal(report.completed,2);assert.deepEqual(report.missing,['seed_8__agent_001']);
  assert.equal(report.paired.length,1);assert.equal(report.paired[0].deltaMoved,3);
  assert.deepEqual(report.paired[0].gainedMilestones,['acquired_wood']);
  assert.equal(report.comparisons[0].milestoneGains,1);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
