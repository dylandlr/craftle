// An explicit opt-in experimental risk-choice learner, separate from the existing 15-action DQN.
// Saves its own values; never modifies the targeted DQN checkpoint.
import fs from 'node:fs';
import path from 'node:path';
export function createCanopyRiskLearner({file,epsilon=0.2,random=Math.random,log=()=>{}}={}){
 if(!file)throw Error('Risk learner requires a separate checkpoint path');
 if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw Error('Invalid epsilon');
 let values={};try{const obj=JSON.parse(fs.readFileSync(file,'utf8'));if(obj?.schema==='craftle.canopy-risk.v1')values=obj.values??{};}catch(e){if(e.code!=='ENOENT')throw e;}
 const key=({health,drop})=>[(health<=2?'critical':health<8?'low':'healthy'),drop<=3?'short':drop<=5?'medium':'long'].join(':');
 let pending=null;
 const save=()=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify({schema:'craftle.canopy-risk.v1',values}));fs.renameSync(file+'.tmp',file);};
 const choose=({health,drop,position})=>{
  if(pending)return {action:'pending',key:pending.key};
  const k=key({health,drop}),v=values[k]??{attempt:0,stay:0,nAttempt:0,nStay:0};
  const exploratory=random()<epsilon;
  const action=exploratory?(random()<0.5?'attempt':'stay'):(v.attempt>v.stay?'attempt':'stay');
  log({type:'canopy_risk_decision',context:k,health,drop,position,action,exploratory,
   epsilon,estimatedValues:{attempt:v.attempt,stay:v.stay},learnedPolicy:'auxiliary_tabular_not_DQN'});
  if(action==='attempt')pending={key:k,startedAt:Date.now(),health,drop,position};
  else {v.nStay++;v.stay+=(-0.02-v.stay)/v.nStay;values[k]=v;save();}
  return {action,key:k};
 };
 const finish=({outcome,landedOnGround=false})=>{
  if(!pending)return null;
  const p=pending;pending=null;
  const v=values[p.key]??{attempt:0,stay:0,nAttempt:0,nStay:0};
  const reward=outcome==='death'?-1:landedOnGround?1:-0.15;
  v.nAttempt++;v.attempt+=(reward-v.attempt)/v.nAttempt;values[p.key]=v;save();
  log({type:'canopy_risk_outcome',context:p.key,outcome,reward,estimatedAttemptValue:v.attempt,
   trials:v.nAttempt,learnedPolicy:'auxiliary_tabular_not_DQN'});
  return {reward,context:p.key};
 };
 return {choose,finish,pending:()=>pending,values:()=>values};
}
