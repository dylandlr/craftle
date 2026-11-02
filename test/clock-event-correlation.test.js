import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bracketEvent,relateDecisionEvents} from '../src/clock-event-correlation.js';
const samples=[
 {gameTime:100,requestedAt:1000,completedAt:1050,worldId:'w',epoch:0},
 {gameTime:120,requestedAt:2000,completedAt:2050,worldId:'w',epoch:0},
 {gameTime:140,requestedAt:3000,completedAt:3050,worldId:'w',epoch:0}
];
test('event strictly between completed and next requested clock sample has conservative tick bounds',()=>{
 assert.deepEqual((( {minTick,maxTick,tickWidth,status})=>({minTick,maxTick,tickWidth,status}))(bracketEvent({timestamp:new Date(1600).toISOString()},samples)),
 {minTick:100,maxTick:120,tickWidth:20,status:'bracketed'});
});
test('event during a clock request is not spuriously assigned exact tick',()=>assert.equal(bracketEvent({timestamp:new Date(2020).toISOString()},samples).status,'unbounded'));
test('clock gap and epoch mismatch must not yield authoritative event tick',()=>{
 assert.equal(bracketEvent({timestamp:new Date(500).toISOString()},samples).status,'unbounded');
 assert.equal(bracketEvent({timestamp:new Date(1600).toISOString()},[samples[0],{...samples[1],epoch:1}]).status,'clock_discontinuity');
});
test('same local decision ID but different agent does not match',()=>{
 const x=relateDecisionEvents({decisionId:9,agent_id:'a'},[{decisionId:9,agent_id:'b',type:'target_transition'},{decisionId:9,agent_id:'a',type:'target_transition'}]);
 assert.equal(x.events.length,1);assert.equal(x.evidence,'id_association_not_causal_proof');
});
