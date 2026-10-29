import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectAgentExitLog,classifyAgentExit} from '../src/continuous-agent-recovery.js';
const now=Date.parse('2026-10-28T21:12:05.500Z');
const event=(type,message,time=now)=>({type,message,timestamp:new Date(time).toISOString()});
test('recognizes outage without counting server failure as a model crash',()=>{
 assert.equal(classifyAgentExit({lastEvent:null,serverReady:false,now}),'minecraft_unreachable');
 assert.equal(classifyAgentExit({lastEvent:event('error','connect ECONNREFUSED minecraft:25565'),serverReady:true,now}),'minecraft_connectivity');
 assert.equal(classifyAgentExit({lastEvent:event('disconnected'),serverReady:true,now}),'minecraft_disconnected');
});
test('does not classify stale disconnects as transient',()=>{
 assert.equal(classifyAgentExit({lastEvent:event('disconnected',null,now-60000),serverReady:true,now}),'unexpected_agent_exit');
 assert.equal(classifyAgentExit({lastEvent:event('error','unrelated failure'),serverReady:true,now}),'unexpected_agent_exit');
});
test('bounded tail parser handles large prefixes and last network error',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-exit-'));
 try{
  const log=path.join(root,'agent.log');
  fs.writeFileSync(log,'padding'.repeat(14000)+'\n'+JSON.stringify(event('error','connect ECONNREFUSED minecraft:25565'))+'\n');
  assert.equal(inspectAgentExitLog(log)?.type,'error');
  assert.equal(inspectAgentExitLog(path.join(root,'missing.log')),null);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
