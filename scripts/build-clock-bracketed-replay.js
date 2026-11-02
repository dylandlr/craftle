import fs from 'node:fs';
import readline from 'node:readline';
import {bracketEvent,relateDecisionEvents} from '../src/clock-event-correlation.js';
const agentLog=process.argv[2]??'deploy/filming/state/agent/continuous/agent.log';
const clockLog=process.argv[3]??'deploy/filming/state/observer/server-clock.jsonl';
const output=process.argv[4]??'clock-bracketed-events.json';
const lastN=Math.max(1,Math.min(2000,Number(process.argv[5]??200)));
const clocks=[];for await(const line of readline.createInterface({input:fs.createReadStream(clockLog),crlfDelay:Infinity})){
 try{const e=JSON.parse(line);if(e.type==='server_clock_sample')clocks.push(e);}catch{}
}
clocks.sort((a,b)=>a.requestedAt-b.requestedAt);
const relevant=new Set(['decision_trace_v1','target_transition','target_terminal','target_navigation_result','connected_exploration_audit','connected_retreat_audit','target_verified_recovery','navigation_recovery_outcome']);
const recent=[];let run=0,previousDecision=null;
for await(const line of readline.createInterface({input:fs.createReadStream(agentLog),crlfDelay:Infinity})){
 if(!line.includes('"type"'))continue;let e;try{e=JSON.parse(line);}catch{continue;}
 if(!relevant.has(e.type))continue;
 if(e.type==='decision_trace_v1'){
  // A decreasing decision number is a possible new process, not proof of one.
  if(previousDecision!==null&&e.decisionId<previousDecision)run++;
  previousDecision=e.decisionId;
 }
 recent.push({event:e,segment:run});if(recent.length>lastN*12)recent.shift();
}
const decisions=recent.filter(x=>x.event.type==='decision_trace_v1').slice(-lastN);
const records=decisions.map(d=>{
 const e=d.event, related=recent.filter(x=>x.segment===d.segment&&x.event.type!=='decision_trace_v1'&&x.event.decisionId===e.decisionId&&x.event.agent_id===e.agent_id).map(x=>x.event);
 return {decisionId:e.decisionId,segment:d.segment,agentId:e.agent_id,action:e.selection,timestamp:e.timestamp,
  tickBracket:bracketEvent(e,clocks),correlated:relateDecisionEvents(e,related),
  eventBrackets:related.map(x=>({type:x.type,timestamp:x.timestamp,bracket:bracketEvent(x,clocks)}))};
});
const report={schema:'craftle.clock-bracketed-replay.v1',readOnly:true,agentLog,clockLog,clockSampleCount:clocks.length,recordCount:records.length,
 caveat:'Tick intervals are bounds, NOT exact event timestamps. Segment inferred from decision ID reset; causal linkage is not verified. Do not train SMDP from uncertain ticks.',
 records};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,clockSampleCount:clocks.length,recordCount:records.length,bracketed:records.filter(r=>r.tickBracket.status==='bracketed').length}));
