// Adapted LLM/Voyager proposal boundary, not the native upstream Voyager agent.
// Restricting executable actions cannot erase knowledge in pretrained weights.
import {encodeTargets,decodeTargetAction,TARGET_ACTIONS} from './target-opportunities.js';
export function groundProposal(proposal,observation,observationId){
 if(!proposal||typeof proposal!=='object'||Array.isArray(proposal)||Object.keys(proposal).some(k=>!['observationId','index'].includes(k)))throw Error('Grounded proposal must contain only observationId and index');
 if(proposal.observationId!==observationId)throw Error('Stale or ungrounded observation identity');
 return decodeTargetAction(proposal.index,observation);
}
export function createGroundedVoyagerAdapter({propose,maxDecisions=100,log=()=>{}}={}){
 if(typeof propose!=='function'||!Number.isInteger(maxDecisions)||maxDecisions<1)throw Error('A bounded proposal provider is required');
 let serial=0,epoch=0,closed=false;
 return {
  async choose(observation){
   if(closed||serial>=maxDecisions)throw Error('Grounded proposal budget exhausted');
   const currentEpoch=epoch,snapshot=structuredClone(observation),observationId=`${epoch}:${++serial}`;
   const decisionId=serial;
   const {features,mask}=encodeTargets(snapshot);
   // Match the neural policy's encoded sensory fields. Do not expose coordinates,
   // command execution, recipe lookup, imported skill code, or a global world API.
   const proposal=await propose({observationId,features,mask,actions:[...TARGET_ACTIONS],provenance:'pretrained_language_prior'});
   if(closed||currentEpoch!==epoch)throw Error('Proposal belongs to an ended life');
   const choice=groundProposal(proposal,snapshot,observationId);
   log({type:'grounded_llm_decision',observationId,...choice,provenance:'pretrained_language_prior',nativeVoyager:false});
   return {...choice,decisionId};
  },
  consumed(decisionId,beforeFood,afterFood){log({type:'grounded_llm_consumption_observed',decisionId,beforeFood,afterFood});},
  terminal(){epoch++;},truncate(){epoch++;},stop(){closed=true;epoch++;}
 };
}
