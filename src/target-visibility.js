// Conservative Minecraft entity line-of-sight check using the bot's loaded block observations.
// This is assisted semantic perception, not a learned vision model.
// Returns false when chunks are unavailable, and never uses spectator or server-only data.
const solid=block=>block?.boundingBox==='block'||(block?.boundingBox==='shape'&&Array.isArray(block.shapes)&&block.shapes.length>0);
export function canSeeTargetEntity(bot,entity,{maxDistance=24,step=0.35}={}){
 const origin=bot?.entity?.position,target=entity?.position;
 if(!origin||!target||typeof origin.offset!=='function'||typeof bot?.blockAt!=='function')return false;
 const eye=origin.offset(0,Number.isFinite(bot.entity.height)?Math.min(1.62,bot.entity.height*.9):1.62,0);
 const height=Number.isFinite(entity.height)?Math.max(.2,entity.height):1.4;
 // Two aim points avoid rejecting partly exposed entities.
 for(const ratio of [.5,.85]){
  const end=target.offset(0,height*ratio,0);
  const dx=end.x-eye.x,dy=end.y-eye.y,dz=end.z-eye.z;
  const length=Math.hypot(dx,dy,dz);
  if(!Number.isFinite(length)||length>maxDistance||length<.001)continue;
  let blocked=false;
  const n=Math.ceil(length/step);
  for(let i=1;i<n;i++){
   const t=i/n;
   const point=eye.offset(dx*t,dy*t,dz*t);
   const block=bot.blockAt(point,false);
   if(!block||solid(block)){blocked=true;break;}
  }
  if(!blocked)return true;
 }
 return false;
}
