import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('nine agents with exhaustive eight-way factorial and baseline replicate',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-config-'));
 try{
  execFileSync(process.execPath,[path.resolve('scripts/make-config.js')],{cwd:dir,stdio:'pipe'});
  const c=JSON.parse(fs.readFileSync(path.join(dir,'config.json'),'utf8'));
  assert.equal(c.agents.length,9);
  assert.equal(new Set(c.agents.map(a=>a.name)).size,9);
  assert.equal(new Set(c.agents.map(a=>a.id)).size,9);
  assert.equal(new Set(c.agents.slice(0,8).map(a=>JSON.stringify(a.cognition))).size,8);
  assert.deepEqual(c.agents[8].cognition,{foveatedVision:false,cognitiveMap:false,knowledgeGraph:false});
  assert.equal(c.agents[8].cohort,'baseline_replication');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
