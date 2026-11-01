import {smdpTarget} from './smdp-target.js';
// An isolated transition builder. Authoritative server ticks must be supplied
// by a server observer; never reinterpret controller iterations as server ticks.
export class OptionTransition {
 constructor({runId,optionId,action,startTick,state,mask,gamma}){
  if(!runId||!optionId||!action||!Number.isSafeInteger(startTick)||startTick<0)throw Error('invalid option identity/start tick');
  if(!(gamma>0&&gamma<=1)||!Number.isFinite(gamma))throw Error('invalid gamma');
  if(!Array.isArray(state)||!state.every(Number.isFinite)||!Array.isArray(mask)||!mask.some(Boolean))throw Error('invalid starting observation/mask');
  this.runId=runId;this.optionId=optionId;this.action=action;this.startTick=startTick;this.state=structuredClone(state);this.mask=[...mask];this.gamma=gamma;
  this.events=new Map();this.closed=false;
 }
 reward({tick,value,evidence='unknown'}){
  if(this.closed)throw Error('option already closed');
  if(!Number.isSafeInteger(tick)||tick<this.startTick||!Number.isFinite(value))throw Error('invalid reward event');
  if(!['verified','observed_association','unknown'].includes(evidence))throw Error('invalid evidence');
  const values=this.events.get(tick)??[];values.push({value,evidence});this.events.set(tick,values);
 }
 finish({endTick,nextState,nextMask,nextQ,termination='continuing',outcome='unknown'}){
  if(this.closed)throw Error('option already closed');
  if(!Number.isSafeInteger(endTick)||endTick<=this.startTick)throw Error('duration must be positive authoritative ticks');
  const allowed=['verified_success','verified_failure','no_observable_change','interrupted','timed_out','unknown'];
  if(!allowed.includes(outcome))throw Error('invalid outcome');
  if(termination==='option_interrupted'&&outcome!=='interrupted')throw Error('interruption must be represented in outcome');
  if(termination==='environment_terminal'&&outcome==='interrupted')throw Error('death/reset is not an option interruption');
  if(!Array.isArray(nextState)||!nextState.every(Number.isFinite))throw Error('invalid successor observation');
  const duration=endTick-this.startTick;
  const rewards=Array(duration).fill(0),evidence=[];
  for(const [tick,items] of this.events){
   if(tick>=endTick)throw Error('reward outside option interval');
   for(const item of items){rewards[tick-this.startTick]+=item.value;evidence.push({tick,...item});}
  }
  const result=smdpTarget({rewards,gamma:this.gamma,nextQ,nextMask,termination});
  this.closed=true;
  return {schema:'craftle.option-transition.v1',runId:this.runId,optionId:this.optionId,action:this.action,
   startTick:this.startTick,endTick,duration,state:this.state,mask:this.mask,nextState:structuredClone(nextState),
   nextMask:nextMask?[...nextMask]:null,termination,outcome,evidence,reward:result.discountedReward,
   target:result.target,discount:result.discount,bootstrapped:result.bootstrapped};
 }
}
