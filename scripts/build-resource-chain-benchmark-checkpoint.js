// Generates frozen offline checkpoints for a PRE-REGISTERED seed cohort.
 // Exact same network/training procedure as the successful pilot, but
 // records all 0..10 synthetic holdout outcomes instead of selecting 10/10.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CHAIN_BENCHMARK_SEEDS,CHAIN_BENCHMARK_EPISODES}
  from '../src/resource-chain-benchmark-plan.js';
import {
  buildResourceChainOfflineCheckpoint,
  loadResourceChainOfflineCheckpoint
} from '../src/resource-chain-offline-checkpoint.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args={};
for(let i=2;i<process.argv.length;i+=2){
  if(!process.argv[i]?.startsWith('--')||process.argv[i+1]===undefined)
    throw Error('Usage: --mode trained|untrained --seed N --episodes N --self-test true|false');
  const key=process.argv[i].slice(2);
  if(Object.hasOwn(args,key))throw Error('Duplicate --'+key);
  args[key]=process.argv[i+1];
}
if(!Object.keys(args).every(k=>[
  'mode','seed','episodes','self-test','benchmark'
].includes(k)))throw Error('Unknown option');
if(args['self-test']!==undefined&&!['true','false'].includes(args['self-test']))
  throw Error('Invalid --self-test flag');
if(args.benchmark!=='true')
  throw Error('Explicit --benchmark true is required');
const mode=args.mode;
const seed=Number(args.seed),episodes=Number(args.episodes);
if(!['trained','untrained'].includes(mode)||
  !CHAIN_BENCHMARK_SEEDS.includes(seed)||
  episodes!==CHAIN_BENCHMARK_EPISODES)
  throw Error('Mode, seed or episodes violates pre-registered protocol');
const names=[
  'src/motor-resource-chain.js',
  'src/resource-chain-q.js',
  'src/resource-chain-simulator.js',
  'src/resource-chain-offline-checkpoint.js'
];
const hashes=Object.fromEntries(names.map(name=>[
  name,createHash('sha256').update(fs.readFileSync(
    path.join(root,name))).digest('hex')
]));
const envelope=buildResourceChainOfflineCheckpoint({
  mode,seed,episodes,sourceHashes:hashes
});
const loaded=loadResourceChainOfflineCheckpoint(envelope,{
  requireSourceHashes:hashes
});
if(loaded.policy.stats().training!==false)
  throw Error('Checkpoint is not frozen');
// Intention-to-evaluate: a trained policy scoring 0/10 is *still eligible*
 // for Minecraft evaluation. Synthetic validation is logged, not used to
 // choose checkpoints or silently exclude seeds.
const report={
  checkpointSchema:loaded.metadata.schema,
  type:'SYNTHETIC_ONLY_NOT_MINECRAFT',
  mode,seed,trainingEpisodes:loaded.metadata.training.episodes,
  totalOfflineWeightUpdates:loaded.metadata.model.updates,
  novelLayoutSuccesses:loaded.metadata.validation.successes,
  novelLayoutTrials:loaded.metadata.validation.physicalLayouts,
  protocol:'pre_registered_multiseed_no_holdout_success_filter',
  sha256:loaded.sha256,
  liveLearningUpdates:0,createdFile:false
};
if(args['self-test']==='true'){
  console.log(JSON.stringify({...report,selfTest:'passed'},null,2));
  process.exit(0);
}
const base=path.join(root,'recordings/resource-chain-offline-checkpoints');
fs.mkdirSync(base,{recursive:true});
const target=path.join(base,
  'chain-'+mode+'-seed'+seed+'-'+(mode==='trained'?episodes:0)+'.json');
const fd=fs.openSync(target,'wx');
try{
  fs.writeFileSync(fd,JSON.stringify(envelope,null,2)+'\n');
  fs.fsyncSync(fd);
}finally{
  fs.closeSync(fd);
}
const reread=JSON.parse(fs.readFileSync(target,'utf8'));
loadResourceChainOfflineCheckpoint(reread,{requireSourceHashes:hashes});
console.log(JSON.stringify({...report,createdFile:true,checkpointPath:target},null,2));
