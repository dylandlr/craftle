import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('audits available food targets separately from chosen actions',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-target-audit-'));
 try{
  const file=path.join(dir,'log');
  const lines=[
   {timestamp:'2026-10-30T00:00:00Z',type:'target_decision',skill:'explore',features:[1,0,0,0,0,1],mask:[false,true,false,true],targets:[{kind:'plant',reachable:false}]},
   {timestamp:'2026-10-30T00:00:02Z',type:'target_decision',skill:'retreat',features:[1,0,0,0,0,.2],mask:[false,true,true],targets:[]}
  ];
  fs.writeFileSync(file,lines.map(JSON.stringify).join('\n'));
  const p=spawnSync(process.execPath,['scripts/report-target-opportunities.js',file],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  const report=JSON.parse(p.stdout);
  assert.equal(report.counts.decisions,2);
  assert.equal(report.counts.withTargets,1);
  assert.equal(report.counts.withApproachOption,1);
  assert.equal(report.counts.withHarvestablePlant,0);
  assert.equal(report.counts.targetPresentExplore,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
