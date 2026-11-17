// Read-only checkpoint and 24-trial study status. No server startup,
// checkpoint generation, file writes, or reward classification shortcuts.
// Runs against either an in-progress or completed preregistered suite.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {
  verifyChainBenchmarkPlan,summarizeChainBenchmark
} from '../src/resource-chain-benchmark-plan.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const suite=process.argv[2]??'chain-multiseed-v1';
if(process.argv.length>3||!/^[a-z][a-z0-9-]{3,20}$/.test(suite))
  throw Error('Usage: node scripts/inspect-resource-chain-benchmark.js [suite-id]');
const base=path.join(root,'recordings/live-resource-chain-benchmarks',suite);
const planPath=path.join(base,'preregistration.json');
if(!fs.existsSync(planPath)){
  console.log(JSON.stringify({schema:'craftle.chain-benchmark-read-only-status.v1',
    suiteId:suite,state:'NOT_REGISTERED',
    instructions:'Create a plan once with --plan-only true; do not synthesize results.'},
    null,2));
  process.exit(0);
}
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const plan=readJson(planPath);
verifyChainBenchmarkPlan(plan);
const lockPath=path.join(base,'checkpoint-lock.json');
let lockState='NOT_CREATED',lockSha256=null;
if(fs.existsSync(lockPath)){
  const lock=readJson(lockPath);
  const {lockSha256:known,...payload}=lock;
  if(digest(payload)!==known||lock.planSha256!==plan.planSha256)
    throw Error('Preregistered checkpoint lock hash is invalid');
  lockState='VALID';lockSha256=known;
}
const receiptsDir=path.join(base,'trial-receipts');
const receipts=[];
for(const t of plan.trials){
  const p=path.join(receiptsDir,t.trialId+'.json');
  if(!fs.existsSync(p))continue;
  const r=readJson(p);
  if(r.schema!=='craftle.chain-benchmark-trial-receipt.v1'||
    r.trialId!==t.trialId||r.runId!==t.runId||
    r.planSha256!==plan.planSha256||
    r.lockSha256!==lockSha256||
    !['policy_success','policy_failure','infrastructure_error']
      .includes(r.classification))
    throw Error('Invalid receipt in locked study: '+t.trialId);
  receipts.push(r);
}
const summary=summarizeChainBenchmark(plan,receipts);
const pending=plan.trials.filter(t=>
  !receipts.some(r=>r.trialId===t.trialId));
const rawRuns=pending.filter(t=>
  fs.existsSync(path.join(root,
    'recordings/live-resource-chain-frozen-eval',t.runId)));
console.log(JSON.stringify({
  schema:'craftle.chain-benchmark-read-only-status.v1',
  suiteId:suite,planSha256:plan.planSha256,
  lockState,lockSha256,
  plannedTrials:summary.plannedTrials,
  attemptedTrials:summary.attemptedTrials,
  pendingTrials:pending.length,
  completedSchedule:summary.completedSchedule,
  trained:summary.byPolicy.trained,
  untrained:summary.byPolicy.untrained,
  auditedMatchedPairs:summary.validMatchedPairs,
  trainedOnlyWins:summary.trainedOnlyWins,
  untrainedOnlyWins:summary.untrainedOnlyWins,
  pendingWithExistingWorldEvidence:rawRuns.map(t=>t.runId),
  nextUnattemptedTrial:pending[0]??null,
  note:'Read-only status; does not reclassify receipts or run new trials.'
},null,2));
