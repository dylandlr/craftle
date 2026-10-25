import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {preparePersistentSession,promotePersistentSession} from '../src/persistent-session.js';
import {createTargetedController} from '../src/targeted-controller.js';
const observation={health:20,food:20,foodAvailable:false,foodUnits:0,foodPoints:0,hostileDistance:24,blocked:false,displacement:1,position:{x:0,y:64,z:0},targets:[]};
function fixture(run){const root=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-persistent-'));try{run(root);}finally{fs.rmSync(root,{recursive:true,force:true});}}
function train(session){const events=[];const ctl=createTargetedController({checkpoint:session.candidate,log:e=>events.push(e)});ctl.choose(observation);ctl.choose(observation);ctl.stop();events.push({type:'shutdown'});return events;}
test('successive persistent sessions load and promote the accepted model with correct lineage',()=>fixture(root=>{
 const first=preparePersistentSession(root);assert.equal(first.incoming,null);
 const a=promotePersistentSession(first,train(first),{exitCode:0,videoValid:true});assert.equal(a.outgoing.updates,4);
 const second=preparePersistentSession(root);assert.notEqual(first.directory,second.directory);assert.equal(second.incoming.sha256,a.outgoing.sha256);
 const b=promotePersistentSession(second,train(second),{exitCode:0,videoValid:true});assert.equal(b.episodeUpdates,4);assert.equal(b.outgoing.updates,8);
}));
test('failed recording, runtime errors and changed checkpoint lineage preserve the accepted model',()=>fixture(root=>{
 const first=preparePersistentSession(root);promotePersistentSession(first,train(first),{exitCode:0,videoValid:true});
 const before=fs.readFileSync(first.checkpoint,'utf8'),next=preparePersistentSession(root),events=train(next);
 assert.throws(()=>promotePersistentSession(next,events,{exitCode:0,videoValid:false}),/recording failed/);
 assert.throws(()=>promotePersistentSession(next,[...events,{type:'target_runtime_error'}],{exitCode:0,videoValid:true}),/invalid agent/);
 assert.equal(fs.readFileSync(first.checkpoint,'utf8'),before);
 const later=preparePersistentSession(root);promotePersistentSession(later,train(later),{exitCode:0,videoValid:true});
 assert.throws(()=>promotePersistentSession(next,events,{exitCode:0,videoValid:true}),/changed during/);
}));
