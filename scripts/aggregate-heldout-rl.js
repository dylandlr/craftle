// Aggregate independent frozen-vs-random comparisons across held-out seeds.
// Input: node scripts/aggregate-heldout-rl.js seedA/comparison.json seedB/comparison.json ...
import fs from 'node:fs';
const paths=process.argv.slice(2);
if(paths.length<2)throw Error('At least two independently generated held-out seed reports required');
const rows=paths.map(file=>{
 const x=JSON.parse(fs.readFileSync(file,'utf8'));
 if(x.schemaVersion!==1||x.frozen?.policy!=='frozen_visual_q'||x.random?.policy!=='random_rgb_control')throw Error('Unrecognized comparison report: '+file);
 if(x.frozen.transitions<3||x.random.transitions<3)throw Error('Too few transitions: '+file);
 const frozen=x.frozen.meanReward,random=x.random.meanReward;
 if(!Number.isFinite(frozen)||!Number.isFinite(random))throw Error('Missing finite rewards: '+file);
 return {file,frozenRewardPerTransition:frozen,randomRewardPerTransition:random,
  delta:frozen-random,frozenActions:x.frozen.actions,randomActions:x.random.actions};
});
const deltas=rows.map(x=>x.delta),n=deltas.length,mean=deltas.reduce((a,b)=>a+b,0)/n;
const variance=n>1?deltas.reduce((a,b)=>a+(b-mean)**2,0)/(n-1):0;
console.log(JSON.stringify({schemaVersion:1,pairedSeeds:n,meanRewardDifference:mean,
 standardDeviation:Math.sqrt(variance),standardError:Math.sqrt(variance/n),
 wins:rows.filter(x=>x.delta>0).length,ties:rows.filter(x=>x.delta===0).length,
 losses:rows.filter(x=>x.delta<0).length,rows,
 caveat:'Per-seed paired reward differences are descriptive, not a measure of Minecraft mastery. Distinct seed metadata must be independently verified; no automatic significance claim.'},null,2));
