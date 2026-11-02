import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bracketEvent,relateDecisionEvents,createClockIndex,boundDuration} from '../src/clock-event-correlation.js';
const samples=[
 {gameTime:100,requestedAt:1000,completedAt:1050,worldId:'w',epoch:0},
 {gameTime:120,requestedAt:2000,completedAt:2050,worldId:'w',epoch:0},
 {gameTime:140,requestedAt:3000,completedAt:3050,worldId:'w',epoch:0}
];
test('event strictly between completed and next requested clock sample has conservative tick bounds',()=>{
 assert.deepEqual((( {minTick,maxTick,tickWidth,status})=>({minTick,maxTick,tickWidth,status}))(bracketEvent({timestamp:new Date(1600).toISOString()},samples)),
 {minTick:100,maxTick:120,tickWidth:20,status:'bracketed'});
});
test('event during a clock request uses wider enclosing bounds, never exact sample tick',()=>{const x=bracketEvent({timestamp:new Date(2020).toISOString()},samples);assert.equal(x.status,'bracketed');assert.equal(x.minTick,100);assert.equal(x.maxTick,140);});
test('clock gap and epoch mismatch must not yield authoritative event tick',()=>{
 assert.equal(bracketEvent({timestamp:new Date(500).toISOString()},samples).status,'unbounded');
 assert.equal(bracketEvent({timestamp:new Date(1600).toISOString()},[samples[0],{...samples[1],epoch:1}]).status,'clock_discontinuity');
});
test('same local decision ID but different agent does not match',()=>{
 const scope={sessionId:'run',timestamp:new Date(1600).toISOString()};
 const x=relateDecisionEvents({...scope,decisionId:9,agent_id:'a'},[{...scope,decisionId:9,agent_id:'b',type:'target_transition'},{...scope,decisionId:9,agent_id:'a',type:'target_transition'}]);
 assert.equal(x.events.length,1);assert.equal(x.evidence,'id_association_not_causal_proof');
});

const at = ms => ({timestamp: new Date(ms).toISOString()});
test('supplied decision 6606 and transition bound elapsed ticks to 0..101', () => {
 const index=createClockIndex([
  {worldId:'w',epoch:0,gameTime:7547293,requestedAt:1793584398400,completedAt:1793584398462},
  {worldId:'w',epoch:0,gameTime:7547394,requestedAt:1793584403465,completedAt:1793584403500}
 ]);
 const result=boundDuration(index.bracket(at(1793584399912)),index.bracket(at(1793584401684)));
 assert.equal(result.minTicks,0);assert.equal(result.maxTicks,101);
 assert.equal(result.wallDurationMs,1772);assert.equal(result.trainingEligible,false);
});

test('duration extrema enclose every ordered integer pair in small intervals', () => {
 const b=(minTick,maxTick,eventTime)=>({status:'bracketed',worldId:'w',epoch:0,clockSegment:0,minTick,maxTick,eventTime});
 for(let a=0;a<5;a++)for(let A=a;A<6;A++)for(let z=0;z<5;z++)for(let Z=z;Z<6;Z++){
  const possible=[];
  for(let start=a;start<=A;start++)for(let end=z;end<=Z;end++)if(end>=start)possible.push(end-start);
  const result=boundDuration(b(a,A,0),b(z,Z,1));
  if(!possible.length)assert.equal(result.status,'inconsistent_tick_order');
  else {assert.equal(result.minTicks,Math.min(...possible));assert.equal(result.maxTicks,Math.max(...possible));}
 }
});

test('duration rejects unbounded, reversed, malformed and cross-session endpoints', () => {
 const index=createClockIndex(samples),start=index.bracket(at(1600)),end=index.bracket(at(2600));
 assert.equal(boundDuration(start,end).minTicks,0);
 assert.equal(boundDuration(start,end).maxTicks,40);
 assert.equal(boundDuration(start,{}).status,'unbounded_endpoint');
 assert.equal(boundDuration(end,start).status,'reversed_event_time');
 assert.equal(boundDuration(start,{...end,collectorSessionId:'restart'}).status,'clock_discontinuity');
 assert.equal(boundDuration(start,{...end,clockSegment:1}).status,'clock_discontinuity');
 assert.equal(boundDuration(start,{...end,minTick:-1}).status,'invalid_bracket');
 assert.equal(boundDuration(start,{...end,epoch:undefined}).status,'invalid_bracket');
});

test('restart, hidden intervening rollback and invalid samples cannot be bridged', () => {
 const restart=[{...samples[0],collectorSessionId:'one'},{...samples[1],collectorSessionId:'two'}];
 assert.equal(bracketEvent(at(1600),restart).status,'clock_discontinuity');
 const rollback=[samples[0],{...samples[1],gameTime:1},samples[2]];
 assert.equal(bracketEvent(at(2020),rollback).status,'unbounded');
 for(const invalid of [null,{...samples[1],gameTime:-1},{...samples[1],epoch:undefined},{...samples[1],worldId:''}, {...samples[1],requestedAt:2100}]){
  assert.notEqual(bracketEvent(at(2020),[samples[0],invalid,samples[2]]).status,'bracketed');
 }
});

