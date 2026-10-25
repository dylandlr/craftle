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
 const confirmations=ordered.filter(e=>e.event==='pickup_post_tick_inventory');
 const records=[];let unique=0,ambiguous=0,unmatched=0;
 for(const b of breaks){
  const candidates=intents.filter(a=>sameBlock(a,b)&&sameActor(a,b)&&epoch(a)<=b.unixTimeMs&&b.unixTimeMs-epoch(a)<=windowMs);
  const status=candidates.length===1?'single_command_candidate':candidates.length>1?'ambiguous':'unmatched';
  if(candidates.length===1)unique++;else if(candidates.length>1)ambiguous++;else unmatched++;
  const matchingDrops=drops.filter(d=>d.x===b.x&&d.y===b.y&&d.z===b.z&&compatibleServerActor(b,d)&&d.sequence>b.sequence&&d.serverTick>=b.serverTick&&d.serverTick<=b.serverTick+2);
  const itemIds=new Map(matchingDrops.flatMap(d=>(d.drops??[]).filter(x=>typeof x.entityUuid==='string').map(x=>[x.entityUuid,d.sequence])));
  const matchingPickups=pickups.filter(p=>itemIds.has(p.itemEntityUuid)&&p.sequence>itemIds.get(p.itemEntityUuid)&&compatibleServerActor(b,p)&&p.serverTick>=b.serverTick);
  const verifiedPickups=matchingPickups.filter(p=>confirmations.some(c=>
    c.itemEntityUuid===p.itemEntityUuid&&compatibleServerActor(p,c)&&
    c.sequence>p.sequence&&c.serverTick>=p.serverTick&&c.serverTick<=p.serverTick+3&&
    c.item===p.item&&Number.isFinite(c.beforeCount)&&Number.isFinite(c.afterCount)&&c.afterCount>c.beforeCount));
  const actorIdentityComplete=Boolean(b.playerUuid&&b.playerName)&&matchingDrops.length===1&&
    Boolean(matchingDrops[0].playerUuid)&&matchingDrops[0].playerUuid===b.playerUuid&&
    matchingPickups.some(p=>p.playerUuid===b.playerUuid)&&
    verifiedPickups.some(p=>confirmations.some(c=>c.itemEntityUuid===p.itemEntityUuid&&c.playerUuid===b.playerUuid));
  records.push({actorIdentityComplete,linkedItemUuids:[...itemIds.keys()],verifiedInventoryGains:verifiedPickups.length,serverBreakSequence:b.sequence,serverTick:b.serverTick,block:[b.x,b.y,b.z],association:status,decisionId:candidates.length===1?candidates[0].decisionId:null,matchedDropEvents:matchingDrops.length,matchedPickupEvents:matchingPickups.length,completedAcquisitionCandidate:candidates.length===1&&matchingDrops.length===1&&matchingPickups.length>0,verifiedAcquisitionCandidate:candidates.length===1&&matchingDrops.length===1&&verifiedPickups.length>0,strictVerifiedAcquisitionCandidate:candidates.length===1&&actorIdentityComplete&&verifiedPickups.length>0});
 }
 // A single decision or item entity cannot be credited to multiple harvest breaks.
 const duplicateDecisions=new Set();
 const decisionCounts=new Map();
 const uuidCounts=new Map();
 for(const r of records){
  if(r.decisionId!==null)decisionCounts.set(r.decisionId,(decisionCounts.get(r.decisionId)??0)+1);
  for(const uuid of r.linkedItemUuids)uuidCounts.set(uuid,(uuidCounts.get(uuid)??0)+1);
 }
 for(const r of records){
  const collision=(r.decisionId!==null&&decisionCounts.get(r.decisionId)>1)||
    r.linkedItemUuids.some(uuid=>uuidCounts.get(uuid)>1);
  if(collision){r.duplicateAssociation=true;r.completedAcquisitionCandidate=false;r.verifiedAcquisitionCandidate=false;r.strictVerifiedAcquisitionCandidate=false;if(r.decisionId!==null)duplicateDecisions.add(r.decisionId);}
  else r.duplicateAssociation=false;
 }
 return {schema:'craftle.server-acquisition-match.v1',duplicateDecisionIds:[...duplicateDecisions],duplicateItemEntityUuids:[...uuidCounts].filter(([,count])=>count>1).map(([uuid])=>uuid),serverBootId:ordered[0]?.serverBootId??null,serverEvents:ordered.length,serverBlockBreaks:breaks.length,serverPickups:pickups.length,serverConsumptionEvents:meals.length,singleCommandCandidates:unique,ambiguousBreaks:ambiguous,unmatchedBreaks:unmatched,completeAcquisitionCandidates:records.filter(r=>r.completedAcquisitionCandidate).length,verifiedAcquisitionCandidates:records.filter(r=>r.verifiedAcquisitionCandidate).length,strictVerifiedAcquisitionCandidates:records.filter(r=>r.strictVerifiedAcquisitionCandidate).length,records,limitations:'Only candidate association; strict inventory confirmation requires matching nonempty server actor IDs, while agent-to-server linkage still relies on names and time. Actor mismatch rejects matches, absent actor identity is not confirmation, and one linked drop event is required. Event timestamps originate in different processes; no calibrated clock uncertainty or server-acknowledged decision token. Drop and pickup UUIDs are authoritative when present; post-tick inventory gains strengthen evidence but may be confounded by concurrent inventory changes. No reward credit.'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const agent=fs.readFileSync(process.argv[2],'utf8').split('\n').filter(s=>s.startsWith('{"timestamp":')).map(JSON.parse);
 const server=fs.readFileSync(process.argv[3],'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
 console.log(JSON.stringify(matchServerAcquisition(agent,server),null,2));
}
