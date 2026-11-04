import test from 'node:test';
import assert from 'node:assert/strict';
import {availableSurvivalActions} from '../src/survival-action-mask-v2.js';
const noop=()=>{};
test('named but unwired skills are never made available',()=>{
 const a=availableSurvivalActions({observation:{food:5,edibleInInventory:true,
  craftableRecipes:['oak_planks'],isInWater:true}});
 assert.equal(a.mask.some(Boolean),false);
 assert.ok(a.blockedByMissingExecutor.includes('craft_item'));
});
test('a real executor and local preconditions must both hold',()=>{
 const executors={eat_item:noop,craft_item:noop,swim:noop,wait:noop};
 const a=availableSurvivalActions({executors,observation:{food:5,edibleInInventory:true,
  craftableRecipes:[],isInWater:false}});
 assert.deepEqual(a.executableIds,['eat_item','wait']);
});
test('recipe discovery alone never makes crafting executable',()=>{
 const a=availableSurvivalActions({observation:{craftableRecipes:['stick']}});
 assert.equal(a.executableIds.includes('craft_item'),false);
});
test('missing movement observations prevent blind risky descent',()=>{
 const a=availableSurvivalActions({observation:{descentCandidate:{fullyObserved:false}},
  executors:{descend:noop}});
 assert.equal(a.executableIds.includes('descend'),false);
 const b=availableSurvivalActions({observation:{descentCandidate:{fullyObserved:true}},
  executors:{descend:noop}});
 assert.equal(b.executableIds.includes('descend'),true);
});
