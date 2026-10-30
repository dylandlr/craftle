import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
test('survival report distinguishes exploration from verified achievements',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-survival-')),file=path.join(dir,'events.log');
 try{
  fs.writeFileSync(file,[
   {timestamp:'2026-10-30T00:00:00Z',type:'target_decision',skill:'explore'},
   {timestamp:'2026-10-30T00:00:01Z',type:'target_action',food:0,health:1},
   {timestamp:'2026-10-30T00:00:02Z',type:'target_transition',reward:0.2},
   {timestamp:'2026-10-30T00:00:03Z',type:'discovery_new_cell',cellKey:'overworld:0,0'}
  ].map(JSON.stringify).join('\n'));
  const result=spawnSync(process.execPath,['scripts/report-survival-progress.js',file],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.decisions,1);assert.equal(report.verified.hungerRecovery,0);
  assert.equal(report.foodEmptySamples,1);assert.equal(report.discoveredCells,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
