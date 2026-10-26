import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {eventAnnotation,readEventAnnotations} from '../src/spectator-annotations.js';
import {spectatorHtml} from '../src/spectator-monitor.js';
test('annotations label attempts without fabricating world coordinates',()=>{
 const e=eventAnnotation({timestamp:'2026-10-26T00:00:00Z',type:'target_attack_attempt',targetId:'entity:3',decisionId:9});
 assert.equal(e.label,'Punched / attack attempted');
 assert.equal(e.position,null);
 assert.equal(e.provenance,'agent_attempt_or_intent');
 assert.equal(e.targetId,'entity:3');
 assert.equal(eventAnnotation({timestamp:'bad',type:'target_attack_attempt'}),null);
});
test('bounded log projection excludes arbitrary events and allows notebook JSON',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-ann-'));
 try{
  fs.mkdirSync(path.join(dir,'continuous'));
  const logs=[
   {timestamp:'2026-10-26T00:00:00Z',type:'target_decision',action:'attack_0'},
   {timestamp:'2026-10-26T00:00:01Z',type:'target_attack_attempt',targetId:'entity:4'},
   {timestamp:'2026-10-26T00:00:02Z',type:'health',health:20}
  ];
  fs.writeFileSync(path.join(dir,'continuous','agent.log'),logs.map(x=>JSON.stringify(x)).join('\n')+'\n');
  const projected=readEventAnnotations(dir);
  assert.equal(projected.length,2);
  assert.equal(projected[0].action,'attack_0');
  assert.equal(projected[1].symbol,'⚔');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('monitor annotates stock iframe externally, without WebGL patching',()=>{
 const html=spectatorHtml();
 assert.match(html,/api\/annotations/);
 assert.match(html,/Observed gameplay events/);
 assert.match(html,/createTextNode/);
});
