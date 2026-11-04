// Generic local-observation novelty, not a strategy reward.
// Counts unique perceived local states, regardless of action verb.
export function localMotorStateKey(observation,{radius=2}={}){
 const p=observation?.position;
 if(!p||![p.x,p.y,p.z].every(Number.isFinite))throw Error('Position required');
 const at=observation.blockAt;
 const blocks=[];
 for(let dx=-radius;dx<=radius;dx++)
  for(let dy=-1;dy<=1;dy++)
   for(let dz=-radius;dz<=radius;dz++){
    const b=typeof at==='function'?at(Math.floor(p.x)+dx,
     Math.floor(p.y)+dy,Math.floor(p.z)+dz):null;
    blocks.push(b?.name??'?');
   }
 const inv=(observation.inventory??[]).filter(x=>x.count>0)
  .map(x=>[x.name,x.count]).sort((a,b)=>a[0].localeCompare(b[0]));
 return JSON.stringify({position:[Math.floor(p.x),Math.floor(p.y),Math.floor(p.z)],
  health:Math.floor(observation.health??0),inventory:inv,blocks});
}
export function createStateNovelty({coefficient=0.1}={}){
 if(!Number.isFinite(coefficient)||coefficient<0)throw Error('Invalid novelty');
 const counts=new Map();let previous=null;
 return {
  observe(state){
   const key=localMotorStateKey(state);
   const old=counts.get(key)??0;counts.set(key,old+1);
   const changed=previous!==null&&previous!==key;
   previous=key;
   return {bonus:changed?coefficient/Math.sqrt(old+1):0,
    firstVisit:changed&&old===0,visitCount:old+1,statesSeen:counts.size};
  },
  stats:()=>({statesSeen:counts.size})
 };
}
