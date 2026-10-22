// Analyze completed factorial trials. Never treat a missing run as a zero score.
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2);
const get=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
const root=path.resolve(get('--root','recordings/factorial'));
const manifest=JSON.parse(fs.readFileSync(get('--manifest','experiments/llm-factorial-trials.v1.json'),'utf8'));
const out=get('--output','recordings/factorial-summary.json');
const rows=[],missing=[],invalid=[];
for(const trial of manifest.trials){
 const dir=path.join(root,trial.id);
 const reportPath=path.join(dir,'episode-report.json');
 const metaPath=path.join(dir,'trial.json');
 if(!fs.existsSync(reportPath)||!fs.existsSync(metaPath)){missing.push(trial.id);continue;}
 try{
   const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
   const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
   if(meta.trialId!==trial.id||meta.seed!==trial.seed||meta.agentId!==trial.agentId||meta.status!=='completed')throw Error('trial identity or completion mismatch');
   if(!Number.isInteger(report.appliedActions)||report.appliedActions<1)throw Error('invalid applied actions');
   rows.push({trialId:trial.id,seed:trial.seed,agentId:trial.agentId,condition:trial.condition,
     appliedActions:report.appliedActions,modelActions:report.modelActions??null,
     deaths:report.deaths??null,moved:report.measuredEffects?.moved??null,
     stationary:report.measuredEffects?.stationary??null,
     inventoryChanges:report.measuredEffects?.inventoryChanges??null,
     verifiedMilestones:Array.isArray(report.minecraftMilestonesVerified)?report.minecraftMilestonesVerified.filter(x=>typeof x?.id==='string'&&['inventory_snapshot','client_dimension_event'].includes(x.evidence)).map(x=>x.id):[]});
 }catch(e){invalid.push({trialId:trial.id,error:e.message});}
}
const key=(seed,agent)=>String(seed)+':'+agent;
const index=new Map(rows.map(r=>[key(r.seed,r.agentId),r]));
const paired=[];
for(const row of rows){
 if(row.agentId==='agent_001')continue;
 const baseline=index.get(key(row.seed,'agent_001'));
 if(!baseline)continue;
 paired.push({seed:row.seed,agentId:row.agentId,condition:row.condition,
   deltaAppliedActions:row.appliedActions-baseline.appliedActions,
   deltaDeaths:row.deaths!==null&&baseline.deaths!==null?row.deaths-baseline.deaths:null,
   deltaMoved:row.moved!==null&&baseline.moved!==null?row.moved-baseline.moved:null,
   gainedMilestones:row.verifiedMilestones.filter(id=>!baseline.verifiedMilestones.includes(id)),
   lostMilestones:baseline.verifiedMilestones.filter(id=>!row.verifiedMilestones.includes(id))});
}
const byCondition=Object.groupBy(paired,r=>r.agentId);
const comparisons=Object.entries(byCondition).map(([agentId,records])=>({
 agentId,condition:records[0].condition,n:records.length,
 milestoneGains:records.reduce((n,r)=>n+r.gainedMilestones.length,0),
 milestoneLosses:records.reduce((n,r)=>n+r.lostMilestones.length,0),
 meanDeltaMoved:records.every(r=>r.deltaMoved!==null)?records.reduce((s,r)=>s+r.deltaMoved,0)/records.length:null,
 meanDeltaAppliedActions:records.reduce((s,r)=>s+r.deltaAppliedActions,0)/records.length,
 meanDeltaDeaths:records.every(r=>r.deltaDeaths!==null)?records.reduce((s,r)=>s+r.deltaDeaths,0)/records.length:null
}));
const summary={schemaVersion:1,source:'logged_completed_trials_only',totalPlanned:manifest.trials.length,
 completed:rows.length,missing,invalid,rows,paired,comparisons,
 limitations:['Missing/invalid trials are excluded, never imputed as failure or success','Applied actions and motion do not establish intelligence','Only equal-seed comparisons; uncontrolled world randomness persists','No causal claims from sparse or incomplete trial data','Milestones use conservative inventory/dimension event evidence, not validated causal attribution of acquisition']};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({completed:rows.length,missing:missing.length,invalid:invalid.length,paired:paired.length,output:out}));
