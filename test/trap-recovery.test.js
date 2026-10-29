import test from 'node:test';
import assert from 'node:assert/strict';
import {planTrapRecovery,createTrapMonitor} from '../src/trap-recovery.js';
const air={name:'air',boundingBox:'empty'};
const solid=name=>({name,boundingBox:'block'});
test('general recovery finds traversable dry land without a tree',()=>{
 const blockAt=(x,y,z)=>y===64?solid('stone'):(y===65||y===66?air:null);
 const r=planTrapRecovery({origin:{x:0,y:65,z:0},blockAt,health:20});
 assert.equal(r.reason,'verified_connected_candidate');
 assert.ok(r.selected);
 assert.equal(r.selected.leaves,false);
});
test('unknown enclosure fails closed without inventing a route',()=>{
 const blockAt=(x,y,z)=>x===0&&z===0&&y===64?solid('stone'):x===0&&z===0&&(y===65||y===66)?air:null;
 const r=planTrapRecovery({origin:{x:0,y:65,z:0},blockAt});
 assert.equal(r.selected,null);
 assert.equal(r.reason,'no_known_connected_route');
});
test('low health disallows multi-block descent',()=>{
 const blocks=(x,y,z)=>{
  if(x===0&&z===0&&y===74)return solid('oak_leaves');
  if(x>0&&x<=3&&z===0&&y===72)return solid('grass_block');
  if(y>=73&&y<=77)return air;
  return null;
 };
 const origin={x:0,y:75,z:0};
 assert.equal(planTrapRecovery({origin,blockAt:blocks,health:1}).selected,null);
 assert.ok(planTrapRecovery({origin,blockAt:blocks,health:20}).selected);
});
test('monitor recognizes repeated failed attempts but not intentional idling',()=>{
 const m=createTrapMonitor({threshold:2});
 const sample=(x,attempted)=>m.observe({position:{x,y:65,z:0},displacement:0,attempted});
 assert.equal(sample(0,true).trapped,false);
 assert.equal(sample(0,true).trapped,false);
 assert.equal(sample(0,true).trapped,true);
 assert.equal(sample(0,false).trapped,false);
});
