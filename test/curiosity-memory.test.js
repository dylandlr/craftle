import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createCuriosityMemory} from '../src/curiosity-memory.js';
test('novel concepts are recorded only once and remain unknown without evidence',()=>{
 const events=[],m=createCuriosityMemory({log:e=>events.push(e)});
 m.observe({position:{x:0,y:64,z:0},blocks:[{name:'stone'},{name:'stone'},{name:'air'}]});
 m.observe({position:{x:0,y:64,z:0},blocks:[{name:'stone'}]});
 assert.equal(events.filter(x=>x.type==='curiosity_new_concept').length,1);
 assert.equal(m.snapshot().concepts['block:stone'].encounters,2);
 assert.equal(m.snapshot().concepts['block:stone'].knowledge,'uninvestigated');
});
test('known outcomes persist only with recorded interaction',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-curiosity-')),file=path.join(dir,'memory.json');
 try{
  const m=createCuriosityMemory({file,worldId:'w',agentId:'a'});
  m.observe({blocks:[{name:'oak_log'}]});
  assert.equal(m.recordOutcome({kind:'block',name:'oak_log',action:'break',outcome:'inventory_change'}),true);
  assert.equal(m.save(true),true);
  const next=createCuriosityMemory({file,worldId:'w',agentId:'a'});
  assert.equal(next.snapshot().concepts['block:oak_log'].outcomes.length,1);
  assert.equal(createCuriosityMemory({file,worldId:'different',agentId:'a'}).snapshot().encounters,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
