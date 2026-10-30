// Read-only normalization of registered runs. Do not compare unmatched seeds as causal evidence.
import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root)throw Error('Usage: node scripts/compare-normalized.js REGISTRY_ROOT');
const rows=[];
for(const entry of fs.readdirSync(root,{withFileTypes:true})){
 if(!entry.isDirectory())continue;
 const file=path.join(root,entry.name,'run.json');if(!fs.existsSync(file))continue;
 const r=JSON.parse(fs.readFileSync(file,'utf8')),c=r.configuration,m=r.metrics;
 const elapsed=c.durationSeconds??(c.startedAt&&c.endedAt?(Date.parse(c.endedAt)-Date.parse(c.startedAt))/1000:null);
 const hours=Number.isFinite(elapsed)&&elapsed>0?elapsed/3600:null;
 const rate=n=>hours!==null&&Number.isFinite(n)?n/hours:null;
 rows.push({runId:c.runId,profile:c.instinctProfile,seed:c.trainingSeed,worldSeed:c.worldSeed,
  policy:c.policy,checkpoint:c.checkpointSha256,hours,
  decisionsPerHour:rate(m.decisions),deathsPerHour:rate(m.deaths),
  eatsPerHour:rate(m.successfulEats),newCellsPerHour:rate(m.discoveredCells),
  eatingPerThousandDecisions:Number.isFinite(m.decisions)&&m.decisions>0&&Number.isFinite(m.successfulEats)?1000*m.successfulEats/m.decisions:null,
  meanReward:m.meanReward});
}
rows.sort((a,b)=>a.seed-b.seed||a.profile.localeCompare(b.profile));
const pairs={};for(const r of rows)(pairs[r.seed]??=[]).push(r.profile);
console.log(JSON.stringify({schema:'craftle.experiment-normalized.v1',results:rows,
 seedCoverage:pairs,caveat:'Rates are null without measured elapsed time. Treat profiles as experimental labels only after the learning runtime consumes them. Survival success needs server-verified outcomes.'},null,2));
