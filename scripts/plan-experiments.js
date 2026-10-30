// Produce reproducible treatment schedule, but do not launch worlds until isolation is configured.
// Paired seeds minimize world-difficulty confounding; each run must use its own world/state root.
import fs from 'node:fs';
const output=process.argv[2],seeds=(process.argv[3]??'17,23,41').split(',').map(Number);
if(!output||!seeds.length||!seeds.every(Number.isInteger))throw Error('Usage: node scripts/plan-experiments.js PLAN.json [seeds comma-separated]');
const profiles=['tabula_rasa','survival','crafting','pickaxe','survival_pickaxe'];
const runs=[];
for(const seed of seeds)for(const profile of profiles){
 const runId=`instinct_${profile}_seed_${seed}`;
 runs.push({runId,profile,trainingSeed:seed,worldSeed:String(seed),
   isolatedWorld:`worlds/${runId}`,isolatedState:`state/${runId}`,
   trainingBudgetDecisions:10000,phase:'planned',policy:'targeted_dqn',
   warning:'Profile integration is not yet live: do not treat this plan as completed experiments.'});
}
const result={schema:'craftle.experiment-plan.v1',createdAt:new Date().toISOString(),runs,
 constraints:{pairedSeeds:true,independentCheckpoints:true,independentWorlds:true,
  equalTrainingBudget:true,instinctIntegrationRequired:true}};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file:output,runs:runs.length,seeds,profiles},null,2));
