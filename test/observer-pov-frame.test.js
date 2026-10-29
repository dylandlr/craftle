import test from 'node:test';
import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import {createObserverPovFrameCache} from '../src/observer-pov-frame.js';

const frame=()=>jpeg.encode({data:Buffer.alloc(16,255),width:2,height:2},80).data;
test('observer only publishes fresh, actual JPEG bytes',()=>{
 const cache=createObserverPovFrameCache({maxAgeMs:200});
 const bytes=frame();
 assert.equal(cache.ingest(bytes,1000),true);
 assert.equal(cache.status(1100).source,'tcp_jpeg_frame');
 assert.deepEqual(cache.get(1100).bytes,bytes);
 assert.equal(cache.get(1201),null);
 assert.equal(cache.status(1201).available,false);
 assert.equal(cache.status(900).available,false);
});
test('observer rejects invalid or oversized images without replacing last valid frame',()=>{
 const cache=createObserverPovFrameCache({maxBytes:1024*1024});
 const bytes=frame();
 assert.equal(cache.ingest(bytes,1000),true);
 assert.equal(cache.ingest(Buffer.from('not a jpeg'),1001),false);
 assert.equal(cache.status(1100).frameId,0);
});
test('length-prefixed TCP frames flow into observer cache',()=>{
 const cache=createObserverPovFrameCache();
 const bytes=frame(),packet=Buffer.alloc(4+bytes.length);
 packet.writeUInt32LE(bytes.length,0);bytes.copy(packet,4);
 const parser=cache.parser();parser.push(packet.subarray(0,3));parser.push(packet.subarray(3));
 assert.deepEqual(cache.get().bytes,bytes);
});
