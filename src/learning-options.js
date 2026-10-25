import fs from 'node:fs';
import path from 'node:path';
import {createOptionDQN,OPTIONS} from './option-dqn.js';
export function seededOptionRandom(seed=1){
 if(!Number.isSafeInteger(seed))throw Error('Invalid option seed');
 let state=(seed>>>0)||1;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
}
export function createLearningOptionController({checkpoint,log=()=>{},training=true,mode=training?'training':'frozen',seed=1,commitmentSteps=1,rewardVersion='v1',epsilon=0.3}={}){
 if(!['training','frozen','random','scripted'].includes(mode))throw Error('Unknown option policy');
 if(!Number.isInteger(commitmentSteps)||commitmentSteps<1||commitmentSteps>32)throw Error('Invalid option commitment');
 if(!['v1','v2','v3'].includes(rewardVersion))throw Error('Unknown option reward version');
 if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw Error('Invalid exploration epsilon');
 const gamma=0.95;
 const random=seededOptionRandom(seed),neural=['training','frozen'].includes(mode);
 if(mode==='frozen'&&(!checkpoint||!fs.existsSync(checkpoint)))throw Error('Frozen options require a checkpoint');
 const learner=neural?createOptionDQN({training:mode==='training',random,epsilon,snapshot:checkpoint&&fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint,'utf8')):null}):null;
 const stats=()=>({...learner?.stats()??{updates:0,replaySize:0,training:false},mode,seed,rewardVersion,epsilon});
 let pending=null,previous=null;const visited=new Set();const credited=new Set();
 const save=()=>{if(mode!=='training'||!checkpoint)return;fs.mkdirSync(path.dirname(checkpoint),{recursive:true});fs.writeFileSync(checkpoint+'.tmp',JSON.stringify(learner.snapshot()));fs.renameSync(checkpoint+'.tmp',checkpoint);};
 const features=o=>[o.health/20,o.food/20,Number(o.foodAvailable),Math.min(1,o.hostileDistance/24),Math.min(1,o.inventoryCount/36),Number(o.blocked),Math.min(1,(o.displacement??0)/4)];
 const terminal=()=>{if(pending&&mode==='training'){const reward=pending.reward-5*Math.pow(gamma,pending.steps);learner.observe({...pending,reward,terminal:true});log({type:'option_terminal',action:pending.action,reward,steps:pending.steps});}pending=null;previous=null;save();};
 return {
  choose(o){
   const state=features(o),mask=[o.foodAvailable,true,true,true];
   const key=Math.floor(o.position.x/4)+','+Math.floor(o.position.z/4);
   if(pending){
    const foodGain=Math.max(0,o.food-previous.food),inventoryGain=Math.max(0,o.inventoryCount-previous.inventoryCount);
    const reward=rewardVersion==='v3'
      ?(visited.has(key)?0:0.10)+Math.min(0,o.health-previous.health)*0.7-0.03
      :rewardVersion==='v2'
      ?(visited.has(key)?0:0.15)+Math.min(0,o.health-previous.health)*0.7+foodGain*0.5+inventoryGain*0.3-0.03
      :(visited.has(key)?0:0.2)+Math.min(0,o.health-previous.health)*0.5+foodGain*0.05+inventoryGain*0.1-0.02;
    pending.reward+=Math.pow(gamma,pending.steps)*reward;pending.steps++;
    const invalid=!mask[pending.index];
    const changedThreat=(o.hostileDistance<8)!==previous.threat;
    const completed=pending.action==='eat'&&o.food>previous.food;
    previous={health:o.health,food:o.food,inventoryCount:o.inventoryCount,threat:o.hostileDistance<8};
    visited.add(key);
    if(pending.steps<commitmentSteps&&!invalid&&!changedThreat&&!completed&&!o.blocked){
     log({type:'option_continued',action:pending.action,steps:pending.steps,commitmentSteps});
     return pending.action;
    }
    if(mode==='training')learner.observe({...pending,reward:pending.reward,nextState:state,nextMask:mask,terminal:false});
    log({type:'option_transition',action:pending.action,reward:pending.reward,rewardVersion,steps:pending.steps,reason:invalid?'invalid':changedThreat?'threat_changed':completed?'completed':o.blocked?'blocked':'horizon',...stats()});
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
   pending={state,index:choice.index,action:choice.action,reward:0,steps:0,attributionId:null};
   previous={health:o.health,food:o.food,inventoryCount:o.inventoryCount,threat:o.hostileDistance<8};
   log({type:'option_decision',...choice,features:state,mask,origin:neural?'neural_policy':mode+'_option_policy',mode,seed,commitmentSteps,rewardVersion,epsilon,capabilityTier:'scripted_assisted_options'});
   if(stats().updates%40===0)save();
   return choice.action;
  },
  bindOutcomeOption(optionId){if(pending)pending.attributionId=optionId;},
  creditOutcome(event){
   if(rewardVersion!=='v3'||mode!=='training'||!pending||event?.kind!=='option_outcome'||event.evidence!=='verified_hunger_recovery'||event.option!==pending.action||!pending.attributionId||event.optionId!==pending.attributionId)return false;
   const key=[event.life,event.optionId,event.sequence].join(':');
   if(credited.has(key))return false;
   credited.add(key);
   pending.reward+=Math.pow(gamma,pending.steps)*1.0;
   log({type:'option_verified_reward',sourceSequence:event.sequence,optionId:event.optionId,action:pending.action,reward:1.0});
   return true;
  },
  terminal,stop:()=>{pending=null;previous=null;save();},stats
 };
}
