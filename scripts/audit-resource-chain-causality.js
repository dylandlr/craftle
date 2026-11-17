// Causal ablation on a synthetic four-step build task. NOT Minecraft proof.
// Controls share the blueprint-conditioned neural architecture and seed.
// Terminal reward labels in 'scrambled' are random, unrelated to world success.
import {createResourceChainQ} from '../src/resource-chain-q.js';
import {syntheticEpisode} from '../src/resource-chain-simulator.js';
import {
  chainTasks,CHAIN_SPLITS,CHAIN_GEOMETRY_VARIANTS
} from '../src/motor-resource-chain.js';

const seeds=[1,2,3,5,8,13,17,21,23,34,41,55];
const trainEpisodes=600,warmupEpisodes=200;
const makeRng=seed=>{
  let state=seed>>>0;
  return ()=>{
    state=(Math.imul(1664525,state)+1013904223)>>>0;
    return state/4294967296;
  };
};
function accuracy(policy){
  let successes=0,total=0;
  const breakdown={};
  for(const variant of CHAIN_GEOMETRY_VARIANTS){
    let count=0;
    for(const rotation of CHAIN_SPLITS.heldout){
      const result=syntheticEpisode(rotation,menu=>
        policy.choose(menu.observation,menu.candidates),{variant});
      const hit=Number(result.success);
      successes+=hit;count+=hit;total++;
    }
    breakdown[variant]=count;
  }
  return {successes,trials:total,breakdown};
}
const records=[];
for(const seed of seeds){
  const baseline=createResourceChainQ({seed,epsilon:0,training:false});
  const untrained=accuracy(baseline);
  const real=createResourceChainQ({seed,epsilon:0.4,alpha:0.02,
    gamma:0.95,replayPasses:6,replayCapacity:256});
  const scrambled=createResourceChainQ({seed,epsilon:0.4,alpha:0.02,
    gamma:0.95,replayPasses:6,replayCapacity:256});
  const coin=makeRng(seed*733+421);
  let actualSuccesses=0;
  const tasks=chainTasks(trainEpisodes,{seed,split:'train'});
  for(let i=0;i<tasks.length;i++){
    const rotation=tasks[i].rotation;
    const override=i<warmupEpisodes?1:null;
    const realOutcome=syntheticEpisode(rotation,menu=>
      real.choose(menu.observation,menu.candidates,{
        epsilonOverride:override
      }),{afterEpisode:trajectory=>real.learnEpisode(trajectory)});
    actualSuccesses+=Number(realOutcome.success);
    syntheticEpisode(rotation,menu=>
      scrambled.choose(menu.observation,menu.candidates,{
        epsilonOverride:override
      }),{afterEpisode:trajectory=>{
        const noInformation=coin()<0.5?-1:1;
        scrambled.learnEpisode(trajectory.map((t,j)=>({
          ...t,reward:j===3?noInformation:0
        })));
      }});
  }
  const trained=accuracy(createResourceChainQ({seed,
    training:false,snapshot:real.snapshot()}));
  const noRewardSignal=accuracy(createResourceChainQ({seed,
    training:false,snapshot:scrambled.snapshot()}));
  records.push({seed,actualSuccessesDuringTraining:actualSuccesses,
    untrained,terminalRewardTraining:trained,
    scrambledTerminalRewardTraining:noRewardSignal,
    neuralUpdates:real.stats().updates});
}
const total=(field)=>records.reduce((sum,row)=>sum+
  row[field].successes,0);
const summary={
  type:'SYNTHETIC_ONLY_CAUSAL_ABLATION_NOT_LIVE_MINECRAFT',
  method:'same neural architecture and public blueprint; freeze before evaluation',
  seeds,trainingEpisodesPerSeed:trainEpisodes,
  uniformRandomWarmupEpisodes:warmupEpisodes,
  distinctEvaluationLayoutsPerSeed:
    CHAIN_GEOMETRY_VARIANTS.length*CHAIN_SPLITS.heldout.length,
  evaluationLayoutSource:'five geometry families x rotations 2 and 3',
  aggregate:{
    noTraining:total('untrained'),
    trueTerminalReward:total('terminalRewardTraining'),
    randomlyScrambledTerminalReward:total('scrambledTerminalRewardTraining'),
    totalTrials:records.length*CHAIN_GEOMETRY_VARIANTS.length*
      CHAIN_SPLITS.heldout.length
  },
  perSeed:records,
  warnings:[
    'Layouts are small deterministic one-step-affordance construction puzzles.',
    'Blueprint membership is explicitly encoded, so even untrained networks can solve some seeds.',
    'Scrambled labels are independently randomized by an LCG, not paired trajectories.',
    'There is no Minecraft execution, observer proof, autonomous item pickup or multi-biome evaluation.'
  ]
};
console.log(JSON.stringify(summary,null,2));
