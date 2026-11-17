// Generate and validate isolated, FROZEN neural checkpoints trained only in
// Craftle's deterministic symbolic resource-chain simulator. No Minecraft
// action, reward, server event, or prior motor-v3 checkpoint is involved.
import {createHash} from 'node:crypto';
import {createResourceChainQ,RESOURCE_CHAIN_Q_SCHEMA}
  from './resource-chain-q.js';
import {syntheticEpisode} from './resource-chain-simulator.js';
import {chainTasks,CHAIN_SPLITS,CHAIN_GEOMETRY_VARIANTS}
  from './motor-resource-chain.js';

export const CHAIN_OFFLINE_CHECKPOINT_SCHEMA=
  'craftle.resource-chain-offline-frozen-policy.v1';

const digest=payload=>createHash('sha256')
  .update(JSON.stringify(payload)).digest('hex');

export function buildResourceChainOfflineCheckpoint({
  mode='trained',seed=17,episodes=600,sourceHashes={}
}={}){
  if(!['trained','untrained'].includes(mode)||
    !Number.isSafeInteger(seed)||seed<0||
    !Number.isSafeInteger(episodes)||episodes<200||
    episodes>1000||episodes%2!==0||
    !sourceHashes||typeof sourceHashes!=='object'||
    Array.isArray(sourceHashes)||
    Object.values(sourceHashes).some(s=>typeof s!=='string'||
      !/^[a-f0-9]{64}$/.test(s)))
    throw Error('Invalid offline checkpoint configuration');
  const trainSpec={
    source:'SYNTHETIC_ONLY_NOT_MINECRAFT',
    trainRotations:[...CHAIN_SPLITS.train],
    trainGeometry:'base',seed,episodes:mode==='trained'?episodes:0,
    explorationWarmup:mode==='trained'?200:0,
    learner:'neural Monte Carlo terminal returns',
    alpha:0.02,gamma:0.95,epsilon:0.4,
    replayPasses:6,replayCapacity:256,
    plannerDemonstrations:0,liveLearningUpdates:0
  };
  const q=createResourceChainQ({
    seed,hidden:24,alpha:0.02,gamma:0.95,
    epsilon:0.4,replayPasses:6,replayCapacity:256,
    training:mode==='trained'
  });
  let trainSuccesses=0;
  if(mode==='trained'){
    const tasks=chainTasks(episodes,{seed,split:'train'});
    for(let i=0;i<tasks.length;i++){
      const result=syntheticEpisode(tasks[i].rotation,menu=>
        q.choose(menu.observation,menu.candidates,{
          epsilonOverride:i<200?1:null
        }),{afterEpisode:trajectory=>q.learnEpisode(trajectory)});
      trainSuccesses+=Number(result.success);
    }
  }
  const trainedSnapshot=q.snapshot();
  const frozen=createResourceChainQ({
    seed,hidden:24,training:false,epsilon:0,
    snapshot:trainedSnapshot
  });
  const heldout=[];
  for(const variant of CHAIN_GEOMETRY_VARIANTS){
    for(const rotation of CHAIN_SPLITS.heldout){
      const result=syntheticEpisode(rotation,menu=>
        frozen.choose(menu.observation,menu.candidates),{variant});
      heldout.push({variant,rotation,success:result.success});
    }
  }
  const payload={
    schema:CHAIN_OFFLINE_CHECKPOINT_SCHEMA,
    policy:mode==='trained'?'frozen_neural_synthetic_pretrained':
      'frozen_neural_untrained_control',
    mode,
    training:trainSpec,
    model:trainedSnapshot,
    validation:{
      source:'SYNTHETIC_ONLY',
      trainSuccesses,
      heldoutRotations:[...CHAIN_SPLITS.heldout],
      physicalLayouts:heldout.length,
      successes:heldout.filter(r=>r.success).length,
      heldout
    },
    sourceHashes:{...sourceHashes},
    liveEvidence:'NONE',
    immutableDuringLiveRun:true
  };
  return {schema:'craftle.integrity-envelope.v1',
    sha256:digest(payload),payload};
}

export function loadResourceChainOfflineCheckpoint(envelope,{
  requireSourceHashes=null
}={}){
  if(envelope?.schema!=='craftle.integrity-envelope.v1'||
    !envelope.payload||
    envelope.sha256!==digest(envelope.payload))
    throw Error('Offline checkpoint integrity mismatch');
  const p=envelope.payload;
  if(p.schema!==CHAIN_OFFLINE_CHECKPOINT_SCHEMA||
    !['trained','untrained'].includes(p.mode)||
    !Number.isSafeInteger(p.training?.seed)||
    p.training.seed<0||
    p.training.source!=='SYNTHETIC_ONLY_NOT_MINECRAFT'||
    p.training.plannerDemonstrations!==0||
    p.training.liveLearningUpdates!==0||
    JSON.stringify(p.training.trainRotations)!==JSON.stringify(CHAIN_SPLITS.train)||
    p.training.trainGeometry!=='base'||
    p.validation?.source!=='SYNTHETIC_ONLY'||
    p.validation?.physicalLayouts!==10||
    !Array.isArray(p.validation?.heldout)||
    p.validation.heldout.length!==10||
    !Number.isSafeInteger(p.validation.successes)||
    p.validation.successes<0||p.validation.successes>10||
    p.validation.successes!==p.validation.heldout.filter(r=>r.success).length||
    !p.immutableDuringLiveRun||p.liveEvidence!=='NONE'||
    p.model?.schema!==RESOURCE_CHAIN_Q_SCHEMA)
    throw Error('Invalid frozen policy provenance or evaluation metadata');
  if(p.mode==='trained'){
    if(p.policy!=='frozen_neural_synthetic_pretrained'||
      p.training.episodes<200||p.training.episodes>1000||
      p.model.episodes!==p.training.episodes||
      p.model.updates!==(1+p.training.replayPasses)*4*p.training.episodes)
      throw Error('Trained policy update history inconsistent with provenance');
  }else if(p.policy!=='frozen_neural_untrained_control'||
    p.training.episodes!==0||p.model.episodes!==0||p.model.updates!==0)
    throw Error('Untrained policy has nonzero updates');
  if(requireSourceHashes){
    if(!p.sourceHashes||Object.entries(requireSourceHashes).some(([file,hash])=>
      !/^[a-f0-9]{64}$/.test(hash)||p.sourceHashes[file]!==hash))
      throw Error('Offline checkpoint source hash mismatch');
  }
  const frozen=createResourceChainQ({
    seed:p.training.seed,hidden:24,training:false,
    epsilon:0,snapshot:p.model
  });
  if(frozen.stats().training!==false)
    throw Error('Loaded policy is not frozen');
  return {policy:frozen,metadata:p,sha256:envelope.sha256};
}
