import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreExplorationCandidate,chooseGroundedExploreGoal} from '../src/grounded-exploration.js';
const solid=name=>({name,boundingBox:'block'});
const air={name:'air',boundingBox:'empty'};
test('grounded candidate finds solid earth and clear headroom',()=>{
 const result=scoreExplorationCandidate({origin:{x:0,y:65,z:0},candidate:{x:10,z:0},
  blockAt:(_x,y)=>y===64?solid('grass_block'):y===65||y===66?air:null});
 assert.equal(result.valid,true);assert.equal(result.position.y,65);assert.equal(result.ground,'grass_block');
});
test('leaf footing is disfavored over open ground',()=>{
 const dirt=scoreExplorationCandidate({origin:{x:0,y:65,z:0},candidate:{x:10,z:0},
  blockAt:(_x,y)=>y===64?solid('dirt'):y===65||y===66?air:null});
 const leaves=scoreExplorationCandidate({origin:{x:0,y:65,z:0},candidate:{x:10,z:0},
  blockAt:(_x,y)=>y===64?solid('oak_leaves'):y===65||y===66?air:null});
 assert.ok(dirt.score>leaves.score);
});
test('failed cells and unloaded block cache do not generate fake goals',()=>{
 const origin={x:0,y:65,z:0};
 assert.equal(scoreExplorationCandidate({origin,candidate:{x:10,z:0},blockAt:()=>null}).valid,false);
 assert.equal(scoreExplorationCandidate({origin,candidate:{x:10,z:0},blockAt:()=>air,failed:new Set(['10,0'])}).reason,'previous_no_path');
 assert.equal(chooseGroundedExploreGoal({origin,blockAt:()=>null}).selected,null);
});
