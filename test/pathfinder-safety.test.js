import test from 'node:test';
import assert from 'node:assert/strict';
import {configurePathfinderSafety,summarizePathUpdate} from '../src/pathfinder-safety.js';
test('native pathfinder avoids registered lava and magma while preserving benign blocks',()=>{
 const movements={blocksToAvoid:new Set([42])};
 const registry={blocksByName:{lava:{id:10},magma_block:{id:11},stone:{id:1}}};
 const out=configurePathfinderSafety(movements,{registry,maxDropDown:1});
 assert.equal(out,movements);
 assert.equal(out.blocksToAvoid.has(10),true);
 assert.equal(out.blocksToAvoid.has(11),true);
 assert.equal(out.blocksToAvoid.has(1),false);
 assert.equal(out.blocksToAvoid.has(42),true);
 assert.equal(out.canDig,false);assert.equal(out.allowParkour,false);
 assert.equal(out.maxDropDown,1);
});
test('native path results are bounded to diagnostic fields',()=>{
 assert.deepEqual(summarizePathUpdate({status:'partial',path:[1,2],visitedNodes:8,generatedNodes:10,cost:3,time:15}),{
  status:'partial',pathLength:2,visitedNodes:8,generatedNodes:10,cost:3,computeTimeMs:15
 });
 assert.equal(summarizePathUpdate(null).status,'unknown');
});
