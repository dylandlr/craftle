import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root)throw Error('Usage: node scripts/compare-experiments.js RUN_REGISTRY_ROOT');
const rows=[];
for(const entry of fs.readdirSync(root,{withFileTypes:true})){
 if(!entry.isDirectory())continue;
 const file=path.join(root,entry.name,'run.json');if(!fs.existsSync(file))continue;
 const r=JSON.parse(fs.readFileSync(file,'utf8'));
 const c=r.configuration,m=r.metrics;
 rows.push({runId:c.runId,agent:c.agentId,instinct:c.instinctProfile,policy:c.policy,
  seed:c.trainingSeed,world:c.worldSeed,decisions:m.decisions,deaths:m.deaths,
  eats:m.successfulEats,inventoryGains:m.observedInventoryGain,discoveredCells:m.discoveredCells,
  meanReward:m.meanReward,checkpoint:c.checkpointSha256});
}
rows.sort((a,b)=>a.runId.localeCompare(b.runId));
console.log(JSON.stringify({schema:'craftle.experiment-comparison.v1',runs:rows.length,results:rows,
 warning:'Raw totals are not normalized for duration or world conditions; compare matched trials only.'},null,2));
