// Experimental variable-candidate Q policy. No fixed 15-way DQN head and no
// built-in construction strategies. Every action candidate must be grounded in
// current client observations and an available executor.
import {MOTOR_OPERATIONS} from './motor-affordances.js';
export const PARAMETRIC_POLICY_SCHEMA='craftle.motor-q.v2.candidate';
const OP_COUNT=MOTOR_OPERATIONS.length;
export const MOTOR_FEATURE_COUNT=OP_COUNT+22;
const clamp=(n,scale=1)=>Math.max(-1,Math.min(1,Number(n||0)/scale));
export function encodeMotorCandidate(observation={},candidate={}){
 const op=MOTOR_OPERATIONS.indexOf(candidate.operation);
 if(op<0||!candidate.executable)throw Error('Candidate not executable');
 const p=observation.position??{x:0,y:0,z:0};
 const args=candidate.arguments??{};
 const at=candidate.evidence?.destination??args.position??args.reference??
  (candidate.operation==='move'?{x:p.x+(args.dx??0),y:p.y+(args.dy??0),z:p.z+(args.dz??0)}:p);
 const goal=observation.goal??p;
 const destination=observation.blockAt?.(Math.floor(at.x),Math.floor(at.y)-1,Math.floor(at.z));
 const feet=observation.blockAt?.(Math.floor(at.x),Math.floor(at.y),Math.floor(at.z));
 const currentFoot=observation.blockAt?.(Math.floor(p.x),Math.floor(p.y)-1,Math.floor(p.z));
 const item=observation.inventory?.find(i=>i.name===candidate.arguments?.itemName);
 const vec=[...MOTOR_OPERATIONS.map((_,i)=>Number(i===op)),
  clamp(observation.health,20),clamp(observation.food,20),
  clamp(observation.inventory?.length,36),clamp(observation.stalls,20),
  clamp(at.x-p.x,8),clamp(at.y-p.y,8),clamp(at.z-p.z,8),
  clamp(item?.count,64),clamp(candidate.arguments?.dx),
  clamp(candidate.arguments?.dy),clamp(candidate.arguments?.dz),
  Number(candidate.evidence?.source==='observed_block'),
  Number(candidate.evidence?.source==='observed_empty_destination_and_inventory'),
  Number(candidate.arguments?.face?.y===-1),
  Number(candidate.arguments?.face?.y===1),
  clamp(goal.x-p.x,16),clamp(goal.y-p.y,16),clamp(goal.z-p.z,16),
  clamp(Math.abs(goal.x-p.x)-Math.abs(goal.x-at.x),8),
  Number(destination?.boundingBox==='block'),
  Number(feet?.boundingBox==='block'),
  Number(currentFoot?.boundingBox==='block')];
 if(vec.length!==MOTOR_FEATURE_COUNT||!vec.every(Number.isFinite))
  throw Error('Invalid motor candidate encoding');
 return vec;
}
export function createMotorQPolicy({seed=17,epsilon=0.3,gamma=0.95,alpha=0.001,
 hidden=24,snapshot=null,training=true,explorationMode='candidate_uniform'}={}){
 if(!['candidate_uniform','operation_balanced'].includes(explorationMode))throw Error('Invalid exploration mode');
 if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1||!Number.isInteger(hidden)||hidden<1)
  throw Error('Invalid policy parameters');
 let rng=seed>>>0;
 const random=()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/4294967296;};
 const initialize=n=>Array.from({length:n},()=>random()*.06-.03);
 let w=Array.from({length:hidden},()=>initialize(MOTOR_FEATURE_COUNT+1));
 let v=initialize(hidden+1),updates=0;
 if(snapshot){
  if(snapshot.schema!==PARAMETRIC_POLICY_SCHEMA||snapshot.hidden!==hidden||
   !Array.isArray(snapshot.w)||snapshot.w.length!==hidden||
   snapshot.w.some(row=>!Array.isArray(row)||row.length!==MOTOR_FEATURE_COUNT+1||
    !row.every(Number.isFinite))||
   !Array.isArray(snapshot.v)||snapshot.v.length!==hidden+1||!snapshot.v.every(Number.isFinite))
   throw Error('Incompatible candidate policy');
  w=snapshot.w.map(row=>row.slice());v=snapshot.v.slice();updates=snapshot.updates??0;
 }
 const forward=x=>{
  const h=w.map(row=>Math.tanh(row[MOTOR_FEATURE_COUNT]+
   x.reduce((s,t,i)=>s+row[i]*t,0)));
  return {h,q:v[hidden]+h.reduce((s,t,i)=>s+v[i]*t,0)};
 };
 const eligible=(obs,candidates)=>candidates.filter(c=>c.executable).map(c=>({
  candidate:c,features:encodeMotorCandidate(obs,c)}));
 const rank=(obs,candidates)=>eligible(obs,candidates).map(row=>({
  ...row,q:forward(row.features).q}));
 return {
  choose(obs,candidates){
   const scores=rank(obs,candidates);
   if(!scores.length)return {candidate:null,reason:'no_executable_candidate'};
   const exploratory=training&&random()<epsilon;
   let selected;
   if(exploratory&&explorationMode==='operation_balanced'){
    const operations=[...new Set(scores.map(s=>s.candidate.operation))];
    const operation=operations[Math.floor(random()*operations.length)];
    const same=scores.filter(s=>s.candidate.operation===operation);
    selected=same[Math.floor(random()*same.length)];
   }else selected=exploratory?scores[Math.floor(random()*scores.length)]:
    scores.reduce((best,c)=>!best||c.q>best.q?c:best,null);
   return {candidate:selected.candidate,features:selected.features,
    estimatedQ:selected.q,exploratory,eligibleCount:scores.length,
    reason:exploratory?explorationMode:'estimated_value'};
  },
  observe({features,reward,nextObservation,nextCandidates=[],terminal=false,steps=1}={}){
   if(!training)throw Error('Cannot train frozen policy');
   if(!Array.isArray(features)||features.length!==MOTOR_FEATURE_COUNT||
    !features.every(Number.isFinite)||!Number.isFinite(reward))throw Error('Invalid transition');
   const {h,q}=forward(features);
   const future=terminal?[]:rank(nextObservation,nextCandidates);
   const next=terminal||!future.length?0:Math.max(...future.map(s=>s.q));
   const td=Math.max(-5,Math.min(5,reward+Math.pow(gamma,steps)*next-q));
   const old=v.slice();
   for(let j=0;j<hidden;j++){
    v[j]+=alpha*td*h[j];
    const grad=td*old[j]*(1-h[j]*h[j]);
    for(let i=0;i<MOTOR_FEATURE_COUNT;i++)w[j][i]+=alpha*grad*features[i];
    w[j][MOTOR_FEATURE_COUNT]+=alpha*grad;
   }
   v[hidden]+=alpha*td;
   updates++;
   return {tdError:td,updates};
  },
  // Planner-assisted imitation is a separate experimental arm, NOT unassisted RL.
  // Generic search supplies an observed successful action, not a named recipe.
  // Train against a hard negative among other legal candidates, using the same
  // Q network. Each input is a frozen feature vector from the decision time.
  imitate({positiveFeatures,negativeFeatures=[],margin=0.5,weight=1}={}){
   if(!training)throw Error('Cannot imitate on frozen policy');
   const valid=x=>Array.isArray(x)&&x.length===MOTOR_FEATURE_COUNT&&x.every(Number.isFinite);
   if(!valid(positiveFeatures)||!Array.isArray(negativeFeatures)||
    !negativeFeatures.every(valid)||!Number.isFinite(margin)||margin<=0||
    !Number.isFinite(weight)||weight<=0)throw Error('Invalid imitation sample');
   if(!negativeFeatures.length)return {updated:false,reason:'no_negative_candidates'};
   const p=forward(positiveFeatures);
   const ranked=negativeFeatures.map(features=>({features,...forward(features)}));
   const worst=ranked.reduce((best,row)=>!best||row.q>best.q?row:best,null);
   const violation=margin+worst.q-p.q;
   if(violation<=0)return {updated:false,reason:'margin_satisfied',violation};
   const step=alpha*weight;
   const old=v.slice();
   // Pairwise hinge gradient: increase Q(positive) and decrease Q(negative).
   for(let j=0;j<hidden;j++){
    v[j]+=step*(p.h[j]-worst.h[j]);
    const posGrad=old[j]*(1-p.h[j]*p.h[j]);
    const negGrad=old[j]*(1-worst.h[j]*worst.h[j]);
    for(let i=0;i<MOTOR_FEATURE_COUNT;i++)
     w[j][i]+=step*(posGrad*positiveFeatures[i]-negGrad*worst.features[i]);
    w[j][MOTOR_FEATURE_COUNT]+=step*(posGrad-negGrad);
   }
   updates++;
   return {updated:true,reason:'pairwise_margin_update',violation,updates};
  },
  stats:()=>({schema:PARAMETRIC_POLICY_SCHEMA,updates,training}),
  snapshot:()=>({schema:PARAMETRIC_POLICY_SCHEMA,hidden,updates,w:w.map(r=>r.slice()),
   v:v.slice(),note:'experimental candidate scorer; not the v1 targeted DQN'})
 };
}
