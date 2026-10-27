import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeLocalPerception} from '../src/local-perception.js';
function mockBot(){
 const position={x:0.4,y:65,z:0.8,offset(dx,dy,dz){return {x:this.x+dx,y:this.y+dy,z:this.z+dz};}};
 return {entity:{position,yaw:1.2},entities:{
  target:{id:2,position:{x:1,y:65,z:1},name:'cow',type:'mob'},
  far:{id:3,position:{x:30,y:65,z:0},name:'zombie'}},
 blockAt(pos){if(Math.floor(pos.y)===64)return {name:'oak_leaves',boundingBox:'block'};
 if(Math.floor(pos.y)===65)return {name:'air',boundingBox:'empty'};return null;}};
}
test('local perception is bounded and represents unknown terrain instead of filling unseen space',()=>{
 const o=observeLocalPerception(mockBot(),{radius:1,vertical:1});
 assert.equal(o.schema,'craftle.local-perception.v1');assert.equal(o.blocks.length,27);
 assert.ok(o.counts.unknown>0);assert.equal(o.entities.length,1);
 assert.equal(o.entities[0].name,'cow');
 assert.equal(o.semantics,'diagnostic_only_not_policy_input');
});
test('missing pose yields unavailable, not synthetic perception',()=>{
 assert.equal(observeLocalPerception({}).available,false);
});
test('invalid field of view size fails closed',()=>{
 assert.throws(()=>observeLocalPerception(mockBot(),{radius:100}),/Invalid local perception bounds/);
});
