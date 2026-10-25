import pathfinderPackage from 'mineflayer-pathfinder';
import {HOSTILE_MOBS} from './survival-reference.js';
import {observeTargets,edible} from './target-opportunities.js';
import {foodPlantAction} from './food-foraging.js';
// Each decision selects one skill and one concrete target. No automatic forage chain.
export function startTargetedSurvival(bot,{decisionController,log=()=>{},navigation=pathfinderPackage,autoStart=true,intervalMs=1800,clock=Date.now}={}){
 if(!decisionController)throw Error('Targeted policy required');
 const {pathfinder,Movements,goals:{GoalNear,GoalXZ}}=navigation;
 bot.loadPlugin(pathfinder);const movements=new Movements(bot);
 Object.assign(movements,{canDig:false,allow1by1towers:false,allowParkour:false,maxDropDown:1});bot.pathfinder.setMovements(movements);
 let ended=false,dead=false,busy=false,life=0,tick=0,lastPosition=null,stalls=0,goal=null,timer;
 const clearGoal=()=>{goal=null;bot.pathfinder.setGoal(null);};
 const cancel=()=>{clearGoal();bot.clearControlStates();bot.deactivateItem?.();lastPosition=null;stalls=0;};
 const death=()=>{if(ended||dead)return;dead=true;life++;decisionController.terminal();cancel();};
 const spawn=()=>{if(ended)return;dead=false;life++;decisionController.truncate?.();cancel();};
 const reached=()=>{goal=null;};
 const pathUpdate=result=>{if(result.status==='noPath'&&goal){clearGoal();log({type:'target_navigation_result',status:'noPath',life});}};
 const setGoal=(key,p,range=1,horizontal=false)=>{
  if(goal?.key===key&&Math.hypot(p.x-goal.x,p.y-goal.y,p.z-goal.z)<=1&&clock()-goal.at<15000&&stalls<3)return;
  goal={key,x:p.x,y:p.y,z:p.z,at:clock()};
  bot.pathfinder.setGoal(horizontal?new GoalXZ(Math.floor(p.x),Math.floor(p.z)):new GoalNear(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z),range));
 };
 const step=async()=>{
  if(ended||dead||busy||!bot.entity||bot.health<=0)return;
  busy=true;const epoch=life,valid=()=>!ended&&!dead&&epoch===life;
  try{
   const p=bot.entity.position,displacement=lastPosition?Math.hypot(p.x-lastPosition.x,p.z-lastPosition.z):0;
   stalls=lastPosition&&displacement<0.3?stalls+1:0;
   const observation=observeTargets(bot,{hostileNames:HOSTILE_MOBS,blocked:stalls>=3,displacement});
   const choice=decisionController.choose(observation);
   const target=observation.targets.find(t=>t.id===choice.targetId);
   if(choice.skill==='approach'&&target){setGoal(target.id,target.position,target.kind==='drop'?0:1);}
   else if(choice.skill==='explore'){
    if(goal?.key!=='explore'||stalls>=3||clock()-goal.at>=15000){const a=tick*2.399963229728653;setGoal('explore',{x:p.x+Math.cos(a)*16,y:p.y,z:p.z+Math.sin(a)*16},1,true);}
   }else if(choice.skill==='retreat'){
    const threats=Object.values(bot.entities).filter(e=>e?.position&&HOSTILE_MOBS.has(e.name));
    threats.sort((a,b)=>a.position.distanceTo(p)-b.position.distanceTo(p));const threat=threats[0];
    if(threat){const dx=p.x-threat.position.x,dz=p.z-threat.position.z,len=Math.max(0.01,Math.hypot(dx,dz));setGoal('retreat',{x:p.x+dx/len*12,y:p.y,z:p.z+dz/len*12},2);}else clearGoal();
   }else{
    clearGoal();
    if(choice.skill==='eat'){
     const item=bot.inventory.items().find(item=>edible(bot,item));
     if(item&&bot.food<20){await bot.equip(item,'hand');if(!valid())return;const before=bot.food;await bot.consume();if(!valid())return;const credited=decisionController.consumed(choice.decisionId,before,bot.food);log({type:'target_consumed',decisionId:choice.decisionId,item:item.name,beforeFood:before,afterFood:bot.food,credited});}
    }else if(choice.skill==='harvest'&&target?.kind==='plant'&&target.reachable){
     const block=bot.blockAt(p.offset(target.position.x-p.x,target.position.y-p.y,target.position.z-p.z)),action=foodPlantAction(block);
     if(action&&bot.canSeeBlock?.(block)){if(action==='dig')await bot.dig(block);else await bot.activateBlock(block);if(!valid())return;log({type:'target_harvest_attempt',decisionId:choice.decisionId,targetId:target.id,plant:block.name});}
    }else if(choice.skill==='attack'&&target?.kind==='animal'){
     const entity=Object.values(bot.entities).find(e=>`entity:${e?.id}`===target.id);
     if(entity?.position&&entity.position.distanceTo(p)<3&&bot.canSeeEntity?.(entity)){await bot.lookAt(entity.position.offset(0,(entity.height??1)/2,0),true);if(!valid())return;bot.attack(entity);log({type:'target_attack_attempt',decisionId:choice.decisionId,targetId:target.id});}
    }
   }
   if(!valid())return;
   lastPosition={x:p.x,z:p.z};tick++;
   log({type:'target_action',life,...choice,health:bot.health,food:bot.food,position:{x:p.x,y:p.y,z:p.z}});
  }catch(error){if(valid())log({type:'target_runtime_error',message:error.message});}finally{busy=false;}
 };
 const stop=()=>{if(ended)return;ended=true;life++;if(timer)clearInterval(timer);decisionController.stop();for(const [event,listener] of [['death',death],['spawn',spawn],['goal_reached',reached],['path_update',pathUpdate],['end',stop]])bot.removeListener(event,listener);cancel();};
 bot.on('death',death);bot.on('spawn',spawn);bot.on('goal_reached',reached);bot.on('path_update',pathUpdate);bot.once('end',stop);
 if(autoStart)timer=setInterval(()=>void step(),intervalMs);
 return {step,stop};
}
