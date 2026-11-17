// Blueprint-conditioned neural Monte Carlo control for the deliberately
// small four-step resource chain. Separate from the existing v3 motor model:
// no checkpoint or feature-schema compatibility is implied.
// Learns ONLY from complete terminal outcomes; no scripted-action imitation.
// Uses public blueprint coordinates and independently observed block/inventory
// state, exactly as the scripted planner does. No hidden candidate IDs.
import {
  chainActionTarget,validateChainBlueprint
} from './motor-resource-chain.js';

export const RESOURCE_CHAIN_Q_SCHEMA='craftle.resource-chain-mc-q.v1';
export const RESOURCE_CHAIN_Q_FEATURES=16;
const finite3=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const clamp=(x,scale=1)=>Math.max(-1,Math.min(1,x/scale));
const equal=(a,b)=>a.x===b.x&&a.y===b.y&&a.z===b.z;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function dirtCount(items=[]){
  if(!Array.isArray(items))throw Error('Inventory required');
  let n=0;
  for(const item of items) {
    if(typeof item?.name!=='string'||!Number.isSafeInteger(item.count)||
      item.count<0)throw Error('Invalid inventory row');
    if(item.name==='dirt')n+=item.count;
  }
  return n;
}

export function encodeResourceChainCandidate(observation,candidate){
  const blueprint=validateChainBlueprint(observation);
  if(!candidate?.executable||!['dig','place'].includes(candidate.operation)||
    typeof observation.blockAt!=='function'||!Array.isArray(observation.inventory))
    throw Error('Missing observed action/blueprint/block state');
  const target=chainActionTarget(candidate);
  if(!finite3(target))throw Error('Invalid action target');
  const dirt=dirtCount(observation.inventory);
  const sourceRemaining=blueprint.sources.filter(p=>{
    const b=observation.blockAt(p.x,p.y,p.z);
    if(!b)throw Error('Unobserved required source');
    return b.name==='dirt'&&b.boundingBox==='block';
  }).length;
  const siteRemaining=blueprint.sites.filter(p=>{
    const b=observation.blockAt(p.x,p.y,p.z);
    if(!b)throw Error('Unobserved required site');
    return b.boundingBox==='empty';
  }).length;
  const opDig=candidate.operation==='dig';
  const targetList=opDig?blueprint.sources:blueprint.sites;
  const otherList=opDig?blueprint.sites:blueprint.sources;
  const closest=Math.min(...targetList.map(p=>distance(p,target)));
  const nearestOther=Math.min(...otherList.map(p=>distance(p,target)));
  // A task-intrinsic canonical frame based on two *public* source positions.
  // Equal output for rotated layouts, without feeding task.rotation to the net.
  const a=blueprint.sources[0],b=blueprint.sources[1];
  const ux=b.x-a.x,uz=b.z-a.z,n=Math.hypot(ux,uz);
  if(n<0.5)throw Error('Degenerate public blueprint');
  const vx=target.x-a.x,vz=target.z-a.z;
  const along=(vx*ux+vz*uz)/n;
  const lateral=(vx*(-uz)+vz*ux)/n;
  const remaining=observation.remainingSteps;
  if(!Number.isSafeInteger(remaining)||remaining<0||remaining>4)
    throw Error('Missing remaining action budget');
  const features=[
    Number(opDig),Number(!opDig),
    Number(closest===0), // publicly derived blueprint membership
    clamp(closest,4),clamp(nearestOther,4),
    clamp(dirt,2),clamp(sourceRemaining,2),clamp(siteRemaining,2),
    clamp(remaining,4),
    Number(opDig&&dirt===0),
    Number(!opDig&&dirt>0),
    Number(opDig&&sourceRemaining>0),
    Number(!opDig&&siteRemaining>0),
    clamp(along,4),clamp(lateral,4),
    clamp(target.y-a.y,4)
  ];
  if(features.length!==RESOURCE_CHAIN_Q_FEATURES||
     !features.every(Number.isFinite))throw Error('Invalid chain Q feature vector');
  return features;
}

function validateVector(features){
  if(!Array.isArray(features)||features.length!==RESOURCE_CHAIN_Q_FEATURES||
    !features.every(Number.isFinite))throw Error('Invalid chain Q feature vector');
}

