import test from 'node:test';
import assert from 'node:assert/strict';
import {preregisterChainBenchmark}
  from '../src/resource-chain-benchmark-plan.js';
import {
  analyzeFrozenChainBenchmark,exactPairedSignPValue
} from '../src/resource-chain-benchmark-analysis.js';

const plan=preregisterChainBenchmark({
  suiteId:'chain-multiseed-v1',
  sourceHashes:{'src/resource-chain-q.js':'e'.repeat(64)}
});
const receipt=(trial,status)=>({
  trialId:trial.trialId,runId:trial.runId,
  mode:trial.mode,seed:trial.seed,
  planSha256:plan.planSha256,classification:status
});

test('paired exact two-sided discordant test has correct small n behavior',()=>{
  assert.equal(exactPairedSignPValue(0,0),1);
  assert.equal(exactPairedSignPValue(1,0),1);
  assert.equal(exactPairedSignPValue(2,0),.5);
  assert.equal(exactPairedSignPValue(3,0),.25);
  assert.equal(exactPairedSignPValue(5,0),.0625);
  assert.equal(exactPairedSignPValue(6,0),.03125);
  assert.equal(exactPairedSignPValue(3,3),1);
  assert.equal(exactPairedSignPValue(10,2),.03857421875);
  assert.equal(exactPairedSignPValue(-1,2),null);
});
test('empty plan does not claim an advantage or a p-value',()=>{
  const r=analyzeFrozenChainBenchmark(plan,[]);
  assert.equal(r.plannedPairs,12);
  assert.equal(r.validPairs,0);
  assert.equal(r.pendingPairs,12);
  assert.equal(r.exactTwoSidedDiscordantPValue,null);
  assert.equal(r.absoluteSuccessRateDifference,null);
  assert.match(r.inferenceStatus,/INCOMPLETE/);
  assert.equal(r.bySeed.length,3);
});
test('paired outcomes retain failures, missing arms and infrastructure exclusions',()=>{
  const [a,b,c,d,e,f]=plan.trials;
  const statuses=new Map([
    [a.trialId,a.mode==='trained'?'policy_success':'policy_failure'],
    [b.trialId,b.mode==='trained'?'policy_success':'policy_failure'],
    [c.trialId,'infrastructure_error'],
    [d.trialId,'policy_success'],
    [e.trialId,'policy_success'],
    [f.trialId,'policy_success']
  ]);
  const receipts=plan.trials.filter(t=>statuses.has(t.trialId))
    .map(t=>receipt(t,statuses.get(t.trialId)));
  const result=analyzeFrozenChainBenchmark(plan,receipts);
  assert.equal(result.validPairs,2);
  assert.equal(result.invalidPairs,1);
  assert.equal(result.pendingPairs,9);
  assert.equal(result.pairCategories.trained_only_win,1);
  assert.equal(result.pairCategories.both_success,1);
  assert.equal(result.absoluteSuccessRateDifference,.5);
  assert.equal(result.exactTwoSidedDiscordantPValue,1);
  assert.equal(result.bySeed.reduce((n,s)=>n+s.pairsValid,0),2);
  assert.match(result.inferenceStatus,/INCOMPLETE/);
});
test('all-paired positive runs still caution about repeated seed dependence',()=>{
  const receipts=plan.trials.map(t=>receipt(t,t.mode==='trained'?
    'policy_success':'policy_failure'));
  const r=analyzeFrozenChainBenchmark(plan,receipts);
  assert.equal(r.validPairs,12);
  assert.equal(r.pendingPairs,0);
  assert.equal(r.invalidPairs,0);
  assert.equal(r.trainedSuccessesInValidPairs,12);
  assert.equal(r.controlSuccessesInValidPairs,0);
  assert.equal(r.absoluteSuccessRateDifference,1);
  assert.equal(r.exactTwoSidedDiscordantPValue,2/4096);
  assert.equal(r.inferenceStatus,'COMPLETE_DESCRIPTIVE_MATCHED_COMPARISON');
  assert.equal(r.bySeed.length,3);
  assert.ok(r.limitations.some(x=>x.includes('three independent')));
});
test('the receipt validator rejects altered trial identity or duplicate outcomes',()=>{
  const [t]=plan.trials;
  const a=receipt(t,'policy_success');
  assert.throws(()=>analyzeFrozenChainBenchmark(plan,[a,a]));
  assert.throws(()=>analyzeFrozenChainBenchmark(plan,[
    {...a,runId:'wrong-run'}
  ]));
  assert.throws(()=>analyzeFrozenChainBenchmark(plan,[
    {...a,classification:'policy_successfully_pretended'}
  ]));
});
