// One-command, no-cherry-picking, resumable paired Minecraft benchmark.
// ALL 24 planned episodes remain in the denominator, even when an action,
// checkpoint, server or audit fails. No automatic retry or train-on-live.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadResourceChainOfflineCheckpoint}
  from '../src/resource-chain-offline-checkpoint.js';
import {auditPreregisteredTrial}
  from './audit-live-resource-chain-trial.js';
import {
  preregisterChainBenchmark,verifyChainBenchmarkPlan,
  validateChainBenchmarkTrial,summarizeChainBenchmark,
  CHAIN_BENCHMARK_SEEDS,CHAIN_BENCHMARK_EPISODES
} from '../src/resource-chain-benchmark-plan.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const opts={};
for(let i=2;i<process.argv.length;i+=2){
  if(!process.argv[i]?.startsWith('--')||process.argv[i+1]===undefined)
    throw Error('Usage: --suite-id NAME --plan-only true|false --resume true|false --limit N --port N [--paper-jar FILE]');
  const key=process.argv[i].slice(2);
  if(Object.hasOwn(opts,key))throw Error('Duplicate option: '+key);
  opts[key]=process.argv[i+1];
}
if(!Object.keys(opts).every(x=>[
  'suite-id','plan-only','resume','limit','port','paper-jar'
].includes(x)))throw Error('Unknown benchmark argument');
const yesNo=(key,defaultValue=false)=>{
  if(opts[key]===undefined)return defaultValue;
  if(!['true','false'].includes(opts[key]))
    throw Error('Expected --'+key+' true or false');
  return opts[key]==='true';
};
const suiteId=opts['suite-id']??'chain-multiseed-v1';
const planOnly=yesNo('plan-only'),resume=yesNo('resume');
const limit=Number(opts.limit??24),port=Number(opts.port??25624);
if(!Number.isSafeInteger(limit)||limit<1||limit>24||
  !Number.isSafeInteger(port)||port<1024||port>65535||
  [25565,25567,25575,25617,25623].includes(port))
  throw Error('Invalid trial limit or isolated server port');
if(planOnly&&resume)throw Error('Cannot plan-only resume existing suite');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const stringify=x=>JSON.stringify(x,null,2)+'\n';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const sourceFiles=[
  'src/resource-chain-benchmark-plan.js',
  'src/motor-resource-chain.js',
  'src/resource-chain-q.js',
  'src/resource-chain-simulator.js',
  'src/resource-chain-offline-checkpoint.js',
  'src/resource-chain-live-result.js',
  'src/motor-resource-pickup-proof.js',
  'src/verified-motor-baseline-action.js',
  'scripts/build-resource-chain-benchmark-checkpoint.js',
  'scripts/run-live-resource-chain-multi-trial.js',
  'scripts/audit-live-resource-chain-trial.js',
  'scripts/run-resource-chain-benchmark.js'
];
const sourceHashes=Object.fromEntries(sourceFiles.map(name=>
  [name,hash(path.join(root,name))]));
const checkpointSourceNames=[
  'src/motor-resource-chain.js','src/resource-chain-q.js',
  'src/resource-chain-simulator.js','src/resource-chain-offline-checkpoint.js'
];
const checkpointHashes=Object.fromEntries(checkpointSourceNames.map(name=>
  [name,sourceHashes[name]]));
const expectedPlan=preregisterChainBenchmark({suiteId,sourceHashes});
const base=path.join(root,'recordings/live-resource-chain-benchmarks');
const dir=path.join(base,suiteId);
const planPath=path.join(dir,'preregistration.json');
const lockPath=path.join(dir,'checkpoint-lock.json');
const receiptDir=path.join(dir,'trial-receipts');
const logDir=path.join(dir,'trial-logs');
const reportPath=path.join(dir,'results.json');
if(resume){
  if(!fs.existsSync(planPath))
    throw Error('Cannot resume a nonexistent preregistration');
}else{
  fs.mkdirSync(base,{recursive:true});
  fs.mkdirSync(dir,{recursive:false});
  fs.writeFileSync(planPath,stringify(expectedPlan),{flag:'wx'});
}
const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
verifyChainBenchmarkPlan(plan);
if(JSON.stringify(plan)!==JSON.stringify(expectedPlan))
  throw Error('Benchmark code or fixture hashes changed since preregistration; do not silently resume under new code');
