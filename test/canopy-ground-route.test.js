import test from 'node:test';
import assert from 'node:assert/strict';
import {planCanopyGroundRoute} from '../src/canopy-ground-route.js';
const solid=name=>({name,boundingBox:'block'});
const air={name:'air',boundingBox:'empty'};
test('finds ground beyond old local waypoint search and returns a staged route',()=>{
 const blocks=(x,y,z)=>{
  if(z!==0||x<0||x>14)return null;
  if(y===69)return solid(x<14?'birch_leaves':'grass_block');
  if(y===70||y===71||y===72)return air;
  return null;
 };
 const p=planCanopyGroundRoute({origin:{x:0.5,y:70,z:0.5},blockAt:blocks});
 assert.equal(p.reason,'verified_connected_ground_route');
 assert.equal(p.route.at(-1).ground,'grass_block');
 assert.equal(p.routeSteps,14);
 assert.ok(p.selected.position.x>0&&p.selected.position.x<=5);
 assert.equal(p.selected.leaves,true);
});
test('chooses a lower verified landing rather than looping on leaves',()=>{
 const blocks=(x,y,z)=>{
  if(z!==0||x<0||x>4)return null;
  if(x<=2&&y===74)return solid('oak_leaves');
  if(x>=3&&y===72)return solid('grass_block');
  if(y>=73&&y<=77)return air;
  return null;
 };
 const p=planCanopyGroundRoute({origin:{x:0.5,y:75,z:0.5},blockAt:blocks});
 assert.equal(p.reason,'verified_connected_ground_route');
 assert.equal(p.route.at(-1).y,73);
 assert.equal(p.route.at(-1).ground,'grass_block');
 assert.deepEqual(p.route.map(n=>[n.x,n.y]),[[0,75],[1,75],[2,75],[3,73]]);
});
test('rejects unknown landing cells even when terrain appears nearby',()=>{
 const blocks=(x,y,z)=>{
  if(x===0&&z===0&&y===70)return solid('oak_leaves');
  if(x===0&&z===0&&(y===71||y===72))return air;
  return null;
 };
 const p=planCanopyGroundRoute({origin:{x:0,y:71,z:0},blockAt:blocks});
 assert.equal(p.selected,null);
 assert.equal(p.reason,'no_verified_ground_route');
});
test('low health never plans a drop greater than one block',()=>{
 const blocks=(x,y,z)=>{
  if(z!==0||x<0||x>3)return null;
  if(x===0&&y===74)return solid('oak_leaves');
  if(x>=1&&y===71)return solid('grass_block');
  if(y>=72&&y<=77)return air;
  return null;
 };
 const p=planCanopyGroundRoute({origin:{x:0,y:75,z:0},health:1,blockAt:blocks});
 assert.equal(p.maxDrop,1);
 assert.equal(p.selected,null);
});
test('does not plan ground route when already safely on ground',()=>{
 const p=planCanopyGroundRoute({origin:{x:0,y:70,z:0},blockAt:(x,y,z)=>y===69?solid('grass_block'):air});
 assert.equal(p.reason,'already_on_nonleaf_ground');
 assert.equal(p.selected,null);
});

test('rejects lower landing when the vertical descent shaft is obstructed',()=>{
 const blocks=(x,y,z)=>{
  if(z!==0||x<0||x>3)return null;
  if(x<=2&&y===74)return solid('oak_leaves');
  if(x===3&&y===72)return solid('grass_block');
  if(x===3&&y===74)return solid('stone');
  if(y>=73&&y<=77)return air;
  return null;
 };
 const p=planCanopyGroundRoute({origin:{x:0,y:75,z:0},blockAt:blocks});
 assert.equal(p.selected,null);
 assert.equal(p.reason,'no_verified_ground_route');
});
