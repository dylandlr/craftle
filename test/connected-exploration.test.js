import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseConnectedExploreGoal} from '../src/connected-exploration.js';
const solid=name=>({name,boundingBox:'block'}),air={name:'air',boundingBox:'empty'};
test('chooses connected dry ground over tree leaves',()=>{
 const result=chooseConnectedExploreGoal({origin:{x:0,y:65,z:0},radius:5,blockAt:(x,y,z)=>{
  if(y===64)return solid(x>1?'oak_leaves':'grass_block');
  return y===65||y===66?air:null;
 }});
 assert.ok(result.selected);assert.equal(result.reason,'known_connected_footing');
 assert.equal(result.selected.leaves,false);
});
test('never selects unsupported unknown blocks across chasm',()=>{
 const result=chooseConnectedExploreGoal({origin:{x:0,y:65,z:0},radius:3,blockAt:(x,y,z)=>{
  if(x!==0||z!==0)return null;
  if(y===64)return solid('stone');if(y===65||y===66)return air;return null;
 }});
 assert.equal(result.selected,null);
});
test('rejects lava foundation and unknown initial footing',()=>{
 const result=chooseConnectedExploreGoal({origin:{x:0,y:65,z:0},blockAt:(x,y,z)=>y===64?solid('lava'):air});
 assert.equal(result.reason,'no_known_start_footing');
});

test('avoids previously failed destinations when other connected ground exists',()=>{
 const blockAt=(x,y,z)=>y===64?solid('grass_block'):(y===65||y===66?air:null);
 const first=chooseConnectedExploreGoal({origin:{x:0,y:65,z:0},radius:3,blockAt});
 assert.ok(first.selected);
 const g=first.selected.position;
 const avoid=new Set([[g.x,g.y,g.z].join(',')]);
 const second=chooseConnectedExploreGoal({origin:{x:0,y:65,z:0},radius:3,blockAt,avoid});
 assert.ok(second.selected);
 assert.notDeepEqual(second.selected.position,g);
});

test('connected exploration favors net progress rather than wandering in circles',()=>{
 const blockAt=(x,y,z)=>y===64?solid('grass_block'):(y===65||y===66?air:null);
 const result=chooseConnectedExploreGoal({origin:{x:0,y:65,z:0},radius:5,maxNodes:220,blockAt});
 assert.ok(result.selected);
 const {x,z}=result.selected.position;
 assert.ok(Math.hypot(x,z)>=2.5,'expected meaningful net displacement from start');
});

test('never deliberately chooses leaf canopy when stable ground is reachable',()=>{
 const blockAt=(x,y,z)=>{
  if(y===64)return solid(x>0?'oak_leaves':'grass_block');
  if(y===65||y===66)return air;
  return null;
 };
 const result=chooseConnectedExploreGoal({origin:{x:0,y:65,z:0},radius:5,blockAt});
 assert.ok(result.selected);
 assert.equal(result.selected.leaves,false);
 assert.ok(result.selected.position.x<=0);
});
test('does not invent a safe exit from an isolated leaf canopy',()=>{
 const blockAt=(x,y,z)=>{
  if(y===70&&x===0&&z===0)return solid('oak_leaves');
  if(y===71||y===72)return air;
  return null;
 };
 const result=chooseConnectedExploreGoal({origin:{x:0,y:71,z:0},radius:4,blockAt});
 assert.equal(result.selected,null);
});

test('retreat scorer prefers connected footing farther from threat, not unreachable coordinates',()=>{
 const blockAt=(x,y,z)=>y===64?solid('grass_block'):(y===65||y===66?air:null);
 const result=chooseConnectedExploreGoal({
  origin:{x:0,y:65,z:0},radius:5,blockAt,
  scoreNode:n=>Math.hypot(n.x+4,n.z)-Math.hypot(4,0)-n.cost*.15
 });
 assert.ok(result.selected);
 assert.ok(result.selected.position.x>=0,'retreat must favor movement away from west-side threat');
});

test('canopy descent considers a verified two-block drop but not in standard mode',()=>{
 const blocks=(x,y,z)=>{
  if(x===0&&z===0&&y===74)return solid('birch_leaves');
  if(x===1&&y===72)return solid('grass_block');
  if(y>=73&&y<=77)return air;
  return null;
 };
 const origin={x:0,y:75,z:0};
 const ordinary=chooseConnectedExploreGoal({origin,blockAt:blocks,radius:3});
 assert.equal(ordinary.selected,null);
 // A safe landing needs two steps of horizontal travel to be ranked.
 const descent=chooseConnectedExploreGoal({origin,blockAt:(x,y,z)=>{
  if(x===0&&z===0&&y===74)return solid('birch_leaves');
  if((x===1||x===2)&&z===0&&y===72)return solid('grass_block');
  if(y>=73&&y<=77)return air;
  return null;
 },radius:3,allowShortDescent:true});
 assert.ok(descent.selected);
 assert.equal(descent.selected.ground,'grass_block');
 assert.equal(descent.selected.position.y,73);
});
test('canopy planner rejects unknown landing shafts and falls over three blocks',()=>{
 const blocks=(x,y,z)=>{
  if(x===0&&z===0&&y===74)return solid('birch_leaves');
  if((x===1||x===2)&&z===0&&y===69)return solid('grass_block');
  if(y>=70&&y<=77)return air;
  return null;
 };
 const result=chooseConnectedExploreGoal({origin:{x:0,y:75,z:0},blockAt:blocks,allowShortDescent:true});
 assert.equal(result.selected,null);
});
