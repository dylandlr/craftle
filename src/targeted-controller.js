import fs from 'node:fs';
import path from 'node:path';
import {createOptionDQN} from './option-dqn.js';
import {seededOptionRandom} from './learning-options.js';
import {TARGET_ACTIONS,TARGET_INPUTS,TARGET_SCHEMA,encodeTargets,decodeTargetAction} from './target-opportunities.js';
export function createTargetedController({checkpoint,mode='training',seed=1,epsilon=0.3,rewardVersion='v1',log=()=>{}}={}){
 if(!['training','frozen','random','scripted','auto_eat'].includes(mode))throw Error('Invalid targeted policy mode');
 if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw Error('Invalid targeted epsilon');
 if(!['v1','v2'].includes(rewardVersion))throw Error('Invalid targeted reward version');
 if(mode==='frozen'&&(!checkpoint||!fs.existsSync(checkpoint)))throw Error('Frozen targeted policy requires checkpoint');
 const random=seededOptionRandom(seed),neural=['training','frozen'].includes(mode);
 const learner=neural?createOptionDQN({inputs:TARGET_INPUTS,options:TARGET_ACTIONS,schema:TARGET_SCHEMA,training:mode==='training',random,epsilon,snapshot:checkpoint&&fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint,'utf8')):null}):null;
 let pending=null,serial=0;
 const visited=new Set();
 const cell=p=>p&&[p.x,p.z].every(Number.isFinite)?Math.floor(p.x/8)+','+Math.floor(p.z/8):null;
 const stats=()=>({...learner?.stats()??{updates:0,replaySize:0,training:false},mode});
 const save=()=>{if(mode!=='training'||!checkpoint)return;fs.mkdirSync(path.dirname(checkpoint),{recursive:true});fs.writeFileSync(checkpoint+'.tmp',JSON.stringify(learner.snapshot()));fs.renameSync(checkpoint+'.tmp',checkpoint);};
 return {
  choose(o){
   const {features,mask}=encodeTargets(o);
   if(rewardVersion==='v2'&&!pending){const key=cell(o.position);if(key)visited.add(key);}
   if(pending){
    if(Number.isFinite(o.foodUnits)&&Number.isFinite(pending.foodUnits))log({type:'target_inventory_observed',decisionId:pending.decisionId,action:pending.action,previousFoodUnits:pending.foodUnits,currentFoodUnits:o.foodUnits,deltaFoodUnits:o.foodUnits-pending.foodUnits,evidence:'subsequent_observation_not_causal_proof'});
    let reward=pending.credit+Math.min(0,o.health-pending.health)*0.7-0.03;
    if(rewardVersion==='v2'){
      // Intrinsic spatial novelty is awarded at most once per coarse cell.
      // Inventory gain is evidence of progress, not causal proof of a skill succeeding.
      const key=cell(o.position);
      const novelty=key&&!visited.has(key)?0.12:0;
      if(key)visited.add(key);
      const foodGain=Number.isFinite(o.foodUnits)&&Number.isFinite(pending.foodUnits)?
        Math.max(0,o.foodUnits-pending.foodUnits):0;
      const inventoryProgress=Math.min(0.45,foodGain*0.15);
      const movement=Number.isFinite(o.displacement)?Math.min(0.03,Math.max(0,o.displacement)*0.01):0;
      reward+=novelty+inventoryProgress+movement;
      log({type:'target_reward_components',decisionId:pending.decisionId,rewardVersion,
        novelty,inventoryProgress,movement,foodGain,causalAttribution:'unverified_observation'});
    }
    if(mode==='training')learner.observe({...pending,state:pending.state,reward,nextState:features,nextMask:mask,steps:1});
    log({type:'target_transition',decisionId:pending.decisionId,action:pending.action,reward,...stats()});
   }
   let index;
   if(mode==='random'){const ids=mask.flatMap((yes,i)=>yes?[i]:[]);index=ids[Math.floor(random()*ids.length)];}
   else if(mode==='scripted'||mode==='auto_eat'){
    let action=o.hostileDistance<8?'retreat':mode==='scripted'&&mask[0]?'eat':null;
    if(!action){for(let i=0;i<o.targets.length;i++){const t=o.targets[i];const name=t.reachable&&t.kind==='plant'?`harvest_${i}`:t.reachable&&t.kind==='animal'?`attack_${i}`:`approach_${i}`;if(mask[TARGET_ACTIONS.indexOf(name)]){action=name;break;}}}
    index=TARGET_ACTIONS.indexOf(action??'explore');
    if(mode==='auto_eat'&&index===0)throw Error('Auto-eat control cannot choose neural eat action');
   }else index=learner.choose(features,mask).index;
   const choice=decodeTargetAction(index,o),decisionId=++serial;
   pending={state:features,index,action:TARGET_ACTIONS[index],health:o.health,foodUnits:o.foodUnits,credit:0,decisionId};
   log({type:'target_decision',decisionId,...choice,action:pending.action,features,mask,targets:o.targets,mode,seed,contract:'targeted44-actions15-v1',rewardVersion,capabilityTier:'scripted_targeted_skills'});
   if(mode==='training'&&stats().updates%40===0)save();
   return {...choice,decisionId};
  },
  consumed(decisionId,before,after){
   if(!pending||pending.decisionId!==decisionId||pending.action!=='eat'||pending.credit||!Number.isFinite(before)||!Number.isFinite(after)||after<=before)return false;
   pending.credit=1;log({type:'target_verified_recovery',decisionId,beforeFood:before,afterFood:after,reward:1});return true;
  },
  terminal(){if(pending){const reward=pending.credit-5;if(mode==='training')learner.observe({...pending,reward,terminal:true});log({type:'target_terminal',decisionId:pending.decisionId,reward,...stats()});}pending=null;save();},
  truncate(){pending=null;},stop(){pending=null;save();},stats
 };
}
