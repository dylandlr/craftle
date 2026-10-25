import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Vec3} from 'vec3';
import {observeTargets,encodeTargets,decodeTargetAction,TARGET_INPUTS,TARGET_ACTIONS} from '../src/target-opportunities.js';
import {createTargetedController} from '../src/targeted-controller.js';
import {startTargetedSurvival} from '../src/targeted-survival.js';
import {createOptionDQN} from '../src/option-dqn.js';
function fixture(){
 const bot=new EventEmitter(),goals=[],events=[];
 Object.assign(bot,{health:20,food:16,entity:{position:new Vec3(0,64,0)},entities:{},inventory:{items:()=>[]},registry:{foodsByName:{bread:{foodPoints:5}},blocksByName:{carrots:{id:1}}},
  canSeeEntity:()=>true,canSeeBlock:()=>true,findBlocks:()=>[],blockAt:()=>null,
  loadPlugin(){},clearControlStates(){},deactivateItem(){},pathfinder:{setMovements(){},setGoal:g=>goals.push(g)}});
 const navigation={pathfinder(){},Movements:class {},goals:{GoalXZ:class{constructor(x,z){Object.assign(this,{x,z});}},GoalNear:class{constructor(x,y,z,range){Object.assign(this,{x,y,z,range});}}}};
 return {bot,goals,events,navigation};
}
const animal=(id,x)=>({id,name:'sheep',position:new Vec3(x,64,0),height:1});
test('observations include visible bounded opportunities and food quantities, excluding hidden or distant targets',()=>{
 const {bot}=fixture();bot.entities={1:animal(1,2),2:animal(2,5),3:animal(3,25)};
 bot.canSeeEntity=e=>e.id!==2;
 bot.inventory.items=()=>[{name:'bread',count:4}];
 const o=observeTargets(bot);assert.equal(o.foodUnits,4);assert.equal(o.foodPoints,20);assert.deepEqual(o.targets.map(t=>t.id),['entity:1']);
 const {features,mask}=encodeTargets(o);assert.equal(features.length,TARGET_INPUTS);assert.ok(features.every(Number.isFinite));
 assert.equal(mask[TARGET_ACTIONS.indexOf('attack_0')],true);assert.equal(mask[TARGET_ACTIONS.indexOf('harvest_0')],false);
 assert.equal(mask[TARGET_ACTIONS.indexOf('approach_1')],false);assert.throws(()=>decodeTargetAction(TARGET_ACTIONS.indexOf('attack_1'),o),/Unavailable/);
 bot.food=20;assert.equal(encodeTargets(observeTargets(bot)).mask[0],false);
});
test('target identity is resolved from the decision observation rather than a later slot order',()=>{
 const {bot}=fixture();bot.entities={1:animal(1,5),2:animal(2,2)};
 const o=observeTargets(bot),choice=decodeTargetAction(TARGET_ACTIONS.indexOf('approach_0'),o);
 assert.equal(choice.targetId,'entity:2');bot.entities[1].position.x=1;
 assert.equal(observeTargets(bot).targets[0].id,'entity:1');assert.equal(choice.targetId,'entity:2');
});
test('approach does not automatically attack or harvest, and attacks affect only the selected entity',async()=>{
 const {bot,goals,navigation}=fixture();bot.entities={1:animal(1,1),2:animal(2,2)};const attacked=[];
 bot.attack=e=>attacked.push(e.id);bot.lookAt=async()=>{};
 let skill='approach';const controller={choose:()=>({skill,targetId:'entity:2',decisionId:1}),stop(){},terminal(){}};
 const runtime=startTargetedSurvival(bot,{decisionController:controller,navigation,autoStart:false});
 await runtime.step();assert.equal(goals.at(-1).x,2);assert.deepEqual(attacked,[]);
 skill='attack';await runtime.step();assert.deepEqual(attacked,[2]);
 bot.canSeeEntity=()=>false;await runtime.step();assert.deepEqual(attacked,[2]);runtime.stop();
});
test('death during asynchronous interaction prevents old-life attacks and double terminals',async()=>{
 const {bot,navigation}=fixture();bot.entities={1:animal(1,1)};let release,attacks=0,terminals=0;
 bot.lookAt=()=>new Promise(resolve=>release=resolve);bot.attack=()=>attacks++;
 const controller={choose:()=>({skill:'attack',targetId:'entity:1',decisionId:1}),stop(){},terminal(){terminals++;}};
 const runtime=startTargetedSurvival(bot,{decisionController:controller,navigation,autoStart:false});
 const step=runtime.step();bot.emit('death');bot.emit('death');release();await step;
 assert.equal(attacks,0);assert.equal(terminals,1);runtime.stop();
 for(const name of ['death','spawn','goal_reached','path_update','end'])assert.equal(bot.listenerCount(name),0);
});
test('plant actuator receives a Vec3 and explicitly harvests only the selected mature plant',async()=>{
 const {bot,navigation}=fixture();const crop=new Vec3(2,64,0);let harvested=0;
 bot.findBlocks=()=>[crop];bot.blockAt=p=>{assert.equal(typeof p.floored,'function');return {name:'carrots',position:p,getProperties:()=>({age:7})};};
 bot.dig=async()=>harvested++;
 const controller={choose:()=>({skill:'harvest',targetId:'plant:2,64,0',decisionId:1}),stop(){},terminal(){}};
 const runtime=startTargetedSurvival(bot,{decisionController:controller,navigation,autoStart:false});await runtime.step();assert.equal(harvested,1);runtime.stop();
});
test('targeted policies train, freeze without modifying weights, and reject legacy checkpoints',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-targeted-'));
 try{
  const checkpoint=path.join(directory,'policy.json'),{bot}=fixture(),o=observeTargets(bot);
  const trainer=createTargetedController({checkpoint,seed:8});trainer.choose(o);trainer.choose(o);trainer.stop();assert.equal(trainer.stats().updates,4);
  const before=fs.readFileSync(checkpoint,'utf8'),frozen=createTargetedController({mode:'frozen',checkpoint});
  frozen.choose(o);frozen.choose(o);frozen.terminal();frozen.stop();assert.equal(fs.readFileSync(checkpoint,'utf8'),before);
  fs.writeFileSync(checkpoint,JSON.stringify(createOptionDQN().snapshot()));assert.throws(()=>createTargetedController({checkpoint}),/Incompatible/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('verified eating credits only the active matching eat decision once',()=>{
 const {bot}=fixture();bot.inventory.items=()=>[{name:'bread',count:1}];
 const c=createTargetedController({mode:'scripted'}),o=observeTargets(bot),choice=c.choose(o);
 assert.equal(choice.skill,'eat');assert.equal(c.consumed(choice.decisionId+1,16,20),false);assert.equal(c.consumed(choice.decisionId,16,16),false);
 assert.equal(c.consumed(choice.decisionId,16,20),true);assert.equal(c.consumed(choice.decisionId,16,20),false);
 c.terminal();assert.equal(c.consumed(choice.decisionId,16,20),false);
});
