// Post-action feedback obtained from agent-owned, non-privileged Minecraft state.
// No block map, entity registry, biome or location queries are sent to the LLM.
export function snapshotAgentState(bot){
 const p=bot.entity?.position;
 return {position:p?{x:p.x,y:p.y,z:p.z}:null,health:Number.isFinite(bot.health)?bot.health:null,
   hunger:Number.isFinite(bot.food)?bot.food:null,
   inventory:Array.isArray(bot.inventory?.items?.())?bot.inventory.items().map(i=>({name:i.name,count:i.count})):[]};
}
export function summarizeActionEffect(before,after,action,outcome){
 const a=before?.position,b=after?.position;
 const displacement=a&&b?Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2):null;
 const inventoryDelta={};
 for(const {name,count} of after?.inventory??[])inventoryDelta[name]=(inventoryDelta[name]??0)+count;
 for(const {name,count} of before?.inventory??[])inventoryDelta[name]=(inventoryDelta[name]??0)-count;
 for(const key of Object.keys(inventoryDelta))if(!inventoryDelta[key])delete inventoryDelta[key];
 return {action,toolReportedSuccess:Boolean(outcome?.success),
   displacement:displacement===null?null:Number(displacement.toFixed(3)),
   healthDelta:before?.health!==null&&after?.health!==null?after.health-before.health:null,
   hungerDelta:before?.hunger!==null&&after?.hunger!==null?after.hunger-before.hunger:null,
   inventoryDelta,
   moved:displacement===null?null:displacement>0.12};
}
