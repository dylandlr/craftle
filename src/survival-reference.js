// Privileged-state scripted survival reference, not a vision-only or learned policy.
import pathfinderPackage from 'mineflayer-pathfinder';
import {foodPlantAction,plantKey,findFoodPlant,foodSearchCell,chooseFoodSearchWaypoint} from './food-foraging.js';
export const HOSTILE_MOBS=new Set(['zombie','husk','drowned','skeleton','stray','spider','cave_spider','creeper','witch','pillager','endermite','silverfish']);
export function chooseSurvivalGoal({health=20,food=20,hostileDistance=Infinity,foodAvailable=false,hasFood=false,blocked=false}={}){
 if(hostileDistance<8)return 'retreat';
 if(food<=18&&foodAvailable)return 'eat';
 if(health<=7&&food>=18)return 'retreat';
 if(!hasFood)return 'forage';
 if(blocked)return 'reroute';
 return 'explore';
}
export function createFoodTargetMemory({clock=Date.now,attemptMs=20000,cooldownMs=30000}={}){
 const blocked=new Map();let active=null;
 return {
  available(id){return !blocked.has(id)||clock()>=blocked.get(id);},
  begin(id){if(active?.id!==id)active={id,started:clock()};},
  expired(){return active!==null&&clock()-active.started>=attemptMs;},
  fail(){if(active)blocked.set(active.id,clock()+cooldownMs);active=null;},
  reset(){active=null;blocked.clear();}
 };
}
export function startSurvivalReference(bot,{log=()=>{},intervalMs=1800,autoStart=true,navigation=pathfinderPackage,clock=Date.now}={}){
 const {pathfinder,Movements,goals:{GoalNear,GoalXZ}}=navigation;
 bot.loadPlugin(pathfinder);
 const movement=new Movements(bot);
 movement.canDig=false;movement.allow1by1towers=false;movement.allowParkour=false;movement.maxDropDown=1;
 bot.pathfinder.setMovements(movement);
 const foodTargets=createFoodTargetMemory({clock});
 const searchVisits=new Map(),searchBlocked=new Map();let currentSearchKey=null;
 const actions=[];
 let tick=0,busy=false,ended=false,dead=false,life=0,positionBefore=null,stalledIntervals=0;
 let currentGoal=null,goalSince=0,timer=null;
 const record=(type,data={})=>{const e={type,sequence:actions.length,life,...data};actions.push(e);log(e);};
 const cancel=()=>{
   foodTargets.reset();
   currentGoal=null;positionBefore=null;stalledIntervals=0;
   bot.pathfinder.setGoal(null);
   bot.clearControlStates();
   bot.deactivateItem?.();
 };
 const onDeath=()=>{
   if(ended||dead)return;
   dead=true;life++;cancel();
   record('survival_reference_death',{health:bot.health});
 };
 const onSpawn=()=>{
   if(ended)return;
   dead=false;life++;cancel();
   record('survival_reference_respawn');
 };
 const onGoalReached=()=>{currentGoal=null;};
 const onPathUpdate=result=>{
   if(result.status==='noPath'){
     foodTargets.fail();
     if(currentSearchKey)searchBlocked.set(currentSearchKey,clock()+30000);
     currentSearchKey=null;
     currentGoal=null;
     record('survival_reference_navigation_outcome',{status:'noPath'});
   }
 };
 bot.on('death',onDeath);
 bot.on('spawn',onSpawn);
 bot.on('goal_reached',onGoalReached);
 bot.on('path_update',onPathUpdate);
 const setGoal=goal=>{currentGoal=goal;goalSince=clock();stalledIntervals=0;bot.pathfinder.setGoal(goal);};
 const step=async()=>{
   if(ended||dead||busy||!bot.entity||bot.health<=0)return;
   busy=true;
   const currentLife=life;
   const valid=()=>!ended&&!dead&&life===currentLife;
   try{
     const pos=bot.entity.position;
     const cell=foodSearchCell(pos);searchVisits.set(cell,(searchVisits.get(cell)??0)+1);
     const displacement=positionBefore?Math.hypot(pos.x-positionBefore.x,pos.z-positionBefore.z):null;
     stalledIntervals=displacement!==null&&displacement<0.3?stalledIntervals+1:0;
     const threats=Object.values(bot.entities).filter(e=>e&&HOSTILE_MOBS.has(e.name)&&e.position);
     threats.sort((a,b)=>a.position.distanceTo(pos)-b.position.distanceTo(pos));
     const threat=threats[0],distance=threat?threat.position.distanceTo(pos):Infinity;
     const inventory=bot.inventory?.items?.()??[];
     const edible=inventory.find(item=>bot.registry?.foodsByName?.[item.name]&&!['pufferfish','poisonous_potato','spider_eye','rotten_flesh','chicken'].includes(item.name));
     const foodAvailable=Boolean(edible);
     const objective=chooseSurvivalGoal({health:bot.health,food:bot.food,hostileDistance:distance,foodAvailable,hasFood:inventory.filter(item=>bot.registry?.foodsByName?.[item.name]&&!['pufferfish','poisonous_potato','spider_eye','rotten_flesh','chicken'].includes(item.name)).reduce((sum,item)=>sum+(bot.registry.foodsByName[item.name].foodPoints??1)*item.count,0)>=8,blocked:stalledIntervals>=3});
     if(objective==='eat'&&edible){
       bot.pathfinder.setGoal(null);currentGoal=null;
       await bot.equip(edible,'hand');
       if(!valid())return;
       const beforeFood=bot.food;
       await bot.consume();
       if(!valid())return;
       record('survival_reference_consumed',{item:edible.name,beforeFood,afterFood:bot.food});
     }else if(objective==='retreat'&&threat){
       const dx=pos.x-threat.position.x,dz=pos.z-threat.position.z,len=Math.max(0.01,Math.hypot(dx,dz));
       setGoal(new GoalNear(Math.floor(pos.x+dx/len*12),Math.floor(pos.y),Math.floor(pos.z+dz/len*12),2));
     }else if(objective==='forage'){
       // Scripted reference knowledge only: collect edible drops, then hunt passive food animals.
       if(foodTargets.expired()){foodTargets.fail();currentGoal=null;record('survival_reference_food_target_abandoned');}
       const entities=Object.values(bot.entities).filter(e=>e?.position&&e.position.distanceTo(pos)<=24&&foodTargets.available(e.id));
       const drops=entities.map(e=>({entity:e,item:e.getDroppedItem?.()}))
         .filter(x=>x.item&&bot.registry?.foodsByName?.[x.item.name]&&!['pufferfish','poisonous_potato','spider_eye','rotten_flesh','chicken'].includes(x.item.name));
       drops.sort((a,b)=>a.entity.position.distanceTo(pos)-b.entity.position.distanceTo(pos));
       const animals=entities.filter(e=>['pig','cow','sheep','rabbit'].includes(e.name)&&e.position.distanceTo(pos)<=24);
       animals.sort((a,b)=>a.position.distanceTo(pos)-b.position.distanceTo(pos));
       const plant=findFoodPlant(bot,id=>foodTargets.available(id));
       const target=drops[0]?.entity??plant??animals[0];
       const targetKind=drops.length?'drop':plant?'plant':animals.length?'animal':null;
       record('survival_reference_food_search',{status:target?'target_found':'no_target',targetKind,edibleDrops:drops.length,foodAnimals:animals.length,harvestablePlant:plant?.name??null});
       if(target){
         currentSearchKey=null;
         foodTargets.begin(targetKind==='plant'?plantKey(target):target.id);
         const p=target.position,range=targetKind==='drop'?0:1;
         setGoal(new GoalNear(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z),range));
         if(targetKind==='plant'&&p.distanceTo(pos)<4.2){
           bot.pathfinder.setGoal(null);currentGoal=null;
           const block=bot.blockAt(p),action=foodPlantAction(block);
           if(action){
             if(action==='activate')await bot.activateBlock(block);else await bot.dig(block);
             if(!valid())return;
             record('survival_reference_plant_harvest',{plant:block.name,action,position:{x:p.x,y:p.y,z:p.z}});
           }
         }else if(targetKind==='animal'&&p.distanceTo(pos)<3){
           bot.pathfinder.setGoal(null);currentGoal=null;
           await bot.lookAt(p.offset(0,(target.height??1)/2,0),true);
           if(!valid())return;
           bot.attack(target);
           record('survival_reference_hunt',{entity:target.name,entityId:target.id});
         }
       }else if(!currentGoal||stalledIntervals>=3||clock()-goalSince>=15000){
         const waypoint=chooseFoodSearchWaypoint(pos,searchVisits,tick,key=>(searchBlocked.get(key)??0)<=clock());
         if(waypoint){
           currentSearchKey=foodSearchCell(waypoint);
           setGoal(new GoalXZ(waypoint.x,waypoint.z));
           record('survival_reference_food_search_waypoint',{position:waypoint,previousVisits:searchVisits.get(currentSearchKey)??0});
         }
       }
     }else if(objective==='retreat'){
       bot.pathfinder.setGoal(null);currentGoal=null;
     }else if(!currentGoal||stalledIntervals>=3||clock()-goalSince>=15000){
       // Preserve each waypoint until arrival, a path failure, sustained stall, or timeout.
       // Explore when no survival interaction is needed.
       const heading=(tick*2.399963229728653)%(Math.PI*2);
       const radius=8+(tick%3)*4;
       setGoal(new GoalNear(Math.floor(pos.x+Math.cos(heading)*radius),Math.floor(pos.y),Math.floor(pos.z+Math.sin(heading)*radius),2));
     }
     if(!valid())return;
     positionBefore=pos.clone();
     const observedInventory=bot.inventory?.items?.()??[];
     record('survival_reference_action',{tick,objective,policyOrigin:'SCRIPTED',health:bot.health,food:bot.food,
       hostileDistance:Number.isFinite(distance)?distance:null,position:{x:pos.x,y:pos.y,z:pos.z},
       horizontalDisplacement:displacement,inventoryCount:observedInventory.length,inventory:observedInventory.map(({name,count})=>({name,count}))});
     tick++;
   }catch(error){
     if(valid())record('survival_reference_error',{message:error.message});
   }finally{busy=false;}
 };
 const stop=()=>{
   if(ended)return;
   ended=true;life++;
   if(timer)clearInterval(timer);
   bot.removeListener('death',onDeath);bot.removeListener('spawn',onSpawn);
   bot.removeListener('goal_reached',onGoalReached);bot.removeListener('path_update',onPathUpdate);
   bot.removeListener('end',stop);
   cancel();
 };
 bot.once('end',stop);
 if(autoStart)timer=setInterval(()=>{void step();},intervalMs);
 return {stop,step,events:()=>actions.slice()};
}
