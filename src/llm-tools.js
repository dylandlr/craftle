// Embodied LLM tool executor. Target lookup is confined to motor actuation,
// never returned as a semantic observation to the policy.
import {applyVisualAction,ACTIONS} from './visual-policy.js';
export const LLM_ACTIONS=Object.freeze([...ACTIONS,'mine','use','attack','equip','craft']);
export function validateLlmAction(action){
 if(!LLM_ACTIONS.includes(action))throw Error('Unsupported agent action: '+action);
 return action;
}
export async function executeLlmAction(bot,action,{reach=4.5,digTimeoutMs=8000,target=null}={}){
 validateLlmAction(action);
 if(!bot.entity)throw Error('Agent not spawned');
 if(ACTIONS.includes(action)){
   await applyVisualAction(bot,action);
   return {action,success:true,detail:'motor_command_sent'};
 }
 bot.clearControlStates();
 if(['equip','craft'].includes(action)){
   if(typeof target!=='string'||!/^[a-z0-9_]{1,64}$/.test(target))return {action,success:false,detail:'valid_item_target_required'};
   if(action==='equip'){
     const item=bot.inventory.items().find(item=>item.name===target);
     if(!item)return {action,success:false,detail:'item_not_in_inventory'};
     await bot.equip(item,'hand');
     return {action,success:true,detail:'equipped'};
   }
   const item=bot.registry.itemsByName[target];
   if(!item)return {action,success:false,detail:'unknown_item'};
   const recipes=bot.recipesFor(item.id,null,1,null);
   if(!recipes?.length)return {action,success:false,detail:'no_available_inventory_recipe'};
   await bot.craft(recipes[0],1,null);
   return {action,success:true,detail:'crafted_one'};
 }
 if(action==='mine'){
   const target=bot.blockAtCursor(reach);
   if(!target)return {action,success:false,detail:'nothing_under_crosshair'};
   if(!bot.canDigBlock(target))return {action,success:false,detail:'cannot_dig_target'};
   let timer;
   try{
     await Promise.race([bot.dig(target),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Dig timeout')),digTimeoutMs);})]);
     return {action,success:true,detail:'dig_completed'};
   }finally{clearTimeout(timer);try{bot.stopDigging();}catch{}}
 }
 if(action==='attack'){
   const target=bot.entityAtCursor?.(reach);
   if(!target)return {action,success:false,detail:'no_entity_under_crosshair'};
   bot.attack(target);
   return {action,success:true,detail:'attack_sent'};
 }
 if(action==='use'){
   bot.activateItem();
   return {action,success:true,detail:'item_use_sent'};
 }
}
