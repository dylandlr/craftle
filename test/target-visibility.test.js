import test from 'node:test';
import assert from 'node:assert/strict';
import {canSeeTargetEntity} from '../src/target-visibility.js';
const pos=(x,y,z)=>({x,y,z,offset(dx,dy,dz){return pos(x+dx,y+dy,z+dz);}});
const cow={position:pos(5,64,0),height:1.4};
const make=blockAt=>({entity:{position:pos(0,64,0),height:1.8},blockAt});
test('visible animal through loaded empty blocks',()=>{
 assert.equal(canSeeTargetEntity(make(()=>({boundingBox:'empty'})),cow),true);
});
test('solid barrier occludes both sampled aim points',()=>{
 assert.equal(canSeeTargetEntity(make(p=>p.x>2&&p.x<3?{boundingBox:'block'}:{boundingBox:'empty'}),cow),false);
});
test('an uncovered upper target remains visible',()=>{
 assert.equal(canSeeTargetEntity(make(p=>p.x>2&&p.x<3&&p.y>65?{boundingBox:'block'}:{boundingBox:'empty'}),cow),true);
});
test('unloaded blocks fail closed',()=>{
 assert.equal(canSeeTargetEntity(make(()=>null),cow),false);
});
test('missing block API fails closed',()=>{
 assert.equal(canSeeTargetEntity({entity:{position:pos(0,64,0)}},cow),false);
});
test('animal beyond bounded detection distance fails closed',()=>{
 assert.equal(canSeeTargetEntity(make(()=>({boundingBox:'empty'})),{position:pos(28,64,0),height:1.4}),false);
});