test('wall rollback ambiguity, sequence reset and overlapping requests are rejected', () => {
 const rollback=[...samples,{...samples[0],gameTime:150},{...samples[1],gameTime:170}];
 assert.equal(bracketEvent(at(1600),rollback).status,'clock_discontinuity');
 assert.notEqual(bracketEvent(at(1600),[{...samples[0],sampleSequence:2},{...samples[1],sampleSequence:1}]).status,'bracketed');
 assert.notEqual(bracketEvent(at(2020),[{...samples[0],completedAt:2030},samples[1],samples[2]]).status,'bracketed');
});

test('stale gaps and clock skew are explicit; a frozen tick is not a positive duration', () => {
 assert.equal(bracketEvent(at(1600),samples,{maxSampleGapMs:1000}).status,'stale_clock_gap');
 const wide=bracketEvent(at(2100),samples,{clockSkewMs:100});
 assert.equal(wide.minTick,100);assert.equal(wide.maxTick,140);
 const frozen=createClockIndex(samples.map(x=>({...x,gameTime:100})));
 const elapsed=boundDuration(frozen.bracket(at(1600)),frozen.bracket(at(2600)));
 assert.equal(elapsed.minTicks,0);assert.equal(elapsed.maxTicks,0);assert.equal(elapsed.trainingEligible,false);
 assert.equal(bracketEvent({...at(1600),worldId:'other'},samples).status,'world_mismatch');
 for(const options of [{clockSkewMs:-1},{maxSampleGapMs:NaN}])assert.throws(()=>createClockIndex(samples,options));
});

test('correlation requires identity, scope, ordering and matching action', () => {
 const d={...at(1600),decisionId:9,agent_id:'a',sessionId:'one',eventSequence:10,selection:'explore'};
 const good={...d,...at(1700),eventSequence:11,type:'target_transition',action:'explore'};
 const result=relateDecisionEvents(d,[good,{...good,sessionId:'two'},{...good,sessionId:null},
  {...good,...at(1500)},{...good,eventSequence:9},{...good,decisionId:null},
  {...good,action:'eat'},{...good,timestamp:'bad'}]);
 assert.deepEqual(result.events,[good]);assert.equal(result.rejected.session_mismatch,2);
 assert.equal(result.rejected.event_precedes_decision,2);
 assert.equal(relateDecisionEvents({},[{}]).events.length,0);
 const legacy={...d,sessionId:null},event={...good,sessionId:null};
 assert.equal(relateDecisionEvents(legacy,[event]).events.length,0);
 assert.equal(relateDecisionEvents({...legacy,replaySegment:1},[{...event,replaySegment:1}]).events.length,1);
});

test('v2 samples require session identity and reject unverified tick sources',()=>{
 for(const overrides of [{schema:'craftle.server-clock.v2'}, {source:'estimated_wall_time'}]){
  assert.notEqual(bracketEvent(at(1600),samples.map(s=>({...s,...overrides}))).status,'bracketed');
 }
});

test('equal millisecond query and event stamps require wider enclosing samples',()=>{
 assert.equal(bracketEvent(at(1050),samples).status,'unbounded');
 for(const timestamp of [2000,2050]){
  const bracket=bracketEvent(at(timestamp),samples);
  assert.equal(bracket.minTick,100);assert.equal(bracket.maxTick,140);
 }
 assert.equal(bracketEvent(at(3000),samples).status,'unbounded');
});

test('coverage failure reasons distinguish empty clocks, edges and discontinuities',()=>{
 assert.equal(bracketEvent(at(1600),[]).reason,'no_valid_clock_samples');
 assert.equal(bracketEvent(at(500),samples).reason,'before_clock_coverage');
 assert.equal(bracketEvent(at(4000),samples).reason,'after_clock_coverage');
 assert.equal(bracketEvent(at(1050),samples).reason,'missing_before_sample');
 assert.equal(bracketEvent(at(3000),samples).reason,'missing_after_sample');
 assert.equal(bracketEvent(at(1020),[samples[0]]).reason,'missing_both_enclosing_samples');
 assert.equal(bracketEvent(at(1600),[samples[0],{...samples[1],epoch:1}]).reason,'between_clock_segments');
 assert.equal(bracketEvent(at(1600),[...samples,samples[0],samples[1]]).reason,'ambiguous_clock_segments');
 assert.equal(bracketEvent(at(1600),samples,{maxSampleGapMs:1000}).reason,'sample_span_exceeds_limit');
 const index=createClockIndex(samples);
 const result=boundDuration(index.bracket(at(1600)),index.bracket(at(4000)));
 assert.equal(result.endReason,'after_clock_coverage');assert.equal(result.startStatus,'bracketed');
 assert.equal(index.diagnostics.firstSampleRequestedAt,1000);
 assert.equal(index.diagnostics.lastSampleCompletedAt,3050);
 assert.equal(createClockIndex([]).diagnostics.firstSampleRequestedAt,null);
});
