// Explicitly PLANNER-ASSISTED comparison. Search demonstrations are generated
// from generic legal motor actions, never from a hand-coded construction recipe.
// Does NOT establish unassisted emergence or real Minecraft competence.
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import {searchMutableTerrain} from '../src/mutable-terrain-search-control.js';
import {createMotorQPolicy,encodeMotorCandidate} from '../src/motor-q-policy.js';
const demonstrationCount=Number(process.argv[2]??12);
const imitationPasses=Number(process.argv[3]??100);
if(!Number.isInteger(demonstrationCount)||demonstrationCount<3||demonstrationCount>90||
 !Number.isInteger(imitationPasses)||imitationPasses<1||imitationPasses>500)
 throw Error('Invalid benchmark parameters');
const construct=({seed,span=3,layout='chasm',limit=30,chasmDirection='east'})=>
 createMutableTerrain({seed,span,layout,chasmDirection,platformHeight:4+seed%3,
  initialBlocks:span+3,maxSteps:limit});
function collectDemo(seed){
 const world=construct({seed});
 const control=searchMutableTerrain(world,{depth:8,beamWidth:36,maxCandidates:150});
 if(!control.solved)return {solved:false,seed,expanded:control.expanded};
 const samples=[],replay=world.fork();
 for(const step of control.trace){
  const state=replay.observe(),candidates=replay.affordances();
  const chosen=candidates.find(c=>c.operation===step.operation&&
   JSON.stringify(c.arguments)===JSON.stringify(step.args));
  if(!chosen)throw Error('Search proposed unavailable action');
  const sample={positiveFeatures:encodeMotorCandidate(state,chosen),
   negativeFeatures:candidates.filter(c=>c.id!==chosen.id)
    .map(c=>encodeMotorCandidate(state,c)),
   operation:step.operation};
  samples.push(sample);
  const out=replay.act(chosen);if(!out.ok)throw Error('Search replay failed');
 }
 if(!replay.snapshot().done||replay.snapshot().health<=0)
  throw Error('Planner demo did not reach a living terminal state');
 return {solved:true,seed,samples,expanded:control.expanded,
  length:control.trace.length,operations:control.trace.map(e=>e.operation)};
}
const records=Array.from({length:demonstrationCount},(_,i)=>collectDemo(100+i));
const solved=records.filter(r=>r.solved),samples=solved.flatMap(r=>r.samples);
if(!samples.length)throw Error('No solvable generic search examples');
const assisted=createMotorQPolicy({seed:17,epsilon:0,alpha:0.004});
let marginUpdates=0;
for(let epoch=0;epoch<imitationPasses;epoch++){
 // Deterministic rotated sample order, independent of evaluation episodes.
 for(let i=0;i<samples.length;i++){
  const s=samples[(i+epoch*13)%samples.length];
  marginUpdates+=Number(assisted.imitate(s).updated);
 }
}
const frozen=createMotorQPolicy({seed:71,epsilon:0,training:false,
 snapshot:assisted.snapshot()});
function evaluate(policy,{seed,span=3,allowPlace=true,chasmDirection='east'}={}){
 const w=construct({seed,span,chasmDirection});
 const operations={};const trace=[];let placed=0,dug=0;
 while(!w.snapshot().done){
  const state=w.observe(),candidates=w.affordances()
   .filter(c=>allowPlace||c.operation!=='place');
  const chosen=policy.choose(state,candidates).candidate;
  if(!chosen)break;
  const out=w.act(chosen);
  operations[chosen.operation]=(operations[chosen.operation]??0)+1;
  placed+=Number(out.ok&&chosen.operation==='place');
  dug+=Number(out.ok&&chosen.operation==='dig');
  if(trace.length<30)trace.push({operation:chosen.operation,
   args:chosen.arguments,change:out.change,after:out.after,damage:out.damage});
 }
 const s=w.snapshot();
 const along=chasmDirection==='east'?s.position.x:chasmDirection==='west'?-s.position.x:
  chasmDirection==='north'?-s.position.z:s.position.z;
 const across=chasmDirection==='east'||chasmDirection==='west'?s.position.z:s.position.x;
 return {seed,span,allowPlace,chasmDirection,success:s.done&&s.health>0&&
  along>=span&&Math.abs(across)<=1&&s.position.y===s.goal.y,
  health:s.health,steps:s.steps,placed,dug,operations,trace};
}
const heldoutSeeds=Array.from({length:18},(_,i)=>5001+i);
const results={assisted:[],withoutPlace:[],untrained:[],outOfDistribution:[],
 rotatedWest:[],rotatedNorth:[],rotatedSouth:[],rotatedWithoutPlace:[]};
const untrained=createMotorQPolicy({seed:17,epsilon:0,training:false});
for(const seed of heldoutSeeds){
 results.assisted.push(evaluate(frozen,{seed}));
 results.withoutPlace.push(evaluate(frozen,{seed,allowPlace:false}));
 results.untrained.push(evaluate(untrained,{seed}));
 results.outOfDistribution.push(evaluate(frozen,{seed,span:4}));
 results.rotatedWest.push(evaluate(frozen,{seed,chasmDirection:'west'}));
 results.rotatedNorth.push(evaluate(frozen,{seed,chasmDirection:'north'}));
 results.rotatedSouth.push(evaluate(frozen,{seed,chasmDirection:'south'}));
 results.rotatedWithoutPlace.push(evaluate(frozen,{seed,chasmDirection:'west',allowPlace:false}));
}
const summary=(label,rows)=>({label,n:rows.length,
 successes:rows.filter(x=>x.success).length,
 successRate:rows.filter(x=>x.success).length/rows.length,
 meanSteps:rows.reduce((s,r)=>s+r.steps,0)/rows.length,
 meanPlaced:rows.reduce((s,r)=>s+r.placed,0)/rows.length,
 actions:rows.reduce((sum,r)=>{for(const [k,v] of Object.entries(r.operations))
  sum[k]=(sum[k]??0)+v;return sum;}, {})});
console.log(JSON.stringify({
 schema:'craftle.planning-assisted-motor-comparison.v1',
 synthetic:true,realMinecraft:false,
 method:'pairwise_imitation_of_generic_search_trajectories',
 demonstrationCount,solvedDemonstrations:solved.length,
 meanDemonstrationLength:solved.reduce((s,r)=>s+r.length,0)/solved.length,
 imitationPasses,marginUpdates,parameterUpdates:assisted.stats().updates,
 evaluation:Object.entries(results).map(([label,rows])=>summary(label,rows)),
 examples:results.assisted.filter(r=>r.success).slice(0,2)
  .map(r=>({seed:r.seed,trace:r.trace})),
 failedExamples:results.assisted.filter(r=>!r.success).slice(0,1)
  .map(r=>({seed:r.seed,trace:r.trace})),
 caveats:['Planner demonstrations have privileged access to forkable simulation.',
 'This is assisted learning, not independently discovered construction.',
 'The generic search planner is not wired to the Minecraft agent.',
 'Held-out seeds use the same small chasm family; span 4 is a limited shift.',
 'Rotated evaluation changes direction but does not alter training examples.',
 'Successful motor controls do not establish physical Minecraft competence.']
},null,2));
