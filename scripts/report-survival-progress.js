// Read-only experiment report: distinguish endless movement from verified survival progress.
// Usage: node scripts/report-survival-progress.js /state/agent/continuous/agent.log
import fs from 'node:fs';
const path=process.argv[2];
if(!path)throw Error('Usage: node scripts/report-survival-progress.js LOG.jsonl');
const lines=fs.readFileSync(path,'utf8').split('\n');
const counts={},actions={},rewards=[],decisions=[],discoveries=new Set(),positions=[];
let first=null,last=null,healthLow=0,foodEmpty=0;
for(const line of lines){
 if(!line.startsWith('{"timestamp":'))continue;
 let e;try{e=JSON.parse(line);}catch{continue;}
 if(!first)first=e.timestamp;last=e.timestamp;
 counts[e.type]=(counts[e.type]??0)+1;
 if(e.type==='target_decision'){const a=e.skill??e.action??'unknown';actions[a]=(actions[a]??0)+1;decisions.push(e);}
 if(e.type==='target_transition'&&Number.isFinite(e.reward))rewards.push(e.reward);
 if(e.type==='discovery_new_cell'&&e.cellKey)discoveries.add(e.cellKey);
 if(e.type==='target_action'){if(Number.isFinite(e.health)&&e.health<=5)healthLow++;if(e.food===0)foodEmpty++;}
 if(e.type==='pose_sample'&&e.position&&[e.position.x,e.position.z].every(Number.isFinite))positions.push(e.position);
}
const count=k=>counts[k]??0;
const decisionCount=decisions.length;
const survival={
 schema:'craftle.survival-progress-report.v1',source:path,timeRange:{start:first,end:last},
 decisions:decisionCount,actions,discoveredCells:discoveries.size,
 verified:{
  hungerRecovery:count('target_verified_recovery')+count('target_consumed'),
  eatEvents:count('target_consumed'),
  harvestAttempts:count('target_harvest_attempt'),
  observedBlockChanges:0,
  attackAttempts:count('target_attack_attempt'),
  observedInventoryGain:0,
  deaths:count('death_screen_observed')
 },
 healthCriticalSamples:healthLow,foodEmptySamples:foodEmpty,
 learning:{transitions:count('target_transition'),meanReward:rewards.length?rewards.reduce((a,b)=>a+b,0)/rewards.length:null},
 renderingDiagnostics:{poseSamples:positions.length,chunkAvailability:'not_present_in_existing_log'},
 caveat:'Observed counts are not proof of agent-caused progress; use food provenance and server attribution.'
};
for(const line of lines){if(!line.startsWith('{"timestamp":'))continue;let e;try{e=JSON.parse(line);}catch{continue;}
 if(e.type==='target_harvest_block_observation'&&e.changed)survival.verified.observedBlockChanges++;
 if(e.type==='target_inventory_observed'&&e.deltaFoodUnits>0)survival.verified.observedInventoryGain++;
}
console.log(JSON.stringify(survival,null,2));
