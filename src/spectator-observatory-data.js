// Bounded read-only JSONL events for the local observatory monitor.
// Only whitelisted diagnostic events are exposed; no controls or RCON commands.
import fs from 'node:fs';
import path from 'node:path';
const TYPES=new Set([
 'target_decision','target_action','target_transition','target_reward_components',
 'target_navigation_goal','target_navigation_result','target_navigation_stall',
 'target_action_rejected','target_runtime_error','target_terminal',
 'target_attack_attempt','target_harvest_attempt','target_consumed',
 'target_verified_recovery','food_sequence_inventory_gain',
 'death_screen_observed','pose_sample','spectator_density_audit'
]);
export function readObservatoryEvents(root,{tailBytes=3*1024*1024,limit=1200}={}){
 const filename=path.join(root,'continuous','agent.log');
 let fd;try{fd=fs.openSync(filename,'r');}catch{return [];}
 try{
  const size=fs.fstatSync(fd).size;
  const count=Math.min(Math.max(1024,tailBytes),size,4*1024*1024),buf=Buffer.alloc(count);
  fs.readSync(fd,buf,0,count,size-count);
  const text=buf.toString('utf8');
  const lines=(size>count?text.slice(text.indexOf('\n')+1):text).split('\n');
  const result=[];
  for(const line of lines){
   if(!line.startsWith('{"timestamp":'))continue;
   try{
    const item=JSON.parse(line);
    if(TYPES.has(item.type)&&typeof item.timestamp==='string')result.push(item);
   }catch{}
  }
  return result.slice(-Math.min(2400,Math.max(1,limit)));
 }finally{fs.closeSync(fd);}
}
