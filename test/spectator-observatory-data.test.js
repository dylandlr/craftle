import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readObservatoryEvents} from '../src/spectator-observatory-data.js';

test('returns only allowed diagnostic events from an agent JSONL log',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-observatory-'));
 try{
  const folder=path.join(dir,'continuous');fs.mkdirSync(folder,{recursive:true});
  const lines=[
   {timestamp:'2026-10-26T12:00:00Z',type:'target_decision',action:'explore'},
   {timestamp:'2026-10-26T12:00:01Z',type:'minecraft_text_observed',message:'private'},
   {timestamp:'2026-10-26T12:00:02Z',type:'spectator_density_audit',occupancyRatio:.53},
   {timestamp:'2026-10-26T12:00:03Z',type:'target_navigation_stall',stalls:3}
  ];
  fs.writeFileSync(path.join(folder,'agent.log'),lines.map(x=>JSON.stringify(x)).join('\n')+'\n');
  const events=readObservatoryEvents(dir);
  assert.deepEqual(events.map(x=>x.type),['target_decision','spectator_density_audit','target_navigation_stall']);
  assert.deepEqual(readObservatoryEvents(dir,{limit:1}).map(x=>x.type),['target_navigation_stall']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('missing agent log is represented by empty events',()=>{
 assert.deepEqual(readObservatoryEvents(path.join(os.tmpdir(),'no-such-craftle-observatory-xyz')) ,[]);
});
