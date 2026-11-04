// Constructive navigation challenge without a hand-authored construction policy.
// Separate from the easier finite-floor benchmark; read results as synthetic only.
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import {createMotorQPolicy} from '../src/motor-q-policy.js';
const episodes=Number(process.argv[2]??30),limit=Number(process.argv[3]??60);
if(!Number.isInteger(episodes)||episodes<2||episodes>200||
 !Number.isInteger(limit)||limit<10||limit>200)throw Error('Invalid benchmark limits');
function episode({policy=null,seed,train=false,allowPlace=true,layout='chasm'}){
 const span=3+(seed%2),height=4+(seed%3);
 const world=createMutableTerrain({layout,span,platformHeight:height,
  initialBlocks:span+2,maxSteps:limit,seed});
 let rng=(seed*5923+11)>>>0;
 const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
 let placed=0,dug=0,fallDamage=0,invalid=0,success=false;
 const trace=[];
 while(!world.snapshot().done){
  const state=world.observe();
  const candidates=world.affordances().filter(a=>allowPlace||a.operation!=='place');
  const chosen=policy?policy.choose(state,candidates):
   {candidate:candidates[Math.floor(random()*candidates.length)]};
  if(!chosen.candidate)break;
  const result=world.act(chosen.candidate);
  if(trace.length<limit)trace.push({op:chosen.candidate.operation,
   args:chosen.candidate.arguments,change:result.change,
   position:result.after,damage:result.damage,ok:result.ok,
   success:result.reachedLowerGround});
  const next=world.observe();
  const nextCandidates=world.affordances().filter(a=>allowPlace||a.operation!=='place');
  if(policy&&train)policy.observe({features:chosen.features,reward:result.reward,
   nextObservation:next,nextCandidates,terminal:result.done});
  placed+=Number(result.ok&&result.action==='place');
  dug+=Number(result.ok&&result.action==='dig');
  fallDamage+=result.damage;invalid+=Number(!result.ok);
  success ||=result.reachedLowerGround;
 }
 return {seed,success,steps:world.snapshot().steps,placed,dug,fallDamage,invalid,trace};
}
function summary(label,records){
 const avg=k=>Number((records.reduce((s,r)=>s+r[k],0)/records.length).toFixed(3));
 return {label,n:records.length,successRate:avg('success'),meanSteps:avg('steps'),
  meanPlaced:avg('placed'),meanDug:avg('dug'),
  meanFallDamage:avg('fallDamage'),meanInvalid:avg('invalid')};
}
const learner=createMotorQPolicy({seed:41,epsilon:0.35});
const training=[];
for(let i=0;i<episodes;i++)for(const offset of [0,1,2,3])
 training.push(episode({policy:learner,train:true,seed:41+i*4+offset}));
const frozen=createMotorQPolicy({snapshot:learner.snapshot(),training:false,epsilon:0});
const controls={random:[],randomNoPlace:[],frozen:[],frozenNoPlace:[],easyReference:[]};
for(let seed=10001;seed<10021;seed++){
 controls.random.push(episode({seed}));
 controls.randomNoPlace.push(episode({seed,allowPlace:false}));
 controls.frozen.push(episode({seed,policy:frozen}));
 controls.frozenNoPlace.push(episode({seed,policy:frozen,allowPlace:false}));
 controls.easyReference.push(episode({seed,policy:frozen,layout:'isolated'}));
}
console.log(JSON.stringify({
 schema:'craftle.constructive-navigation-benchmark.v1',synthetic:true,
 realMinecraft:false,trainingEpisodes:training.length,updates:learner.stats().updates,
 training:summary('train_chasm',training),
 evaluation:Object.entries(controls).map(([name,records])=>summary(name,records)),
 safeguards:['No high-level building/digging solutions in the action space',
  'Placement-disabled control checks necessity of construction',
  'Held-out evaluation seeds separate from training seeds',
  'Frozen policy receives no evaluation updates'],
 limitations:['Synthetic discrete physics is not Minecraft',
  'Sparse reward may prevent any policy discovering construction',
  'Training and evaluation still share chasm generator family']
},null,2));
