// Streaming O(1) memory event aggregation for multi-GB continuous Craftle logs.
import fs from 'node:fs';
import readline from 'node:readline';
const file=process.argv[2];
if(!file)throw Error('Usage: node scripts/report-survival-progress.js LOG.jsonl');
const counts=Object.create(null),actions=Object.create(null),discoveries=new Set();
let first=null,last=null,decisions=0,healthLow=0,foodEmpty=0,rewardSum=0,rewardCount=0;
let poseSamples=0,observedBlockChanges=0,observedInventoryGain=0,chunkSamples=0,chunkUnknown=0;
const input=fs.createReadStream(file,{encoding:'utf8',highWaterMark:256*1024});
const reader=readline.createInterface({input,crlfDelay:Infinity});
for await(const line of reader){
 if(!line.startsWith('{"timestamp":'))continue;
 let e;try{e=JSON.parse(line);}catch{continue;}
 if(!first)first=e.timestamp;last=e.timestamp;
 counts[e.type]=(counts[e.type]??0)+1;
 if(e.type==='target_decision'){const a=e.skill??e.action??'unknown';actions[a]=(actions[a]??0)+1;decisions++;}
 if(e.type==='target_transition'&&Number.isFinite(e.reward)){rewardSum+=e.reward;rewardCount++;}
 if(e.type==='discovery_new_cell'&&e.cellKey)discoveries.add(e.cellKey);
 if(e.type==='target_action'){if(Number.isFinite(e.health)&&e.health<=5)healthLow++;if(e.food===0)foodEmpty++;}
 if(e.type==='pose_sample')poseSamples++;
 if(e.type==='target_harvest_block_observation'&&e.changed)observedBlockChanges++;
 if(e.type==='target_inventory_observed'&&e.deltaFoodUnits>0)observedInventoryGain++;
 if(e.type==='agent_chunk_cache_audit'){chunkSamples++;chunkUnknown+=e.unknownSamples??0;}
}
const count=k=>counts[k]??0;
const survival={
 schema:'craftle.survival-progress-report.v1',source:file,timeRange:{start:first,end:last},
 decisions,actions,discoveredCells:discoveries.size,
 verified:{
  hungerRecovery:count('target_verified_recovery'),
  eatEvents:count('target_consumed'),
  harvestAttempts:count('target_harvest_attempt'),
  observedBlockChanges,attackAttempts:count('target_attack_attempt'),
  observedInventoryGain,deaths:count('death_screen_observed')
 },
 healthCriticalSamples:healthLow,foodEmptySamples:foodEmpty,
 learning:{transitions:count('target_transition'),meanReward:rewardCount?rewardSum/rewardCount:null},
 renderingDiagnostics:{poseSamples,chunkSamples,chunkUnknownSamples:chunkUnknown,
  chunkAvailability:chunkSamples?'agent_cache_only':'not_present_in_existing_log'},
 caveat:'Observed counts are not proof of agent-caused progress; use food provenance and server attribution.'
};
console.log(JSON.stringify(survival,null,2));
