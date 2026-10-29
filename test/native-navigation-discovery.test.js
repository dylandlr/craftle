import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverNativeRoute} from '../src/native-navigation-discovery.js';
class GoalNearXZ {constructor(x,z,range){this.x=x;this.z=z;this.range=range;}}
const position={x:0.5,y:70,z:0.5};
test('native discovery accepts only a complete A-star route',()=>{
 let calls=0;
 const pathfinder={getPathTo:()=>{calls++;return calls===3?{status:'success',path:[{x:1,y:70,z:0}]}:{status:'partial',path:[{x:0,y:70,z:0}]};}};
 const result=discoverNativeRoute({position,pathfinder,movements:{},GoalNearXZ});
 assert.equal(result.reason,'native_astar_success');assert.equal(calls,3);
 assert.equal(result.probes[0].status,'partial');assert.equal(result.selected.horizontal,true);
});
test('no complete route never invents a destination',()=>{
 const pathfinder={getPathTo:()=>({status:'noPath',path:[]})};
 const result=discoverNativeRoute({position,pathfinder,movements:{},GoalNearXZ});
 assert.equal(result.selected,null);assert.equal(result.probes.length,8);
});
test('missing native API and path exceptions fail closed',()=>{
 assert.equal(discoverNativeRoute({position}).reason,'native_probe_unavailable');
 const pathfinder={getPathTo:()=>{throw Error('unloaded chunk');}};
 const result=discoverNativeRoute({position,pathfinder,movements:{},GoalNearXZ});
 assert.equal(result.selected,null);assert.equal(result.probes[0].status,'error');
});
