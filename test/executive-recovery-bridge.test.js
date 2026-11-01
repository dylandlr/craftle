import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ThreeSystemLoop} from '../src/three-system-loop.js';
import {createThreeSystemDqnAdapter,makeTargetedDqn} from '../src/three-system-dqn-adapter.js';
import {ExecutiveRecoveryBridge,EXECUTION_OUTCOMES as O} from '../src/executive-recovery-bridge.js';
import {NavigationRecoveryLearner} from '../src/navigation-recovery-learning.js';
const obs=()=>({health:20,food:18,foodAvailable:false,foodUnits:0,foodPoints:0,hostileDistance:24,blocked:true,
 displacement:0,position:{x:0,y:64,z:0},targets:[]});
const setup=(recovery=new NavigationRecoveryLearner())=>{
 const learner=makeTargetedDqn({random:()=>0.5,epsilon:0});
 const adapter=createThreeSystemDqnAdapter({learner});
 const loop=new ThreeSystemLoop({valueLearner:adapter,chooseAction:adapter.chooseAction});
 loop.goals.propose({id:'explore-forest',objective:'explore nearby area'});
 return {learner,loop,bridge:new ExecutiveRecoveryBridge({loop,recovery})};
};
test('unavailable route ends current option but not lifetime or executive goal',()=>{
 const {bridge,loop,learner}=setup();
 bridge.start('explore-forest',{tick:0,observation:obs()});
 const out=bridge.resolve({kind:O.UNAVAILABLE,tick:30,observation:obs(),reward:-0.1,situationId:'cell-1',routeStatus:'no_native_complete_route'});
 assert.equal(out.event.kind,'capability_unavailable');
 assert.equal(out.transition.truncated,true);
 assert.equal(out.goal.state,'active');
 const sample=learner.snapshot().trainingState.replay[0];
 assert.equal(sample.terminal,false);
 assert.equal(sample.steps,1);
 assert.equal(loop.goals.goal('explore-forest').progress.length,0);
});
test('attempted failure is not mistaken for death',()=>{
 const {bridge,learner}=setup();
 bridge.start('explore-forest',{tick:0,observation:obs()});
 const out=bridge.resolve({kind:O.FAILED,tick:40,observation:obs(),reward:-0.2});
 assert.equal(out.event.episodeResult,'verified_failure');
 assert.equal(learner.snapshot().trainingState.replay[0].terminal,false);
});
test('partial progress preserves goal and recovery evidence without claiming success',()=>{
 const recovery=new NavigationRecoveryLearner();
 recovery.observeFailure({situationId:'a',decisionId:'prior',routeStatus:'no_known_connected_route'});
 recovery.beginRecovery({situationId:'a',attemptId:'probe-1',method:'alternate_route'});
 const {bridge,loop}=setup(recovery);
 bridge.start('explore-forest',{tick:1,observation:obs()});
 const out=bridge.resolve({kind:O.PROGRESS,tick:41,observation:obs(),reward:0.2,
  situationId:'a',recoveryAttemptId:'probe-1',
  recoveryBefore:{tick:1,distanceToGoal:10},
  recoveryAfter:{tick:41,distanceToGoal:8,routeAvailable:false}});
 assert.equal(out.event.recoveryEvent.result,'observed_recovery_progress');
 assert.equal(out.event.episodeResult,'unknown');
 assert.equal(out.goal.state,'active');
 assert.equal(loop.goals.goal('explore-forest').progress.length,0);
});
test('bounded failed recovery allows deferral while retaining goal',()=>{
 const recovery=new NavigationRecoveryLearner({maxAttemptsPerSituation:1});
 recovery.observeFailure({situationId:'a',decisionId:'old',routeStatus:'no_known_connected_route'});
 recovery.beginRecovery({situationId:'a',attemptId:'old-attempt',method:'probe'});
 recovery.finishRecovery({situationId:'a',attemptId:'old-attempt',before:{tick:1,distanceToGoal:10},
  after:{tick:5,distanceToGoal:10,routeAvailable:false}});
 const {bridge,loop}=setup(recovery);
 bridge.start('explore-forest',{tick:10,observation:obs()});
 const out=bridge.resolve({kind:O.UNAVAILABLE,tick:20,observation:obs(),reward:-0.1,
  situationId:'a',routeStatus:'no_known_connected_route',resumeWhen:'a new route is observed'});
 assert.equal(out.goal.state,'tabled');
 assert.equal(out.goal.resumeWhen,'a new route is observed');
 assert.equal(out.event.goalDisposition,'tabled');
 loop.goals.activate('explore-forest',{reason:'new path seen'});
 assert.equal(loop.goals.goal('explore-forest').state,'active');
});
test('explicit deferral requires a condition and cannot silently settle episode',()=>{
 const {bridge,loop}=setup();
 bridge.start('explore-forest',{tick:0,observation:obs()});
 assert.throws(()=>bridge.resolve({kind:O.DEFERRED,tick:10,observation:obs()}),/condition/);
 assert.equal(loop.dual.active.status,'active');
 const r=bridge.resolve({kind:O.DEFERRED,tick:10,observation:obs(),resumeWhen:'new information'});
 assert.equal(r.goal.state,'tabled');
});
