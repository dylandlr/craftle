import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDiggingNeighbors} from '../src/dig-navigation-audit.js';

class FakeMovements {
 constructor(){this.canDig=false;}
 getNeighbors(node){
  const walk={x:node.x+1,y:node.y,z:node.z,cost:1,toBreak:[],toPlace:[]};
  const dig={x:node.x,y:node.y,z:node.z+1,cost:3,toBreak:[{x:node.x,y:node.y,z:node.z+1}],toPlace:[]};
  return this.canDig?[walk,dig]:[walk];
 }
}
const configure=(movements)=>movements;
test('read-only digging audit reports only new neighbor and leaves bot untouched',()=>{
 const bot={entity:{position:{x:9.5,y:71,z:-24.6}},registry:{}};
 const result=auditDiggingNeighbors({bot,Movements:FakeMovements,configure,position:bot.entity.position});
 assert.equal(result.reason,'read_only_neighbor_comparison');
 assert.deepEqual(result.origin,{x:9,y:71,z:-25});
 assert.equal(result.blocked.count,1);
 assert.equal(result.digAllowed.count,2);
 assert.equal(result.addedByDig.length,1);
 assert.equal(result.addedByDig[0].toBreak.length,1);
 assert.equal(bot.pathfinder,undefined);
});
test('read-only audit handles missing bot',()=>{
 assert.equal(auditDiggingNeighbors({}).reason,'unavailable');
});
