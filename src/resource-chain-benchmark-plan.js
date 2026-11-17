// Fixed, pre-registered experimental design for frozen neural policy transfer.
// This schedule is NEVER constructed from checkpoint quality or live outcomes.
// Seed 23 is reserved for the already observed pilot and excluded here.
import {createHash} from 'node:crypto';
import {chainLayout} from './motor-resource-chain.js';

export const CHAIN_BENCHMARK_SCHEMA='craftle.live-chain-preregistered-benchmark.v1';
export const CHAIN_BENCHMARK_SEEDS=Object.freeze([101,211,307]);
export const CHAIN_BENCHMARK_ROTATIONS=Object.freeze([2,3]);
export const CHAIN_BENCHMARK_VARIANTS=Object.freeze(['base','skewed']);
export const CHAIN_BENCHMARK_ORDER_SEED=1729;
export const CHAIN_BENCHMARK_EPISODES=600;
export const CHAIN_BENCHMARK_EXPECTED_TRIALS=24;

const validSuite=x=>typeof x==='string'&&
  /^[a-z][a-z0-9-]{3,20}$/.test(x);
const digest=x=>createHash('sha256')
  .update(JSON.stringify(x)).digest('hex');

export function preregisterChainBenchmark({
  suiteId='chain-multiseed-v1',
  sourceHashes={}
}={}){
  if(!validSuite(suiteId)||!sourceHashes||
    typeof sourceHashes!=='object'||Array.isArray(sourceHashes)||
    Object.values(sourceHashes).some(x=>typeof x!=='string'||
      !/^[a-f0-9]{64}$/.test(x)))
    throw Error('Invalid preregistration provenance');
  let rng=CHAIN_BENCHMARK_ORDER_SEED>>>0;
  const random=()=>{
    rng=(Math.imul(1664525,rng)+1013904223)>>>0;
    return rng/4294967296;
  };
  const pairs=[];
  for(const seed of CHAIN_BENCHMARK_SEEDS)
    for(const rotation of CHAIN_BENCHMARK_ROTATIONS)
      for(const variant of CHAIN_BENCHMARK_VARIANTS){
        chainLayout(rotation,variant);
        pairs.push({seed,rotation,variant});
      }
  // Shuffle PAIRS (not individual trials), preserving closely matched arms.
  for(let i=pairs.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [pairs[i],pairs[j]]=[pairs[j],pairs[i]];
  }
  const trials=[];
  for(let i=0;i<pairs.length;i++){
    const pair=pairs[i];
    // Matched arms alternate order, rather than always testing trained first.
    const modes=i%2===0?['trained','untrained']:['untrained','trained'];
    for(const mode of modes){
      const trialNo=String(trials.length+1).padStart(3,'0');
      trials.push({
        trialId:trialNo,pairId:'pair-'+String(i+1).padStart(3,'0'),
        runId:'chain-frozen-'+suiteId+'-'+trialNo,
        mode,...pair,episodes:CHAIN_BENCHMARK_EPISODES,
        split:'HELDOUT_ROTATION_2_OR_3',
        outcomeKnownBeforeRun:false
      });
    }
  }
  if(trials.length!==CHAIN_BENCHMARK_EXPECTED_TRIALS)
    throw Error('Preregistered trial count mismatch');
  const design={
    schema:CHAIN_BENCHMARK_SCHEMA,suiteId,
    intent:'independent seeds; matched frozen trained/untrained controls',
    historicalPilotExcluded:'seed23_rotation2_base',
    seeds:[...CHAIN_BENCHMARK_SEEDS],
    heldoutRotations:[...CHAIN_BENCHMARK_ROTATIONS],
    heldoutVariants:[...CHAIN_BENCHMARK_VARIANTS],
    offlineTrainingEpisodes:CHAIN_BENCHMARK_EPISODES,
    orderingSeed:CHAIN_BENCHMARK_ORDER_SEED,
    protocol:'full_intention_to_evaluate_no_holdout_success_filter',
    policies:['trained','untrained'],
    pairs:pairs.length,plannedTrials:trials.length,
    noAutomaticRetry:true,
    invalidTrialsRetainedInDenominator:true,
    noLiveGradientUpdates:true,
    sourceHashes:{...sourceHashes},
    trials
  };
  return {...design,planSha256:digest(design)};
}

export function verifyChainBenchmarkPlan(plan){
  if(!plan||typeof plan!=='object'||plan.schema!==CHAIN_BENCHMARK_SCHEMA||
    typeof plan.planSha256!=='string')throw Error('Invalid benchmark plan');
  const {planSha256,...payload}=plan;
  if(digest(payload)!==planSha256)
    throw Error('Preregistered benchmark plan was edited');
  const expected=preregisterChainBenchmark({
    suiteId:plan.suiteId,sourceHashes:plan.sourceHashes
  });
  if(JSON.stringify(plan)!==JSON.stringify(expected))
    throw Error('Preregistered benchmark schedule changed');
  return true;
}

