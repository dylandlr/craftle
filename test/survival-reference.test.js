import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseSurvivalGoal,HOSTILE_MOBS,startSurvivalReference,createFoodTargetMemory} from '../src/survival-reference.js';
test('reference prioritizes threats and critical health over food',()=>{
 assert.equal(chooseSurvivalGoal({hostileDistance:3,food:5,foodAvailable:true}),'retreat');
 assert.equal(chooseSurvivalGoal({health:5,food:20}),'retreat');
});
test('reference eats when hungry, forages when missing food, and explores otherwise',()=>{
 assert.equal(chooseSurvivalGoal({food:8,foodAvailable:true}),'eat');
 assert.equal(chooseSurvivalGoal({food:20,foodAvailable:false,hasFood:false}),'forage');
 assert.equal(chooseSurvivalGoal({food:20,hasFood:true}),'explore');
 assert.equal(chooseSurvivalGoal({food:20,hasFood:true,blocked:true}),'reroute');
});
test('hazard set contains a few common survival threats',()=>{
 for(const mob of ['creeper','zombie','skeleton'])assert.equal(HOSTILE_MOBS.has(mob),true);
 assert.equal(HOSTILE_MOBS.has('cow'),false);
});

import {EventEmitter} from 'node:events';
class Position {
 constructor(x=0,y=64,z=0){Object.assign(this,{x,y,z});}
 clone(){return new Position(this.x,this.y,this.z);}
 distanceTo(p){return Math.hypot(this.x-p.x,this.y-p.y,this.z-p.z);}
}
function fixture(){
 const bot=new EventEmitter(),goals=[];
 Object.assign(bot,{health:20,food:20,entities:{},entity:{position:new Position()},
   registry:{foodsByName:{bread:{}}},inventory:{items:()=>[]},
   loadPlugin(){},clearControlStates(){},deactivateItem(){},
   pathfinder:{setMovements(){},setGoal(goal){goals.push(goal);}}});
 const navigation={pathfinder(){},Movements:class {},goals:{GoalXZ:class {constructor(x,z){Object.assign(this,{x,z,horizontal:true});}},GoalNear:class {constructor(x,y,z,range){Object.assign(this,{x,y,z,range});}}}};
 return {bot,goals,navigation};
}
test('reference preserves navigation goals while making progress and replans after arrival',async()=>{
 const {bot,goals,navigation}=fixture();
 const runtime=startSurvivalReference(bot,{autoStart:false,navigation});
 await runtime.step();
 bot.entity.position.x=1;
 await runtime.step();
 assert.equal(goals.length,1);
 bot.emit('goal_reached');
 await runtime.step();
 assert.equal(goals.length,2);
 runtime.stop();
});
test('reference replans after sustained stalls instead of replacing every goal immediately',async()=>{
 const {bot,goals,navigation}=fixture();
 const runtime=startSurvivalReference(bot,{autoStart:false,navigation});
 await runtime.step();
 await runtime.step();
 await runtime.step();
 assert.equal(goals.length,1);
 await runtime.step();
 assert.equal(goals.length,2);
 runtime.stop();
});
test('death cancels pending eating; respawn does not apply commands from the previous life',async()=>{
 const {bot,navigation}=fixture();
 let release,consumed=0;
 bot.food=6;
 bot.inventory.items=()=>[{name:'bread',count:1}];
 bot.equip=()=>new Promise(resolve=>{release=resolve;});
 bot.consume=async()=>{consumed++;};
 const runtime=startSurvivalReference(bot,{autoStart:false,navigation});
 const pending=runtime.step();
 bot.emit('death');bot.emit('death');
 await runtime.step();
 bot.emit('spawn');
 release();await pending;
 assert.equal(consumed,0);
 assert.equal(runtime.events().filter(e=>e.type==='survival_reference_death').length,1);
 assert.equal(runtime.events().filter(e=>e.type==='survival_reference_action').length,0);
 bot.equip=async()=>{};
 await runtime.step();
 assert.equal(consumed,1);
 runtime.stop();
});
test('stop is idempotent and removes listeners and prevents further actions',async()=>{
 const {bot,navigation}=fixture();
 const runtime=startSurvivalReference(bot,{autoStart:false,navigation});
 runtime.stop();runtime.stop();
 await runtime.step();
 for(const type of ['death','spawn','goal_reached','path_update','end'])assert.equal(bot.listenerCount(type),0);
 assert.equal(runtime.events().length,0);
});

