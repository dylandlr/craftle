import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {probeMinecraft} from '../src/continuous-agent-recovery.js';

test('probeMinecraft detects an accepting local TCP listener',async()=>{
 const server=net.createServer(socket=>socket.end());
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 try{
  const port=server.address().port;
  assert.equal(await probeMinecraft({host:'127.0.0.1',port,timeoutMs:500}),true);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('probeMinecraft returns false for a port with no listener',async()=>{
 const server=net.createServer();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 assert.equal(await probeMinecraft({host:'127.0.0.1',port,timeoutMs:500}),false);
});

test('probeMinecraft handles DNS failure without crashing the supervisor',async()=>{
 assert.equal(await probeMinecraft({host:'does-not-exist.invalid',port:25565,timeoutMs:500}),false);
});
