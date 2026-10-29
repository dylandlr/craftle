import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverNativeRoute} from '../src/native-navigation-discovery.js';
class GoalNearXZ {constructor(x,z,range){this.x=x;this.z=z;this.range=range;}}
const position={x:0.5,y:70,z:0.5};
test('native discovery accepts only a complete A-star route',()=>{
 let calls=0;
 const pathfinder={getPathTo:()=>{calls++;return calls===3?{status:'success',path:[{x:1,y:70,z:0}]}:{status:'partial',path:[{x:0,y:70,z:0}]};}};
 const result=discoverNativeRoute({position,pathfinder,movements:{},GoalNearXZ});
 assert.equal(result.reason,'native_near_route_success');assert.equal(calls,3);
 assert.equal(result.probes[0].status,'partial');assert.equal(result.selected.horizontal,true);
});
test('no complete route never invents a destination',()=>{
 const pathfinder={getPathTo:()=>({status:'noPath',path:[]})};
 const result=discoverNativeRoute({position,pathfinder,movements:{},GoalNearXZ});
 assert.equal(result.selected,null);assert.equal(result.probes.length,12);
});
test('missing native API and path exceptions fail closed',()=>{
 assert.equal(discoverNativeRoute({position}).reason,'native_probe_unavailable');
 const pathfinder={getPathTo:()=>{throw Error('unloaded chunk');}};
 const result=discoverNativeRoute({position,pathfinder,movements:{},GoalNearXZ});
 assert.equal(result.selected,null);assert.equal(result.probes[0].status,'error');
});

test('native probe logs noPath at one-step range distinctly from far destinations',()=>{
 const result=discoverNativeRoute({position,pathfinder:{getPathTo:()=>({status:'noPath',path:[],visitedNodes:1})},movements:{},GoalNearXZ});
 assert.equal(result.probes[0].kind,'near');assert.equal(result.probes[0].visitedNodes,1);
 assert.equal(result.probes[4].kind,'far');
});

test('native discovery falls back to long-distance route after all near probes fail',()=>{
 let calls=0;
 const pathfinder={getPathTo:()=>{calls++;return calls===5?{status:'success',path:[{x:3,y:70,z:0}]}:{status:'noPath',path:[]};}};
 const result=discoverNativeRoute({position,pathfinder,movements:{},GoalNearXZ});
 assert.equal(result.reason,'native_astar_success');
 assert.equal(calls,5);
 assert.equal(result.probes.length,5);
 assert.equal(result.probes[4].kind,'far');
});