test('forage pursues edible dropped food before animals',async()=>{
 const {bot,goals,navigation}=fixture();
 bot.entities={1:{id:1,name:'item',position:new Position(2,64,0),getDroppedItem:()=>({name:'bread',count:1})}};
 const runtime=startSurvivalReference(bot,{autoStart:false,navigation});
 await runtime.step();
 assert.equal(goals.at(-1).x,2);
 assert.equal(goals.at(-1).range,0);
 runtime.stop();
});
test('hungry reference consumes acquired food and reports measured hunger',async()=>{
 const {bot,navigation}=fixture();
 bot.food=10;let count=1;
 bot.inventory.items=()=>count?[{name:'bread',count}]:[];
 bot.equip=async()=>{};
 bot.consume=async()=>{count--;bot.food=15;};
 const runtime=startSurvivalReference(bot,{autoStart:false,navigation});
 await runtime.step();
 const outcome=runtime.events().find(e=>e.type==='survival_reference_consumed');
 assert.equal(outcome.beforeFood,10);
 assert.equal(outcome.afterFood,15);
 assert.equal(runtime.events().at(-1).inventoryCount,0);
 runtime.stop();
});
test('forage attacks a nearby food animal through primitive controls',async()=>{
 const {bot,navigation}=fixture();
 const p=new Position(1,64,0);p.offset=()=>p;
 const animal={id:2,name:'sheep',position:p,height:1};
 bot.entities={2:animal};let attacks=0;
 bot.lookAt=async()=>{};bot.attack=e=>{assert.equal(e,animal);attacks++;};
 const runtime=startSurvivalReference(bot,{autoStart:false,navigation});
 await runtime.step();
 assert.equal(attacks,1);
 assert.equal(runtime.events().some(e=>e.type==='survival_reference_hunt'),true);
 runtime.stop();
});

test('unreachable food target expires without repeated choices renewing its deadline',()=>{
 let now=0;const m=createFoodTargetMemory({clock:()=>now});m.begin(1);
 now=19000;m.begin(1);assert.equal(m.expired(),false);
 now=20000;assert.equal(m.expired(),true);m.fail();
 assert.equal(m.available(1),false);assert.equal(m.available(2),true);
 now=50000;assert.equal(m.available(1),true);
});
test('food target failures and cooldowns are cleared between lives',()=>{
 const m=createFoodTargetMemory();m.begin(1);m.fail();assert.equal(m.available(1),false);
 m.reset();assert.equal(m.available(1),true);assert.equal(m.expired(),false);
});

test('reference harvests a mature crop and leaves immature crops alone',async()=>{
 const {bot,navigation}=fixture();let digs=0;
 const crop={name:'carrots',position:new Position(2,64,0),getProperties:()=>({age:7})};
 bot.registry.blocksByName={carrots:{id:1}};
 bot.findBlock=options=>options.useExtraInfo(crop)?crop:null;
 bot.blockAt=()=>crop;bot.dig=async block=>{assert.equal(block,crop);digs++;};
 const runtime=startSurvivalReference(bot,{autoStart:false,navigation});
 await runtime.step();assert.equal(digs,1);
 assert.equal(runtime.events().some(e=>e.type==='survival_reference_plant_harvest'),true);
 crop.getProperties=()=>({age:2});await runtime.step();assert.equal(digs,1);
 runtime.stop();
});
test('pending plant harvest cannot record a success after death',async()=>{
 const {bot,navigation}=fixture();let release;
 const crop={name:'carrots',position:new Position(2,64,0),getProperties:()=>({age:7})};
 bot.registry.blocksByName={carrots:{id:1}};
 bot.findBlock=()=>crop;bot.blockAt=()=>crop;
 bot.dig=()=>new Promise(resolve=>{release=resolve;});
 const runtime=startSurvivalReference(bot,{autoStart:false,navigation});
 const pending=runtime.step();bot.emit('death');release();await pending;
 assert.equal(runtime.events().some(e=>e.type==='survival_reference_plant_harvest'),false);
 runtime.stop();
});

test('food search uses horizontal navigation instead of requiring the current altitude',async()=>{
 const {bot,goals,navigation}=fixture();
 const runtime=startSurvivalReference(bot,{autoStart:false,navigation});
 await runtime.step();assert.equal(goals.at(-1).horizontal,true);assert.equal(goals.at(-1).y,undefined);
 runtime.stop();
});
