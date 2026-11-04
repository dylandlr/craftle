// Synthetic evaluation-only decision guard. A candidate is a proposal, never
// execution authority. Before acting, read fresh observation and re-enumerate
// affordances, then require the selected action ID to remain grounded.
// No planner, macros, or implicit action substitution.
import {revalidateMotorCandidates} from './motor-counterfactual-audit.js';

export function checkFreshMotorDecision(world,proposed,{expectedState=null}={}){
 if(!world?.observe||!world?.affordances||!world?.snapshot)
  throw Error('Observable motor environment required');
 const state=world.snapshot();
 if(expectedState&&JSON.stringify(expectedState.position)!==JSON.stringify(state.position))
  return {approved:false,reason:'position_changed',candidate:null};
 const obs=world.observe();
 const fresh=world.affordances();
 if(!proposed?.id||!proposed.executable)
  return {approved:false,reason:'unavailable',candidate:null};
 const verified=fresh.find(c=>c.id===proposed.id&&
  c.operation===proposed.operation);
 if(!verified)
  return {approved:false,reason:'candidate_no_longer_available',candidate:null};
 if(!revalidateMotorCandidates(obs,[verified]).length)
  return {approved:false,reason:'precondition_no_longer_observed',candidate:null};
 return {approved:true,reason:'freshly_grounded',candidate:verified};
}

// This helper never retries, changes actions, or fabricates successful
// execution. On rejection, caller must take another observation/decision.
export function executeFreshMotorDecision(world,proposed,options={}){
 const check=checkFreshMotorDecision(world,proposed,options);
 if(!check.approved)return {...check,executed:false,result:null};
 const result=world.act(check.candidate);
 return {...check,executed:true,result,
  confirmed:Boolean(result?.ok),reason:result?.ok?'executed_confirmed':
   'executor_rejected'};
}
