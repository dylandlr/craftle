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
const canopyEvents=events.filter(e=>typeof e.type==='string'&&e.type.startsWith('canopy_'));
const lastAction=events.filter(e=>e.type==='target_action').at(-1)??null;
const latestPose=events.filter(e=>e.type==='pose_sample').at(-1)??null;
const lastEvent=events.at(-1)??null;
const recent=events.slice(-2000);
const canopyTypes=Object.fromEntries([...new Set(canopyEvents.map(e=>e.type))].sort()
  .map(type=>[type,canopyEvents.filter(e=>e.type===type).length]));
const lastCanopyEvent=canopyEvents.at(-1)??null;
const lastNavigationGoal=events.filter(e=>e.type==='target_navigation_goal').at(-1)??null;
const lastStall=events.filter(e=>e.type==='target_navigation_stall').at(-1)??null;
const errors=events.filter(e=>e.type==='target_runtime_error').slice(-5);
const lifecycleSummary={deaths:events.filter(e=>e.type==='death_screen_observed').length,
  respawns:events.filter(e=>e.type==='life_feedback_available').length};

console.log(JSON.stringify({schema:'craftle.canopy-decision-review.v1',readOnly:true,
  log:file,tailBytes:bytes,eventsRead:events.length,lastGeometry:geometry??null,
  lastNoRoute:noRoute??null,lastDecisions:traces,riskEvents:risky,lifecycle:compact,
  lastEventAt:lastEvent?.timestamp??null,lastAction:lastAction?{
   at:lastAction.timestamp,skill:lastAction.skill,health:lastAction.health,
   food:lastAction.food,position:lastAction.position}:null,
  latestPose:latestPose?{at:latestPose.timestamp,position:latestPose.position}:null,
  recentCanopy:{eventCounts:canopyTypes,lastEvent:lastCanopyEvent?
   {at:lastCanopyEvent.timestamp,type:lastCanopyEvent.type,
    reason:lastCanopyEvent.reason??null,position:lastCanopyEvent.position??null}:null,
   inLast2000Events:recent.filter(e=>typeof e.type==='string'&&e.type.startsWith('canopy_')).length},
  lastNavigationGoal:lastNavigationGoal?{at:lastNavigationGoal.timestamp,goal:lastNavigationGoal.goal}:null,
  lastStall:lastStall?{at:lastStall.timestamp,position:lastStall.position,stalls:lastStall.stalls}:null,
  recentRuntimeErrors:errors,lifecycleSummary,
  limitation:'Only events captured in the final log tail are analyzed; no direct access to Minecraft world state.'},null,2));