export function createResourceChainQ({
  seed=17,hidden=24,alpha=0.02,gamma=0.95,epsilon=0.3,
  training=true,replayCapacity=256,replayPasses=4,snapshot=null
}={}){
  if(!Number.isSafeInteger(seed)||seed<0||
    !Number.isSafeInteger(hidden)||hidden<1||hidden>128||
    !Number.isFinite(alpha)||alpha<=0||alpha>0.3||
    !Number.isFinite(gamma)||gamma<=0||gamma>1||
    !Number.isFinite(epsilon)||epsilon<0||epsilon>1||
    !Number.isSafeInteger(replayCapacity)||replayCapacity<2||
    !Number.isSafeInteger(replayPasses)||replayPasses<0||
    replayPasses>32)throw Error('Invalid chain Q configuration');
  let rng=seed>>>0;
  const random=()=>{
    rng=(Math.imul(1664525,rng)+1013904223)>>>0;
    return rng/4294967296;
  };
  const init=n=>Array.from({length:n},()=>random()*.1-.05);
  let w=Array.from({length:hidden},()=>init(RESOURCE_CHAIN_Q_FEATURES+1));
  let v=init(hidden+1),updates=0,episodes=0,successes=0;
  if(snapshot){
    if(snapshot.schema!==RESOURCE_CHAIN_Q_SCHEMA||
      snapshot.hidden!==hidden||!Array.isArray(snapshot.w)||
      snapshot.w.length!==hidden||snapshot.w.some(row=>
        !Array.isArray(row)||row.length!==RESOURCE_CHAIN_Q_FEATURES+1||
        !row.every(Number.isFinite))||
      !Array.isArray(snapshot.v)||snapshot.v.length!==hidden+1||
      !snapshot.v.every(Number.isFinite))
      throw Error('Invalid chain Q checkpoint');
    w=snapshot.w.map(row=>row.slice());v=snapshot.v.slice();
    updates=snapshot.updates;episodes=snapshot.episodes;
    successes=snapshot.successes;
  }
  const replay=[]; // in-memory only; snapshots freeze policy, not training buffer
  const forward=x=>{
    const h=w.map(row=>Math.tanh(
      row[RESOURCE_CHAIN_Q_FEATURES]+
      x.reduce((sum,xk,i)=>sum+row[i]*xk,0)));
    return {h,q:v[hidden]+h.reduce((sum,hk,i)=>sum+v[i]*hk,0)};
  };
  const fit=(x,target)=>{
    validateVector(x);
    if(!Number.isFinite(target))throw Error('Nonfinite MC return');
    const {h,q}=forward(x);
    const td=Math.max(-4,Math.min(4,target-q));
    const old=v.slice();
    for(let j=0;j<hidden;j++){
      v[j]+=alpha*td*h[j];
      const grad=td*old[j]*(1-h[j]*h[j]);
      for(let i=0;i<RESOURCE_CHAIN_Q_FEATURES;i++)
        w[j][i]+=alpha*grad*x[i];
      w[j][RESOURCE_CHAIN_Q_FEATURES]+=alpha*grad;
    }
    v[hidden]+=alpha*td;
    updates++;
  };
  const score=(obs,candidates)=>candidates.filter(c=>c?.executable)
    .map(candidate=>{
      const features=encodeResourceChainCandidate(obs,candidate);
      return {candidate,features,q:forward(features).q};
    });
  return {
    scoreCandidates(obs,candidates){
      return score(obs,candidates).map(row=>({
        id:row.candidate.id,operation:row.candidate.operation,q:row.q
      }));
    },
    choose(obs,candidates){
      if(!Array.isArray(candidates))throw Error('Candidates required');
      const scores=score(obs,candidates);
      if(scores.length===0)return {candidate:null,reason:'no_executable_chain_action'};
      const exploratory=training&&random()<epsilon;
      const pick=exploratory?scores[Math.floor(random()*scores.length)]:
        scores.reduce((best,row)=>!best||row.q>best.q?row:best,null);
      return {candidate:pick.candidate,features:pick.features,
        q:pick.q,exploratory,reason:exploratory?'uniform_exploration':'learned_value'};
    },
    // Every transition must be a verified 0 intermediate reward and a +/-1
    // final outcome. This function accepts terminal labels from the
    // simulator or verifier; it does NOT create authoritative proof.
    learnEpisode(transitions){
      if(!training)throw Error('Frozen chain Q cannot learn');
      if(!Array.isArray(transitions)||transitions.length!==4||
         transitions.some((t,i)=>!t||!Array.isArray(t.features)||
           (i<3&&t.reward!==0)||(i===3&&t.reward!==1&&t.reward!==-1)))
        throw Error('Expected exactly four actions and terminal-only reward');
      transitions.forEach(t=>validateVector(t.features));
      const finalReward=transitions[3].reward;
      const example=transitions.map((t,i)=>({
        features:t.features.slice(),
        target:Math.pow(gamma,3-i)*finalReward
      }));
      replay.push({example,success:finalReward>0});
      if(replay.length>replayCapacity)replay.shift();
      episodes++;successes+=Number(finalReward>0);
      // On-policy terminal returns. Balanced success/failure episode replay
      // mitigates rare successful trajectories, but does not add any
      // demonstration, shaping reward or per-action target-label feedback.
      const positive=replay.filter(x=>x.success);
      const negative=replay.filter(x=>!x.success);
      const sample=()=>{
        const pool=positive.length&&negative.length?
          (random()<0.5?positive:negative):replay;
        return pool[Math.floor(random()*pool.length)];
      };
      for(const t of example)fit(t.features,t.target);
      for(let i=0;i<replayPasses;i++){
        const batch=sample();
        for(const t of batch.example)fit(t.features,t.target);
      }
      return {updates,episodes,successes,replaySize:replay.length};
    },
    stats:()=>({schema:RESOURCE_CHAIN_Q_SCHEMA,updates,episodes,successes,
      replaySize:replay.length,training}),
    snapshot:()=>({schema:RESOURCE_CHAIN_Q_SCHEMA,hidden,updates,episodes,
      successes,w:w.map(row=>row.slice()),v:v.slice(),
      note:'separate public-blueprint MC chain policy; not the v3 motor-Q checkpoint'})
  };
}
