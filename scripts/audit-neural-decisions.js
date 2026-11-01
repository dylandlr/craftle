// Read-only streaming audit of large continuous agent JSONL (multi-GB safe).
// Usage: node scripts/audit-neural-decisions.js [logPath] [lastN]
import fs from 'node:fs';
import readline from 'node:readline';
const file=process.argv[2]??'deploy/filming/state/agent/continuous/agent.log';
const limit=Math.max(1,Math.min(1000,Number(process.argv[3]??200)));
const recent=[];let current=null,lines=0,bad=0,traces=0;
const count={greedy:0,epsilon:0,forced:0,missingTargets:0,starving:0,chosenExplore:0,chosenRetreat:0};
function save(){if(!current)return;recent.push(current);if(recent.length>limit)recent.shift();}
for await(const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})){
 lines++;if(!line.includes('"type"'))continue;
 let e;try{e=JSON.parse(line);}catch{bad++;continue;}
 if(e.type==='decision_trace_v1'&&e.neuralTrace){
  save();const t=e.neuralTrace,eligible=t.eligibleIndices??[];
  current={timestamp:e.timestamp,decisionId:e.decisionId,action:e.selection,
   selectionReason:t.selectionReason,epsilon:t.epsilon,eligible:eligible.map(i=>e.actions?.[i]),
   qEligible:eligible.map(i=>({action:e.actions?.[i],q:t.qValues?.[i]})),
   health:e.agentObservation?.health,food:e.agentObservation?.food,
   targets:e.agentObservation?.targets?.length,blocked:e.agentObservation?.blocked,
   updates:e.stats?.updates,transition:null,execution:[]};
  traces++;
 }else if(current&&e.type==='target_transition'&&e.decisionId===current.decisionId){
  current.transition={reward:e.reward,updates:e.updates};
 }else if(current&&['target_navigation_result','connected_exploration_audit','connected_retreat_audit',
   'grounded_exploration_no_safe_goal','navigation_impossibility_observed','target_navigation_stall',
   'target_verified_recovery','navigation_recovery_outcome'].includes(e.type)){
  if(e.decisionId==null||e.decisionId===current.decisionId)
   current.execution.push({type:e.type,reason:e.reason??e.status??e.outcome??null});
 }
}
save();for(const d of recent){
 if(d.selectionReason==='greedy_max_q')count.greedy++;
 if(d.selectionReason==='epsilon_random')count.epsilon++;
 if(d.eligible.length===1)count.forced++;
 if(d.targets===0)count.missingTargets++;
 if(d.food===0)count.starving++;
 if(d.action==='explore')count.chosenExplore++;
 if(d.action==='retreat')count.chosenRetreat++;
}
const transitions=recent.filter(d=>d.transition);
const rewards=transitions.map(d=>d.transition.reward).filter(Number.isFinite);
const report={schema:'craftle.neural-decision-audit.v1',readOnly:true,file,linesRead:lines,
 totalTraces:traces,recentTraces:recent.length,counts:count,
 transitionMatches:transitions.length,meanObservedReward:rewards.length?rewards.reduce((a,b)=>a+b,0)/rewards.length:null,
 warning:'Decision IDs can reset when the process reconnects; within-session event association and causal attribution must be verified. Events with missing IDs are contextual, not proven outcomes.',
 newest:recent.at(-1)??null,oldest:recent[0]?.timestamp??null,parseErrors:bad,
 samples:recent.slice(-10)};
console.log(JSON.stringify(report,null,2));
