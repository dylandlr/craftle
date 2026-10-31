import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AffordanceEvidence,OptionEpisode,DualLearningCoordinator} from '../src/dual-learning-core.js';
test('option stays active until verified outcome, only one value update',()=>{
 const transitions=[],c=new DualLearningCoordinator({valueLearner:{observe:t=>transitions.push(t)}});
 c.begin({id:'1',option:'inspect',observation:{x:1},tick:100,maxTicks:200});
 assert.throws(()=>c.begin({id:'2',option:'explore',tick:101}));
 assert.equal(c.active.due(299),false);
 const t=c.settle({tick:140,result:'verified_success',finalObservation:{x:2},reward:1,evidence:{kind:'block',name:'log',action:'hit',evidenceSource:'agent_observation'}});
 assert.equal(t.elapsedTicks,40);assert.equal(t.discount,0.999**40);
 assert.equal(transitions.length,1);
 assert.equal(c.knowledge.query('block','log','hit').observations,1);
 assert.throws(()=>c.settle({tick:141,result:'unknown',reward:0}));
});
test('timeouts truncate without creating knowledge',()=>{
 const c=new DualLearningCoordinator({valueLearner:{observe:()=>{}}});
 c.begin({id:'x',option:'swim',tick:1,maxTicks:5});
 assert.equal(c.active.due(6),true);
 assert.equal(c.settle({tick:6,result:'timed_out',finalObservation:{},reward:-0.1}).truncated,true);
 assert.equal(c.knowledge.snapshot().records.length,0);
});
test('knowledge enforces provenance and bounded observation history',()=>{
 const k=new AffordanceEvidence({maxExamples:2});
 assert.throws(()=>k.record({kind:'block',name:'ore',action:'hit',result:'verified_success',decisionId:1,evidenceSource:'privileged'}));
 for(let i=0;i<3;i++)k.record({kind:'block',name:'ore',action:'hit',result:'no_observable_change',decisionId:i,evidenceSource:'agent_observation'});
 assert.equal(k.query('block','ore','hit').observations,3);
 assert.equal(k.snapshot().records[0].examples.length,2);
});
test('episode can only be finalized once',()=>{
 const e=new OptionEpisode({id:1,option:'explore',tick:5,observation:{a:1}});
 assert.equal(e.finish({tick:6,result:'unknown',finalObservation:{a:2},reward:0}).truncated,true);
 assert.throws(()=>e.finish({tick:7,result:'verified_success',reward:1}));
});
