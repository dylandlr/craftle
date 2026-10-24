import test from 'node:test';
import assert from 'node:assert/strict';
import {foodPlantAction,findFoodPlant,plantKey,foodSearchCell,chooseFoodSearchWaypoint} from '../src/food-foraging.js';
const plant=(name,age)=>({name,getProperties:()=>({age}),position:{x:2,y:64,z:0}});
test('plant harvesting preserves immature crops and berries',()=>{
 for(const name of ['carrots','potatoes']){
  assert.equal(foodPlantAction(plant(name,6)),null);
  assert.equal(foodPlantAction(plant(name,7)),'dig');
 }
 assert.equal(foodPlantAction(plant('sweet_berry_bush',1)),null);
 assert.equal(foodPlantAction(plant('sweet_berry_bush',2)),'activate');
 assert.equal(foodPlantAction(plant('melon',0)),'dig');
 assert.equal(foodPlantAction(plant('wheat',7)),null);
});
test('plant query filters maturity and target cooldown using actual block state',()=>{
 const ripe=plant('carrots',7),unripe=plant('carrots',2);
 const bot={registry:{blocksByName:{carrots:{id:1}}},findBlock(options){
  assert.deepEqual(options.matching,[1]);assert.equal(options.maxDistance,24);
  assert.equal(options.useExtraInfo(unripe),false);
  return options.useExtraInfo(ripe)?ripe:null;
 }};
 assert.equal(findFoodPlant(bot),ripe);
 assert.equal(findFoodPlant(bot,key=>key!==plantKey(ripe)),null);
});
test('food search prefers less-visited cells and excludes failed search destinations',()=>{
 const pos={x:0,y:64,z:0};const visits=new Map([['3,0',5]]);
 const first=chooseFoodSearchWaypoint(pos,visits,0);
 assert.notEqual(foodSearchCell(first),'3,0');
 const second=chooseFoodSearchWaypoint(pos,visits,0,key=>key!==foodSearchCell(first));
 assert.notEqual(foodSearchCell(second),foodSearchCell(first));
 assert.equal(chooseFoodSearchWaypoint(pos,visits,0,()=>false),null);
});
