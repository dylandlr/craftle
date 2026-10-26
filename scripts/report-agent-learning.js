// Compare survival behaviour from actual agent logs; no synthetic success claims.
import fs from 'node:fs';
const file=process.argv[2];
if(!file)throw Error('Usage: node scripts/report-agent-learning.js <agent.log>');
const lines=fs.readFileSync(file,'utf8').split('\n');
const events=[];
for(const line of lines){if(!line.startsWith('{"timestamp":'))continue;try{events.push(JSON.parse(line));}catch{}}
let deaths=0,decisions=0,verifiedEats=0,transitions=0,rewardSum=0,healthLoss=0;
const actions={},visited=new Set(),foodLevels=[],updates=[];
for(const e of events){
 if(e.type==='death')deaths++;
 if(e.type==='target_decision'){decisions++;actions[e.action]=(actions[e.action]??0)+1;}
 if(e.type==='target_verified_recovery')verifiedEats++;
 if(e.type==='target_transition'){
  transitions++;if(Number.isFinite(e.reward))rewardSum+=e.reward;
  if(Number.isFinite(e.updates))updates.push(e.updates);
 }
 if(e.type==='health'){
  if(Number.isFinite(e.food))foodLevels.push(e.food);
 }
 if(e.type==='pose_sample'&&e.position&&[e.position.x,e.position.z].every(Number.isFinite))
  visited.add(Math.floor(e.position.x/8)+','+Math.floor(e.position.z/8));
}
const average=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
const start=events[0]?.timestamp,end=events.at(-1)?.timestamp;
const durationMinutes=start&&end?(Date.parse(end)-Date.parse(start))/60000:0;
console.log(JSON.stringify({
 schema:'craftle.learning-report.v1',file,eventCount:events.length,
 timeRange:{start,end,minutes:Math.round(durationMinutes*100)/100},
 decisions,actionCounts:actions,transitions,verifiedEats,deaths,
 eightBlockCellsVisited:visited.size,
 avgFood:average(foodLevels),rewardTotal:Math.round(rewardSum*1000)/1000,
 finalTrainingUpdates:updates.length?updates.at(-1):null,
 note:'Observed event metrics only. Not proof of intelligence or causal reward attribution.'
},null,2));
