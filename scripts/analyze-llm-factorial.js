// Analyze matched-seed agent outcomes without imputing unrun or missing trials.
import fs from 'node:fs';
import path from 'node:path';
const manifestFile=process.argv[2]??'experiments/llm-factorial-trials.v1.json';
const root=process.argv[3]??'recordings/factorial';
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const records=[],missing=[];
for(const trial of manifest.trials){
 const folder=path.join(root,trial.id);
 const statusFile=path.join(folder,'trial.json');
 const reportFile=path.join(folder,'episode-report.json');
 if(!fs.existsSync(statusFile)||!fs.existsSync(reportFile)){missing.push(trial.id);continue;}
 try{
  const status=JSON.parse(fs.readFileSync(statusFile,'utf8'));
  const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));
  if(status.status!=='completed'||status.seed!==trial.seed||status.agentId!==trial.agentId){missing.push(trial.id);continue;}
  const actions=Number(report.appliedActions);
  const moved=Number(report.measuredEffects?.moved);
  const deaths=Number(report.deaths);
  if(![actions,moved,deaths].every(Number.isFinite)||actions<0||moved<0||deaths<0)throw Error('invalid metrics');
  records.push({trialId:trial.id,seed:trial.seed,agentId:trial.agentId,condition:trial.condition,appliedActions:actions,moved,deaths});
 }catch(e){missing.push(trial.id);}
}
const baselines=Object.fromEntries(records.filter(r=>r.agentId==='agent_001').map(r=>[r.seed,r]));
const matched=records.filter(r=>r.agentId!=='agent_001'&&baselines[r.seed]).map(r=>({
 seed:r.seed,agentId:r.agentId,condition:r.condition,
 deltaActions:r.appliedActions-baselines[r.seed].appliedActions,
 deltaMovementEvents:r.moved-baselines[r.seed].moved,
 deltaDeaths:r.deaths-baselines[r.seed].deaths
}));
const byCondition=[];
for(const id of [...new Set(manifest.trials.map(t=>t.agentId))].filter(id=>id!=='agent_001')){
 const rows=matched.filter(r=>r.agentId===id);
 byCondition.push({agentId:id,n:rows.length,
   meanDeltaActions:rows.length?rows.reduce((a,b)=>a+b.deltaActions,0)/rows.length:null,
   meanDeltaMovementEvents:rows.length?rows.reduce((a,b)=>a+b.deltaMovementEvents,0)/rows.length:null,
   meanDeltaDeaths:rows.length?rows.reduce((a,b)=>a+b.deltaDeaths,0)/rows.length:null});
}
const result={schemaVersion:1,kind:'paired_seed_observational_summary',planned:manifest.trials.length,completed:records.length,
 missing:missing.length,missingTrialIds:missing,pairedComparisons:matched.length,conditions:byCondition,
 disclaimer:'No missing trials were imputed. These tool/event metrics are not Minecraft checkpoint success or causal evidence. Meaningful inference requires verified milestones, repetitions and controlled model/provider settings.'};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--require-complete')&&missing.length)process.exitCode=1;