fs.mkdirSync(receiptDir,{recursive:true});
fs.mkdirSync(logDir,{recursive:true});
console.log(JSON.stringify({
  phase:'PREREGISTRATION_LOCKED',suiteId,
  planSha256:plan.planSha256,
  independentSeeds:plan.seeds,heldoutRotations:plan.heldoutRotations,
  geometryVariants:plan.heldoutVariants,
  plannedPairs:plan.pairs,plannedTrials:plan.plannedTrials,
  planOnly,limit,runDir:dir
},null,2));
if(planOnly)process.exit(0);

const paperJar=path.resolve(opts['paper-jar']??
  'C:/Users/delar/Downloads/craftle-main/craftle-observer-verify/observer-test/paper-1.21.1-133.jar');
const plugin=path.join(root,'observer/target/craftle-observer-0.1.0.jar');
if(!fs.existsSync(paperJar)||!fs.existsSync(plugin))
  throw Error('Paper jar or compiled Craftle observer unavailable');
const binaries={paperJarSha256:hash(paperJar),
  observerJarSha256:hash(plugin)};
const checkpointPath=(seed,mode)=>path.join(root,
  'recordings/resource-chain-offline-checkpoints',
  'chain-'+mode+'-seed'+seed+'-'+
  (mode==='trained'?CHAIN_BENCHMARK_EPISODES:0)+'.json');
const describeCheckpoint=(seed,mode)=>{
  const full=checkpointPath(seed,mode);
  const bytes=fs.readFileSync(full);
  const loaded=loadResourceChainOfflineCheckpoint(
    JSON.parse(bytes.toString('utf8')),
    {requireSourceHashes:checkpointHashes});
  if(loaded.metadata.mode!==mode||
    loaded.metadata.training.seed!==seed||
    loaded.metadata.training.episodes!==
      (mode==='trained'?CHAIN_BENCHMARK_EPISODES:0)||
    loaded.policy.stats().training!==false)
    throw Error('Checkpoint inconsistent with locked seed/mode');
  return {
    seed,mode,path:path.relative(root,full).replaceAll('\\','/'),
    byteSha256:hash(full),envelopeSha256:loaded.sha256,
    updates:loaded.metadata.model.updates,
    heldoutSuccesses:loaded.metadata.validation.successes,
    heldoutTrials:loaded.metadata.validation.physicalLayouts
  };
};
let checkpointLock;
if(fs.existsSync(lockPath)){
  checkpointLock=JSON.parse(fs.readFileSync(lockPath,'utf8'));
  const {lockSha256,...payload}=checkpointLock;
  if(sha(payload)!==lockSha256||
    checkpointLock.planSha256!==plan.planSha256||
    JSON.stringify(checkpointLock.binaries)!==JSON.stringify(binaries))
    throw Error('Checkpoint/binary lock changed');
  for(const entry of checkpointLock.checkpoints){
    const actual=describeCheckpoint(entry.seed,entry.mode);
    if(JSON.stringify(actual)!==JSON.stringify(entry))
      throw Error('Frozen checkpoint changed after it was locked');
  }
}else{
  const entries=[];
  for(const seed of CHAIN_BENCHMARK_SEEDS){
    for(const mode of ['trained','untrained']){
      const full=checkpointPath(seed,mode);
      if(!fs.existsSync(full)){
        const result=spawnSync(process.execPath,[
          path.join(root,'scripts/build-resource-chain-benchmark-checkpoint.js'),
          '--benchmark','true','--mode',mode,'--seed',String(seed),
          '--episodes',String(CHAIN_BENCHMARK_EPISODES)
        ],{cwd:root,stdio:'inherit',windowsHide:true});
        if(result.error||result.status!==0)
          throw Error('Checkpoint build failed; keep all seeds, no replacement: '+seed+'/'+mode);
      }
      entries.push(describeCheckpoint(seed,mode));
    }
  }
  const payload={
    schema:'craftle.chain-benchmark-checkpoint-lock.v1',
    planSha256:plan.planSha256,binaries,checkpoints:entries
  };
  checkpointLock={...payload,lockSha256:sha(payload)};
  fs.writeFileSync(lockPath,stringify(checkpointLock),{flag:'wx'});
}
if(checkpointLock.checkpoints.length!==6||
  new Set(checkpointLock.checkpoints.map(x=>x.seed+':'+x.mode)).size!==6)
  throw Error('Expected exactly six immutable checkpoints');
