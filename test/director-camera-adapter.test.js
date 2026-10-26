import test from 'node:test';
import assert from 'node:assert/strict';
import {createDirectorCameraAdapter,connectDirectorStream} from '../src/director-camera-adapter.js';

test('in-renderer camera follows the server chase pose but never moves the bot',()=>{
 const calls=[],camera={position:{x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},
 lookAt(...args){calls.push(args);}};
 const viewer={camera};
 const adapter=createDirectorCameraAdapter(viewer,{smoothing:1});
 const observedAt=new Date().toISOString();
 assert.equal(adapter.accept({schema:'craftle.director-pose.v1',available:true,observedAt,
 camera:{x:2,y:70,z:8},target:{x:2,y:65,z:0}}),true);
 assert.equal(adapter.tick(),true);
 assert.deepEqual([camera.position.x,camera.position.y,camera.position.z],[2,70,8]);
 assert.deepEqual(calls.at(-1),[2,65,0]);
 adapter.setMode('manual');
 assert.equal(adapter.tick(),false);
 adapter.setMode('auto');
 assert.equal(adapter.tick(),true);
 assert.equal(adapter.accept({schema:'craftle.director-pose.v1',available:true,
 observedAt,camera:{x:NaN,y:1,z:1},target:{x:1,y:2,z:3}}),false);
 assert.equal(adapter.tick(Date.parse(observedAt)+20000),false);
});

test('read-only EventSource adapter can attach and cleanly close',()=>{
 let listener=null,closed=false;
 class FakeEventSource {
  constructor(url){assert.equal(url,'/api/director/stream');}
  addEventListener(type,fn){assert.equal(type,'director');listener=fn;}
  removeEventListener(){listener=null;}
  close(){closed=true;}
 }
 const camera={position:{x:0,y:0,z:0,set(){}},lookAt(){}};
 const adapter=createDirectorCameraAdapter({camera});
 const disconnect=connectDirectorStream(adapter,{EventSourceClass:FakeEventSource});
 listener({data:JSON.stringify({schema:'craftle.director-pose.v1',available:true,
 observedAt:new Date().toISOString(),camera:{x:1,y:2,z:3},target:{x:1,y:2,z:1}})});
 assert.ok(adapter.getLatest());
 disconnect();assert.equal(closed,true);assert.equal(listener,null);
});
