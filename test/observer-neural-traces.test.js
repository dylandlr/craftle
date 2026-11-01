import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interpretNeuralTrace,neuralTraceText} from '../scripts/observer-neural-traces.js';
test('only eligible option means forced choice even when epsilon exploration triggers',()=>{
 const e={type:'decision_trace_v1',decisionId:1,actions:['eat','explore','retreat'],agentObservation:{blocked:false,targets:[]},
 neuralTrace:{qValues:[0.1,-0.85,-0.7],eligibleIndices:[1],selectedIndex:1,selectionReason:'epsilon_random'}};
 const x=interpretNeuralTrace(e);
 assert.equal(x.forced,true);assert.match(neuralTraceText(x),/only available action/);
 assert.equal(x.ranked.length,1);
});
test('greedy comparison is restricted to eligible actions',()=>{
 const x=interpretNeuralTrace({type:'decision_trace_v1',decisionId:2,actions:['eat','explore','retreat'],
 neuralTrace:{qValues:[1.5,-1,-1.1],eligibleIndices:[1,2],selectedIndex:1,selectionReason:'greedy_max_q'}});
 assert.equal(x.ranked[0].action,'explore');assert.equal(x.forced,false);
});
test('missing trace cannot produce an invented explanation',()=>{
 assert.equal(interpretNeuralTrace({type:'target_decision'}),null);
});
