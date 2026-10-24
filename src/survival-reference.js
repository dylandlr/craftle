// Privileged-state scripted survival reference, not a vision-only or learned policy.
import pathfinderPackage from 'mineflayer-pathfinder';
export const HOSTILE_MOBS=new Set(['zombie','husk','drowned','skeleton','stray','spider','cave_spider','creeper','witch','pillager','endermite','silverfish']);
export function chooseSurvivalGoal({health=20,food=20,hostileDistance=Infinity,foodAvailable=false,hasFood=false,blocked=false}={}){
 if(hostileDistance<8||health<=7)return 'retreat';
 if(food<=14&&foodAvailable)return 'eat';
 if(!hasFood)return 'forage';
 if(blocked)return 'reroute';
 return 'explore';
}
export function startSurvivalReference(bot,{log=()=>{},intervalMs=1800,autoStart=true,navigation=pathfinderPackage,clock=Date.now}={}){
 const {pathfinder,Movements,goals:{GoalNear}}=navigation;
 bot.loadPlugin(pathfinder);
 const movement=new Movements(bot);
 movement.canDig=false;movement.allow1by1towers=false;movement.allowParkour=false;movement.maxDropDown=1;
 bot.pathfinder.setMovements(movement);
 const actions=[];
 let tick=0,busy=false,ended=false,dead=false,life=0,positionBefore=null,stalledIntervals=0;
 let currentGoal=null,goalSince=0,timer=null;
 const record=(type,data={})=>{const e={type,sequence:actions.length,life,...data};actions.push(e);log(e);};
 const cancel=()=>{
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
     const displacement=positionBefore?Math.hypot(pos.x-positionBefore.x,pos.z-positionBefore.z):null;
     stalledIntervals=displacement!==null&&displacement<0.3?stalledIntervals+1:0;
     const threats=Object.values(bot.entities).filter(e=>e&&HOSTILE_MOBS.has(e.name)&&e.position);
     threats.sort((a,b)=>a.position.distanceTo(pos)-b.position.distanceTo(pos));
     const threat=threats[0],distance=threat?threat.position.distanceTo(pos):Infinity;
     const inventory=bot.inventory?.items?.()??[];
     const edible=inventory.find(item=>bot.registry?.foodsByName?.[item.name]);
     const foodAvailable=Boolean(edible);
     const objective=chooseSurvivalGoal({health:bot.health,food:bot.food,hostileDistance:distance,foodAvailable,hasFood:foodAvailable,blocked:stalledIntervals>=3});
     if(objective==='eat'&&edible){
       bot.pathfinder.setGoal(null);currentGoal=null;
       await bot.equip(edible,'hand');
       if(!valid())return;
       await bot.consume();
       if(!valid())return;
     }else if(objective==='retreat'&&threat){
       const dx=pos.x-threat.position.x,dz=pos.z-threat.position.z,len=Math.max(0.01,Math.hypot(dx,dz));
       setGoal(new GoalNear(Math.floor(pos.x+dx/len*12),Math.floor(pos.y),Math.floor(pos.z+dz/len*12),2));
     }else if(!currentGoal||stalledIntervals>=3||clock()-goalSince>=15000){
       // Preserve each waypoint until arrival, a path failure, sustained stall, or timeout.
       // "Forage" is still exploration; it does not gather food.
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
