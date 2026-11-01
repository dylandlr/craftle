// Offline bridge among option episodes, recovery evidence and executive goals.
// The outcome categories describe execution, not Minecraft-world certainty.
import {ThreeSystemLoop} from './three-system-loop.js';
import {NavigationRecoveryLearner} from './navigation-recovery-learning.js';
export const EXECUTION_OUTCOMES=Object.freeze({
 UNAVAILABLE:'capability_unavailable',
 FAILED:'attempt_failed',
 PROGRESS:'partial_progress',
 DEFERRED:'goal_deferred',
 SUCCEEDED:'action_succeeded'
});
export class ExecutiveRecoveryBridge {
 constructor({loop,recovery=new NavigationRecoveryLearner()}={}){
  if(!(loop instanceof ThreeSystemLoop))throw Error('ThreeSystemLoop required');
  this.loop=loop;this.recovery=recovery;this.events=[];
 }
 start(goalId,args){return this.loop.start(goalId,args);}
 resolve({kind,tick,observation,reward=0,situationId=null,routeStatus=null,recoveryAttemptId=null,recoveryBefore=null,recoveryAfter=null,resumeWhen=null,reason=null,evidence=null,terminal=false}={}){
  if(!Object.values(EXECUTION_OUTCOMES).includes(kind))throw Error('Unknown execution outcome');
  const episode=this.loop.dual.active;
  if(!episode||!this.loop.goals.activeId)throw Error('No active episode and goal');
  const goalId=this.loop.goals.activeId, decisionId=episode.id;
  if(!Number.isFinite(reward)||!Number.isSafeInteger(tick)||tick<episode.startTick)throw Error('Invalid transition');
  let recoveryEvent=null, result, disposition='continue';
  if(kind===EXECUTION_OUTCOMES.UNAVAILABLE){
   if(!situationId||!routeStatus)throw Error('Unavailable navigation needs a known situation and planner status');
   recoveryEvent=this.recovery.observeFailure({situationId,decisionId,goalId,routeStatus});
   // No action was successfully executed. Truncation signals interruption, not a terminal death.
   result='interrupted';
   if(this.recovery.recommendation(situationId)==='table_goal'){
    if(!resumeWhen)throw Error('Tabling requires resumption conditions');
    disposition='tabled';
   }
  }else if(kind===EXECUTION_OUTCOMES.FAILED){
   result='verified_failure'; // verified failure of an attempted action, NOT environment terminal
  }else if(kind===EXECUTION_OUTCOMES.PROGRESS){
   result='unknown'; // partial motion is progress evidence but not success completion
   if(recoveryAttemptId){
    if(!situationId||!recoveryBefore||!recoveryAfter)throw Error('Recovery observation missing');
    recoveryEvent=this.recovery.finishRecovery({situationId,attemptId:recoveryAttemptId,before:recoveryBefore,after:recoveryAfter});
   }
  }else if(kind===EXECUTION_OUTCOMES.DEFERRED){
   if(!resumeWhen)throw Error('Deferred objective needs resumption conditions');
   result='interrupted';disposition='tabled';
  }else{
   if(!evidence||evidence.evidenceSource!=='agent_observation')throw Error('Success requires agent-observed evidence');
   result='verified_success';
  }
  const response=this.loop.observe({tick,result,observation,reward,
   evidence:{...evidence,episodeTerminal:Boolean(terminal)},goalDisposition:disposition,
   reason:reason??kind,resumeWhen});
  const event={schema:'craftle.executive-resolution.v1',kind,decisionId,goalId,episodeResult:result,goalDisposition:disposition,recoveryEvent};
  this.events.push(structuredClone(event));
  return {event,transition:response.transition,goal:response.goal};
 }
}
