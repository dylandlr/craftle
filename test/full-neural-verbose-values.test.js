import {test} from 'node:test';
import assert from 'node:assert/strict';
import {neuralTracePages} from '../scripts/observer-neural-traces.js';
test('verbose trace includes every feature, Q estimate, hidden activation and mask state',()=>{
 const e={type:'decision_trace_v1',decisionId:60,timestamp:'2026-11-01T22:35:43.549Z',
  selection:'retreat',featureNames:Array.from({length:44},(_,i)=>'feature'+i),
  features:Array.from({length:44},(_,i)=>i/10),
  actions:Array.from({length:15},(_,i)=>'action'+i),
  neuralTrace:{qValues:Array.from({length:15},(_,i)=>-i/5),
   hiddenActivations:Array.from({length:16},(_,i)=>i/7),
   eligibleIndices:[1,2],greedyIndices:[2],selectedIndex:2,selectedQ:-0.4,maxEligibleQ:-0.4,
   selectionReason:'epsilon_random',epsilon:0.3,exploratory:true},
  agentObservation:{health:11,food:0,position:{x:159,y:69,z:131},targets:[]},stats:{updates:772876},rewardVersion:'v1'};
 const pages=neuralTracePages(e);
 const text=pages.flatMap(p=>p.extra.map(c=>c.text)).join('\n');
 assert.ok(pages.length>12);
 for(let i=0;i<44;i++)assert.ok(text.includes('feature'+i+'='),'missing feature '+i);
 for(let i=0;i<15;i++)assert.ok(text.includes('action'+i+'='),'missing Q '+i);
 for(let i=0;i<16;i++)assert.ok(text.includes('H'+String(i).padStart(2,'0')+'='),'missing hidden '+i);
 assert.match(text,/\[masked\]/);
 assert.match(text,/\[SELECTED\]/);
 assert.match(text,/epsilon_random/);
 assert.match(text,/772876/);
 assert.equal(neuralTracePages({type:'target_decision'}).length,0);
});
