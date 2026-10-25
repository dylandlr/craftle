import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseAgentTelemetry,readAgentTelemetry} from '../src/spectator-telemetry.js';
import {startSpectatorMonitor} from '../src/spectator-monitor.js';

test('read-only inspector reads only bounded session events and flags stale telemetry',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-spectator-'));
  const session=path.join(root,'sessions','2026-10-25-session');
  fs.mkdirSync(session,{recursive:true});
  const stamp=new Date().toISOString();
  const events=[
    {timestamp:stamp,agent:'Turesla',agent_id:'agent_001',type:'pose_sample',position:{x:1,y:64,z:-2},yaw:0.5},
    {timestamp:stamp,agent:'Turesla',agent_id:'agent_001',type:'health',health:17,food:11},
    {timestamp:stamp,agent:'Turesla',agent_id:'agent_001',type:'target_decision',reward:2,secret:'not forwarded'},
  ];
  fs.writeFileSync(path.join(session,'agent.log'),events.map(e=>JSON.stringify(e)).join('\n')+'\n');
  const server=startSpectatorMonitor({host:'127.0.0.1',port:0,cameraPort:1,telemetryRoot:root});
  await new Promise(resolve=>server.once('listening',resolve));
  try{
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/agent');
    assert.equal(response.status,200);
    const json=await response.json();
    assert.equal(json.agent.name,'Turesla');
    assert.equal(json.agent.health,17);
    assert.deepEqual(json.agent.position,{x:1,y:64,z:-2});
    assert.equal(JSON.stringify(json).includes('secret'),false);
    assert.equal(parseAgentTelemetry(events.map(e=>JSON.stringify(e)),Date.now()+20000).stale,true);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(root,{recursive:true,force:true});
  }
});
