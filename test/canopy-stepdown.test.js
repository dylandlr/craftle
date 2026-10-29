import test from 'node:test';
import assert from 'node:assert/strict';
import {findCanopyStepdown} from '../src/canopy-stepdown.js';
const air={name:'air',boundingBox:'empty'},leaves={name:'oak_leaves',boundingBox:'block'},grass={name:'grass_block',boundingBox:'block'};
const blocks=(x,y,z)=>{
 if(x===0&&z===0&&y===70)return leaves;
 if(x===1&&z===0&&y===68)return grass;
 return air;
};
test('recognizes verified walk-off landing two blocks below canopy',()=>{
 const r=findCanopyStepdown({position:{x:0.5,y:71,z:0.5},blockAt:blocks});
 assert.equal(r.reason,'verified_short_stepdown');
 assert.equal(r.selected.x,1);assert.equal(r.selected.y,69);
});
test('never walks off canopy into nearby lava or unknown blocks',()=>{
 const lava=(x,y,z)=>x===1&&z===0&&y===69?{name:'lava',boundingBox:'empty'}:blocks(x,y,z);
 assert.equal(findCanopyStepdown({position:{x:0.5,y:71,z:0.5},blockAt:lava}).selected,null);
 assert.equal(findCanopyStepdown({position:{x:0.5,y:71,z:0.5},blockAt:(x,y,z)=>x>1?null:blocks(x,y,z)}).selected,null);
});
test('low health and non-canopy starting positions do not attempt drop',()=>{
 assert.equal(findCanopyStepdown({position:{x:0.5,y:71,z:0.5},blockAt:blocks,health:1}).selected,null);
 assert.equal(findCanopyStepdown({position:{x:0.5,y:71,z:0.5},blockAt:()=>grass}).selected,null);
});
