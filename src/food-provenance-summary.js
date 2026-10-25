// Conservative temporal association; never equate correlation with verified causation.
export function summarizeFoodProvenance(events,{windowMs=6000}={}){
 const commands=[],pickups=[],gains=[],meals=[],blockObservations=[];
 for(const e of events){
  if(e.type==='target_harvest_block_observation')blockObservations.push(e);
  if(e.type==='target_harvest_intent'||e.type==='target_attack_intent'){
   commands.push(e);
  }else if(e.type==='food_provenance_pickup_event')pickups.push(e);
  else if(e.type==='food_provenance_inventory_delta'&&e.delta>0)gains.push(e);
  else if(e.type==='target_consumed'||e.type==='auto_eat_finish')meals.push(e);
 }
 let associated=0,unassociated=0,ambiguous=0;
 const examples=[];
 for(const p of pickups){
  const t=Number(p.timestampMs);
  const candidates=commands.filter(c=>{
   const ct=Number(c.timestampMs);
   return Number.isFinite(t)&&Number.isFinite(ct)&&ct<=t&&t-ct<=windowMs;
  });
  if(candidates.length===1){associated++;if(examples.length<12)examples.push({pickupEntityId:p.entityId,commandDecisionId:candidates[0].decisionId,classification:'single_temporal_candidate_not_causal_proof'});}
  else if(candidates.length>1)ambiguous++;
  else unassociated++;
 }
 return {schema:'craftle.food-provenance-summary.v1',harvestOrAttackCommands:commands.length,pickupEvents:pickups.length,positiveInventoryDeltas:gains.length,mealEvents:meals.length,observedHarvestBlockChanges:blockObservations.filter(e=>e.changed===true).length,unchangedHarvestBlocks:blockObservations.filter(e=>e.changed===false).length,temporallyAssociatedPickups:associated,ambiguousPickups:ambiguous,unassociatedPickups:unassociated,examples,limitations:'Temporal association only. Client-observed block change is not server-confirmed; no block drop identity, server-confirmed chain, or credit-worthy acquisition reward.'};
}
