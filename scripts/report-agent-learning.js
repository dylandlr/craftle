// Observed behaviour and opportunity availability, not claims of learned competence.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const ACTIONS=['eat','explore','retreat',...Array.from({length:4},(_,i)=>['approach','harvest','attack'].map(s=>s+'_'+i)).flat()];
export function summarizeAgentLearning(events,{file=null}={}){
 const actions={},available={},modes={},versions={},errors={},visited=new Set(),targetIds=new Set(),targetKinds={};
 const sequences={started:0,observedInventoryGain:0,observedRecovery:0,withInventoryGainAndRecovery:0,death:0,timeout:0};
 let decisions=0,transitions=0,deaths=0,verifiedEats=0,reward=0,terminalReward=0,terminals=0,trainingTransitions=0,trainingTerminals=0,foodSum=0,foodSamples=0;
 let withMasks=0,withoutMasks=0,withTargetTelemetry=0,withTargets=0,foodEligible=0,foodChosenWhenEligible=0,eatEligible=0,targetEligible=0,targetChosen=0;
 let firstUpdates=null,lastUpdates=null,processStarts=0;const decreases=[];
 for(const e of events){
  if(e.type==='recording_started')processStarts++;
  if(e.type==='food_sequence_started')sequences.started++;
  if(e.type==='food_sequence_inventory_gain')sequences.observedInventoryGain++;
  if(e.type==='food_sequence_recovery'){sequences.observedRecovery++;if(e.status==='sequence_with_observed_inventory_gain')sequences.withInventoryGainAndRecovery++;}
  if(e.type==='food_sequence_finished'&&e.status==='death')sequences.death++;
  if(e.type==='food_sequence_finished'&&e.status==='timeout')sequences.timeout++;
  if(e.type==='death')deaths++;
  if(e.type==='target_verified_recovery')verifiedEats++;
  if(e.type==='target_decision'){
   decisions++;actions[e.action]=(actions[e.action]??0)+1;
   modes[e.mode??'unknown']=(modes[e.mode??'unknown']??0)+1;
   versions[e.rewardVersion??'not_logged']=(versions[e.rewardVersion??'not_logged']??0)+1;
   if(Array.isArray(e.targets)){
    withTargetTelemetry++;if(e.targets.length)withTargets++;
    for(const t of e.targets){if(t.id)targetIds.add(t.id);targetKinds[t.kind??'unknown']=(targetKinds[t.kind??'unknown']??0)+1;}
   }
   if(Array.isArray(e.mask)&&e.mask.length===ACTIONS.length&&e.mask.every(x=>typeof x==='boolean')){
    withMasks++;
    for(let i=0;i<ACTIONS.length;i++)if(e.mask[i])available[ACTIONS[i]]=(available[ACTIONS[i]]??0)+1;
    const targetAvailable=e.mask.slice(3).some(Boolean),foodAvailable=e.mask[0]||targetAvailable;
    if(e.mask[0])eatEligible++;
    if(targetAvailable)targetEligible++;
    if(foodAvailable){foodEligible++;if(e.action==='eat'||ACTIONS.indexOf(e.action)>=3)foodChosenWhenEligible++;}
    if(targetAvailable&&ACTIONS.indexOf(e.action)>=3)targetChosen++;
   }else withoutMasks++;
  }
  if(e.type==='target_transition'||e.type==='target_terminal'){
   if(e.type==='target_transition'){transitions++;if(Number.isFinite(e.reward))reward+=e.reward;if(e.mode==='training')trainingTransitions++;}
   else{terminals++;if(Number.isFinite(e.reward))terminalReward+=e.reward;if(e.mode==='training')trainingTerminals++;}
   if(e.mode==='training'&&Number.isSafeInteger(e.updates)&&e.updates>=0){
    if(firstUpdates===null)firstUpdates=e.updates;
    if(lastUpdates!==null&&e.updates<lastUpdates)decreases.push({timestamp:e.timestamp,previous:lastUpdates,current:e.updates});
    lastUpdates=e.updates;
   }
  }
  if(['target_runtime_error','target_action_rejected','error','kicked'].includes(e.type)){
   const key=e.type+': '+String(e.message??e.reason??'unspecified').slice(0,200);errors[key]=(errors[key]??0)+1;
  }
  if(e.type==='health'&&Number.isFinite(e.food)){foodSum+=e.food;foodSamples++;}
  if(e.type==='pose_sample'&&e.position&&[e.position.x,e.position.z].every(Number.isFinite))visited.add(Math.floor(e.position.x/8)+','+Math.floor(e.position.z/8));
 }
 const start=events[0]?.timestamp,end=events.at(-1)?.timestamp;
 const rounded=n=>Math.round(n*1000)/1000;
 const diagnoses=[];
 if(withMasks===0)diagnoses.push('No complete action masks logged; opportunity availability is unknown.');
 if(withMasks&&targetEligible/withMasks<0.01)diagnoses.push('Target actions were available in less than 1% of mask-bearing decisions; audit perception, visibility, resource coverage and the environment before reward tuning.');
 if(targetEligible>=20&&targetChosen/targetEligible<0.05)diagnoses.push('Target opportunities were often offered but rarely selected; audit policy values, exploration settings and reward incentives.');
 if(decreases.length)diagnoses.push('Training update counters decreased; this log is not a single monotonically increasing update history. Correlate process/checkpoint changes before claiming continuity.');
 return {
  schema:'craftle.learning-report.v2',file,eventCount:events.length,
  timeRange:{start,end,minutes:start&&end?rounded((Date.parse(end)-Date.parse(start))/60000):0},
  decisions,actionCounts:actions,transitions,verifiedEats,deaths,foodSequences:sequences,
  eightBlockCellsVisited:visited.size,avgFood:foodSamples?foodSum/foodSamples:null,
  rewardTotal:rounded(reward),terminalRewardTotal:rounded(terminalReward),loggedRewardTotalIncludingTerminals:rounded(reward+terminalReward),
  finalTrainingUpdates:lastUpdates,
  opportunities:{decisionsWithValidMasks:withMasks,decisionsWithoutValidMasks:withoutMasks,availableActionCounts:available,
   decisionsWithTargetTelemetry:withTargetTelemetry,decisionsWithTargets:withTargets,uniqueTargetIds:targetIds.size,targetSightingsByKind:targetKinds,
   decisionsWithEatAvailable:eatEligible,decisionsWithTargetActionAvailable:targetEligible,decisionsChoosingTargetWhenAvailable:targetChosen,
   decisionsWithAnyFoodActionAvailable:foodEligible,decisionsChoosingFoodActionWhenAvailable:foodChosenWhenEligible},
  trainingHistory:{decisionModes:modes,decisionRewardVersions:versions,loggedProcessStarts:processStarts,trainingTransitions,trainingTerminals,
   expectedUpdatesFromLoggedTrainingTransitions:4*(trainingTransitions+trainingTerminals),
   firstLoggedUpdates:firstUpdates,lastLoggedUpdates:lastUpdates,counterDecreases:decreases},
  runtimeErrors:errors,diagnoses,
  note:'Observed event metrics only. Masks describe offered actions, not independently proven resources. Terminal rewards are reported separately; no continuity or causal learning claim.'
 };
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error('Usage: node scripts/report-agent-learning.js <agent.log>');
 const events=[];
 for(const line of fs.readFileSync(file,'utf8').split('\n')){
  if(!line.startsWith('{"timestamp":'))continue;
  try{events.push(JSON.parse(line));}catch{}
 }
 console.log(JSON.stringify(summarizeAgentLearning(events,{file}),null,2));
}
