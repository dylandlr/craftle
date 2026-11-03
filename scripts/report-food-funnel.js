// Read-only food acquisition funnel from authoritative *observed* agent JSONL.
// Correlation only: inventory gain alone does not prove a particular attack succeeded.
import fs from 'node:fs';
export function summarizeFoodFunnel(events){
 const counts={};const increment=k=>counts[k]=(counts[k]??0)+1;
 const decisions={};let lastDecision=null,first=null,last=null;
 const skills={};const availability={};const perception={auditSamples:0,totalCandidates:0,selectedTargets:0,
  visibleFoodEntities:0,visiblePlants:0,inventoryFoodItems:0};
 const anomalies=[];
 for(const e of events){
  if(!e||typeof e.type!=='string')continue;
  if(e.timestamp){first??=e.timestamp;last=e.timestamp;}
  increment(e.type);
  if(e.type==='target_decision'){
   const action=e.action??e.skill??'unknown';skills[action]=(skills[action]??0)+1;
   lastDecision=e.decisionId;
   decisions[e.decisionId]={action,at:e.timestamp};
  }
  if(e.type==='decision_trace_v1'){
   const allowed=(e.actions??[]).filter((_,i)=>e.mask?.[i]);
   for(const action of allowed)availability[action]=(availability[action]??0)+1;
  }
  if(e.type==='target_perception_audit'){
   perception.auditSamples++;
   perception.totalCandidates+=e.totalCandidates??0;
   perception.selectedTargets+=e.selectedTargets??0;
   perception.visibleFoodEntities+=e.entityVisibilityAccepted??0;
   perception.visiblePlants+=e.plantVisibilityAccepted??0;
   perception.inventoryFoodItems+=e.inventoryFoodItems??0;
  }
  if(e.type==='target_runtime_error'&&anomalies.length<12)anomalies.push({
   at:e.timestamp,error:String(e.message??'unknown').slice(0,200)});
 }
 const get=k=>counts[k]??0;
 const phases={
  perceptionSamples:perception.auditSamples,
  approachDecisions:Object.entries(skills).filter(([k])=>k.startsWith('approach_')).reduce((s,[,n])=>s+n,0),
  attacksAttempted:get('target_attack_attempt'),
  harvestsAttempted:get('target_harvest_attempt'),
  pickupEvents:get('food_provenance_pickup_event'),
  positiveInventoryDeltas:events.filter(e=>e.type==='food_provenance_inventory_delta'&&e.delta>0).length,
  verifiedEats:get('target_consumed'),
  verifiedHungerRecovery:get('target_verified_recovery'),
  deaths:get('death_screen_observed')
 };
 const bottlenecks=[];
 if(perception.auditSamples===0)bottlenecks.push('No target-perception audits in sampled interval; enable CRAFTLE_TARGET_PERCEPTION_AUDIT=1.');
 if(phases.approachDecisions===0)bottlenecks.push('No approach decisions; inspect target masks and observation slots.');
 if(phases.attacksAttempted+phases.harvestsAttempted===0)bottlenecks.push('No attack or harvest attempts; inspect reachability and action selection.');
 if(phases.pickupEvents===0)bottlenecks.push('No pickup events observed; verify drops and collection radius.');
 if(phases.verifiedEats===0)bottlenecks.push('No successful eat event observed; check whether edible inventory was available.');
 return {schema:'craftle.food-funnel-report.v1',readOnly:true,first,last,phases,
  skills,availability,perception,sequenceEvents:{
   started:get('food_sequence_started'),attempts:get('food_sequence_attempt'),
   inventoryGain:get('food_sequence_inventory_gain'),
   recovered:get('food_sequence_recovery'),finished:get('food_sequence_finished')},
  bottlenecks,anomalies,limitations:[
   'Observed event counts are not independent trials or success rates.',
   'A pickup or inventory increase does not establish causation by the preceding action.',
   'Availability represents decision-trace mask counts, not global world opportunities.',
   'No food-source data is fabricated when auditing events are absent.'
  ]};
}
export function loadFoodEvents(file,{tailBytes=32*1024*1024}={}){
 const fd=fs.openSync(file,'r');
 try{
  const size=fs.fstatSync(fd).size,start=Math.max(0,size-tailBytes);
  const bytes=Buffer.alloc(size-start);fs.readSync(fd,bytes,0,bytes.length,start);
  const lines=bytes.toString('utf8').split(/\r?\n/);if(start>0)lines.shift();
  return lines.flatMap(line=>{if(!line.startsWith('{"timestamp":'))return [];
   try{return [JSON.parse(line)];}catch{return [];}});
 }finally{fs.closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const file=process.argv[2]??'/state/agent/continuous/agent.log';
 console.log(JSON.stringify(summarizeFoodFunnel(loadFoodEvents(file)),null,2));
}
