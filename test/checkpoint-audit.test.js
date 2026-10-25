import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureIncoming,auditCheckpoint} from '../scripts/audit-option-checkpoint.js';
import {createLearningOptionController} from '../src/learning-options.js';

function fixture(run){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-lineage-'));
 try{run(path.join(directory,'policy.json'));}finally{fs.rmSync(directory,{recursive:true,force:true});}
}
function episode(checkpoint,{death=false}={}){
 const incoming=captureIncoming(checkpoint),events=[];
 const ctl=createLearningOptionController({checkpoint,rewardVersion:'v3',commitmentSteps:4,seed:7,log:e=>events.push(e)});
 for(let i=0;i<9;i++)ctl.choose({health:20,food:20,foodAvailable:false,hostileDistance:Infinity,inventoryCount:0,blocked:false,displacement:1,position:{x:i*4,z:0}});
 if(death){ctl.terminal();ctl.terminal();}
 ctl.stop();return {incoming,events};
}
test('two actual training episodes resume weights and audit only each episode update delta',()=>fixture(checkpoint=>{
 let run=episode(checkpoint),report=auditCheckpoint(checkpoint,run.events,run.incoming);
 assert.equal(report.coldStart,true);assert.equal(report.episodeUpdates,8);assert.equal(report.outgoing.updates,8);
 const previousHash=report.outgoing.sha256;
 run=episode(checkpoint,{death:true});report=auditCheckpoint(checkpoint,run.events,run.incoming);
 assert.equal(report.coldStart,false);assert.equal(report.incoming.sha256,previousHash);
 assert.equal(report.incoming.updates,8);assert.equal(report.episodeUpdates,12);assert.equal(report.outgoing.updates,20);
 assert.equal(report.terminals,1);assert.equal(report.transitions,2);
}));
test('missing or extra updates and corrupt restored checkpoints cannot pass',()=>fixture(checkpoint=>{
 const run=episode(checkpoint);
 const lastTransition=run.events.findLastIndex(e=>e.type==='option_transition');
 assert.throws(()=>auditCheckpoint(checkpoint,run.events.filter((_,i)=>i!==lastTransition),run.incoming),/delta/);
 const checkpointData=JSON.parse(fs.readFileSync(checkpoint,'utf8'));
 checkpointData.updates+=4;fs.writeFileSync(checkpoint,JSON.stringify(checkpointData));
 assert.throws(()=>auditCheckpoint(checkpoint,run.events,run.incoming),/delta/);
 checkpointData.updates=-1;fs.writeFileSync(checkpoint,JSON.stringify(checkpointData));
 assert.throws(()=>captureIncoming(checkpoint),/update count/);
 checkpointData.updates=0;checkpointData.w[0][0]=null;fs.writeFileSync(checkpoint,JSON.stringify(checkpointData));
 assert.throws(()=>captureIncoming(checkpoint),/weights/);
}));
test('valid weights alone cannot pass absent or mismatched episode evidence',()=>fixture(checkpoint=>{
 const run=episode(checkpoint);
 assert.throws(()=>auditCheckpoint(checkpoint,[],run.incoming),/decision contract/);
 assert.throws(()=>auditCheckpoint(checkpoint,run.events.map(e=>e.type==='option_decision'?{...e,rewardVersion:'v1'}:e),run.incoming),/decision contract/);
 assert.throws(()=>auditCheckpoint(checkpoint,run.events.map(e=>e.type==='option_transition'?{...e,updates:999}:e),run.incoming),/lineage/);
 assert.throws(()=>auditCheckpoint(checkpoint,run.events,{...run.incoming,coldStart:false}),/cold-start/);
}));
