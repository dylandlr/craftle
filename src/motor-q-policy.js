// Experimental variable-candidate Q policy. No fixed 15-way DQN head and no
// built-in construction strategies. Every action candidate must be grounded in
// current client observations and an available executor.
import {MOTOR_OPERATIONS} from './motor-affordances.js';
export const PARAMETRIC_POLICY_SCHEMA='craftle.motor-q.v1.candidate';
const OP_COUNT=MOTOR_OPERATIONS.length;
export const MOTOR_FEATURE_COUNT=OP_COUNT+12;
const clamp=(n,scale=1)=>Math.max(-1,Math.min(1,Number(n||0)/scale));
export function encodeMotorCandidate(observation={},candidate={}){
 const op=MOTOR_OPERATIONS.indexOf(candidate.operation);
 if(op<0||!candidate.executable)throw Error('Candidate not executable');
 const p=observation.position??{x:0,y:0,z:0};
 const at=candidate.arguments?.position??candidate.arguments?.reference??
  candidate.evidence?.destination??p;
 const item=observation.inventory?.find(i=>i.name===candidate.arguments?.itemName);
 const vec=[...MOTOR_OPERATIONS.map((_,i)=>Number(i===op)),
  clamp(observation.health,20),clamp(observation.food,20),
  clamp(observation.inventory?.length,36),clamp(observation.stalls,20),
  clamp(at.x-p.x,8),clamp(at.y-p.y,8),clamp(at.z-p.z,8),
  clamp(item?.count,64),Number(candidate.evidence?.source==='observed_block'),
  Number(candidate.evidence?.source==='observed_empty_destination_and_inventory'),
  Number(candidate.arguments?.face?.y===-1),
  Number(candidate.arguments?.face?.y===1)];
 if(vec.length!==MOTOR_FEATURE_COUNT||!vec.every(Number.isFinite))
  throw Error('Invalid motor candidate encoding');
 return vec;
}
export function createMotorQPolicy({seed=17,epsilon=0.3,gamma=0.95,alpha=0.001,
 hidden=24,snapshot=null,training=true}={}){
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
   const selected=exploratory?scores[Math.floor(random()*scores.length)]:
    scores.reduce((best,c)=>!best||c.q>best.q?c:best,null);
   return {candidate:selected.candidate,features:selected.features,
    estimatedQ:selected.q,exploratory,eligibleCount:scores.length,
    reason:exploratory?'exploration':'estimated_value'};
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
  stats:()=>({schema:PARAMETRIC_POLICY_SCHEMA,updates,training}),
  snapshot:()=>({schema:PARAMETRIC_POLICY_SCHEMA,hidden,updates,w:w.map(r=>r.slice()),
   v:v.slice(),note:'experimental candidate scorer; not the v1 targeted DQN'})
 };
}
