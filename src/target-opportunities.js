// Assisted semantic perception: food categories/maturity are supplied knowledge.
import {FOOD_PLANTS,foodPlantAction,plantKey} from './food-foraging.js';
import {canSeeTargetEntity} from './target-visibility.js';
export const TARGET_SLOTS=4;
export const TARGET_ACTIONS=Object.freeze(['eat','explore','retreat',...Array.from({length:TARGET_SLOTS},(_,i)=>['approach','harvest','attack'].map(skill=>`${skill}_${i}`)).flat()]);
export const TARGET_SCHEMA='craftle.targeted.dqn.v1';
export const TARGET_INPUTS=8+9*TARGET_SLOTS;
export function edible(bot,item){return Boolean(item&&bot.registry?.foodsByName?.[item.name]&&!['pufferfish','poisonous_potato','spider_eye','rotten_flesh','chicken'].includes(item.name));}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function observeTargets(bot,{hostileNames=new Set(),blocked=false,displacement=0,audit=null}={}){
 const position=bot.entity.position,inventory=bot.inventory.items(),candidates=[];
 const counts={nearbyEntities:0,eligibleEntityCategories:0,entityVisibilityAccepted:0,entityVisibilityRejected:0,plantBlocksFound:0,actionablePlantBlocks:0,plantVisibilityAccepted:0,plantVisibilityRejected:0,inventoryFoodItems:0};
 const auditEnabled=typeof audit==='function';
 const nearbyEntityTypes={},rejectedEntityExamples=[];
 for(const entity of Object.values(bot.entities)){
  if(!entity?.position||distance(position,entity.position)>24)continue;
  counts.nearbyEntities++;
  if(auditEnabled){const name=String(entity.name??'unknown');nearbyEntityTypes[name]=(nearbyEntityTypes[name]??0)+1;}
  const drop=entity.getDroppedItem?.();
  const kind=edible(bot,drop)?'drop':['pig','cow','sheep','rabbit'].includes(entity.name)?'animal':null;
  if(!kind)continue;
  counts.eligibleEntityCategories++;
  if(!canSeeTargetEntity(bot,entity)){
   counts.entityVisibilityRejected++;
   if(auditEnabled&&rejectedEntityExamples.length<6)rejectedEntityExamples.push({
    kind,name:String(entity.name??'unknown'),distanceBlocks:Math.round(distance(position,entity.position)*100)/100,
    deltaYBlocks:Math.round((entity.position.y-position.y)*100)/100,
    entityId:entity.id??null});
   continue;
  }
  counts.entityVisibilityAccepted++;
  candidates.push({id:`entity:${entity.id}`,kind,position:{...entity.position},distance:distance(position,entity.position),visible:true});
 }
 const ids=FOOD_PLANTS.map(name=>bot.registry?.blocksByName?.[name]?.id).filter(Number.isInteger);
 if(ids.length&&bot.findBlocks){
  const positions=bot.findBlocks({matching:ids,maxDistance:24,count:16,useExtraInfo:block=>Boolean(foodPlantAction(block))});
  counts.plantBlocksFound=positions.length;
  for(const p of positions){const block=bot.blockAt(p);
   if(!foodPlantAction(block))continue;
   counts.actionablePlantBlocks++;
   if(!bot.canSeeBlock?.(block)){counts.plantVisibilityRejected++;continue;}
   counts.plantVisibilityAccepted++;
   candidates.push({id:plantKey(block),kind:'plant',position:{x:p.x,y:p.y,z:p.z},distance:distance(position,p),visible:true});
  }
 }
 // Reserve target capacity for edible drops and harvestable plants when they
 // are in range; otherwise four nearer animals can crowd out immediate food.
 // This is an explicit semantic perception heuristic, not a learned priority.
 const priority=t=>t.kind==='drop'?0:t.kind==='plant'?1:2;
 candidates.sort((a,b)=>priority(a)-priority(b)||a.distance-b.distance||a.id.localeCompare(b.id));
 const targets=candidates.slice(0,TARGET_SLOTS).map(t=>({...t,reachable:t.distance<(t.kind==='animal'?3:t.kind==='plant'?4.2:1)}));
 const foods=inventory.filter(item=>edible(bot,item));
 counts.inventoryFoodItems=foods.length;
 if(auditEnabled)audit({schema:'craftle.target-perception-audit.v2',...counts,
  visibilityMethodAvailable:typeof bot.blockAt==='function'&&typeof bot.entity?.position?.offset==='function',nearbyEntityTypes,rejectedEntityExamples,
  totalCandidates:candidates.length,selectedTargets:targets.length,foodPlantRegistryIds:ids.length,searchRadiusBlocks:24});
 return {schema:'craftle.target-observation.v1',health:bot.health,food:bot.food,foodAvailable:foods.length>0,
  foodUnits:foods.reduce((sum,item)=>sum+item.count,0),foodPoints:foods.reduce((sum,item)=>sum+item.count*(bot.registry.foodsByName[item.name].foodPoints??0),0),
  hostileDistance:Math.min(24,...Object.values(bot.entities).filter(e=>e?.position&&hostileNames.has(e.name)).map(e=>distance(position,e.position))),
  blocked,displacement:displacement??0,position:{x:position.x,y:position.y,z:position.z},targets};
}
export function encodeTargets(o,{maskRedundantPlantApproach=false}={}){
 const clamp=(n,scale)=>Math.max(-1,Math.min(1,n/scale));
 const features=[o.health/20,o.food/20,Number(o.foodAvailable),clamp(o.foodUnits,64),clamp(o.foodPoints,80),clamp(o.hostileDistance,24),Number(o.blocked),clamp(o.displacement,4)];
 for(let i=0;i<TARGET_SLOTS;i++){
  const t=o.targets[i];
  features.push(...(t?[Number(t.kind==='drop'),Number(t.kind==='plant'),Number(t.kind==='animal'),clamp(t.distance,24),clamp(t.position.x-o.position.x,24),clamp(t.position.y-o.position.y,8),clamp(t.position.z-o.position.z,24),Number(t.visible),Number(t.reachable)]:Array(9).fill(0)));
 }
 if(features.length!==TARGET_INPUTS||!features.every(Number.isFinite))throw Error('Invalid target observation');
 const mask=TARGET_ACTIONS.map(action=>{
  if(action==='eat')return o.foodAvailable&&o.food<20;
  if(action==='explore')return o.exploreFeasible!==false;
  if(action==='retreat')return o.hostileDistance<24;
  const [skill,slot]=action.split('_'),t=o.targets[Number(slot)];
  if(skill==='approach'&&maskRedundantPlantApproach&&t?.kind==='plant'&&t.visible&&t.reachable)return false;
  return Boolean(t&&t.visible&&(skill==='approach'||t.reachable&&(skill==='harvest'?t.kind==='plant':t.kind==='animal')));
 });
 // Never silently construct an empty action set: caller needs an explicit recovery/interrupt path.
 if(!mask.some(Boolean))return {features,mask,requiresRecovery:true};
 return {features,mask,requiresRecovery:false};
}
export function decodeTargetAction(index,o,options){
 const {mask}=encodeTargets(o,options);if(!Number.isInteger(index)||!mask[index])throw Error('Unavailable target action');
 const [skill,slot]=TARGET_ACTIONS[index].split('_');
 return {index,skill,targetId:slot===undefined?null:o.targets[Number(slot)].id};
}
