// Offline observation-difference verifier for Minecraft action attempts.
// Verifies measured changes, not causality; never infers item gain from a dig promise.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const pos=p=>p&&[p.x,p.y,p.z].every(finite);
const normalize=s=>{
 if(!s||!Number.isSafeInteger(s.tick)||s.tick<0||!pos(s.position)||!finite(s.health)||!finite(s.food)||!Array.isArray(s.inventory))throw Error('Invalid observation');
 const inventory=new Map();
 for(const i of s.inventory){
  if(typeof i?.name!=='string'||!i.name||!Number.isSafeInteger(i.count)||i.count<0)throw Error('Invalid inventory item');
  inventory.set(i.name,(inventory.get(i.name)??0)+i.count);
 }
 const blocks=new Map();
 for(const b of s.blocks??[]){
  if(!pos(b?.position)||typeof b.name!=='string'||!b.name)throw Error('Invalid observed block');
  blocks.set([b.position.x,b.position.y,b.position.z].join(','),b.name);
 }
 return {tick:s.tick,position:{...s.position},health:s.health,food:s.food,inventory,blocks};
};
export class MinecraftOutcomeLedger {
 constructor(){this.active=null;this.history=[];}
 begin({decisionId,action,observation}){
  if(this.active)throw Error('Previous attempt unresolved');
  if(typeof decisionId!=='string'||!decisionId||typeof action!=='string'||!action)throw Error('Invalid attempt');
  this.active={decisionId,action,before:normalize(observation)};return decisionId;
 }
 finish({observation,reason='observation',environmentTerminal=false}){
  if(!this.active)throw Error('No pending attempt');
  const after=normalize(observation),{before,decisionId,action}=this.active;
  if(after.tick<before.tick)throw Error('Tick regression');
  const inventoryDeltas={};
  for(const name of new Set([...before.inventory.keys(),...after.inventory.keys()])){
   const d=(after.inventory.get(name)??0)-(before.inventory.get(name)??0);
   if(d!==0)inventoryDeltas[name]=d;
  }
  const blockChanges=[];
  for(const [key,oldName] of before.blocks){
   if(after.blocks.has(key)&&after.blocks.get(key)!==oldName)
    blockChanges.push({positionKey:key,before:oldName,after:after.blocks.get(key)});
  }
  const displacement=Math.hypot(after.position.x-before.position.x,after.position.y-before.position.y,after.position.z-before.position.z);
  const evidence={source:'agent_observation',decisionId,action,elapsedTicks:after.tick-before.tick,
   healthDelta:after.health-before.health,foodDelta:after.food-before.food,inventoryDeltas,blockChanges,displacement,
   episodeTerminal:Boolean(environmentTerminal),causalAttribution:'unverified_temporal_association'};
  // Only a directly observed difference counts as observed change; no claimed action success.
  const changed=Object.keys(inventoryDeltas).length>0||blockChanges.length>0||displacement>0.05||evidence.healthDelta!==0||evidence.foodDelta!==0;
  const result=environmentTerminal?'verified_failure':reason==='timeout'?'timed_out':reason==='interrupt'?'interrupted':changed?'unknown':'no_observable_change';
  const entry={schema:'craftle.minecraft-outcome.v1',decisionId,action,startTick:before.tick,endTick:after.tick,result,evidence};
  this.history.push(entry);this.active=null;return structuredClone(entry);
 }
}
