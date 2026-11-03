// Read-only tail report that correlates canopy geometry with recent DQN decisions.
// Unlike explain-agent-ticks.py this reports the LAST traces, not the first.
import fs from 'node:fs';
const file=process.argv[2]??'/state/agent/continuous/agent.log';
const bytes=Number(process.env.CRAFTLE_TRACE_TAIL_BYTES??8*1024*1024);
const fd=fs.openSync(file,'r'),size=fs.fstatSync(fd).size;
const start=Math.max(0,size-bytes),buffer=Buffer.alloc(size-start);
try{fs.readSync(fd,buffer,0,buffer.length,start);}finally{fs.closeSync(fd);}
const lines=buffer.toString('utf8').split(/\r?\n/);
if(start>0)lines.shift();
const events=[];
for(const line of lines){if(!line.startsWith('{"timestamp":'))continue;try{events.push(JSON.parse(line));}catch{}}
const relevant=new Set(['canopy_geometry_snapshot','canopy_egress_no_route','canopy_risk_decision','canopy_risk_candidate',
 'canopy_risk_execution','canopy_risk_outcome','target_decision','decision_trace_v1',
 'target_navigation_result','target_terminal','death_screen_observed','life_feedback_available']);
const filtered=events.filter(e=>relevant.has(e.type));
const traces=filtered.filter(e=>e.type==='decision_trace_v1').slice(-12).map(e=>{
 const q=e.neuralTrace?.qValues??[],mask=e.mask??[],actions=e.actions??[];
 const ranked=q.flatMap((v,i)=>mask[i]&&Number.isFinite(v)?[{action:actions[i],q:+v.toFixed(4)}]:[]).sort((a,b)=>b.q-a.q);
 return {at:e.timestamp,decisionId:e.decisionId,selection:e.selection,why:e.neuralTrace?.selectionReason??null,
  health:e.agentObservation?.health,food:e.agentObservation?.food,
  allowed:actions.filter((_,i)=>mask[i]),bestQ:ranked.slice(0,5),
  riskChoiceInDqnActionSpace:actions.some(a=>/jump|fall|descend/i.test(a))};
});
const geometry=filtered.filter(e=>e.type==='canopy_geometry_snapshot').at(-1);
const noRoute=filtered.filter(e=>e.type==='canopy_egress_no_route').at(-1);
const risky=filtered.filter(e=>e.type.startsWith('canopy_risk_')).slice(-10);
const compact=filtered.filter(e=>['target_navigation_result','target_terminal','death_screen_observed','life_feedback_available'].includes(e.type)).slice(-12);
console.log(JSON.stringify({schema:'craftle.canopy-decision-review.v1',readOnly:true,
  log:file,tailBytes:bytes,eventsRead:events.length,lastGeometry:geometry??null,
  lastNoRoute:noRoute??null,lastDecisions:traces,riskEvents:risky,lifecycle:compact,
  limitation:'Only events captured in the final log tail are analyzed; no direct access to Minecraft world state.'},null,2));
