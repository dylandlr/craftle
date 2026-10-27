import {loader as autoEatPlugin} from 'mineflayer-auto-eat';
import pathfinderPackage from 'mineflayer-pathfinder';
import {HOSTILE_MOBS} from './survival-reference.js';
import {observeTargets,edible} from './target-opportunities.js';
import {foodPlantAction} from './food-foraging.js';
import {attachFoodProvenance} from './food-provenance.js';
import {createFoodSequenceTracker} from './food-sequence-tracker.js';
import {chooseGroundedExploreGoal} from './grounded-exploration.js';
// Each decision selects one skill and one concrete target. No automatic forage chain.
export function startTargetedSurvival(bot,{decisionController,log=()=>{},navigation=pathfinderPackage,autoStart=true,intervalMs=1800,clock=Date.now,autoEatControl=false}={}){
 if(!decisionController)throw Error('Targeted policy required');
 const {pathfinder,Movements,goals:{GoalNear,GoalXZ}}=navigation;
 if(autoEatControl){
  bot.loadPlugin(autoEatPlugin);
  bot.autoEat.setOpts({minHunger:15,priority:'foodPoints'});
  bot.autoEat.on('eatStart',opts=>log({type:'auto_eat_start',food:opts.food?.name??null,foodBefore:bot.food,decisionSource:'plugin_threshold',learned:false}));
  bot.autoEat.on('eatFinish',opts=>log({type:'auto_eat_finish',food:opts.food?.name??null,foodAfter:bot.food,decisionSource:'plugin_threshold',learned:false}));
  bot.autoEat.on('eatFail',error=>log({type:'auto_eat_failure',message:error?.message??String(error),decisionSource:'plugin_threshold'}));
  bot.autoEat.enableAuto();log({type:'auto_eat_control_enabled',minHunger:15,priority:'foodPoints',learned:false});
 }
 bot.loadPlugin(pathfinder);const movements=new Movements(bot);
 Object.assign(movements,{canDig:false,allow1by1towers:false,allowParkour:false,maxDropDown:1});bot.pathfinder.setMovements(movements);
 let ended=false,dead=false,busy=false,life=0,tick=0,lastPosition=null,stalls=0,goal=null,timer,activeDecision=null;
 const provenance=attachFoodProvenance(bot,{log,getDecision:()=>activeDecision,clock});
 const sequences=createFoodSequenceTracker({log,clock});
 let previousFoodUnits=null;
 const groundedExplore=process.env.CRAFTLE_GROUNDED_EXPLORATION==='1';
 const failedExplore=new Set();
 log({type:'exploration_execution_variant',variant:groundedExplore?'grounded_v1':'legacy_v1',learned:false});
 const clearGoal=()=>{goal=null;bot.pathfinder.setGoal(null);};
 const cancel=()=>{clearGoal();bot.clearControlStates();bot.deactivateItem?.();lastPosition=null;stalls=0;};
 const death=()=>{if(ended||dead)return;dead=true;life++;sequences.death();decisionController.terminal();cancel();};
 const spawn=()=>{if(ended)return;dead=false;life++;decisionController.truncate?.();cancel();};
 const reached=()=>{goal=null;};
 const pathUpdate=result=>{if(result.status==='noPath'&&goal){const failed={...goal};if(groundedExplore&&failed.key==='explore'){failedExplore.add([Math.floor(failed.x),Math.floor(failed.z)].join(','));if(failedExplore.size>256)failedExplore.clear();}clearGoal();log({type:'target_navigation_result',status:'noPath',life,decisionId:activeDecision?.decisionId??null,skill:activeDecision?.skill??null,goal:failed,position:bot.entity?.position?{x:bot.entity.position.x,y:bot.entity.position.y,z:bot.entity.position.z}:null,pathStatus:result.status});}};
 const setGoal=(key,p,range=1,horizontal=false)=>{
  if(goal?.key===key&&Math.hypot(p.x-goal.x,p.y-goal.y,p.z-goal.z)<=1&&clock()-goal.at<15000&&stalls<3)return;
  goal={key,x:p.x,y:p.y,z:p.z,at:clock()};
  log({type:'target_navigation_goal',decisionId:activeDecision?.decisionId??null,skill:activeDecision?.skill??null,goal:{...goal},range,horizontal});
  bot.pathfinder.setGoal(horizontal?new GoalXZ(Math.floor(p.x),Math.floor(p.z)):new GoalNear(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z),range));
 };
 const step=async()=>{
  if(ended||dead||busy||!bot.entity||bot.health<=0)return;
  busy=true;const epoch=life,valid=()=>!ended&&!dead&&epoch===life;
  try{
   let p=bot.entity.position;const displacement=lastPosition?Math.hypot(p.x-lastPosition.x,p.z-lastPosition.z):0;
   stalls=lastPosition&&displacement<0.3?stalls+1:0;
   if(stalls===3||stalls===8)log({type:'target_navigation_stall',decisionId:activeDecision?.decisionId??null,stalls,displacement,goal:goal?{...goal}:null,position:{x:p.x,y:p.y,z:p.z}});
   const observation=observeTargets(bot,{hostileNames:HOSTILE_MOBS,blocked:stalls>=3,displacement});
   const proposed=decisionController.choose(observation);
   const choice=typeof proposed?.then==='function'?await proposed:proposed;
   if(!valid())return;
   p=bot.entity.position;
   if(previousFoodUnits!==null)sequences.inventory({before:previousFoodUnits,after:observation.foodUnits});
   previousFoodUnits=observation.foodUnits;
   sequences.decision(choice);
   activeDecision={decisionId:choice.decisionId,skill:choice.skill,targetId:choice.targetId};
   const current=observeTargets(bot,{hostileNames:HOSTILE_MOBS,blocked:stalls>=3,displacement});
   const target=current.targets.find(t=>t.id===choice.targetId);
   if(['approach','harvest','attack'].includes(choice.skill)&&!target){clearGoal();log({type:'target_action_rejected',decisionId:choice.decisionId,reason:'target_no_longer_available'});return;}
   if(choice.skill==='approach'&&target){setGoal(target.id,target.position,target.kind==='drop'?0:1);}
   else if(choice.skill==='explore'){
    if(goal?.key!=='explore'||stalls>=3||clock()-goal.at>=15000){
     if(groundedExplore){
      const choice=chooseGroundedExploreGoal({origin:p,blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false),failed:failedExplore,seed:tick});
      log({type:'grounded_exploration_candidates',decisionId:activeDecision?.decisionId,viableCandidates:choice.viableCandidates,totalCandidates:choice.totalCandidates,chosen:choice.selected?.position??null,ground:choice.selected?.ground??null,leafFooting:choice.selected?.leaves??null});
      if(choice.selected)setGoal('explore',choice.selected.position,1,false);
      else{clearGoal();log({type:'grounded_exploration_no_safe_goal',decisionId:choice.decisionId??activeDecision?.decisionId});}
     }else{const a=tick*2.399963229728653;setGoal('explore',{x:p.x+Math.cos(a)*16,y:p.y,z:p.z+Math.sin(a)*16},1,true);}
    }
   }else if(choice.skill==='retreat'){
    const threats=Object.values(bot.entities).filter(e=>e?.position&&HOSTILE_MOBS.has(e.name));
    threats.sort((a,b)=>a.position.distanceTo(p)-b.position.distanceTo(p));const threat=threats[0];
    if(threat){const dx=p.x-threat.position.x,dz=p.z-threat.position.z,len=Math.max(0.01,Math.hypot(dx,dz));setGoal('retreat',{x:p.x+dx/len*12,y:p.y,z:p.z+dz/len*12},2);}else clearGoal();
   }else{
    clearGoal();
    if(choice.skill==='eat'){
     const item=bot.inventory.items().find(item=>edible(bot,item));
     if(item&&bot.food<20){await bot.equip(item,'hand');if(!valid())return;const before=bot.food;await bot.consume();if(!valid())return;const credited=decisionController.consumed(choice.decisionId,before,bot.food);sequences.consumed({before,after:bot.food,decisionId:choice.decisionId});log({type:bot.food>before?'target_consumed':'target_consume_no_hunger_gain',decisionId:choice.decisionId,item:item.name,beforeFood:before,afterFood:bot.food,credited});}
    }else if(choice.skill==='harvest'&&target?.kind==='plant'&&target.reachable){
     const block=bot.blockAt(p.offset(target.position.x-p.x,target.position.y-p.y,target.position.z-p.z)),action=foodPlantAction(block);
     if(action&&bot.canSeeBlock?.(block)){
      const before={name:block.name,stateId:block.stateId??null,properties:block.getProperties?.()??null};
      log({type:'target_harvest_intent',timestampMs:clock(),decisionId:choice.decisionId,targetId:target.id,targetPosition:{x:block.position.x,y:block.position.y,z:block.position.z},plant:block.name});
      if(action==='dig')await bot.dig(block);else await bot.activateBlock(block);
      if(!valid())return;
      const afterBlock=bot.blockAt(block.position);
      const after={name:afterBlock?.name??null,stateId:afterBlock?.stateId??null,properties:afterBlock?.getProperties?.()??null};
      const changed=before.stateId!==null&&after.stateId!==null?before.stateId!==after.stateId:JSON.stringify(before)!==JSON.stringify(after);
      log({type:'target_harvest_block_observation',timestampMs:clock(),decisionId:choice.decisionId,targetId:target.id,targetPosition:{x:block.position.x,y:block.position.y,z:block.position.z},action,before,after,changed,evidence:'client_world_observation_not_server_confirmation'});
      log({type:'target_harvest_attempt',decisionId:choice.decisionId,targetId:target.id,plant:block.name});
     }
    }else if(choice.skill==='attack'&&target?.kind==='animal'){
     const entity=Object.values(bot.entities).find(e=>`entity:${e?.id}`===target.id);
     if(entity?.position&&entity.position.distanceTo(p)<3&&bot.canSeeEntity?.(entity)){log({type:'target_attack_intent',timestampMs:clock(),decisionId:choice.decisionId,targetId:target.id,targetPosition:{x:entity.position.x,y:entity.position.y,z:entity.position.z}});await bot.lookAt(entity.position.offset(0,(entity.height??1)/2,0),true);if(!valid())return;bot.attack(entity);log({type:'target_attack_attempt',decisionId:choice.decisionId,targetId:target.id});}
    }
   }
   if(!valid())return;
   provenance.sample();lastPosition={x:p.x,z:p.z};tick++;
   log({type:'target_action',life,...choice,health:bot.health,food:bot.food,position:{x:p.x,y:p.y,z:p.z}});
  }catch(error){if(valid())log({type:'target_runtime_error',message:error.message});}finally{busy=false;}
 };
 const stop=()=>{if(ended)return;ended=true;life++;if(timer)clearInterval(timer);decisionController.stop();provenance.stop();sequences.stop();if(autoEatControl){bot.autoEat.disableAuto();bot.autoEat.cancelEat();}for(const [event,listener] of [['death',death],['spawn',spawn],['goal_reached',reached],['path_update',pathUpdate],['end',stop]])bot.removeListener(event,listener);cancel();};
 bot.on('death',death);bot.on('spawn',spawn);bot.on('goal_reached',reached);bot.on('path_update',pathUpdate);bot.once('end',stop);
 if(autoStart)timer=setInterval(()=>void step(),intervalMs);
 return {step,stop};
}
