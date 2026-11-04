// Explicitly PLANNER-ASSISTED comparison. Search demonstrations are generated
// from generic legal motor actions, never from a hand-coded construction recipe.
// Does NOT establish unassisted emergence or real Minecraft competence.
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import {searchMutableTerrain} from '../src/mutable-terrain-search-control.js';
import {createMotorQPolicy,encodeMotorCandidate} from '../src/motor-q-policy.js';
import {compareCandidateMenus} from '../src/motor-counterfactual-audit.js';
const demonstrationCount=Number(process.argv[2]??12);
const imitationPasses=Number(process.argv[3]??100);
if(!Number.isInteger(demonstrationCount)||demonstrationCount<3||demonstrationCount>90||
 !Number.isInteger(imitationPasses)||imitationPasses<1||imitationPasses>500)
 throw Error('Invalid benchmark parameters');
const construct=({seed,span=3,layout='chasm',limit=30,chasmDirection='east',goalObstructed=false,obstacleDepth=1,obstacleOffset=0,initialBlocks=null})=>
 createMutableTerrain({seed,span,layout,chasmDirection,goalObstructed,obstacleDepth,
  obstacleOffset,platformHeight:4+seed%3,
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
 chasmDirection='east',goalObstructed=false,obstacleDepth=1,obstacleOffset=0,
 initialBlocks=null}={}){
 const w=construct({seed,span,chasmDirection,goalObstructed,obstacleDepth,
  obstacleOffset,initialBlocks});
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
 return {seed,span,allowPlace,allowDig,chasmDirection,goalObstructed,obstacleDepth,
  obstacleOffset,
  success:s.done&&s.health>0&&
  along>=span+(goalObstructed?obstacleOffset+obstacleDepth-1:0)&&
  Math.abs(across)<=1&&s.position.y===s.goal.y,
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
 {label:'obstructedWithoutPlace',args:{goalObstructed:true,allowPlace:false}},
 {label:'twoLayerBarrierEast',args:{goalObstructed:true,obstacleDepth:2}},
 {label:'twoLayerBarrierWest',args:{goalObstructed:true,obstacleDepth:2,chasmDirection:'west'}},
 {label:'threeLayerBarrierNorth',args:{goalObstructed:true,obstacleDepth:3,chasmDirection:'north'}},
 {label:'threeLayerBarrierNoDig',args:{goalObstructed:true,obstacleDepth:3,allowDig:false}},
 {label:'delayedBarrierEast',args:{goalObstructed:true,obstacleOffset:1}},
 {label:'delayedBarrierWest',args:{goalObstructed:true,obstacleOffset:2,chasmDirection:'west'}},
 {label:'delayedBarrierNorth',args:{goalObstructed:true,obstacleOffset:2,chasmDirection:'north'}},
 {label:'delayedBarrierNoDig',args:{goalObstructed:true,obstacleOffset:2,allowDig:false}},
 {label:'delayedTwoLayerSouth',args:{goalObstructed:true,obstacleDepth:2,
  obstacleOffset:2,chasmDirection:'south'}}
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
  if(['obstructedEast','obstructedWest','openEast','twoLayerBarrierEast',
   'threeLayerBarrierNorth','delayedBarrierWest','delayedTwoLayerSouth'].includes(label))
   examples[arm+'_'+label]={
    success:records.find(r=>r.success)?.trace??null,
    failure:records.find(r=>!r.success)?.trace?.slice(0,12)??null
   };
 }
}
// Matched-state counterfactual: identical state, action horizon, inventory,
// goal and coordinates; only the obstructing cell at the next step changes.
// The intervention is evaluation-only and is NOT included in policy training.
function counterfactualTrial(policy,{seed,chasmDirection}){
 const world=construct({seed,chasmDirection,goalObstructed:true});
 const goal=world.snapshot().goal;
 const dx=Math.sign(goal.x),dz=Math.sign(goal.z);
 const advance=()=>world.affordances().find(c=>c.operation==='move'&&
  c.arguments.dx===dx&&c.arguments.dz===dz);
 const first=world.act(advance());
 if(!first.ok)throw Error('Counterfactual setup failed: initial move');
 const q={x:2*dx,y:world.snapshot().position.y-1,z:2*dz};
 const support=world.affordances().find(c=>c.operation==='place'&&
  c.evidence.destination.x===q.x&&
  c.evidence.destination.y===q.y&&c.evidence.destination.z===q.z);
 if(!support||!world.act(support).ok)throw Error('Counterfactual setup failed: support');
 if(!world.act(advance()).ok)throw Error('Counterfactual setup failed: second move');
 const blocked=world.fork(),clear=world.fork();
 const blocker=goal.x+','+goal.y+','+goal.z;
 if(blocked.blockAt(goal.x,goal.y,goal.z).name!=='stone')
  throw Error('Counterfactual setup missing obstruction');
 clear.world.delete(blocker);
 if(clear.blockAt(goal.x,goal.y,goal.z).name!=='air')
  throw Error('Counterfactual intervention did not clear obstacle');
 const assess=w=>{
  const obs=w.observe(),candidates=w.affordances();
  const scores=policy.scoreCandidates(obs,candidates);
  const chosen=policy.choose(obs,candidates).candidate;
  if(!chosen)throw Error('No executable counterfactual candidate');
  return {chosenOperation:chosen.operation,chosenArguments:chosen.arguments,
   bestMoveQ:Math.max(-Infinity,...scores.filter(s=>s.operation==='move').map(s=>s.q)),
   bestDigQ:Math.max(-Infinity,...scores.filter(s=>s.operation==='dig').map(s=>s.q)),
   candidateCount:scores.length,scores,
   nextCell:w.blockAt(goal.x,goal.y,goal.z).name,
   position:obs.position,goal:obs.goal};
 };
 const a=assess(blocked),b=assess(clear);
 if(JSON.stringify(a.position)!==JSON.stringify(b.position)||
  JSON.stringify(a.goal)!==JSON.stringify(b.goal)||
  JSON.stringify(blocked.snapshot().inventory)!==JSON.stringify(clear.snapshot().inventory))
  throw Error('Counterfactual pair was not matched');
 const comparison=compareCandidateMenus(a.scores,b.scores);
 // Controlled perception intervention: do not regenerate the action menu.
 // Both scores use the *same executable candidate objects* from the blocked
 // world; only the returned block at the targeted cell is counterfactually air.
 const fixedCandidates=blocked.affordances();
 const originalObservation=blocked.observe();
 const originalBlockAt=originalObservation.blockAt;
 const maskedObservation={...originalObservation,
  blockAt:(x,y,z)=>x===goal.x&&y===goal.y&&z===goal.z?
   {name:'air',boundingBox:'empty'}:originalBlockAt(x,y,z)};
 const fixedBlocked=policy.scoreCandidates(originalObservation,fixedCandidates);
 const fixedClearPerception=policy.scoreCandidates(maskedObservation,fixedCandidates);
 if(fixedBlocked.length!==fixedClearPerception.length)
  throw Error('Fixed-menu perception intervention changed candidate set');
 const fixedPairs=fixedBlocked.map((row,i)=>({
  id:row.id,operation:row.operation,
  blockedQ:row.q,clearPerceptionQ:fixedClearPerception[i].q,
  deltaQ:fixedClearPerception[i].q-row.q}));
 const preferred=rows=>rows.reduce((best,row)=>!best||row.q>best.q?row:best,null);
 const originalTop=preferred(fixedBlocked);
 const maskedTop=preferred(fixedClearPerception);
 const forwardMove=fixedPairs.find(row=>row.id===advance()?.id);
 // Avoid evaluating the source environment by calling advance() here: the
 // world is a predecessor of both forks and remains unchanged.
 const perceptionIntervention={
  candidateCount:fixedCandidates.length,
  originalPreferred:originalTop?.operation??null,
  maskedPreferred:maskedTop?.operation??null,
  preferredSwitch:originalTop?.id!==maskedTop?.id,
  forwardMoveDeltaQ:forwardMove?.deltaQ??null,
  maxAbsoluteDeltaQ:Math.max(0,...fixedPairs.map(row=>Math.abs(row.deltaQ))),
  changedCandidateScores:fixedPairs.filter(row=>Math.abs(row.deltaQ)>1e-10).length
 };
 const {scores:blockedScores,...blockedSummary}=a;
 const {scores:clearScores,...clearSummary}=b;
 return {seed,chasmDirection,blocked:blockedSummary,clear:clearSummary,
  perceptionIntervention,
  comparison:{...comparison,sharedDeltas:comparison.sharedDeltas
   .filter(d=>Math.abs(d.deltaQ)>1e-10).slice(0,8)},
  responsive:a.chosenOperation==='dig'&&b.chosenOperation==='move'};
}
const counterfactualPairs=[];
for(const [arm,trained] of [['east_only',baseline],['mixed_search',mixed]])
 for(const direction of ['east','west','north','south'])
  for(const seed of heldoutSeeds.slice(0,6))
   counterfactualPairs.push({arm,...counterfactualTrial(trained.policy,{
    seed,chasmDirection:direction})});
