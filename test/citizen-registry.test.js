import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateCitizenRoster,provisionCitizenRoster,readCitizenRoster} from '../src/citizen-registry.js';
test('roster generates distinct stable citizens and preserves appearance across restart',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-citizens-'));
 try{
  const members=[{id:'agent_001',name:'Turesla'},{id:'agent_002',name:'Citizen2'}];
  const one=provisionCitizenRoster(dir,members,{worldSeed:'test',renderSkin:()=>Buffer.from('skin')});
  const profile=fs.readFileSync(path.join(dir,'citizens','agent_001.json'),'utf8');
  const two=provisionCitizenRoster(dir,members,{worldSeed:'changed',renderSkin:()=>Buffer.from('new')});
  assert.deepEqual(one,two);
  assert.deepEqual(readCitizenRoster(dir),members);
  assert.equal(fs.readFileSync(path.join(dir,'citizens','agent_001.json'),'utf8'),profile);
  assert.equal(fs.readFileSync(path.join(dir,'citizens','agent_001.png'),'utf8'),'skin');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('reject duplicate usernames and unsafe identifiers',()=>{
 assert.throws(()=>validateCitizenRoster([{id:'one',name:'A'},{id:'two',name:'a'}]),/Duplicate/);
 assert.throws(()=>validateCitizenRoster([{id:'../x',name:'x'}]),/Invalid/);
});
