// Offline adapter for existing Craftle targeted DQN (44 features / 15 masked actions).
// No file I/O, Mineflayer client or checkpoint mutation outside caller-provided learner.
// Duration is measured in Minecraft ticks and converted to decision quanta for legacy gamma.
import {encodeTargets,TARGET_ACTIONS,TARGET_INPUTS} from './target-opportunities.js';
import {createOptionDQN} from './option-dqn.js';
export function createThreeSystemDqnAdapter({learner,decisionTicks=36}={}){
 if(!learner || typeof learner.choose!=='function' || typeof learner.observe!=='function')
  throw Error('DQN learner with choose/observe required');
 if(!Number.isSafeInteger(decisionTicks)||decisionTicks<1)throw Error('Invalid decision quantum');
 let pending=null;
 function chooseAction({observation}){
  if(pending)throw Error('Unsettled DQN choice');
  const {features,mask}=encodeTargets(observation);
  if(features.length!==TARGET_INPUTS)throw Error('Unexpected feature count');
  const selected=learner.choose(features,mask);
  if(!Number.isInteger(selected.index)||!mask[selected.index])throw Error('DQN selected masked action');
  pending={index:selected.index,features,action:TARGET_ACTIONS[selected.index]};
  return pending.action;
 }
 function observe(t){
  if(!pending)throw Error('Missing DQN choice');
  if(t.option!==pending.action)throw Error('DQN option mismatch');
  if(!Number.isSafeInteger(t.elapsedTicks)||t.elapsedTicks<0)throw Error('Invalid duration');
  if(!Number.isFinite(t.reward))throw Error('Invalid reward');
  const isTerminal=['verified_failure'].includes(t.result)&&t.evidence?.episodeTerminal===true;
  // Timeout and interruptions are truncated, NOT terminal. Bootstrap unless
  // the environment truly ended (death), which must be passed as terminal.
  const actualTerminal=t.evidence?.episodeTerminal===true || isTerminal;
  const steps=Math.max(1,Math.ceil(t.elapsedTicks/decisionTicks));
  let successor={};
  if(!actualTerminal){
   const encoded=encodeTargets(t.nextState);
   successor={nextState:encoded.features,nextMask:encoded.mask};
  }
  learner.observe({state:pending.features,index:pending.index,reward:t.reward,
   steps,terminal:actualTerminal,...successor});
  pending=null;
 }
 return {chooseAction,observe,get pending(){return pending!==null;}};
}
export function makeTargetedDqn({snapshot=null,random=Math.random,epsilon=0.3,training=true}={}){
 return createOptionDQN({inputs:TARGET_INPUTS,options:TARGET_ACTIONS,schema:'craftle.targeted.dqn.v1',
  snapshot,random,epsilon,training});
}
