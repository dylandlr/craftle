// Observational provenance only: a preceding command is not proof of causality.
export function attachFoodProvenance(bot,{log=()=>{},getDecision=()=>null,clock=Date.now}={}){
 const snapshot=()=>{const counts={};for(const i of bot.inventory.items().filter(Boolean))counts[i.name]=(counts[i.name]??0)+i.count;return counts;};
 let previous=snapshot(),stopped=false;
 const emitInventory=(source)=>{
  if(stopped)return;
  const current=snapshot(),keys=new Set([...Object.keys(previous),...Object.keys(current)]);
  const decision=getDecision();
  for(const item of keys){
   const before=previous[item]??0,after=current[item]??0;
   if(before!==after)log({type:'food_provenance_inventory_delta',timestampMs:clock(),item,before,after,delta:after-before,decisionId:decision?.decisionId??null,decisionSkill:decision?.skill??null,source,evidence:'client_inventory_observation_not_causal_proof'});
  }
  previous=current;
 };
 const onCollect=(collector,collected)=>{
  if(stopped||collector?.id!==bot.entity?.id)return;
  const decision=getDecision();
  log({type:'food_provenance_pickup_event',timestampMs:clock(),entityId:collected?.id??null,item:collected?.getDroppedItem?.()?.name??null,decisionId:decision?.decisionId??null,decisionSkill:decision?.skill??null,evidence:'mineflayer_playerCollect_client_event'});
  emitInventory('playerCollect');
 };
 const onSlot=()=>emitInventory('updateSlot');
 bot.on('playerCollect',onCollect);
 bot.inventory.on?.('updateSlot',onSlot);
 return {sample:()=>emitInventory('periodic_sample'),stop(){if(stopped)return;stopped=true;bot.removeListener('playerCollect',onCollect);bot.inventory.removeListener?.('updateSlot',onSlot);}};
}
