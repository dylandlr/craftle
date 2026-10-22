// Auditable milestones based on the Minecraft client's inventory and game events,
// not the LLM's natural-language claims or success reports.
const WOOD = /^(?:.+_log|.+_stem|bamboo_block)$/;
const PLANK = /_planks$/;
const STONE_TOOL = /^(?:stone|iron|diamond|netherite)_(?:pickaxe|axe|shovel|hoe|sword)$/;
export function verifyMilestones(events){
 const milestones=new Map();
 const recorded=(id,event,evidence)=>{if(!milestones.has(id))milestones.set(id,{id,timestamp:event.timestamp??null,evidence});};
 for(const e of events){
  if(e.type==='inventory_snapshot' && Array.isArray(e.items)){
   const items=e.items.filter(x=>typeof x?.name==='string'&&Number.isInteger(x.count)&&x.count>0);
   if(items.some(x=>WOOD.test(x.name)))recorded('acquired_wood',e,'inventory_snapshot');
   if(items.some(x=>PLANK.test(x.name)))recorded('acquired_planks',e,'inventory_snapshot');
   if(items.some(x=>STONE_TOOL.test(x.name)))recorded('acquired_stone_or_better_tool',e,'inventory_snapshot');
   if(items.some(x=>x.name==='crafting_table'))recorded('held_crafting_table',e,'inventory_snapshot');
   if(items.some(x=>x.name==='ender_pearl'))recorded('held_ender_pearl',e,'inventory_snapshot');
   if(items.some(x=>x.name==='blaze_rod'))recorded('held_blaze_rod',e,'inventory_snapshot');
  }
  if(e.type==='minecraft_dimension'&&e.dimension==='minecraft:the_nether')recorded('entered_nether',e,'client_dimension_event');
  if(e.type==='minecraft_dimension'&&e.dimension==='minecraft:the_end')recorded('entered_end',e,'client_dimension_event');
 }
 return [...milestones.values()];
}
