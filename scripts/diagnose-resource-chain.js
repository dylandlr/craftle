// Entirely SYNTHETIC task calibration. Do not cite these simulated block
// changes or rewards as Minecraft execution, observer proof or real learning.
import {createMotorQPolicy} from '../src/motor-q-policy.js';
import {createResourceChainQ} from '../src/resource-chain-q.js';
import {scriptedResourcePlanner,CHAIN_SPLITS,chainTasks,
  CHAIN_GEOMETRY_VARIANTS} from '../src/motor-resource-chain.js';
import {syntheticEpisode} from '../src/resource-chain-simulator.js';

function randomGenerator(seed) {
  let s=seed>>>0;
  return () => {
    s=(Math.imul(s,1664525)+1013904223)>>>0;
    return s/4294967296;
  };
}
const runSeed=17;
const random=randomGenerator(3975);
const trials=400;
let plannerWins=0,randomWins=0;
for(let i=0;i<trials;i++){
  const rotation=CHAIN_SPLITS.heldout[i%2];
  const planner=syntheticEpisode(rotation,menu=>
    scriptedResourcePlanner(menu.observation,menu.candidates));
  const randomOutcome=syntheticEpisode(rotation,menu=>
    menu.candidates[Math.floor(random()*menu.candidates.length)]);
  plannerWins+=Number(planner.success);
  randomWins+=Number(randomOutcome.success);
}
const train=schedule=>chainTasks(schedule,{seed:runSeed,split:'train'});
const evalRotations=CHAIN_SPLITS.heldout;
const seeds=[17,23,41],results=[];
for(const seed of seeds){
  let model=createMotorQPolicy({seed,alpha:0.05,
    epsilon:0.35,hidden:24,training:true});
  const tasks=train(1000);
  for(const task of tasks){
    const nextSelection=(menu)=>
      model.choose(menu.observation,menu.candidates);
    syntheticEpisode(task.rotation,nextSelection,{
      update:t=>{
        model.observe({features:t.features,reward:t.reward,
          terminal:t.terminal,nextObservation:t.nextObservation,
          nextCandidates:t.nextCandidates,steps:1});
      }
    });
  }
  const frozen=createMotorQPolicy({seed,epsilon:0,
    hidden:24,snapshot:model.snapshot(),training:false});
  let won=0;
  for(let i=0;i<100;i++){
    const result=syntheticEpisode(evalRotations[i%2],
      menu=>frozen.choose(menu.observation,menu.candidates));
    won+=Number(result.success);
  }
  results.push({seed,trainedUpdates:model.stats().updates,
    heldoutSyntheticWins:won,heldoutSyntheticTrials:100,
    accuracy:won/100});
}
const episodicNeuralQ=[];
const uniformWarmupEpisodes=200;
for(const seed of seeds){
  const model=createResourceChainQ({seed,alpha:0.02,epsilon:0.4,
    gamma:0.95,replayPasses:6,replayCapacity:256});
  let trainWins=0;
  const learningStages=[];
  const trainingTasks=chainTasks(1000,{seed,split:'train'});
  for(let index=0;index<trainingTasks.length;index++){
    const task=trainingTasks[index];
    const warmup=index<uniformWarmupEpisodes;
    const outcome=syntheticEpisode(task.rotation,menu=>model.choose(
      menu.observation,menu.candidates,{
        epsilonOverride:warmup?1:null
      }),{afterEpisode:episode=>model.learnEpisode(episode)});
    trainWins+=Number(outcome.success);
    if([200,400,600,800,1000].includes(index+1)){
      const checkpoint=createResourceChainQ({seed,training:false,
        snapshot:model.snapshot(),epsilon:0});
      let correct=0;
      for(let evaluation=0;evaluation<20;evaluation++){
        const trial=syntheticEpisode(evalRotations[evaluation%2],
          menu=>checkpoint.choose(menu.observation,menu.candidates));
        correct+=Number(trial.success);
      }
      learningStages.push({episodes:index+1,
        heldoutSuccesses:correct,heldoutTrials:20});
    }
  }
  const frozen=createResourceChainQ({seed,training:false,
    snapshot:model.snapshot(),epsilon:0});
  let heldoutWins=0;
  for(let i=0;i<100;i++){
    const outcome=syntheticEpisode(evalRotations[i%2],menu=>
      frozen.choose(menu.observation,menu.candidates));
    heldoutWins+=Number(outcome.success);
  }
  const novelGeometries=[];
  // Same feature encoder and architecture, same seed, but NO updates.
  const untrained=createResourceChainQ({seed,training:false,epsilon:0});
  for(const variant of CHAIN_GEOMETRY_VARIANTS){
    for(const rotation of evalRotations){
      const test=syntheticEpisode(rotation,menu=>
        frozen.choose(menu.observation,menu.candidates),{variant});
      const planner=syntheticEpisode(rotation,menu=>
        scriptedResourcePlanner(menu.observation,menu.candidates),{variant});
      const noTraining=syntheticEpisode(rotation,menu=>
        untrained.choose(menu.observation,menu.candidates),{variant});
      novelGeometries.push({variant,rotation,
        neuralSuccess:test.success,plannerSuccess:planner.success,
        untrainedSameArchitectureSuccess:noTraining.success,
        neuralChoices:test.choices});
    }
  }
  episodicNeuralQ.push({seed,trainWins,trainTrials:1000,
    uniformWarmupEpisodes,learningStages,
    heldoutSyntheticWins:heldoutWins,heldoutSyntheticTrials:100,
    novelGeometryWins:novelGeometries.filter(x=>x.neuralSuccess).length,
    untrainedSameArchitectureNovelWins:novelGeometries.filter(
      x=>x.untrainedSameArchitectureSuccess).length,
    novelGeometryCount:novelGeometries.length,
    novelGeometries,
    trainedEpisodes:model.stats().episodes,gradientUpdates:model.stats().updates});
}
console.log(JSON.stringify({
  type:'SYNTHETIC_ONLY_NOT_MINECRAFT',
  task:'four required mutations with two executable distractors',
  stepsPerEpisode:4,
  random:{wins:randomWins,trials,rate:randomWins/trials},
  symbolicPlanner:{wins:plannerWins,trials,rate:plannerWins/trials},
  onlineNeuralQ:results,
  blueprintConditionedMonteCarloNeuralQ:episodicNeuralQ,
  notes:['Simulated inventory pickup is instantaneous; real drops may require movement.',
    'No server proof, no live weights, no claim of autonomous planning.',
    'The scripted planner and new neural Q observe identical public blueprint coordinates.',
    'The new MC neural learner uses terminal returns, success/failure replay and 200 uniform-random warmup episodes; no planner imitation.',
    'The 100 old holdout repetitions are only two layouts; novelGeometryCount reports ten distinct variant/rotation combinations.',
    'Four non-base geometry variants change source/destination/distractor positions and are never used for training.',
    'Untrained same-architecture policies use identical blueprint-conditioned features with no updates.']
},null,2));
