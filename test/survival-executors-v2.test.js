import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurvivalExecutors} from '../src/survival-executors-v2.js';
const pos=(x,y,z)=>({
 x,y,z,offset(dx,dy,dz){return pos(x+dx,y+dy,z+dz);},
 minus(p){return {x:x-p.x,y:y-p.y,z:z-p.z}},
 distanceTo(p){return Math.hypot(x-p.x,y-p.y,z-p.z)}
});
function fake(){
 const blocks=new Map(),key=p=>[p.x,p.y,p.z].join(',');
 const cobble={name:'stone',boundingBox:'block',position:pos(1,64,0)};
 blocks.set(key(cobble.position),cobble);
 const inventory=[{name:'oak_log',count:2},{name:'oak_planks',count:1}];
 const bot={
  entity:{position:pos(0,64,0)},registry:{itemsByName:{oak_planks:{id:5}}},
  inventory:{items:()=>inventory},heldItem:null,
  blockAt:p=>blocks.get(key(p))??{name:'air',boundingBox:'empty',position:p},
  canDigBlock:()=>true,
  async dig(b){blocks.set(key(b.position),{name:'air',boundingBox:'empty',position:b.position});},
  async equip(item){this.heldItem=item;},
  recipesFor:()=>[{id:'fake_recipe'}],
  async craft(){inventory.find(i=>i.name==='oak_planks').count+=4;},
  async placeBlock(reference,face){const p=reference.position.offset(face.x,face.y,face.z);
   blocks.set(key(p),{name:'oak_planks',boundingBox:'block',position:p});}
 };
 return {bot,cobble,inventory};
}
test('dig requires observed local reach and block change',async()=>{
 const {bot,cobble}=fake(),executors=createSurvivalExecutors(bot);
 assert.equal((await executors.dig_block({block:{...cobble,position:pos(100,64,0)}})).ok,false);
 const result=await executors.dig_block({block:cobble});
 assert.equal(result.ok,true);
 assert.equal(result.after,'air');
});
test('equip confirms held item and refuses missing inventory',async()=>{
 const {bot}=fake(),executors=createSurvivalExecutors(bot);
 assert.equal((await executors.equip_item({itemName:'diamond_pickaxe'})).ok,false);
 assert.equal((await executors.equip_item({itemName:'oak_log'})).ok,true);
 assert.equal(bot.heldItem.name,'oak_log');
});
test('craft proves output inventory increased; absent recipe fails closed',async()=>{
 const {bot}=fake(),executors=createSurvivalExecutors(bot);
 assert.equal((await executors.craft_item({itemName:'unknown'})).ok,false);
 assert.equal((await executors.craft_item({itemName:'oak_planks'})).delta,4);
 bot.recipesFor=()=>[];
 assert.equal((await executors.craft_item({itemName:'oak_planks'})).ok,false);
});
test('place requires known empty destination and verifies new block',async()=>{
 const {bot,cobble}=fake(),executors=createSurvivalExecutors(bot);
 const yes=await executors.place_block({referenceBlock:cobble,faceVector:{x:0,y:1,z:0},itemName:'oak_planks'});
 assert.equal(yes.ok,true);
 const duplicate=await executors.place_block({referenceBlock:cobble,faceVector:{x:0,y:1,z:0},itemName:'oak_planks'});
 assert.equal(duplicate.ok,false);
});
