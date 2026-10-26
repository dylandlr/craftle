// Read-only event projection for web/notebook spectators.
// Events are correlated observations, never definitive server-side attribution.
import fs from 'node:fs';
import path from 'node:path';
const TYPES=new Map([
 ['target_decision',['🎯','Selected action']],['target_attack_intent',['⚔','Attack intended']],
 ['target_attack_attempt',['⚔','Punched / attack attempted']],['target_harvest_intent',['⛏','Mining/harvest intended']],
 ['target_harvest_attempt',['⛏','Mining/harvest attempted']],['target_harvest_block_observation',['⛏','Block change observed']],
 ['target_consumed',['🍞','Ate food']],['target_verified_recovery',['♥','Hunger recovered']],
 ['food_provenance_pickup_event',['📦','Item pickup observed']],['food_sequence_inventory_gain',['📦','Food inventory increased']],
 ['death_screen_observed',['☠','Death observed']],['target_navigation_result',['⚑','Pathfinding result']]
]);
export function eventAnnotation(e){
 if(!TYPES.has(e?.type)||!Number.isFinite(Date.parse(e.timestamp)))return null;
 const [symbol,label]=TYPES.get(e.type);
 const coords=e.position??e.blockPosition??e.targetPosition??null;
 const position=coords&&[coords.x,coords.y,coords.z].every(Number.isFinite)?
   {x:coords.x,y:coords.y,z:coords.z}:null;
 const action=typeof e.action==='string'?e.action.slice(0,80):null;
 const targetId=typeof e.targetId==='string'?e.targetId.slice(0,100):null;
 return {time:e.timestamp,type:e.type,symbol,label,action,targetId,
  decisionId:Number.isInteger(e.decisionId)?e.decisionId:null,position,
  provenance:e.type.includes('attempt')||e.type.includes('intent')?'agent_attempt_or_intent':'agent_observed_event'};
}
export function readEventAnnotations(root,{limit=35,tailBytes=262144}={}){
 const file=path.join(root,'continuous','agent.log');
 let fd;try{fd=fs.openSync(file,'r');}catch{return [];}
 try{
  const size=fs.fstatSync(fd).size,amount=Math.min(tailBytes,size),buf=Buffer.alloc(amount);
  fs.readSync(fd,buf,0,amount,size-amount);
  let content=buf.toString('utf8');
  if(size>amount)content=content.slice(content.indexOf('\n')+1);
  const annotations=[];
  for(const line of content.split('\n')){
   if(!line.startsWith('{"timestamp":'))continue;
   try{const item=eventAnnotation(JSON.parse(line));if(item)annotations.push(item);}catch{}
  }
  return annotations.slice(-Math.min(100,Math.max(1,limit)));
 }finally{fs.closeSync(fd);}
}
