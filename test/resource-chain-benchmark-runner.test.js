// Full no-server preflight: every preregistered seed and BOTH arms remain
// runnable, including synthetic failure. This never boots Minecraft.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {buildResourceChainOfflineCheckpoint}
  from '../src/resource-chain-offline-checkpoint.js';
import {preregisterChainBenchmark,CHAIN_BENCHMARK_SEEDS}
  from '../src/resource-chain-benchmark-plan.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sources=[
  'src/motor-resource-chain.js','src/resource-chain-q.js',
  'src/resource-chain-simulator.js','src/resource-chain-offline-checkpoint.js'
];
const hashes=Object.fromEntries(sources.map(name=>
  [name,digest(path.join(root,name))]));
const plan=preregisterChainBenchmark({suiteId:'chain-preflight-ci',
  sourceHashes:hashes});
const script=path.join(root,'scripts/run-live-resource-chain-multi-trial.js');

test('every preregistered neural arm passes no-Minecraft preflight without score filtering',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-chain-bench-'));
  let observedSyntheticFailure=false;
  try{
    for(const seed of CHAIN_BENCHMARK_SEEDS){
      for(const mode of ['trained','untrained']){
        const envelope=buildResourceChainOfflineCheckpoint({
          seed,mode,episodes:600,sourceHashes:hashes
        });
        const checkpoint=path.join(tmp,'seed'+seed+'-'+mode+'.json');
        fs.writeFileSync(checkpoint,JSON.stringify(envelope)+'\n');
        const trial=plan.trials.find(x=>x.seed===seed&&x.mode===mode);
        assert.ok(trial);
        const result=spawnSync(process.execPath,[
          script,'--benchmark','true',
          '--suite-id',plan.suiteId,
          '--trial-id',trial.trialId,
          '--plan-sha256',plan.planSha256,
          '--run-id',trial.runId,'--checkpoint',checkpoint,
          '--policy',mode,
          '--rotation',String(trial.rotation),
          '--variant',trial.variant,
          '--self-test','true'
        ],{cwd:root,encoding:'utf8',windowsHide:true});
        assert.equal(result.status,0,
          mode+'/'+seed+' preflight must be admitted: '+result.stderr);
        const report=JSON.parse(result.stdout.trim());
        assert.equal(report.liveActions,0);
        assert.equal(report.liveLearningUpdates,0);
        assert.equal(report.benchmarkPlanSha256,plan.planSha256);
        assert.equal(report.benchmarkTrialId,trial.trialId);
        assert.equal(report.offlineTrainingUpdates,mode==='trained'?16800:0);
        if(!report.syntheticSuccess)observedSyntheticFailure=true;
      }
    }
    assert.equal(observedSyntheticFailure,true,
      'Controls must include at least one synthetic-negative trajectory');
  }finally{
    fs.rmSync(tmp,{recursive:true,force:true});
  }
});
test('benchmark trial refuses to run without exact preregistration identity',()=>{
  const result=spawnSync(process.execPath,[
    script,'--benchmark','true','--suite-id','wrong',
    '--trial-id','001','--plan-sha256','f'.repeat(64),
    '--run-id','chain-frozen-something-001',
    '--policy','trained','--checkpoint','missing.json',
    '--self-test','true'
  ],{cwd:root,encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/run ID must match preregistered identity/);
});
