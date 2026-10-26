import test from 'node:test';
import assert from 'node:assert/strict';
import {directorShot,smoothDirectorPose} from '../src/spectator-director.js';
import {parseAgentTelemetry} from '../src/spectator-telemetry.js';

test('drone shot trails agent, zooms for interactions and infers actual jump',()=>{
 const rear=directorShot({position:{x:0,y:64,z:0},yaw:0,velocity:{x:0,y:0,z:-2},onGround:true});
 assert.ok(rear.camera.z>rear.target.z);
 assert.equal(rear.animation,'walk');
 const jump=directorShot({position:{x:0,y:65,z:0},yaw:0,velocity:{x:0,y:0.4,z:0},onGround:false,action:'attack'});
 assert.equal(jump.animation,'jump');
 assert.equal(jump.zoomIntent,'close');
 assert.ok(jump.distance<rear.distance);
 const blended=smoothDirectorPose(rear,jump,0.5);
 assert.equal(blended.camera.x,(rear.camera.x+jump.camera.x)/2);
 assert.equal(directorShot({position:{x:NaN,y:0,z:0}}),null);
});

test('spectator decodes real effect reports without claiming audio playback',()=>{
 const at=new Date().toISOString();
 const lines=[
  {timestamp:at,agent:'Turesla',type:'spectator_effect',kind:'motion',position:{x:1,y:67,z:2},velocity:{x:0,y:0.5,z:0},yaw:0,onGround:false},
  {timestamp:at,agent:'Turesla',type:'spectator_effect',kind:'sound',name:'entity.player.hurt'},
  {timestamp:at,agent:'Turesla',type:'spectator_effect',kind:'particle',name:'minecraft:crit'},
 ].map(e=>JSON.stringify(e));
 const a=parseAgentTelemetry(lines);
 assert.equal(a.shot.animation,'jump');
 assert.deepEqual(a.effects.map(e=>e.kind),['sound','particle']);
 assert.equal('audioPlayback' in a,false);
});

test('live director API exposes read-only pose without mutating world',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const {startSpectatorMonitor}=await import('../src/spectator-monitor.js');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-director-api-'));
 const dir=path.join(root,'continuous');fs.mkdirSync(dir,{recursive:true});
 const at=new Date().toISOString();
 fs.writeFileSync(path.join(dir,'agent.log'),JSON.stringify({timestamp:at,agent:'Turesla',agent_id:'agent_001',type:'spectator_effect',kind:'motion',position:{x:10,y:64,z:10},yaw:0,velocity:{x:0,y:0,z:-1},onGround:true})+'\n');
 const server=startSpectatorMonitor({port:0,host:'127.0.0.1',cameraPort:1,telemetryRoot:root});
 await new Promise(resolve=>server.once('listening',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/api/director';
  const response=await fetch(url);assert.equal(response.status,200);
  const pose=await response.json();
  assert.equal(pose.available,true);assert.equal(pose.control,'read_only');
  assert.equal(pose.renderApplied,false);assert.equal(pose.agentId,'agent_001');
  assert.ok(pose.camera.z>pose.target.z);
  const denied=await fetch(url,{method:'POST'});assert.equal(denied.status,405);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  fs.rmSync(root,{force:true,recursive:true});
 }
});

test('director event stream emits well-formed read-only event and closes',async()=>{
 const {startSpectatorMonitor}=await import('../src/spectator-monitor.js');
 const server=startSpectatorMonitor({host:'127.0.0.1',port:0,cameraPort:1});
 await new Promise(resolve=>server.once('listening',resolve));
 const controller=new AbortController();
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/director/stream',{signal:controller.signal});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const {value}=await response.body.getReader().read();
  const frame=new TextDecoder().decode(value);
  assert.match(frame,/event: director\ndata: /);
  const line=frame.split('\n').find(line=>line.startsWith('data: '));
  const data=JSON.parse(line.slice(6));
  assert.equal(data.control,'read_only');
  assert.equal(data.renderApplied,false);
  assert.equal(data.available,false);
 }finally{controller.abort();await new Promise(resolve=>server.close(resolve));}
});
