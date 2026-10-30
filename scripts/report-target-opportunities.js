// Diagnose whether targets are absent, masked, or ignored in continuous training logs.
// O(1) aggregate memory: suitable for multi-gigabyte JSONL recordings.
import fs from 'node:fs';
import readline from 'node:readline';
const file=process.argv[2];
if(!file)throw Error('Usage: node scripts/report-target-opportunities.js LOG.jsonl');
const counts={decisions:0,withTargets:0,withoutTargets:0,withHarvestablePlant:0,withAttackableAnimal:0,
 withApproachOption:0,withEatOption:0,withFoodAvailable:0,withThreat:0,
 targetPresentExplore:0,targetPresentRetreat:0,targetPresentApproach:0,
 noTargetsExplore:0,noTargetsRetreat:0};
const targetKinds={};const chosen={};const observedMasks={};
const read=readline.createInterface({input:fs.createReadStream(file,{encoding:'utf8'}),crlfDelay:Infinity});
for await(const line of read){
 if(!line.startsWith('{"timestamp":'))continue;
 let e;try{e=JSON.parse(line);}catch{continue;}
 if(e.type!=='target_decision')continue;
 counts.decisions++;
 const targets=Array.isArray(e.targets)?e.targets:[],mask=Array.isArray(e.mask)?e.mask:[];
 const action=e.skill??e.action??'unknown';chosen[action]=(chosen[action]??0)+1;
 const present=targets.length>0;
 counts[present?'withTargets':'withoutTargets']++;
 if(e.features?.[2]>0)counts.withFoodAvailable++;
 if(targets.some(t=>t.kind==='plant'&&t.reachable))counts.withHarvestablePlant++;
 if(targets.some(t=>t.kind==='animal'&&t.reachable))counts.withAttackableAnimal++;
 if(mask[0])counts.withEatOption++;
 if(mask.slice(3).some((yes,i)=>yes&&i%3===0))counts.withApproachOption++;
 if(Number(e.features?.[5])<1)counts.withThreat++;
 for(const t of targets)targetKinds[t.kind??'unknown']=(targetKinds[t.kind??'unknown']??0)+1;
 for(let i=0;i<mask.length;i++)if(mask[i])observedMasks[i]=(observedMasks[i]??0)+1;
 if(present){
  if(action==='explore')counts.targetPresentExplore++;
  if(action==='retreat')counts.targetPresentRetreat++;
  if(action==='approach')counts.targetPresentApproach++;
 }else{
  if(action==='explore')counts.noTargetsExplore++;
  if(action==='retreat')counts.noTargetsRetreat++;
 }
}
console.log(JSON.stringify({schema:'craftle.target-opportunity-audit.v1',file,counts,chosen,targetKinds,
 availableActionIndexCounts:observedMasks,
 interpretation:'Target availability and action masks are from agent decision logs, not server omniscience.'},null,2));