console.log(JSON.stringify({
  phase:'ALL_CHECKPOINTS_FROZEN',lockSha256:checkpointLock.lockSha256,
  checkpointScores:checkpointLock.checkpoints.map(x=>({
    seed:x.seed,mode:x.mode,
    syntheticHoldout:x.heldoutSuccesses+'/10',
    offlineUpdates:x.updates
  }))
},null,2));

function allReceipts(){
  return plan.trials.map(trial=>{
    const p=path.join(receiptDir,trial.trialId+'.json');
    return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;
  }).filter(Boolean);
}
function writeReport(){
  const report=summarizeChainBenchmark(plan,allReceipts());
  const temp=reportPath+'.tmp';
  fs.writeFileSync(temp,stringify(report));
  fs.renameSync(temp,reportPath);
  return report;
}
const seen=allReceipts();
if(seen.some(r=>r.planSha256!==plan.planSha256||
    r.lockSha256!==checkpointLock.lockSha256||
    r.runId!==plan.trials.find(t=>t.trialId===r.trialId)?.runId))
  throw Error('Existing receipts conflict with locked experiment');
writeReport();
let abortRequested=false,activeChild=null;
process.on('SIGINT',()=>{
  abortRequested=true;
  if(activeChild)activeChild.kill('SIGINT');
});
process.on('SIGTERM',()=>{
  abortRequested=true;
  if(activeChild)activeChild.kill('SIGTERM');
});
async function spawnLogged(argv,logPath){
  const fd=fs.openSync(logPath,'wx');
  let spawned=false;
  try{
    const child=spawn(process.execPath,argv,{
      cwd:root,windowsHide:true,stdio:['inherit','pipe','pipe']
    });
    activeChild=child;
    spawned=true;
    for(const [stream,target] of [
      [child.stdout,process.stdout],[child.stderr,process.stderr]
    ])stream.on('data',chunk=>{
      fs.writeSync(fd,chunk);
      target.write(chunk);
    });
    return await new Promise(resolve=>{
      child.once('error',err=>resolve({code:-1,error:String(err)}));
      child.once('close',(code,signal)=>resolve({code:code??-1,signal}));
    });
  }finally{
    activeChild=null;
    fs.closeSync(fd);
    if(!spawned)throw Error('Could not start runner subprocess');
  }
}
function receiptFor(trial,exit){
  const location=path.join(root,
    'recordings/live-resource-chain-frozen-eval',trial.runId);
  const summaryFile=path.join(location,'summary.json');
  let observed=null,reason=null,classification='infrastructure_error';
  let audit=null;
  if(fs.existsSync(summaryFile)){
    try{
      observed=JSON.parse(fs.readFileSync(summaryFile,'utf8'));
      const result=validateChainBenchmarkTrial(trial,observed);
      classification=result.classification;
      reason=result.reason??null;
      if(observed.benchmarkPlanSha256!==plan.planSha256||
        observed.benchmarkSuiteId!==suiteId||
        observed.benchmarkTrialId!==trial.trialId||
        observed.checkpointSha256!==
          checkpointLock.checkpoints.find(c=>
            c.seed===trial.seed&&c.mode===trial.mode).byteSha256)
        throw Error('Run checkpoint/suite provenance mismatch');
      if(observed.eventsSha256){
        const eventFile=path.join(location,'server-events.jsonl');
        if(hash(eventFile)!==observed.eventsSha256)
          throw Error('Server event bytes do not match saved event digest');
      }
      if(observed.complete===true){
        const manifest=JSON.parse(fs.readFileSync(
          path.join(location,'manifest.json'),'utf8'));
        if(manifest.benchmarkPlanSha256!==plan.planSha256||
          manifest.benchmarkSuiteId!==suiteId||
          manifest.benchmarkTrialId!==trial.trialId||
          manifest.offlineModelUpdates!==observed.offlineModelUpdates)
          throw Error('Run manifest identity mismatch');
        if(classification!=='infrastructure_error'){
          audit=auditPreregisteredTrial({
            runId:trial.runId,mode:trial.mode,
            planSha256:plan.planSha256
          });
          if(audit.success!==observed.success||
            audit.terminalReward!==observed.terminalReward||
            audit.realPickups!==observed.verifiedRealPickups||
            audit.serverEvidenceSha256!==observed.eventsSha256)
            throw Error('Independent audit differs from reported outcome');
        }
      }
    }catch(e){
      classification='infrastructure_error';
      audit=null;
      reason='summary_or_replay_integrity_error: '+String(e);
    }
  }else{
    reason='runner_did_not_write_summary';
  }
  const record={
    schema:'craftle.chain-benchmark-trial-receipt.v1',
    planSha256:plan.planSha256,
    lockSha256:checkpointLock.lockSha256,
    trialId:trial.trialId,pairId:trial.pairId,
    runId:trial.runId,seed:trial.seed,mode:trial.mode,
    rotation:trial.rotation,variant:trial.variant,
    processExitCode:exit.code??null,
    classification,reason,
    complete:observed?.complete===true,
    success:classification==='policy_success',
    terminalReward:classification==='policy_success'?1:
      classification==='policy_failure'?-1:null,
    serverEventSha256:observed?.eventsSha256??null,
    independentProofReplayPassed:audit?.verified===true,
    auditedActionKeys:audit?.executedActions??null,
    savedSummarySha256:fs.existsSync(summaryFile)?
      hash(summaryFile):null
  };
  fs.writeFileSync(path.join(receiptDir,trial.trialId+'.json'),
    stringify(record),{flag:'wx'});
  return record;
}
for(const trial of plan.trials.slice(0,limit)){
  if(abortRequested)break;
  const receiptPath=path.join(receiptDir,trial.trialId+'.json');
  if(fs.existsSync(receiptPath)){
    console.log(JSON.stringify({phase:'ALREADY_RECORDED',
      trialId:trial.trialId,runId:trial.runId}));
    continue;
  }
  const location=path.join(root,
    'recordings/live-resource-chain-frozen-eval',trial.runId);
  // Never rerun a prior trial automatically or replace its evidence.
  if(fs.existsSync(location)){
    const running=spawnSync('docker',[
      'inspect','--format','{{.State.Running}}','craftle-'+trial.runId
    ],{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000});
    if(running.status===0&&running.stdout.trim()==='true')
      throw Error('Previous trial is still running; cannot resume or overwrite '+trial.runId);
    const recovered=receiptFor(trial,{code:null});
    console.log(JSON.stringify({phase:'RECOVERED_PRIOR_ATTEMPT',...recovered}));
    writeReport();
    continue;
  }
  const checkpoint=checkpointLock.checkpoints.find(c=>
    c.seed===trial.seed&&c.mode===trial.mode);
  if(!checkpoint)throw Error('Missing preregistered arm checkpoint');
  const argv=[
    path.join(root,'scripts/run-live-resource-chain-multi-trial.js'),
    '--benchmark','true',
    '--suite-id',suiteId,'--trial-id',trial.trialId,
    '--plan-sha256',plan.planSha256,'--run-id',trial.runId,
    '--policy',trial.mode,
    '--checkpoint',path.join(root,checkpoint.path),
    '--port',String(port),'--rotation',String(trial.rotation),
    '--variant',trial.variant,'--paper-jar',paperJar
  ];
  console.log(JSON.stringify({
    phase:'START_LIVE_MINECRAFT_TRIAL',trialId:trial.trialId,
    plannedTotal:plan.plannedTrials,seed:trial.seed,
    policy:trial.mode,rotation:trial.rotation,variant:trial.variant
  }));
  const childResult=await spawnLogged(argv,
    path.join(logDir,trial.trialId+'.log'));
  const receipt=receiptFor(trial,childResult);
  console.log(JSON.stringify({phase:'TRIAL_RECORDED',...receipt},null,2));
  const report=writeReport();
  console.log(JSON.stringify({phase:'CUMULATIVE_RESULTS',
    completed:report.attemptedTrials,
    trained:report.byPolicy.trained,
    untrained:report.byPolicy.untrained,
    matchedPairs:report.validMatchedPairs},null,2));
}
const final=writeReport();
console.log(JSON.stringify({phase:'BENCHMARK_STOP_POINT',
  suiteId,planSha256:plan.planSha256,
  attemptedTrials:final.attemptedTrials,
  plannedTrials:final.plannedTrials,
  completedSchedule:final.completedSchedule,
  byPolicy:final.byPolicy,
  validMatchedPairs:final.validMatchedPairs,
  trainedOnlyWins:final.trainedOnlyWins,
  untrainedOnlyWins:final.untrainedOnlyWins,
  reportPath},null,2));
if(abortRequested)process.exitCode=130;
