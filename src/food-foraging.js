// Scripted reference knowledge; never seed learned-agent skill libraries with this module.
export const FOOD_PLANTS=['sweet_berry_bush','carrots','potatoes','melon'];
export function foodPlantAction(block){
 if(!block)return null;
 const age=Number(block.getProperties?.().age??-1);
 if(block.name==='sweet_berry_bush'&&age>=2)return 'activate';
 if(['carrots','potatoes'].includes(block.name)&&age===7)return 'dig';
 if(block.name==='melon')return 'dig';
 return null;
}
export function plantKey(block){const p=block.position;return `plant:${p.x},${p.y},${p.z}`;}
export function findFoodPlant(bot,available=()=>true){
 const ids=FOOD_PLANTS.map(name=>bot.registry?.blocksByName?.[name]?.id).filter(Number.isInteger);
 if(!ids.length||!bot.findBlock)return null;
 return bot.findBlock({matching:ids,maxDistance:24,useExtraInfo:block=>Boolean(foodPlantAction(block))&&available(plantKey(block))});
}
export function foodSearchCell(p){return `${Math.floor(p.x/8)},${Math.floor(p.z/8)}`;}
export function chooseFoodSearchWaypoint(pos,visits,step,available=()=>true){
 const candidates=Array.from({length:8},(_,i)=>{
  const a=((i+step)%8)*Math.PI/4;
  return {x:Math.floor(pos.x+Math.cos(a)*24),y:Math.floor(pos.y),z:Math.floor(pos.z+Math.sin(a)*24)};
 }).filter(p=>available(foodSearchCell(p)));
 candidates.sort((a,b)=>(visits.get(foodSearchCell(a))??0)-(visits.get(foodSearchCell(b))??0));
 return candidates[0]??null;
}
