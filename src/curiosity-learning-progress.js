// Prediction-based curiosity from local evidence only.
// Prediction is made BEFORE observation; no Minecraft ontology or recipe data.
const check = (s) => typeof s === 'string' && s.length > 0 && s.length <= 128;
const key = (kind,name,action) => JSON.stringify([kind,name,action]);
export function createLearningProgress({window=12,minimumSamples=4,maximumReward=0.25}={}) {
 if(!Number.isInteger(window)||window<4||!Number.isInteger(minimumSamples)||minimumSamples<2||!Number.isFinite(maximumReward)||maximumReward<0)
  throw Error('Invalid curiosity configuration');
 const models=new Map();
 function get(kind,name,action) {
  if(![kind,name,action].every(check))throw Error('Invalid concept/action');
  const id=key(kind,name,action);
  if(!models.has(id))models.set(id,{counts:new Map(),total:0,errors:[],pending:new Map()});
  return models.get(id);
 }
 function predict({kind,name,action,decisionId}){
  if(!check(String(decisionId??'')))throw Error('Missing decision ID');
  const m=get(kind,name,action),id=String(decisionId);
  if(m.pending.has(id))throw Error('Duplicate decision ID');
  const classes=[...m.counts.keys()].sort();
  // Laplace smoothed empirical categorical model; unknown outcome mass is
  // represented by the OTHER bucket rather than impossible zero probability.
  const denom=m.total+classes.length+1;
  const probabilities=Object.fromEntries(classes.map(c=>[c,(m.counts.get(c)+1)/denom]));
  probabilities.__other__=1/denom;
  m.pending.set(id,{probabilities,priorError:m.errors.length?m.errors.reduce((a,b)=>a+b,0)/m.errors.length:null});
  return {probabilities,knownSamples:m.total};
 }
 function observe({kind,name,action,decisionId,outcome}){
  if(!check(outcome))throw Error('Invalid outcome');
  const m=get(kind,name,action),id=String(decisionId),pending=m.pending.get(id);
  if(!pending)throw Error('Prediction must precede observation');
  m.pending.delete(id);
  const p=pending.probabilities[outcome]??pending.probabilities.__other__;
  const surprise=-Math.log(Math.max(p,1e-12));
  m.counts.set(outcome,(m.counts.get(outcome)??0)+1);m.total++;
  const recent=m.errors.slice(-window);
  // Reward only measured reduction in average prediction error, and never
  // reward first encounters or isolated anomalous observations.
  const previous=pending.priorError;
  m.errors.push(surprise);if(m.errors.length>window)m.errors.shift();
  const current=m.errors.reduce((a,b)=>a+b,0)/m.errors.length;
  const progress=previous===null||m.total<minimumSamples?0:Math.max(0,previous-current);
  return {surprise,progress,reward:Math.min(maximumReward,progress),samples:m.total,
   attribution:'observed_transition',policyApplied:false};
 }
 function snapshot(){return {schema:'craftle.curiosity-learning-progress.v1',models:[...models.entries()].map(([id,m])=>({id,total:m.total,counts:Object.fromEntries(m.counts),errors:[...m.errors]}))};}
 return {predict,observe,snapshot};
}
