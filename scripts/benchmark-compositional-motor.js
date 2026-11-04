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
const construct=({seed,span=3,layout='chasm',limit=30,chasmDirection='east',goalObstructed=false,initialBlocks=null})=>
 createMutableTerrain({seed,span,layout,chasmDirection,goalObstructed,platformHeight:4+seed%3,
  initialBlocks:initialBlocks??span+3,maxSteps:limit});
function collectDemo(seed,goalObstructed=false){
 const world=construct({seed,goalObstructed});
 const control=searchMutableTerrain(world,{depth:8,beamWidth:36,maxCandidates:150});
 if(!control.solved)return {solved:false,seed,goalObstructed,expanded:control.expanded};
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
 return {solved:true,seed,goalObstructed,samples,expanded:control.expanded,
  length:control.trace.length,operations:control.trace.map(e=>e.operation)};
}
const openRecords=Array.from({length:demonstrationCount},(_,i)=>collectDemo(100+i));
const obstacleRecords=Array.from({length:demonstrationCount},(_,i)=>collectDemo(200+i,true));
const openSolved=openRecords.filter(r=>r.solved);
const obstacleSolved=obstacleRecords.filter(r=>r.solved);
function train(records){
 const solved=records.filter(r=>r.solved),samples=solved.flatMap(r=>r.samples);
 if(!samples.length)throw Error('No solvable generic search examples');
 const policy=createMotorQPolicy({seed:17,epsilon:0,alpha:0.004});
 let marginUpdates=0;
 for(let epoch=0;epoch<imitationPasses;epoch++)
  for(let i=0;i<samples.length;i++){
   const sample=samples[(i+epoch*13)%samples.length];
   marginUpdates+=Number(policy.imitate(sample).updated);
  }
 return {policy:createMotorQPolicy({seed:71,epsilon:0,training:false,
   snapshot:policy.snapshot()}),updates:policy.stats().updates,marginUpdates};
}
const baseline=train(openRecords);
const mixed=train([...openRecords,...obstacleRecords]);
function evaluate(policy,{seed,span=3,allowPlace=true,allowDig=true,
 chasmDirection='east',goalObstructed=false,initialBlocks=null}={}){
 const w=construct({seed,span,chasmDirection,goalObstructed,initialBlocks});
 const operations={};const trace=[];let placed=0,dug=0;
 while(!w.snapshot().done){
  const state=w.observe(),candidates=w.affordances()
   .filter(c=>(allowPlace||c.operation!=='place')&&
    (allowDig||c.operation!=='dig'));
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
 return {seed,span,allowPlace,allowDig,chasmDirection,goalObstructed,success:s.done&&s.health>0&&
  along>=span&&Math.abs(across)<=1&&s.position.y===s.goal.y,
  health:s.health,steps:s.steps,placed,dug,operations,trace};
}
const heldoutSeeds=Array.from({length:18},(_,i)=>5001+i);
const configs=[
 {label:'openEast',args:{}},
 {label:'openWest',args:{chasmDirection:'west'}},
 {label:'openNorth',args:{chasmDirection:'north'}},
 {label:'openSouth',args:{chasmDirection:'south'}},
 {label:'openScarce',args:{initialBlocks:1}},
 {label:'obstructedEast',args:{goalObstructed:true}},
 {label:'obstructedWest',args:{goalObstructed:true,chasmDirection:'west'}},
 {label:'obstructedNorth',args:{goalObstructed:true,chasmDirection:'north'}},
 {label:'obstructedSouth',args:{goalObstructed:true,chasmDirection:'south'}},
 {label:'obstructedWithoutDig',args:{goalObstructed:true,allowDig:false}},
 {label:'obstructedWithoutPlace',args:{goalObstructed:true,allowPlace:false}}
];
const summary=(label,records)=>({
 label,runs:records.length,
 successes:records.filter(r=>r.success).length,
 successRate:records.filter(r=>r.success).length/records.length,
 meanSteps:records.reduce((s,r)=>s+r.steps,0)/records.length,
 meanPlaced:records.reduce((s,r)=>s+r.placed,0)/records.length,
 meanDug:records.reduce((s,r)=>s+r.dug,0)/records.length,
 actionCounts:records.reduce((sum,r)=>{
  for(const [k,v] of Object.entries(r.operations))sum[k]=(sum[k]??0)+v;
  return sum;
 },{})
});
const evaluations=[];
const examples={};
for(const [arm,trained] of [['east_only',baseline],['mixed_search',mixed]]){
 for(const {label,args} of configs){
  const records=heldoutSeeds.map(seed=>evaluate(trained.policy,{seed,...args}));
  evaluations.push({arm,...summary(label,records)});
  if(['obstructedEast','obstructedWest','openEast'].includes(label))
   examples[arm+'_'+label]={
    success:records.find(r=>r.success)?.trace??null,
    failure:records.find(r=>!r.success)?.trace?.slice(0,12)??null
   };
 }
}
console.log(JSON.stringify({
 schema:'craftle.compositional-planning-assisted.v1',
 synthetic:true,realMinecraft:false,plannerAssisted:true,
 demonstrationCountPerType:demonstrationCount,imitationPasses,
 teacherCoverage:{
  open:{requested:openRecords.length,solved:openSolved.length,
   operations:openSolved.flatMap(r=>r.operations).reduce((a,k)=>(a[k]=(a[k]??0)+1,a),{})},
  obstructed:{requested:obstacleRecords.length,solved:obstacleSolved.length,
   operations:obstacleSolved.flatMap(r=>r.operations).reduce((a,k)=>(a[k]=(a[k]??0)+1,a),{})}
 },
 policyUpdates:{east_only:baseline.updates,mixed_search:mixed.updates},
 evaluations,examples,
 caveats:[
  'Both models train from privileged simulator search-generated examples.',
  'Only eastward worlds are demonstrated; rotated outcomes are held out.',
  'Mixed model sees obstacle worlds during teaching; success is not independent discovery.',
  'No changes to live Turesla or its original DQN checkpoint.',
  'Synthetic toy terrain does not establish real Minecraft feasibility.'
 ]
},null,2));
