import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditFoodPerception} from '../src/food-perception-audit.js';
test('separates locally known food mobs from line-of-sight targets',()=>{
 const mob={id:7,name:'cow',position:{x:5,y:64,z:0},getDroppedItem:()=>null};
 const bot={entity:{position:{x:0,y:64,z:0}},entities:{7:mob},
  inventory:{items:()=>[]},registry:{foodsByName:{},blocksByName:{}},game:{dimension:'overworld'},
  canSeeEntity:()=>false,findBlocks:()=>[]};
 const report=auditFoodPerception(bot);
 assert.equal(report.entities.foodAnimalNearby,1);
 assert.equal(report.entities.foodAnimalVisible,0);
 assert.equal(report.plants.registryIds,0);
 assert.equal(report.policyUsed,false);
});
test('unknown entities are not claimed as edible opportunities',()=>{
 const bot={entity:{position:{x:0,y:64,z:0}},entities:{1:{name:'zombie',position:{x:2,y:64,z:0}}},
 inventory:{items:()=>[]},registry:{foodsByName:{},blocksByName:{}},canSeeEntity:()=>true};
 const report=auditFoodPerception(bot);
 assert.equal(report.entities.foodAnimalNearby,0);
 assert.equal(report.entityNames.zombie,1);
});
