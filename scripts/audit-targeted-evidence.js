import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export function auditTargetedEvidence(events){
 const decisions=new Map(),actions=new Map(),foodDeltas=[],recoveries=[],consumptions=[];
 for(const e of events){
  if(e.type==='target_decision'){
   if(!Number.isSafeInteger(e.decisionId)||decisions.has(e.decisionId))throw Error('Duplicate or malformed targeted decision');
   decisions.set(e.decisionId,e);
  }
  if(e.type==='target_action'){
   const d=decisions.get(e.decisionId);
   if(!d||d.skill!==e.skill||d.targetId!==e.targetId)throw Error('Targeted action does not match decision');
   actions.set(e.decisionId,(actions.get(e.decisionId)??0)+1);
  }
  if(e.type==='target_inventory_observed'){
   const d=decisions.get(e.decisionId);
   if(!d||e.evidence!=='subsequent_observation_not_causal_proof'||e.action!==d.action||!Number.isFinite(e.deltaFoodUnits)||e.currentFoodUnits-e.previousFoodUnits!==e.deltaFoodUnits)throw Error('Invalid food inventory observation');
   foodDeltas.push(e);
  }
  if(e.type==='target_consumed')consumptions.push(e);
  if(e.type==='target_verified_recovery'){
   const d=decisions.get(e.decisionId);
   if(!d||d.skill!=='eat'||!Number.isFinite(e.beforeFood)||!Number.isFinite(e.afterFood)||e.afterFood<=e.beforeFood||recoveries.some(x=>x.decisionId===e.decisionId))throw Error('Invalid verified hunger recovery');
   recoveries.push(e);
  }
 }
 for(const r of recoveries){
  const matching=consumptions.filter(c=>c.decisionId===r.decisionId&&c.beforeFood===r.beforeFood&&c.afterFood===r.afterFood);
  if(matching.length!==1)throw Error('Verified recovery requires one matching consumption event');
 }
 for(const c of consumptions){if(!decisions.has(c.decisionId)||c.afterFood<=c.beforeFood||recoveries.filter(r=>r.decisionId===c.decisionId).length!==1)throw Error('Consumption has no valid verified recovery');}
 return {schema:'craftle.target-evidence-audit.v1',decisions:decisions.size,actions:[...actions.values()].reduce((a,b)=>a+b,0),foodInventoryIncreases:foodDeltas.filter(x=>x.deltaFoodUnits>0).length,verifiedHungerRecoveries:recoveries.length,limitations:'Food inventory changes are temporal correlations, not verified causes. Agent-reported hunger recovery requires independent server verification for stronger evidence.'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const events=fs.readFileSync(process.argv[2],'utf8').split('\n').filter(s=>s.startsWith('{"timestamp":')).map(s=>JSON.parse(s));
 console.log(JSON.stringify(auditTargetedEvidence(events),null,2));
}
