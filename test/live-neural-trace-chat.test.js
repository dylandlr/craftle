import {test} from 'node:test';
import assert from 'node:assert/strict';
import {neuralTraceChat} from '../scripts/observer-neural-traces.js';
const base={type:'decision_trace_v1',decisionId:60,actions:['eat','explore','retreat'],agentObservation:{blocked:false,targets:[]},neuralTrace:{qValues:[1.08,-2.878,-2.733],eligibleIndices:[1,2],selectedIndex:2,selectionReason:'epsilon_random',exploratory:true}};
test('neural chat shows actual Q estimates and epsilon choice with colored sections',()=>{
 const result=neuralTraceChat(base),flat=result.extra.map(e=>e.text).join('');
 assert.match(flat,/NEURAL/);assert.match(flat,/retreat/);assert.match(flat,/Epsilon exploration/);
 assert.match(flat,/-2.73/);assert.match(flat,/explore -2.88/);assert.match(flat,/No targets observed/);
 assert.equal(result.extra.find(x=>x.text==='NEURAL ').color,'aqua');
});
test('single eligible action reports forced selection, not preference',()=>{
 const e=structuredClone(base);
 e.neuralTrace.eligibleIndices=[1];e.neuralTrace.selectedIndex=1;
 const flat=neuralTraceChat(e).extra.map(x=>x.text).join('');
 assert.match(flat,/Only available action/);assert.match(flat,/no other eligible actions/);
});
test('invalid or absent neural records create no chat entry',()=>{
 assert.equal(neuralTraceChat({type:'target_decision'}),null);
});
