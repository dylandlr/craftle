import fs from 'node:fs';
import path from 'node:path';
import {createOptionDQN} from './option-dqn.js';
export function createLearningOptionController({checkpoint,log=()=>{},training=true}={}){
 const learner=createOptionDQN({training,snapshot:checkpoint&&fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint,'utf8')):null});
 let pending=null;const visited=new Set();
 const save=()=>{if(!training||!checkpoint)return;fs.mkdirSync(path.dirname(checkpoint),{recursive:true});fs.writeFileSync(checkpoint+'.tmp',JSON.stringify(learner.snapshot()));fs.renameSync(checkpoint+'.tmp',checkpoint);};
 const features=o=>[o.health/20,o.food/20,Number(o.foodAvailable),Math.min(1,o.hostileDistance/24),Math.min(1,o.inventoryCount/36),Number(o.blocked),Math.min(1,(o.displacement??0)/4)];
 const terminal=()=>{if(pending&&training){learner.observe({...pending,reward:-5,terminal:true});log({type:'option_terminal',action:pending.action,reward:-5});}pending=null;save();};
 return {
  choose(o){
   const state=features(o),mask=[o.foodAvailable,true,true,true];
   const key=Math.floor(o.position.x/4)+','+Math.floor(o.position.z/4);
   if(pending){
    const reward=(visited.has(key)?0:0.2)+Math.min(0,o.health-pending.health)*0.5+Math.max(0,o.food-pending.food)*0.05+Math.max(0,o.inventoryCount-pending.inventoryCount)*0.1-0.02;
    if(training)learner.observe({...pending,reward,nextState:state,nextMask:mask,terminal:false});
    log({type:'option_transition',action:pending.action,reward,...learner.stats()});
   }
   visited.add(key);const choice=learner.choose(state,mask);
   pending={state,index:choice.index,action:choice.action,health:o.health,food:o.food,inventoryCount:o.inventoryCount};
   log({type:'option_decision',...choice,features:state,mask,origin:'neural_policy',capabilityTier:'scripted_assisted_options'});
   if(learner.stats().updates%40===0)save();
   return choice.action;
  },
  terminal,stop:()=>{pending=null;save();},stats:learner.stats
 };
}
