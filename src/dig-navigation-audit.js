// Compare native movement generation without issuing goals, moving, digging or mutating the live navigator.
export function auditDiggingNeighbors({bot,Movements,configure,position,mode='ordinary'}={}) {
 if(!bot?.entity||typeof Movements!=='function'||typeof configure!=='function'||!position)
  return {reason:'unavailable'};
 const origin={x:Math.floor(position.x),y:Math.floor(position.y),z:Math.floor(position.z)};
 const evaluate=canDig=>{
  try{
   const movements=configure(new Movements(bot),{registry:bot.registry,mode,maxDropDown:3});
   movements.canDig=canDig;
   // No block placement during this comparison. Only existing terrain and clearing may be considered.
   movements.allowFreeMotion=false;
   const node={...origin,remainingBlocks:0};
   const neighbors=movements.getNeighbors(node);
   return {count:neighbors.length,neighbors:neighbors.slice(0,48).map(n=>({
    x:n.x,y:n.y,z:n.z,cost:n.cost,
    toBreak:(n.toBreak??[]).map(p=>({x:p.x,y:p.y,z:p.z})),
    toPlace:(n.toPlace??[]).length
   }))};
  }catch(error){return {error:String(error?.message??error).slice(0,180)};}
 };
 const blocked=evaluate(false),digAllowed=evaluate(true);
 const key=n=>[n.x,n.y,n.z].join(',');
 const baseline=new Set((blocked.neighbors??[]).map(key));
 return {reason:'read_only_neighbor_comparison',origin,blocked,digAllowed,
  addedByDig:(digAllowed.neighbors??[]).filter(n=>!baseline.has(key(n))),
  note:'These are local movement candidates, not proven traversable full routes. No blocks were broken.'};
}
