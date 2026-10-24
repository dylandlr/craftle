// Privileged-state scripted survival reference: NOT a vision-only or learned agent.
// Purpose: reproducible competence anchor and future Mineflayer-action interface.
import pathfinderPackage from 'mineflayer-pathfinder';
const {pathfinder,Movements,goals}=pathfinderPackage;
const {GoalNear}=goals;
export const HOSTILE_MOBS=new Set(['zombie','husk','drowned','skeleton','stray','spider','cave_spider','creeper','witch','pillager','endermite','silverfish']);
export function chooseSurvivalGoal({health=20,food=20,hostileDistance=Infinity,foodAvailable=false,hasFood=false,blocked=false}={}){
 if(hostileDistance<8||health<=7)return 'retreat';
 if(food<=14&&foodAvailable)return 'eat';
 if(!hasFood)return 'forage';
 if(blocked)return 'reroute';
 return 'explore';
}
export function startSurvivalReference(bot,{log=()=>{},intervalMs=1800}={}){
 bot.loadPlugin(pathfinder);
 const actions=[];
 let tick=0,busy=false,ended=false,positionBefore=null;
 const record=(type,data={})=>{const e={type,...data};actions.push(e);log(e);};
 const onDeath=()=>{bot.pathfinder.setGoal(null);record('survival_reference_death',{health:bot.health});};
 bot.on('death',onDeath);
 const timer=setInterval(async()=>{
   if(ended||busy||!bot.entity)return;
   busy=true;
   try{
     const pos=bot.entity.position;
     const threats=Object.values(bot.entities).filter(e=>e&&HOSTILE_MOBS.has(e.name)&&e.position);
     threats.sort((a,b)=>a.position.distanceTo(pos)-b.position.distanceTo(pos));
     const threat=threats[0],distance=threat?threat.position.distanceTo(pos):Infinity;
     const inventory=bot.inventory?.items?.()??[];
     const edible=inventory.find(item=>bot.registry?.foodsByName?.[item.name]);
     const foodAvailable=Boolean(edible);
     const objective=chooseSurvivalGoal({health:bot.health,food:bot.food,hostileDistance:distance,foodAvailable,hasFood:foodAvailable,blocked:positionBefore?pos.distanceTo(positionBefore)<0.3:false});
     const movement=new Movements(bot);
     movement.canDig=false;movement.allow1by1towers=false;movement.allowParkour=false;movement.maxDropDown=1;
     bot.pathfinder.setMovements(movement);
     if(objective==='eat'&&edible){
       bot.pathfinder.setGoal(null);
       await bot.equip(edible,'hand');await bot.consume();
     }else if(objective==='retreat'&&threat){
       const dx=pos.x-threat.position.x,dz=pos.z-threat.position.z,len=Math.max(0.01,Math.hypot(dx,dz));
       bot.pathfinder.setGoal(new GoalNear(Math.floor(pos.x+dx/len*12),Math.floor(pos.y),Math.floor(pos.z+dz/len*12),2));
     }else {
       // Fixed deterministic waypoints for auditable reference behavior, not world knowledge.
       const heading=(tick*2.399963229728653)% (Math.PI*2);
       const radius=8+(tick%3)*4;
       bot.pathfinder.setGoal(new GoalNear(Math.floor(pos.x+Math.cos(heading)*radius),Math.floor(pos.y),Math.floor(pos.z+Math.sin(heading)*radius),2));
     }
     positionBefore=pos.clone();
     record('survival_reference_action',{tick,objective,health:bot.health,food:bot.food,hostileDistance:Number.isFinite(distance)?distance:null,position:{x:pos.x,y:pos.y,z:pos.z},inventoryCount:inventory.length});
     tick++;
   }catch(error){record('survival_reference_error',{message:error.message});}
   finally{busy=false;}
 },intervalMs);
 const stop=()=>{ended=true;clearInterval(timer);bot.removeListener('death',onDeath);bot.pathfinder.setGoal(null);};
 bot.once('end',stop);
 return {stop,events:()=>actions.slice()};
}