const counterfactualSummary=['east_only','mixed_search'].map(arm=>{
 const pairs=counterfactualPairs.filter(x=>x.arm===arm);
 return {arm,pairs:pairs.length,responsive:pairs.filter(x=>x.responsive).length,
  blockedDig:pairs.filter(x=>x.blocked.chosenOperation==='dig').length,
  clearMove:pairs.filter(x=>x.clear.chosenOperation==='move').length,
  sharedMenuSwitches:pairs.filter(x=>x.comparison.sharedMenuSwitch).length,
  anySharedScoreChange:pairs.filter(x=>x.comparison.changedSharedScores>0).length,
  meanSharedActions:pairs.reduce((s,x)=>s+x.comparison.sharedCount,0)/pairs.length,
  meanOnlyBlocked:pairs.reduce((s,x)=>s+x.comparison.onlyBlockedCount,0)/pairs.length,
  meanOnlyClear:pairs.reduce((s,x)=>s+x.comparison.onlyClearCount,0)/pairs.length,
  fixedMenuPreferenceSwitches:pairs.filter(x=>x.perceptionIntervention.preferredSwitch).length,
  meanForwardPerceptionDeltaQ:pairs.reduce((s,x)=>s+(x.perceptionIntervention.forwardMoveDeltaQ??0),0)/pairs.length,
  meanFixedMenuChangedScores:pairs.reduce((s,x)=>s+x.perceptionIntervention.changedCandidateScores,0)/pairs.length};
});
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
 counterfactualSummary,counterfactualExamples:counterfactualPairs.filter(x=>x.seed===5001),
 caveats:[
  'Both models train from privileged simulator search-generated examples.',
  'Only eastward worlds are demonstrated; rotated outcomes are held out.',
  'Mixed model sees obstacle worlds during teaching; success is not independent discovery.',
  'No changes to live Turesla or its original DQN checkpoint.',
  'Multi-layer barrier depths 2 and 3 are completely excluded from teacher examples.',
  'Delayed barrier offsets 1 and 2 are also excluded from teacher examples.',
  'Counterfactual pairs intervene on exactly one solid cell at matched states in the synthetic world.',
  'Shared candidate menu and Q changes are audited separately; new/disappearing actions may explain decision switches.',
  'Fixed-menu perceptual interventions retain identical blocked-world candidate objects and change only the observed next cell.',
  'Synthetic toy terrain does not establish real Minecraft feasibility.'
 ]
},null,2));
