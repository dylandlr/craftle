// Observed server events, not policy commands or inferred combat success.
const FOOD_ANIMALS=new Set(['cow','pig','sheep','rabbit']);
export function attachFoodOutcomes(bot,record){
 const hurt=(entity,source)=>{
  if(FOOD_ANIMALS.has(entity?.name))record('survival_reference_food_damage_observed',{
   entityId:entity.id,entity:entity.name,attribution:source?.id!==undefined&&source.id===bot.entity?.id?'self':'unknown'});
 };
 const dead=entity=>{
  if(FOOD_ANIMALS.has(entity?.name))record('survival_reference_food_death_observed',{entityId:entity.id,entity:entity.name,attribution:'unknown'});
 };
 const collect=(collector,collected)=>{
  if(collector?.id===undefined||collector.id!==bot.entity?.id)return;
  const item=collected?.getDroppedItem?.();
  record('survival_reference_item_pickup_observed',{entityId:collected?.id??null,item:item?.name??null,count:item?.count??null});
 };
 bot.on('entityHurt',hurt);bot.on('entityDead',dead);bot.on('playerCollect',collect);
 return ()=>{bot.removeListener('entityHurt',hurt);bot.removeListener('entityDead',dead);bot.removeListener('playerCollect',collect);};
}
