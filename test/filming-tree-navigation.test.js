import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chooseConnectedExploreGoal} from '../src/connected-exploration.js';

test('filming enables the existing safe connected-ground navigator by default',()=>{
 const compose=fs.readFileSync(new URL('../deploy/filming/compose.yml',import.meta.url),'utf8');
 assert.ok(compose.includes("CRAFTLE_TREE_NAVIGATION: '${CRAFTLE_TREE_NAVIGATION:-1}'"));
});
test('known canopy without a connected escape never invents one',()=>{
 const leaves={name:'oak_leaves',boundingBox:'block'},air={name:'air',boundingBox:'empty'};
 const blocks=(x,y,z)=>x===0&&z===0&&y===70?leaves:x===0&&z===0&&(y===71||y===72)?air:null;
 const result=chooseConnectedExploreGoal({origin:{x:0.5,y:71,z:0.5},blockAt:blocks});
 assert.equal(result.selected,null);
 assert.equal(result.reason,'no_known_connected_route');
});
