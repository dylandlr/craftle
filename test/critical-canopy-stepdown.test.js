import test from 'node:test';
import assert from 'node:assert/strict';
import {findCanopyStepdown} from '../src/canopy-stepdown.js';
const at=(x,y,z)=>({name:'air',boundingBox:'empty'});
const origin={x:0.5,y:75,z:0.5};
const air={name:'air',boundingBox:'empty'};
const leaf={name:'oak_leaves',boundingBox:'block'};
const stone={name:'stone',boundingBox:'block'};
test('critical HP is not itself a reason to block a verified one-block descent',()=>{
 const blockAt=(x,y,z)=>x===0&&y===74&&z===0?leaf:
  x===1&&y===73&&z===0?stone:air;
 const p=findCanopyStepdown({position:origin,health:1,blockAt});
 assert.equal(p.reason,'verified_short_stepdown');
 assert.equal(p.selected?.drop,1);
});
test('critical HP refuses multi-block descent',()=>{
 const blockAt=(x,y,z)=>x===0&&y===74&&z===0?leaf:
  x===1&&y===72&&z===0?stone:air;
 const p=findCanopyStepdown({position:origin,health:1,blockAt});
 assert.equal(p.selected,null);
 assert.equal(p.reason,'no_verified_safe_stepdown');
});
test('nonleaf footing is distinguished from low-health prohibition',()=>{
 const blockAt=(x,y,z)=>x===0&&y===74&&z===0?{name:'oak_log',boundingBox:'block'}:air;
 const p=findCanopyStepdown({position:origin,health:1,blockAt});
 assert.equal(p.reason,'not_on_canopy');
 assert.equal(p.underfoot,'oak_log');
});
test('unknown local geometry cannot count as safe descent',()=>{
 const blockAt=(x,y,z)=>x===0&&y===74&&z===0?leaf:null;
 const p=findCanopyStepdown({position:origin,health:1,blockAt});
 assert.equal(p.selected,null);
});
