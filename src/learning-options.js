import fs from 'node:fs';
import path from 'node:path';
import {createOptionDQN,OPTIONS} from './option-dqn.js';
export function seededOptionRandom(seed=1){
 if(!Number.isSafeInteger(seed))throw Error('Invalid option seed');
 let state=(seed>>>0)||1;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
}
export function createLearningOptionController({checkpoint,log=()=>{},training=true,mode=training?'training':'frozen',seed=1}={}){
 if(!['training','frozen','random','scripted'].includes(mode))throw Error('Unknown option policy');
 const random=seededOptionRandom(seed),neural=['training','frozen'].includes(mode);
 if(mode==='frozen'&&(!checkpoint||!fs.existsSync(checkpoint)))throw Error('Frozen options require a checkpoint');
 const learner=neural?createOptionDQN({training:mode==='training',random,snapshot:checkpoint&&fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint,'utf8')):null}):null;
 const stats=()=>({...learner?.stats()??{updates:0,replaySize:0,training:false},mode,seed});
 let pending=null;const visited=new Set();
 const save=()=>{if(mode!=='training'||!checkpoint)return;fs.mkdirSync(path.dirname(checkpoint),{recursive:true});fs.writeFileSync(checkpoint+'.tmp',JSON.stringify(learner.snapshot()));fs.renameSync(checkpoint+'.tmp',checkpoint);};
 const features=o=>[o.health/20,o.food/20,Number(o.foodAvailable),Math.min(1,o.hostileDistance/24),Math.min(1,o.inventoryCount/36),Number(o.blocked),Math.min(1,(o.displacement??0)/4)];
 const terminal=()=>{if(pending&&mode==='training'){learner.observe({...pending,reward:-5,terminal:true});log({type:'option_terminal',action:pending.action,reward:-5});}pending=null;save();};
 return {
  choose(o){
   const state=features(o),mask=[o.foodAvailable,true,true,true];
   const key=Math.floor(o.position.x/4)+','+Math.floor(o.position.z/4);
   if(pending){
    const reward=(visited.has(key)?0:0.2)+Math.min(0,o.health-pending.health)*0.5+Math.max(0,o.food-pending.food)*0.05+Math.max(0,o.inventoryCount-pending.inventoryCount)*0.1-0.02;
    if(mode==='training')learner.observe({...pending,reward,nextState:state,nextMask:mask,terminal:false});
    log({type:'option_transition',action:pending.action,reward,...stats()});
   }
   visited.add(key);let choice;
   if(mode==='random'){
    const available=OPTIONS.filter((_,i)=>mask[i]);const action=available[Math.floor(random()*available.length)];
    choice={action,index:OPTIONS.indexOf(action)};
   }else if(mode==='scripted'){
    // Same declared observations as the learner; no extra block/entity queries here.
    const action=o.hostileDistance<8?'retreat':o.food<=18&&o.foodAvailable?'eat':o.health<=7&&o.food>=18?'retreat':!o.foodAvailable?'forage':'explore';
    choice={action,index:OPTIONS.indexOf(action)};
   }else choice=learner.choose(state,mask);
   pending={state,index:choice.index,action:choice.action,health:o.health,food:o.food,inventoryCount:o.inventoryCount};
   log({type:'option_decision',...choice,features:state,mask,origin:neural?'neural_policy':mode+'_option_policy',mode,seed,capabilityTier:'scripted_assisted_options'});
   if(stats().updates%40===0)save();
   return choice.action;
  },
  terminal,stop:()=>{pending=null;save();},stats
 };
}
