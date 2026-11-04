// Offline comparison: random legal actions versus a variable-candidate Q policy.
// Uses discrete surrogate physics, NOT Minecraft. No hard-coded construction policy.
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import {createMotorQPolicy} from '../src/motor-q-policy.js';
const episodes=Number(process.argv[2]??40),maxSteps=Number(process.argv[3]??70);
if(!Number.isInteger(episodes)||episodes<2||episodes>500||
 !Number.isInteger(maxSteps)||maxSteps<10||maxSteps>300)throw Error('Invalid limits');
const seeds=[3,11,29,47,101];
function trial({policy=null,seed,episode,training=false}){
 const layout=(seed+episode)%2?'terraces':'isolated';
 const w=createMutableTerrain({seed,layout,maxSteps,platformHeight:4+(seed+episode)%3,
  span:3+(seed%3),initialBlocks:3+(episode%4)});
 let success=false,placed=0,dug=0,fallDamage=0,invalid=0;
 let rng=(seed*2017+episode*97+1)>>>0;
 const random=()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/4294967296;};
 while(!w.snapshot().done){
  const obs=w.observe(),candidates=w.affordances();
  if(!candidates.length)break;
  const selected=policy?policy.choose(obs,candidates):
   {candidate:candidates[Math.floor(random()*candidates.length)]};
  if(!selected.candidate)break;
  const outcome=w.act(selected.candidate);
  if(policy&&training)policy.observe({features:selected.features,reward:outcome.reward,
   nextObservation:w.observe(),nextCandidates:w.affordances(),
   terminal:outcome.done});
  placed+=Number(outcome.ok&&outcome.action==='place');
  dug+=Number(outcome.ok&&outcome.action==='dig');
  fallDamage+=outcome.damage;invalid+=Number(!outcome.ok);
  success ||= outcome.reachedLowerGround;
 }
 const s=w.snapshot();
 return {success,steps:s.steps,health:s.health,placed,dug,fallDamage,invalid,
  layout,seed,episode};
}
const mean=(a,k)=>Number((a.reduce((s,r)=>s+r[k],0)/a.length).toFixed(3));
const summarize=(name,rows)=>({policy:name,runs:rows.length,
 successRate:mean(rows,'success'),meanSteps:mean(rows,'steps'),
 meanHealth:mean(rows,'health'),meanPlaced:mean(rows,'placed'),
 meanDug:mean(rows,'dug'),meanFallDamage:mean(rows,'fallDamage'),
 meanInvalidActions:mean(rows,'invalid')});
const trained=createMotorQPolicy({seed:17,epsilon:0.25,training:true});
const training=[];
for(const seed of seeds)for(let episode=0;episode<episodes;episode++)
 training.push(trial({policy:trained,seed,episode,training:true}));
const frozen=createMotorQPolicy({snapshot:trained.snapshot(),seed:91,
 epsilon:0,training:false});
const random=[],evaluated=[];
for(const seed of seeds)for(let episode=episodes;episode<episodes+10;episode++){
 random.push(trial({seed,episode}));
 evaluated.push(trial({policy:frozen,seed,episode}));
}
console.log(JSON.stringify({
 schema:'craftle.motor-emergence-benchmark.v1',
 synthetic:true,realMinecraft:false,episodesPerTrainingSeed:episodes,
 heldOutEpisodesPerSeed:10,seedValues:seeds,
 trainingUpdates:trained.stats().updates,
 training:summarize('train_variable_candidate_q',training),
 evaluation:[summarize('random_legal',random),
  summarize('frozen_variable_candidate_q',evaluated)],
 interpretationLimits:[
  'Synthetic physics and candidate enumeration are simplified.',
  'Training and evaluation share world-generation rules and seed families.',
  'No claim of learned bridge building, descent mastery or Minecraft survival.',
  'A negative result is still informative: inspect exploration and action preconditions.'
 ]
},null,2));
