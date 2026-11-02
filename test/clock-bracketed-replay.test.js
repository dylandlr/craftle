import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildReplay,main} from '../scripts/build-clock-bracketed-replay.js';
const event=(type,id=1,extra={})=>({type,decisionId:id,agent_id:'a',sessionId:'run',timestamp:new Date(type==='decision_trace_v1'?1600:1700).toISOString(),...extra});
const decision=(id=1,extra={})=>event('decision_trace_v1',id,{selection:'explore',...extra});
const transition=(id=1,extra={})=>event('target_transition',id,{action:'explore',...extra});
function fixture(t,events,clocks){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-replay-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const agentLog=path.join(root,'agent.jsonl'),clockLog=path.join(root,'clock.jsonl');
 const write=(file,rows)=>fs.writeFileSync(file,rows.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')+'\n');
 write(agentLog,events);
 write(clockLog,clocks??[1000,2000,3000].map((time,i)=>({type:'server_clock_sample',gameTime:100+i*20,requestedAt:time,completedAt:time+50,worldId:'w',epoch:0,collectorSessionId:'clock'})));
 return {agentLog,clockLog,root};
}

test('report preserves requested decision count under event-heavy logs and late outcomes',async t=>{
 const events=[decision(1)];
 for(let i=0;i<100;i++)events.push(event('connected_exploration_audit'));
 events.push(decision(2),transition(1),transition(2));
 const input=fixture(t,events),before=fs.readFileSync(input.agentLog);
 const result=await buildReplay({...input,lastN:2});
 assert.equal(result.recordCount,2);
 assert.equal(result.records[0].correlated.events.length,101);
 assert.equal(result.records[0].duration.status,'bounded');
 assert.equal(result.records[0].duration.minTicks,0);assert.equal(result.records[0].duration.maxTicks,20);
 assert.deepEqual(fs.readFileSync(input.agentLog),before);
 assert.equal(result.trainingEligible,false);
});

test('explicit sessions isolate restarted IDs while allowing interleaved agents',async t=>{
 const result=await buildReplay(fixture(t,[decision(),decision(1,{sessionId:'new'}),
  decision(1,{agent_id:'b'}),transition(1),transition(1,{sessionId:'new'}),transition(1,{agent_id:'b'})]));
 assert.equal(result.records.length,3);
 for(const record of result.records){assert.equal(record.correlated.events.length,1);assert.equal(record.duration.status,'bounded');}
});

test('legacy resets are per agent; connecting boundaries isolate equal IDs',async t=>{
 const legacy={sessionId:null};
 const result=await buildReplay(fixture(t,[decision(10,legacy),decision(1,{...legacy,agent_id:'b'}),transition(10,legacy),
  event('connecting',null,legacy),decision(10,legacy),transition(10,legacy),decision(1,legacy),transition(1,legacy)]));
 assert.equal(result.records[0].correlated.events.length,1);
 assert.equal(result.records[1].segment,0);
 assert.equal(result.records[2].segment,1);assert.equal(result.records[3].segment,2);
 assert.equal(result.records[0].correlated.identity,'legacy_inferred_segment');
});

test('duplicate decision outside lastN still prevents a unique duration',async t=>{
 const result=await buildReplay({...fixture(t,[decision(),decision(),transition()]),lastN:1});
 assert.equal(result.records[0].duration.status,'ambiguous_decision');
 assert.equal(result.records[0].correlated.decisionOccurrences,2);
});

test('multiple closing events, missing outcomes and truncation are explicit',async t=>{
 const input=fixture(t,[decision(),transition(),event('target_terminal'),decision(2)]);
 const report=await buildReplay(input);
 assert.equal(report.records[0].duration.status,'ambiguous_endpoint');
 assert.equal(report.records[1].duration.status,'missing_endpoint');
 const truncated=await buildReplay({...input,maxEventsPerDecision:1});
 assert.equal(truncated.records[0].duration.status,'truncated_events');
 assert.equal(truncated.records[0].correlated.droppedEvents,1);
});

test('malformed data is counted and clock errors break continuity',async t=>{
 const clocks=[{type:'server_clock_sample',gameTime:100,requestedAt:1000,completedAt:1050,worldId:'w',epoch:0},
  '{broken', {type:'server_clock_sample',gameTime:140,requestedAt:3000,completedAt:3050,worldId:'w',epoch:0}];
 const report=await buildReplay(fixture(t,['not JSON',decision(),transition(),event('target_terminal',null)],clocks));
 assert.equal(report.diagnostics.malformedLines,1);assert.equal(report.diagnostics.missingIdentity,1);
 assert.equal(report.diagnostics.malformedClockLines,1);
 assert.equal(report.records[0].tickBracket.status,'clock_discontinuity');
 assert.equal(report.records[0].duration.status,'unbounded_endpoint');
});

test('CLI creates a v2 report and refuses any existing output or input path',async t=>{
 const input=fixture(t,[decision(),transition()]),output=path.join(input.root,'report.json');
 await main([input.agentLog,input.clockLog,output,'1','--clock-skew-ms','10']);
 assert.equal(JSON.parse(fs.readFileSync(output)).schema,'craftle.clock-bracketed-replay.v2');
 const before=fs.readFileSync(input.agentLog);
 for(const target of [output,input.agentLog,input.clockLog])await assert.rejects(main([input.agentLog,input.clockLog,target]),/EEXIST/);
 assert.deepEqual(fs.readFileSync(input.agentLog),before);
});

test('invalid CLI limits and flags fail rather than silently selecting no records',async t=>{
 const input=fixture(t,[]),output=path.join(input.root,'report.json');
 for(const last of ['NaN','0','-1','1.2','2001'])await assert.rejects(main([input.agentLog,input.clockLog,output,last]),/lastN/);
 await assert.rejects(main([input.agentLog,input.clockLog,output,'1','--bogus','1']),/Unknown/);
 await assert.rejects(main([input.agentLog,input.clockLog,output,'1','--clock-skew-ms','bad']),/Invalid clock/);
 assert.equal(fs.existsSync(output),false);
});

test('an earlier log line with the same millisecond is not a decision outcome',async t=>{
 const report=await buildReplay(fixture(t,[transition(1,{timestamp:new Date(1600).toISOString()}),decision()]));
 assert.equal(report.records[0].correlated.events.length,0);
 assert.equal(report.records[0].correlated.rejected.event_precedes_decision,1);
 assert.equal(report.records[0].duration.status,'missing_endpoint');
});
