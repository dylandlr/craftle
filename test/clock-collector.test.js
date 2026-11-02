import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';

function packet(id,type,text){
 const payload=Buffer.from(text+'\0\0'),result=Buffer.alloc(payload.length+12);
 result.writeInt32LE(result.length-4);result.writeInt32LE(id,4);result.writeInt32LE(type,8);payload.copy(result,12);
 return result;
}

test('collector logs failures as barriers and fresh sessions on restart using read-only RCON', {timeout:15000}, async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-clock-'));
 const output=path.join(root,'clock.jsonl'),password=path.join(root,'password');
 fs.writeFileSync(password,'test-only-password');
 const sockets=new Set(),commands=[];
 let replies=0;
 const server=net.createServer(socket=>{
  sockets.add(socket);socket.once('close',()=>sockets.delete(socket));
  let bytes=Buffer.alloc(0);
  socket.on('data',chunk=>{
   bytes=Buffer.concat([bytes,chunk]);
   while(bytes.length>=4 && bytes.length>=bytes.readInt32LE(0)+4){
    const length=bytes.readInt32LE(0),id=bytes.readInt32LE(4),type=bytes.readInt32LE(8);
    const body=bytes.subarray(12,length+2).toString();
    bytes=bytes.subarray(length+4);
    if(type===3)socket.write(packet(id,2,''));
    else {commands.push(body);socket.write(packet(id,0,replies++===0?'invalid clock reply':'The time is 123'));}
   }
  });
 });
 const children=[];
 t.after(async()=>{
  for(const child of children)if(child.exitCode===null && child.signalCode===null){child.kill();await once(child,'exit');}
  for(const socket of sockets)socket.destroy();
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  fs.rmSync(root,{recursive:true,force:true});
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const start=()=>{
  const child=spawn(process.execPath,['scripts/collect-server-clock.js'],{env:{...process.env,
   CRAFTLE_RCON_HOST:'127.0.0.1',CRAFTLE_RCON_PORT:String(server.address().port),
   CRAFTLE_RCON_PASSWORD_FILE:password,CRAFTLE_CLOCK_OUTPUT:output,CRAFTLE_CLOCK_INTERVAL_MS:'1000'},stdio:'ignore'});
  children.push(child);return child;
 };
 const read=()=>fs.existsSync(output)?fs.readFileSync(output,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 const waitFor=async n=>{
  for(let i=0;i<200;i++){const entries=read();if(entries.length>=n)return entries;await delay(25);}
  assert.fail('Mock collector did not produce expected records');
 };
 const first=start();
 const initial=await waitFor(2);
 assert.equal(initial[0].type,'server_clock_error');assert.equal(initial[1].type,'server_clock_sample');
 assert.equal(initial[0].collectorSessionId,initial[1].collectorSessionId);
 assert.equal(initial[1].sampleSequence,1);
 assert.ok(initial[1].requestedAt<=initial[1].completedAt);
 first.kill();await once(first,'exit');
 const priorCount=read().length;
 start();
 const latest=(await waitFor(priorCount+1)).at(-1);
 assert.notEqual(latest.collectorSessionId,initial[1].collectorSessionId);
 assert.equal(latest.sampleSequence,1);
 assert.ok(commands.length>=3);assert.ok(commands.every(x=>x==='time query gametime'));
});
