import test from 'node:test';
import assert from 'node:assert/strict';
import {observeTargets,encodeTargets} from '../src/target-opportunities.js';
function botWithEntities(visible){
 return {
  entity:{position:{x:0,y:64,z:0}}, inventory:{items:()=>[]}, registry:{foodsByName:{},blocksByName:{}},
  entities:{a:{id:1,name:'cow',position:{x:3,y:64,z:4}},b:{id:2,name:'zombie',position:{x:2,y:64,z:2}}},
  canSeeEntity:()=>visible, health:20,food:12
 };
}
test('perception audit reports category and visibility stages without changing mask',()=>{
 const bot=botWithEntities(false),captured=[];
 const original=observeTargets(bot,{hostileNames:new Set(['zombie'])});
 const observed=observeTargets(bot,{hostileNames:new Set(['zombie']),audit:event=>captured.push(event)});
 assert.deepEqual(observed,original);
 assert.deepEqual(encodeTargets(observed),encodeTargets(original));
 assert.equal(captured.length,1);
 assert.equal(captured[0].nearbyEntities,2);
 assert.equal(captured[0].eligibleEntityCategories,1);
 assert.equal(captured[0].entityVisibilityRejected,1);
 assert.equal(captured[0].entityVisibilityAccepted,0);
 assert.equal(captured[0].totalCandidates,0);
 assert.equal(captured[0].selectedTargets,0);
 assert.equal(captured[0].inventoryFoodItems,0);
 assert.equal(captured[0].visibilityMethodAvailable,true);
 assert.equal(captured[0].nearbyEntityTypes.cow,1);
 assert.equal(captured[0].nearbyEntityTypes.zombie,1);
 assert.deepEqual(captured[0].rejectedEntityExamples,[{kind:'animal',name:'cow',distanceBlocks:5,deltaYBlocks:0,entityId:1}]);
});
test('visible survival animal enters candidate list and audit',()=>{
 const reports=[];
 const observed=observeTargets(botWithEntities(true),{audit:e=>reports.push(e)});
 assert.equal(observed.targets.length,1);
 assert.equal(observed.targets[0].kind,'animal');
 assert.equal(reports[0].entityVisibilityAccepted,1);
 assert.equal(reports[0].selectedTargets,1);
});

test('missing entity visibility method is explicitly identified without changing masking',()=>{
 const bot=botWithEntities(false);
 delete bot.canSeeEntity;
 const reports=[];
 const observed=observeTargets(bot,{audit:e=>reports.push(e)});
 assert.equal(observed.targets.length,0);
 assert.equal(reports[0].visibilityMethodAvailable,false);
 assert.equal(reports[0].entityVisibilityRejected,1);
});
