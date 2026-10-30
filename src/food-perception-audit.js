// Observer-only food sensing funnel; no policy or reward changes.
// Counts entities and mature plant blocks known to the Mineflayer client,
// including candidates excluded by type, range or line-of-sight.
import {FOOD_PLANTS,foodPlantAction} from './food-foraging.js';
import {edible} from './target-opportunities.js';
const ANIMALS=new Set(['pig','cow','sheep','rabbit','chicken']);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function auditFoodPerception(bot,{radius=24}={}){
 if(!bot.entity?.position)return null;
 const p=bot.entity.position;
 const entities={known:0,nearby:0,foodAnimalNearby:0,foodAnimalVisible:0,edibleDropNearby:0,edibleDropVisible:0,outOfRangeFoodAnimals:0};
 const names={};
 for(const entity of Object.values(bot.entities??{})){
  if(!entity?.position)continue;
  entities.known++;
  const d=distance(p,entity.position);
  if(d<=radius){entities.nearby++;names[entity.name??'unknown']=(names[entity.name??'unknown']??0)+1;}
  const foodAnimal=ANIMALS.has(entity.name);
  if(foodAnimal&&d>radius)entities.outOfRangeFoodAnimals++;
  if(foodAnimal&&d<=radius){entities.foodAnimalNearby++;if(bot.canSeeEntity?.(entity))entities.foodAnimalVisible++;}
  const drop=entity.getDroppedItem?.();
  if(d<=radius&&edible(bot,drop)){entities.edibleDropNearby++;if(bot.canSeeEntity?.(entity))entities.edibleDropVisible++;}
 }
 const plants={matchingBlocks:0,mature:0,visibleMature:0,searchAvailable:Boolean(bot.findBlocks),registryIds:0};
 const ids=FOOD_PLANTS.map(n=>bot.registry?.blocksByName?.[n]?.id).filter(Number.isInteger);
 plants.registryIds=ids.length;
 if(ids.length&&bot.findBlocks){
  const locations=bot.findBlocks({matching:ids,maxDistance:radius,count:128})??[];
  plants.matchingBlocks=locations.length;
  for(const pos of locations){
   const block=bot.blockAt(pos,false);
   if(!foodPlantAction(block))continue;
   plants.mature++;
   if(bot.canSeeBlock?.(block))plants.visibleMature++;
  }
 }
 return {type:'food_perception_funnel',position:{x:p.x,y:p.y,z:p.z},
  dimension:bot.game?.dimension??null,entities,entityNames:names,plants,
  informationAccess:'mineflayer_client_cache_only',policyUsed:false};
}
