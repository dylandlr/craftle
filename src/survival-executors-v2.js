// Explicit, opt-in Mineflayer skill executors for future survival-policy v2.
// Not attached to v1 DQN. Never used by filming/main agent unless caller opts in.
// Contracts do not claim success based only on command invocation.
const copyItems=bot=>Object.fromEntries((bot.inventory?.items?.()??[]).filter(Boolean).map(i=>[i.name,i.count]));
const count=(items,name)=>items[name]??0;
const blockName=b=>b?.name??null;
const position=b=>b?.position?{x:b.position.x,y:b.position.y,z:b.position.z}:null;
const validName=s=>typeof s==='string'&&/^[a-z0-9_]+$/.test(s);
const samePos=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y&&a.z===b.z;
const within=(bot,b,limit)=>Boolean(bot.entity?.position&&b?.position&&bot.entity.position.distanceTo(b.position)<=limit);
export function createSurvivalExecutors(bot,{log=()=>{}}={}){
 if(!bot?.inventory?.items||!bot?.entity?.position)throw Error('Mineflayer inventory and position required');
 const events=(skill,stage,extra={})=>log({type:'survival_executor_event',skill,stage,...extra,
   learned:false,attribution:'observed_client_state_not_server_causality'});
 return {
  async dig_block({block}={}){
   if(!block?.position||!within(bot,block,5)||block.boundingBox!=='block')return {ok:false,reason:'not_reachable_solid_block'};
   if(!bot.canDigBlock?.(block))return {ok:false,reason:'cannot_dig_block'};
   const before=blockName(bot.blockAt(block.position)),inventoryBefore=copyItems(bot);
   events('dig_block','attempt',{block:before,position:position(block)});
   try{await bot.dig(block);}catch(e){return {ok:false,reason:'execution_error',message:e.message};}
   const after=blockName(bot.blockAt(block.position));
   const inventoryAfter=copyItems(bot);
   const changed=before!==after;
   events('dig_block','observed',{before,after,changed,inventoryBefore,inventoryAfter});
   return {ok:changed,reason:changed?'block_changed':'no_observed_block_change',before,after,inventoryBefore,inventoryAfter};
  },
  async equip_item({itemName,destination='hand'}={}){
   if(!validName(itemName)||!['hand','off-hand','head','torso','legs','feet'].includes(destination))
    return {ok:false,reason:'invalid_item_or_destination'};
   const item=bot.inventory.items().find(i=>i.name===itemName);
   if(!item)return {ok:false,reason:'item_not_in_inventory'};
   events('equip_item','attempt',{itemName,destination});
   try{await bot.equip(item,destination);}catch(e){return {ok:false,reason:'execution_error',message:e.message};}
   const held=destination==='hand'?bot.heldItem?.name:null;
   const ok=destination==='hand'?held===itemName:false;
   events('equip_item','observed',{itemName,destination,held,confirmed:ok});
   return {ok,reason:ok?'held_item_confirmed':'equipment_slot_not_verified',held};
  },
  async craft_item({itemName,countRequested=1,table=null}={}){
   if(!validName(itemName)||!Number.isInteger(countRequested)||countRequested<1||countRequested>64)
    return {ok:false,reason:'invalid_recipe_request'};
   const id=bot.registry?.itemsByName?.[itemName]?.id;
   if(!Number.isInteger(id))return {ok:false,reason:'unknown_item'};
   if(table&&(!within(bot,table,5)||blockName(table)!=='crafting_table'))
    return {ok:false,reason:'unreachable_crafting_table'};
   const recipes=bot.recipesFor?.(id,null,countRequested,table)??[];
   if(!recipes.length)return {ok:false,reason:'no_currently_craftable_recipe'};
   const before=copyItems(bot);
   events('craft_item','attempt',{itemName,countRequested,table:position(table)});
   try{await bot.craft(recipes[0],countRequested,table);}catch(e){
    return {ok:false,reason:'execution_error',message:e.message};}
   const after=copyItems(bot),delta=count(after,itemName)-count(before,itemName);
   const ok=delta>0;
   events('craft_item','observed',{itemName,delta,before,after,confirmed:ok});
   return {ok,reason:ok?'inventory_gain_confirmed':'no_observed_inventory_gain',delta,before,after};
  },
  async place_block({referenceBlock,faceVector,itemName}={}){
   if(!referenceBlock?.position||!within(bot,referenceBlock,5)||referenceBlock.boundingBox!=='block')
    return {ok:false,reason:'invalid_reference_block'};
   if(!faceVector||![faceVector.x,faceVector.y,faceVector.z].every(Number.isInteger)||
      Math.abs(faceVector.x)+Math.abs(faceVector.y)+Math.abs(faceVector.z)!==1)
    return {ok:false,reason:'invalid_placement_face'};
   if(!validName(itemName))return {ok:false,reason:'invalid_item'};
   const target=referenceBlock.position.offset(faceVector.x,faceVector.y,faceVector.z);
   const beforeBlock=bot.blockAt(target);
   if(beforeBlock?.boundingBox!=='empty')return {ok:false,reason:'placement_occupied_or_unobserved'};
   const item=bot.inventory.items().find(i=>i.name===itemName);
   if(!item)return {ok:false,reason:'item_not_in_inventory'};
   events('place_block','attempt',{itemName,target:position({position:target})});
   try{await bot.equip(item,'hand');await bot.placeBlock(referenceBlock,faceVector);}catch(e){
    return {ok:false,reason:'execution_error',message:e.message};}
   const after=bot.blockAt(target);
   const ok=after?.boundingBox==='block'&&!samePos(position(beforeBlock),position(after));
   // Comparing positions is insufficient: target coordinates stay constant.
   const confirmed=after?.boundingBox==='block'&&after?.name!==beforeBlock?.name;
   events('place_block','observed',{before:beforeBlock?.name??null,after:after?.name??null,confirmed});
   return {ok:confirmed,reason:confirmed?'block_placement_observed':'no_observed_placement',before:beforeBlock?.name??null,after:after?.name??null};
  }
 };
}
