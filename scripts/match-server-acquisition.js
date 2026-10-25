import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const epoch=e=>Number.isFinite(e.timestampMs)?e.timestampMs:Date.parse(e.timestamp);
const coords=id=>{const m=/^plant:(-?\d+),(-?\d+),(-?\d+)$/.exec(id??'');return m?m.slice(1).map(Number):null;};
// Actor names are independently recorded by Mineflayer and Paper. A mismatch
// disproves association; an absent actor does not prove identity.
const sameActor=(a,b)=>!a.agent||!b.playerName||a.agent===b.playerName;
const compatibleServerActor=(a,b)=>!a.playerUuid||!b.playerUuid||a.playerUuid===b.playerUuid;
const sameBlock=(a,b)=>{const c=coords(a.targetId);return c&&c[0]===b.x&&c[1]===b.y&&c[2]===b.z;};
export function matchServerAcquisition(agent,server,{windowMs=6000}={}){
 const ordered=[...server].sort((a,b)=>a.sequence-b.sequence);
 for(let i=0;i<ordered.length;i++){
  const e=ordered[i];
  if(e.schema!=='craftle.server-event.v1'||!Number.isSafeInteger(e.sequence)||!Number.isSafeInteger(e.serverTick)||!Number.isFinite(e.unixTimeMs))throw Error('Invalid authoritative server record');
  if(i&&(e.sequence<=ordered[i-1].sequence||e.serverBootId!==ordered[i-1].serverBootId||e.serverTick<ordered[i-1].serverTick))throw Error('Server log ordering or boot mismatch');
 }
 const intents=agent.filter(e=>e.type==='target_harvest_intent'&&Number.isSafeInteger(e.decisionId));
 const breaks=ordered.filter(e=>e.event==='block_break_event');
 const drops=ordered.filter(e=>e.event==='block_drops_event');
 const pickups=ordered.filter(e=>e.event==='item_pickup_event');
 const meals=ordered.filter(e=>e.event==='item_consume_event');
 const records=[];let unique=0,ambiguous=0,unmatched=0;
 for(const b of breaks){
  const candidates=intents.filter(a=>sameBlock(a,b)&&sameActor(a,b)&&epoch(a)<=b.unixTimeMs&&b.unixTimeMs-epoch(a)<=windowMs);
  const status=candidates.length===1?'single_command_candidate':candidates.length>1?'ambiguous':'unmatched';
  if(candidates.length===1)unique++;else if(candidates.length>1)ambiguous++;else unmatched++;
  const matchingDrops=drops.filter(d=>d.x===b.x&&d.y===b.y&&d.z===b.z&&compatibleServerActor(b,d)&&d.serverTick>=b.serverTick&&d.serverTick<=b.serverTick+2);
  const itemIds=new Set(matchingDrops.flatMap(d=>(d.drops??[]).map(x=>x.entityUuid)));
  const matchingPickups=pickups.filter(p=>itemIds.has(p.itemEntityUuid)&&compatibleServerActor(b,p)&&p.serverTick>=b.serverTick);
  records.push({serverBreakSequence:b.sequence,serverTick:b.serverTick,block:[b.x,b.y,b.z],association:status,decisionId:candidates.length===1?candidates[0].decisionId:null,matchedDropEvents:matchingDrops.length,matchedPickupEvents:matchingPickups.length,completedAcquisitionCandidate:candidates.length===1&&matchingDrops.length===1&&matchingPickups.length>0});
 }
 return {schema:'craftle.server-acquisition-match.v1',serverBootId:ordered[0]?.serverBootId??null,serverEvents:ordered.length,serverBlockBreaks:breaks.length,serverPickups:pickups.length,serverConsumptionEvents:meals.length,singleCommandCandidates:unique,ambiguousBreaks:ambiguous,unmatchedBreaks:unmatched,completeAcquisitionCandidates:records.filter(r=>r.completedAcquisitionCandidate).length,records,limitations:'Only candidate association; actor mismatch rejects matches, absent actor identity is not confirmation, and one linked drop event is required. Event timestamps originate in different processes; no calibrated clock uncertainty or server-acknowledged decision token. Drop and pickup UUIDs are authoritative when present. No reward credit.'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const agent=fs.readFileSync(process.argv[2],'utf8').split('\n').filter(s=>s.startsWith('{"timestamp":')).map(JSON.parse);
 const server=fs.readFileSync(process.argv[3],'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
 console.log(JSON.stringify(matchServerAcquisition(agent,server),null,2));
}
