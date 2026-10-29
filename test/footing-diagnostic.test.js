import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseFooting} from '../src/footing-diagnostic.js';
const air={name:'air',boundingBox:'empty'};
const solid={name:'grass_block',boundingBox:'block'};
const make=(ground=solid,feet=air,head=air)=>({position:{x:-2.3,y:70,z:23.7},blockAt:(x,y,z)=>y===69?ground:y===70?feet:y===71?head:null,onGround:true});
test('full-block ground classifies verified footing',()=>assert.equal(diagnoseFooting(make()).status,'verified_full_block_footing'));
test('unknown support fails closed',()=>assert.equal(diagnoseFooting(make(null)).status,'unknown_terrain'));
test('air underfoot is unsupported, not a valid start',()=>assert.equal(diagnoseFooting(make(air)).status,'unsupported_position'));
test('slab requires collision geometry investigation',()=>assert.equal(diagnoseFooting(make({name:'stone_slab',boundingBox:'other'})).status,'partial_block_geometry'));
test('head obstruction is distinct from missing ground',()=>assert.equal(diagnoseFooting(make(solid,air,solid)).status,'head_obstructed'));
test('physics disagrees with verified blocks without inventing movement',()=>{
 const result=diagnoseFooting({...make(),onGround:false});
 assert.equal(result.status,'physics_support_disagreement');assert.equal(result.traversable,false);
});
