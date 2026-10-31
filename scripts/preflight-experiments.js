// Fail-closed preflight for planned multi-agent experiment trials.
// Validates isolated storage and completed knowledge integration before any server is started.
import fs from 'node:fs';
import path from 'node:path';
const file=process.argv[2],root=process.argv[3];
if(!file||!root)throw Error('Usage: node scripts/preflight-experiments.js PLAN.json EXPERIMENT_ROOT');
const plan=JSON.parse(fs.readFileSync(file,'utf8'));
if(plan.schema!=='craftle.experiment-plan.v1'||!Array.isArray(plan.runs)||!plan.runs.length)throw Error('Invalid plan');
const absRoot=path.resolve(root),filming=path.resolve('deploy/filming/state');
const under=(a,b)=>a===b||a.startsWith(b+path.sep);
if(under(absRoot,filming)||under(filming,absRoot))throw Error('Experimental root overlaps filming state');
const used=new Set(),failures=[];
for(const r of plan.runs){
 for(const field of ['runId','isolatedWorld','isolatedState','trainingSeed','trainingBudgetDecisions','profile']){
  if(r[field]===undefined||r[field]===null||r[field]==='')failures.push(r.runId+': missing '+field);
 }
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(String(r.runId)))failures.push('invalid run ID');
 for(const kind of ['isolatedWorld','isolatedState']){
  const value=r[kind];
  if(typeof value!=='string'||path.isAbsolute(value)||value.split(/[\\/]+/).some(x=>x==='..')){failures.push(r.runId+': unsafe '+kind);continue;}
  const target=path.resolve(absRoot,value);
  if(!under(target,absRoot)||under(target,filming))failures.push(r.runId+': state overlap');
  if(used.has(target))failures.push(r.runId+': duplicate path');
  used.add(target);
  if(fs.existsSync(target))failures.push(r.runId+': path already exists '+target);
 }
 if(!Number.isInteger(r.trainingBudgetDecisions)||r.trainingBudgetDecisions<1)failures.push(r.runId+': bad budget');
 if(r.phase!=='planned')failures.push(r.runId+': unexpected phase');
}
const report={schema:'craftle.experiment-preflight.v1',ready:false,plannedRuns:plan.runs.length,
 failures:[...failures,'Instinct treatment injection and isolated Minecraft launcher not yet validated; refusing launch'],
 mode:'dry_run_only',experimentalRoot:absRoot};
console.log(JSON.stringify(report,null,2));
process.exitCode=failures.length?1:2;
