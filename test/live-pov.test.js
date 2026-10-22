import test from 'node:test';
import assert from 'node:assert/strict';
import {JpegFrameParser,startLiveObservationServer} from '../src/live-pov.js';
import net from 'node:net';
import jpeg from 'jpeg-js';
test('parses fragmented and multiple length-prefixed JPEG payloads',()=>{
 const frames=[];
 const parser=new JpegFrameParser(x=>frames.push(Buffer.from(x)));
 const packet=s=>{const b=Buffer.from(s);const p=Buffer.alloc(4+b.length);p.writeUInt32LE(b.length,0);b.copy(p,4);return p;};
 const combined=Buffer.concat([packet('one'),packet('two')]);
 parser.push(combined.subarray(0,3));
 parser.push(combined.subarray(3,8));
 parser.push(combined.subarray(8));
 assert.deepEqual(frames.map(x=>x.toString()),['one','two']);
});
test('rejects oversized JPEG payloads',()=>{
 const parser=new JpegFrameParser(()=>{},{maxBytes:10});
 const header=Buffer.alloc(4);header.writeUInt32LE(20);
 assert.throws(()=>parser.push(header),/length/);
});
test('live TCP stream decodes JPEG to first-person RGB without world state',async()=>{
 const observed=[];
 const server=await startLiveObservationServer({width:2,height:2,onObservation:o=>observed.push(o)});
 try{
   const data=Buffer.from([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
   const encoded=jpeg.encode({data,width:2,height:2},90).data;
   const packet=Buffer.alloc(4+encoded.length);packet.writeUInt32LE(encoded.length,0);encoded.copy(packet,4);
   await new Promise((resolve,reject)=>{
     const client=net.connect(server.port,server.host,()=>{client.write(packet);client.end();});
     client.on('end',resolve);client.on('error',reject);
   });
   assert.equal(observed.length,1);
   assert.equal(observed[0].source,'first_person_rgb');
   assert.equal(observed[0].rgb.length,12);
   assert.equal(observed[0].frameId,0);
   assert.equal(observed[0].world,undefined);
 }finally{await server.close();}
});
