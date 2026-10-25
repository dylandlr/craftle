import fs from 'node:fs';
import path from 'node:path';
import {createOptionDQN} from './option-dqn.js';
import {seededOptionRandom} from './learning-options.js';
import {TARGET_ACTIONS,TARGET_INPUTS,TARGET_SCHEMA,encodeTargets,decodeTargetAction} from './target-opportunities.js';
export function createTargetedController({checkpoint,mode='training',seed=1,epsilon=0.3,log=()=>{}}={}){
 if(!['training','frozen','random','scripted','auto_eat'].includes(mode))throw Error('Invalid targeted policy mode');
 if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw Error('Invalid targeted epsilon');
 if(mode==='frozen'&&(!checkpoint||!fs.existsSync(checkpoint)))throw Error('Frozen targeted policy requires checkpoint');
 const random=seededOptionRandom(seed),neural=['training','frozen'].includes(mode);
 const learner=neural?createOptionDQN({inputs:TARGET_INPUTS,options:TARGET_ACTIONS,schema:TARGET_SCHEMA,training:mode==='training',random,epsilon,snapshot:checkpoint&&fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint,'utf8')):null}):null;
 let pending=null,serial=0;
 const stats=()=>({...learner?.stats()??{updates:0,replaySize:0,training:false},mode});
 const save=()=>{if(mode!=='training'||!checkpoint)return;fs.mkdirSync(path.dirname(checkpoint),{recursive:true});fs.writeFileSync(checkpoint+'.tmp',JSON.stringify(learner.snapshot()));fs.renameSync(checkpoint+'.tmp',checkpoint);};
 return {
  choose(o){
   const {features,mask}=encodeTargets(o);
   if(pending){
    if(Number.isFinite(o.foodUnits)&&Number.isFinite(pending.foodUnits))log({type:'target_inventory_observed',decisionId:pending.decisionId,action:pending.action,previousFoodUnits:pending.foodUnits,currentFoodUnits:o.foodUnits,deltaFoodUnits:o.foodUnits-pending.foodUnits,evidence:'subsequent_observation_not_causal_proof'});
    const reward=pending.credit+Math.min(0,o.health-pending.health)*0.7-0.03;
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
   log({type:'target_decision',decisionId,...choice,action:pending.action,features,mask,targets:o.targets,mode,seed,contract:'targeted44-actions15-v1',capabilityTier:'scripted_targeted_skills'});
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
