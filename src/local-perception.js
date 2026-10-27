// Craftle local perception v1: bounded, partial, agent-relative sensory observation.
// No inferred global terrain, no reward changes, no automatic policy actions.
const FINITE=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
export const LOCAL_PERCEPTION_SCHEMA='craftle.local-perception.v1';
export function observeLocalPerception(bot,{radius=3,vertical=2,maxEntities=24}={}){
 if(!Number.isInteger(radius)||radius<1||radius>8||!Number.isInteger(vertical)||vertical<1||vertical>4)throw Error('Invalid local perception bounds');
 if(!bot?.entity||!FINITE(bot.entity.position))return {schema:LOCAL_PERCEPTION_SCHEMA,available:false,reason:'no_agent_pose'};
 const p=bot.entity.position,origin={x:Math.floor(p.x),y:Math.floor(p.y),z:Math.floor(p.z)};
 const blocks=[],counts={known:0,unknown:0,solid:0,air:0,liquid:0,leaves:0,other:0};
 for(let dy=-vertical;dy<=vertical;dy++)for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
  let b=null;
  try{b=bot.blockAt?.(p.offset(origin.x+dx-p.x,origin.y+dy-p.y,origin.z+dz-p.z),false)??null;}catch{}
  let type='unknown';
  if(b){
   counts.known++;
   if(b.name?.includes('leaves'))type='leaves';
   else if(b.name==='water'||b.name==='lava')type='liquid';
   else if(b.boundingBox==='block')type='solid';
   else if(b.name==='air'||b.name==='cave_air'||b.name==='void_air')type='air';
   else type='other';
  }else counts.unknown++;
  if(type!=='unknown')counts[type]++;
  blocks.push({dx,dy,dz,type}); // No global coordinates or semantic object labels in the policy feed.
 }
 const entities=Object.values(bot.entities??{}).filter(e=>e&&e!==bot.entity&&FINITE(e.position))
  .map(e=>({entityId:e.id??null,dx:e.position.x-p.x,dy:e.position.y-p.y,dz:e.position.z-p.z,
    distance:Math.hypot(e.position.x-p.x,e.position.y-p.y,e.position.z-p.z),
    type:e.type??null,name:e.name??null}))
  .filter(e=>e.distance<=radius).sort((a,b)=>a.distance-b.distance).slice(0,maxEntities);
 return {schema:LOCAL_PERCEPTION_SCHEMA,available:true,origin,agentYaw:bot.entity.yaw??0,
  radius,vertical,blocks,entities,counts,
  provenance:'mineflayer_local_loaded_cache_not_camera_pixels',
  semantics:'diagnostic_only_not_policy_input'};
}
