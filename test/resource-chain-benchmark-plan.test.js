import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preregisterChainBenchmark,verifyChainBenchmarkPlan,
  validateChainBenchmarkTrial,summarizeChainBenchmark
} from '../src/resource-chain-benchmark-plan.js';

const setup=()=>preregisterChainBenchmark({
  suiteId:'chain-multiseed-v1',
  sourceHashes:{'src/resource-chain-q.js':'a'.repeat(64)}
});
function summary(trial,success){
  return {
    schema:'craftle.live-resource-chain-frozen-eval.v1',
    runId:trial.runId,policy:'frozen_'+trial.mode+'_neural',
    rotation:trial.rotation,variant:trial.variant,learnedPolicyUpdates:0,
    complete:true,verifiedActions:4,verifiedRealPickups:2,
    evidence:[0,1,2,3].map(i=>({
      evidenceKey:'boot:'+i,trainingRewardEligible:false,
      scriptedActionVerified:true,gateEligible:true
    })),
    success,terminalReward:success?1:-1,
    taskResult:{terminal:true,reward:success?1:-1,success},
    eventsSha256:'b'.repeat(64),checkpointSha256:'c'.repeat(64)
  };
}
test('schedule pre-registers all independent seeds, holdouts and both arms',()=>{
  const a=setup(),b=setup();
  assert.deepEqual(a,b);
  assert.equal(a.pairs,12);
  assert.equal(a.trials.length,24);
  assert.ok(verifyChainBenchmarkPlan(a));
  assert.deepEqual(new Set(a.trials.map(t=>t.seed)),new Set([101,211,307]));
  assert.deepEqual(new Set(a.trials.map(t=>t.rotation)),new Set([2,3]));
  assert.deepEqual(new Set(a.trials.map(t=>t.variant)),
    new Set(['base','skewed']));
  assert.ok(!a.trials.some(t=>t.seed===23));
  for(let i=0;i<a.trials.length;i+=2){
    const [first,second]=a.trials.slice(i,i+2);
    assert.equal(first.pairId,second.pairId);
    assert.equal(first.seed,second.seed);
    assert.equal(first.rotation,second.rotation);
    assert.equal(first.variant,second.variant);
    assert.notEqual(first.mode,second.mode);
    assert.notEqual(first.runId,second.runId);
  }
  assert.equal(a.trials.filter(t=>t.mode==='trained').length,12);
  assert.equal(a.trials.filter(t=>t.mode==='untrained').length,12);
  assert.equal(a.trials.filter(t=>t.mode==='trained'&&
    Number(t.trialId)%2===1).length,6);
});
test('plan tampering, reordered arms and changed seeds fail closed',()=>{
  const plan=setup();
  for(const field of [
    ['seeds',[23,211,307]],
    ['plannedTrials',18],
    ['orderingSeed',100]
  ]){
    const altered=JSON.parse(JSON.stringify(plan));
    altered[field[0]]=field[1];
    assert.throws(()=>verifyChainBenchmarkPlan(altered));
  }
  const changed=JSON.parse(JSON.stringify(plan));
  [changed.trials[0],changed.trials[1]]=[
    changed.trials[1],changed.trials[0]
  ];
  assert.throws(()=>verifyChainBenchmarkPlan(changed));
  assert.throws(()=>preregisterChainBenchmark({suiteId:'../../other'}));
});
test('a real four-step negative reward is valid policy failure, not infrastructure',()=>{
  const trial=setup().trials[0];
  assert.deepEqual(validateChainBenchmarkTrial(trial,summary(trial,true)),
    {classification:'policy_success',success:true,terminalReward:1});
  assert.deepEqual(validateChainBenchmarkTrial(trial,summary(trial,false)),
    {classification:'policy_failure',success:false,terminalReward:-1});
  const crashed={...summary(trial,false),complete:false};
  assert.equal(validateChainBenchmarkTrial(trial,crashed).classification,
    'infrastructure_error');
  const tampered=summary(trial,true);
  tampered.evidence[1].trainingRewardEligible=true;
  assert.equal(validateChainBenchmarkTrial(trial,tampered).classification,
    'infrastructure_error');
  const wrong=summary(trial,true);
  wrong.runId='someone-elses-run';
  assert.equal(validateChainBenchmarkTrial(trial,wrong).classification,
    'infrastructure_error');
});
test('partial and full reports retain every trial and matched-pair denominator',()=>{
  const plan=setup();
  const empty=summarizeChainBenchmark(plan,[]);
  assert.equal(empty.plannedTrials,24);
  assert.equal(empty.attemptedTrials,0);
  const [a,b]=plan.trials;
  const receipts=[
    {trialId:a.trialId,classification:a.mode==='trained'?
      'policy_success':'policy_failure'},
    {trialId:b.trialId,classification:b.mode==='trained'?
      'policy_success':'policy_failure'}
  ];
  const partial=summarizeChainBenchmark(plan,receipts);
  assert.equal(partial.validMatchedPairs,1);
  assert.equal(partial.trainedOnlyWins,1);
  assert.equal(partial.completedSchedule,false);
  const all=plan.trials.map((t,i)=>({
    trialId:t.trialId,classification:i===3?
      'infrastructure_error':t.mode==='trained'?
        'policy_success':'policy_failure'
  }));
  const full=summarizeChainBenchmark(plan,all);
  assert.equal(full.attemptedTrials,24);
  assert.equal(full.completedSchedule,true);
  assert.equal(full.validMatchedPairs,11);
  assert.equal(full.byPolicy.trained.planned,12);
  assert.equal(full.byPolicy.untrained.planned,12);
  assert.equal(full.byPolicy.trained.pending,0);
  assert.equal(full.byPolicy.untrained.pending,0);
  assert.throws(()=>summarizeChainBenchmark(plan,[receipts[0],receipts[0]]));
});
