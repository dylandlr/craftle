// Post-registration analysis of paired frozen neural Minecraft evaluations.
// The report never changes the trial ledger, schedule, checkpoint or policy.
// A McNemar exact test treats layouts as paired units; three initialization
// seeds mean those 12 pairs are NOT 12 independent trained models.
import {verifyChainBenchmarkPlan} from './resource-chain-benchmark-plan.js';

const statuses=['policy_success','policy_failure','infrastructure_error'];
const isValid=r=>r&&['policy_success','policy_failure'].includes(r.classification);
const choose=(n,k)=>{
  if(k<0||k>n)return 0;
  let p=1;
  for(let i=1;i<=k;i++)p=p*(n-i+1)/i;
  return p;
};
export function exactPairedSignPValue(positive,negative){
  if(!Number.isSafeInteger(positive)||!Number.isSafeInteger(negative)||
    positive<0||negative<0)return null;
  const discordant=positive+negative;
  if(discordant===0)return 1;
  const lower=Math.min(positive,negative);
  let tail=0;
  for(let k=0;k<=lower;k++)tail+=choose(discordant,k);
  return Math.min(1,2*tail/2**discordant);
}
export function analyzeFrozenChainBenchmark(plan,receipts){
  verifyChainBenchmarkPlan(plan);
  if(!Array.isArray(receipts))throw Error('Missing receipts');
  const allowed=new Map(plan.trials.map(t=>[t.trialId,t]));
  const indexed=new Map();
  for(const r of receipts){
    if(!r||typeof r!=='object'||
      !allowed.has(r.trialId)||indexed.has(r.trialId)||
      !statuses.includes(r.classification))
      throw Error('Missing, repeated or misclassified receipt');
    const trial=allowed.get(r.trialId);
    if(r.runId!==undefined&&r.runId!==trial.runId||
      r.mode!==undefined&&r.mode!==trial.mode||
      r.seed!==undefined&&r.seed!==trial.seed||
      r.planSha256!==undefined&&r.planSha256!==plan.planSha256)
      throw Error('Receipt differs from registered trial identity');
    indexed.set(r.trialId,r);
  }
  const pairs=[];
  for(const trained of plan.trials.filter(t=>t.mode==='trained')){
    const untrained=plan.trials.find(t=>
      t.pairId===trained.pairId&&t.mode==='untrained');
    if(!untrained)throw Error('Missing preregistered control arm');
    const a=indexed.get(trained.trialId);
    const b=indexed.get(untrained.trialId);
    const status=x=>!x?'pending':x.classification;
    const category=!a||!b?'pending_pair':
      !isValid(a)||!isValid(b)?'invalid_pair':
      a.classification==='policy_success'&&
        b.classification==='policy_failure'?'trained_only_win':
      a.classification==='policy_failure'&&
        b.classification==='policy_success'?'untrained_only_win':
      a.classification==='policy_success'?'both_success':'both_failure';
    pairs.push({
      pairId:trained.pairId,seed:trained.seed,
      rotation:trained.rotation,variant:trained.variant,
      trained:status(a),untrained:status(b),
      category
    });
  }
  const counts={};
  for(const category of [
    'trained_only_win','untrained_only_win','both_success',
    'both_failure','invalid_pair','pending_pair'
  ])counts[category]=pairs.filter(p=>p.category===category).length;
  const valid=pairs.length-counts.invalid_pair-counts.pending_pair;
  const trainedSuccess=counts.trained_only_win+counts.both_success;
  const untrainedSuccess=counts.untrained_only_win+counts.both_success;
  const bySeed=plan.seeds.map(seed=>{
    const p=pairs.filter(x=>x.seed===seed);
    const usable=p.filter(x=>!['pending_pair','invalid_pair']
      .includes(x.category));
    const a=usable.filter(x=>['trained_only_win','both_success']
      .includes(x.category)).length;
    const b=usable.filter(x=>['untrained_only_win','both_success']
      .includes(x.category)).length;
    return {seed,pairsPlanned:p.length,pairsValid:usable.length,
      trainedSuccesses:a,untrainedSuccesses:b,
      pairedSuccessRateDifference:usable.length?
        (a-b)/usable.length:null};
  });
  return {
    schema:'craftle.frozen-chain-matched-analysis.v1',
    planSha256:plan.planSha256,suiteId:plan.suiteId,
    plannedPairs:pairs.length,validPairs:valid,
    invalidPairs:counts.invalid_pair,pendingPairs:counts.pending_pair,
    pairCategories:counts,bySeed,
    trainedSuccessesInValidPairs:trainedSuccess,
    controlSuccessesInValidPairs:untrainedSuccess,
    absoluteSuccessRateDifference:valid?
      (trainedSuccess-untrainedSuccess)/valid:null,
    exactTwoSidedDiscordantPValue:valid?
      exactPairedSignPValue(
        counts.trained_only_win,counts.untrained_only_win):null,
    inferenceStatus:counts.pending_pair?
      'INCOMPLETE_DO_NOT_CLAIM_CONFIRMED_TRAINING_EFFECT':
      counts.invalid_pair?
        'ALL_SCHEDULED_BUT_INVALID_PAIRS_REQUIRE_SENSITIVITY_ANALYSIS':
        'COMPLETE_DESCRIPTIVE_MATCHED_COMPARISON',
    limitations:[
      'Only three independent random initialization seeds; layouts reusing each seed are correlated and should not be treated as independent trained networks.',
      'Exact paired-discordance p-value is descriptive and not seed-cluster adjusted; no confirmatory statistical inference is justified with three seeds.',
      'Infrastructure failures and missing trials remain explicit, never silently dropped from the planned denominator.',
      'The historical seed-23 pilot is excluded from these results; policies are frozen and receive zero Minecraft updates.'
    ],
    pairs
  };
}
