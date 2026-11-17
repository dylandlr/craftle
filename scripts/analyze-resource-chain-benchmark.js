// Read-only statistical summary of a preregistered frozen neural Minecraft
// study. Does not change plan/receipts, start Paper or exclude missing trials.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeFrozenChainBenchmark}
  from '../src/resource-chain-benchmark-analysis.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const suite=process.argv[2]??'chain-multiseed-v1';
if(process.argv.length>3||!/^[a-z][a-z0-9-]{3,20}$/.test(suite))
  throw Error('Usage: node scripts/analyze-resource-chain-benchmark.js [suite-id]');
const dir=path.join(root,'recordings/live-resource-chain-benchmarks',suite);
const planFile=path.join(dir,'preregistration.json');
if(!fs.existsSync(planFile)){
  console.log(JSON.stringify({
    state:'NOT_PREREGISTERED',suiteId:suite,
    plannedResults:'NONE',
    note:'No Minecraft evidence exists in this study directory.'
  },null,2));
  process.exit(0);
}
const plan=JSON.parse(fs.readFileSync(planFile,'utf8'));
const receipts=plan.trials.flatMap(t=>{
  const p=path.join(dir,'trial-receipts',t.trialId+'.json');
  return fs.existsSync(p)?[JSON.parse(fs.readFileSync(p,'utf8'))]:[];
});
console.log(JSON.stringify(analyzeFrozenChainBenchmark(plan,receipts),null,2));