export function validateChainBenchmarkTrial(trial,summary){
  if(!trial||!summary||typeof summary!=='object'||
    summary.runId!==trial.runId||
    summary.schema!=='craftle.live-resource-chain-frozen-eval.v1'||
    summary.policy!=='frozen_'+trial.mode+'_neural'||
    summary.rotation!==trial.rotation||
    summary.variant!==trial.variant||
    summary.learnedPolicyUpdates!==0)
    return {classification:'infrastructure_error',reason:'identity_or_schema_mismatch'};
  if(summary.complete!==true)
    return {classification:'infrastructure_error',reason:'incomplete_execution'};
  if(summary.verifiedActions!==4||
    !Array.isArray(summary.evidence)||summary.evidence.length!==4||
    summary.evidence.some(e=>!e||
      e.trainingRewardEligible!==false||
      e.scriptedActionVerified!==true||
      e.gateEligible!==true||
      typeof e.evidenceKey!=='string')||
    new Set(summary.evidence.map(e=>e.evidenceKey)).size!==4||
    !Number.isSafeInteger(summary.verifiedRealPickups)||
    summary.verifiedRealPickups<0||summary.verifiedRealPickups>3||
    summary.taskResult?.terminal!==true||
    ![-1,1].includes(summary.terminalReward)||
    summary.taskResult.reward!==summary.terminalReward||
    summary.success!==(summary.terminalReward===1)||
    summary.taskResult.success!==summary.success||
    !/^[a-f0-9]{64}$/.test(summary.eventsSha256??'')||
    !/^[a-f0-9]{64}$/.test(summary.checkpointSha256??''))
    return {classification:'infrastructure_error',reason:'invalid_terminal_evidence'};
  return {
    classification:summary.success?'policy_success':'policy_failure',
    success:summary.success,terminalReward:summary.terminalReward
  };
}

export function summarizeChainBenchmark(plan,receipts){
  verifyChainBenchmarkPlan(plan);
  if(!Array.isArray(receipts))throw Error('Receipts required');
  const allowed=new Set(plan.trials.map(t=>t.trialId));
  if(new Set(receipts.map(r=>r?.trialId)).size!==receipts.length||
    receipts.some(r=>!allowed.has(r.trialId)))
    throw Error('Invalid or repeated benchmark receipt');
  const stats={};
  for(const mode of ['trained','untrained'])
    stats[mode]={planned:plan.pairs,attempted:0,policySuccess:0,
      policyFailure:0,infrastructureError:0,pending:plan.pairs};
  for(const r of receipts){
    if(!['policy_success','policy_failure','infrastructure_error']
      .includes(r.classification))
      throw Error('Unknown trial classification');
    const trial=plan.trials.find(t=>t.trialId===r.trialId);
    const arm=stats[trial.mode];
    arm.attempted++;arm.pending--;
    if(r.classification==='policy_success')arm.policySuccess++;
    if(r.classification==='policy_failure')arm.policyFailure++;
    if(r.classification==='infrastructure_error')arm.infrastructureError++;
  }
  const done=receipts.length===plan.trials.length;
  const bothValidPairs=plan.trials.filter(t=>t.mode==='trained')
    .map(t=>{
      const other=plan.trials.find(x=>x.pairId===t.pairId&&
        x.mode==='untrained');
      const a=receipts.find(r=>r.trialId===t.trialId);
      const b=receipts.find(r=>r.trialId===other.trialId);
      return {a,b};
    }).filter(({a,b})=>a&&b&&
      a.classification!=='infrastructure_error'&&
      b.classification!=='infrastructure_error');
  return {
    schema:'craftle.live-chain-benchmark-report.v1',
    suiteId:plan.suiteId,planSha256:plan.planSha256,
    plannedTrials:plan.trials.length,attemptedTrials:receipts.length,
    completedSchedule:done,byPolicy:stats,
    validMatchedPairs:bothValidPairs.length,
    trainedOnlyWins:bothValidPairs.filter(({a,b})=>
      a.classification==='policy_success'&&
      b.classification==='policy_failure').length,
    untrainedOnlyWins:bothValidPairs.filter(({a,b})=>
      a.classification==='policy_failure'&&
      b.classification==='policy_success').length,
    bothSuccess:bothValidPairs.filter(({a,b})=>
      a.classification==='policy_success'&&
      b.classification==='policy_success').length,
    bothFailure:bothValidPairs.filter(({a,b})=>
      a.classification==='policy_failure'&&
      b.classification==='policy_failure').length,
    limitation:'Policy failures and infrastructure errors counted separately. One seed23 pilot was excluded a priori. Do not interpret the partial schedule as a population-level estimate.'
  };
}
