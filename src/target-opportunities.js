// Assisted semantic perception: food categories/maturity are supplied knowledge.
import {FOOD_PLANTS,foodPlantAction,plantKey} from './food-foraging.js';
export const TARGET_SLOTS=4;
export const TARGET_ACTIONS=Object.freeze(['eat','explore','retreat',...Array.from({length:TARGET_SLOTS},(_,i)=>['approach','harvest','attack'].map(skill=>`${skill}_${i}`)).flat()]);
export const TARGET_SCHEMA='craftle.targeted.dqn.v1';
export const TARGET_INPUTS=8+9*TARGET_SLOTS;
export function edible(bot,item){return Boolean(item&&bot.registry?.foodsByName?.[item.name]&&!['pufferfish','poisonous_potato','spider_eye','rotten_flesh','chicken'].includes(item.name));}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function observeTargets(bot,{hostileNames=new Set(),blocked=false,displacement=0}={}){
 const position=bot.entity.position,inventory=bot.inventory.items(),candidates=[];
 for(const entity of Object.values(bot.entities)){
  if(!entity?.position||distance(position,entity.position)>24)continue;
  const drop=entity.getDroppedItem?.();
  const kind=edible(bot,drop)?'drop':['pig','cow','sheep','rabbit'].includes(entity.name)?'animal':null;
  if(!kind||!bot.canSeeEntity?.(entity))continue;
  candidates.push({id:`entity:${entity.id}`,kind,position:{...entity.position},distance:distance(position,entity.position),visible:true});
 }
 const ids=FOOD_PLANTS.map(name=>bot.registry?.blocksByName?.[name]?.id).filter(Number.isInteger);
 if(ids.length&&bot.findBlocks){
  const positions=bot.findBlocks({matching:ids,maxDistance:24,count:16,useExtraInfo:block=>Boolean(foodPlantAction(block))});
  for(const p of positions){const block=bot.blockAt(p);
   if(foodPlantAction(block)&&bot.canSeeBlock?.(block))candidates.push({id:plantKey(block),kind:'plant',position:{x:p.x,y:p.y,z:p.z},distance:distance(position,p),visible:true});
  }
 }
 candidates.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
 const targets=candidates.slice(0,TARGET_SLOTS).map(t=>({...t,reachable:t.distance<(t.kind==='animal'?3:t.kind==='plant'?4.2:1)}));
 const foods=inventory.filter(item=>edible(bot,item));
 return {schema:'craftle.target-observation.v1',health:bot.health,food:bot.food,foodAvailable:foods.length>0,
  foodUnits:foods.reduce((sum,item)=>sum+item.count,0),foodPoints:foods.reduce((sum,item)=>sum+item.count*(bot.registry.foodsByName[item.name].foodPoints??0),0),
  hostileDistance:Math.min(24,...Object.values(bot.entities).filter(e=>e?.position&&hostileNames.has(e.name)).map(e=>distance(position,e.position))),
  blocked,displacement:displacement??0,position:{x:position.x,y:position.y,z:position.z},targets};
}
export function encodeTargets(o){
 const clamp=(n,scale)=>Math.max(-1,Math.min(1,n/scale));
 const features=[o.health/20,o.food/20,Number(o.foodAvailable),clamp(o.foodUnits,64),clamp(o.foodPoints,80),clamp(o.hostileDistance,24),Number(o.blocked),clamp(o.displacement,4)];
 for(let i=0;i<TARGET_SLOTS;i++){
  const t=o.targets[i];
  features.push(...(t?[Number(t.kind==='drop'),Number(t.kind==='plant'),Number(t.kind==='animal'),clamp(t.distance,24),clamp(t.position.x-o.position.x,24),clamp(t.position.y-o.position.y,8),clamp(t.position.z-o.position.z,24),Number(t.visible),Number(t.reachable)]:Array(9).fill(0)));
 }
 if(features.length!==TARGET_INPUTS||!features.every(Number.isFinite))throw Error('Invalid target observation');
 const mask=TARGET_ACTIONS.map(action=>{
  if(action==='eat')return o.foodAvailable&&o.food<20;
  if(action==='explore')return true;
  if(action==='retreat')return o.hostileDistance<24;
  const [skill,slot]=action.split('_'),t=o.targets[Number(slot)];
  return Boolean(t&&t.visible&&(skill==='approach'||t.reachable&&(skill==='harvest'?t.kind==='plant':t.kind==='animal')));
 });
 return {features,mask};
}
export function decodeTargetAction(index,o){
 const {mask}=encodeTargets(o);if(!Number.isInteger(index)||!mask[index])throw Error('Unavailable target action');
 const [skill,slot]=TARGET_ACTIONS[index].split('_');
 return {index,skill,targetId:slot===undefined?null:o.targets[Number(slot)].id};
}
