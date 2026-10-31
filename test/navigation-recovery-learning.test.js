import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NavigationRecoveryLearner,NAVIGATION_IMPOSSIBLE} from '../src/navigation-recovery-learning.js';
const failure=(situationId='s1')=>({situationId,decisionId:'d1',routeStatus:'no_native_complete_route',knownCandidates:2,goalId:'explore'});
test('explicit impossible outcome reports planner limitation, not physical certainty',()=>{
 const m=new NavigationRecoveryLearner();
 const e=m.observeFailure(failure());
 assert.equal(e.type,NAVIGATION_IMPOSSIBLE);
 assert.match(e.interpretation,/not_world_proof/);
 assert.equal(m.recommendation('s1'),'bounded_recovery_allowed');
});
test('failed experiments are bounded and executive can table the goal',()=>{
 const m=new NavigationRecoveryLearner({maxAttemptsPerSituation:2});
 m.observeFailure(failure());
 for(let i=0;i<2;i++){
  assert.deepEqual(m.beginRecovery({situationId:'s1',attemptId:String(i),method:'alternate_motion'}),{accepted:true});
  const r=m.finishRecovery({situationId:'s1',attemptId:String(i),before:{tick:i*10,distanceToGoal:10},after:{tick:i*10+5,distanceToGoal:10,routeAvailable:false}});
  assert.equal(r.result,'no_observed_recovery_progress');
 }
 assert.equal(m.recommendation('s1'),'table_goal');
 assert.equal(m.beginRecovery({situationId:'s1',attemptId:'late',method:'again'}).accepted,false);
});
test('observed progress triggers reassessment but is not claimed causal proof',()=>{
 const m=new NavigationRecoveryLearner();m.observeFailure(failure());
 m.beginRecovery({situationId:'s1',attemptId:'a1',method:'probe'});
 const result=m.finishRecovery({situationId:'s1',attemptId:'a1',before:{tick:1,distanceToGoal:5},after:{tick:10,distanceToGoal:4,routeAvailable:false}});
 assert.equal(result.result,'observed_recovery_progress');
 assert.equal(result.evidence.causalAttribution,'temporal_association');
 assert.equal(m.recommendation('s1'),'reassess_navigation');
});
test('one unresolved attempt at a time and invalid observations rejected',()=>{
 const m=new NavigationRecoveryLearner();m.observeFailure(failure());
 m.beginRecovery({situationId:'s1',attemptId:'x',method:'probe'});
 assert.throws(()=>m.beginRecovery({situationId:'s1',attemptId:'y',method:'probe'}));
 assert.throws(()=>m.finishRecovery({situationId:'s1',attemptId:'x',before:{tick:2,distanceToGoal:5},after:{tick:2,distanceToGoal:4,routeAvailable:true}}));
});
