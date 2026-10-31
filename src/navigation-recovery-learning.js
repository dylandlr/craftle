// Outcome and recovery learning, independent of Minecraft control.
// Failed pathfinding is not equivalent to an impossible physical world.
export const NAVIGATION_IMPOSSIBLE='navigation_impossible';
const valid=s=>typeof s==='string'&&s.length>0;
export class NavigationRecoveryLearner {
 constructor({maxAttemptsPerSituation=3,maxSituations=256}={}){
  if(!Number.isInteger(maxAttemptsPerSituation)||maxAttemptsPerSituation<1||!Number.isInteger(maxSituations)||maxSituations<1)throw Error('Invalid limits');
  Object.assign(this,{maxAttemptsPerSituation,maxSituations});this.situations=new Map();
 }
 observeFailure({situationId,decisionId,routeStatus,knownCandidates=0,goalId=null}){
  if(!valid(situationId)||!valid(String(decisionId??''))||!['no_known_connected_route','no_native_complete_route','no_safe_goal'].includes(routeStatus)||!Number.isInteger(knownCandidates)||knownCandidates<0)throw Error('Invalid failure');
  if(!this.situations.has(situationId)&&this.situations.size>=this.maxSituations)throw Error('Situation capacity reached');
  const state=this.situations.get(situationId)??{failures:0,attempts:[],status:'unresolved'};
  state.failures++;state.lastFailure={decisionId,routeStatus,knownCandidates,goalId};
  this.situations.set(situationId,state);
  return {schema:'craftle.navigation-outcome.v1',type:NAVIGATION_IMPOSSIBLE,situationId,decisionId,goalId,reason:routeStatus,
   evidenceSource:'agent_observation',interpretation:'no_route_found_by_current_planners_not_world_proof'};
 }
 beginRecovery({situationId,attemptId,method}){
  const s=this.situations.get(situationId);
  if(!s||!valid(attemptId)||!valid(method)||s.attempts.some(x=>x.attemptId===attemptId)||s.attempts.some(x=>x.outcome===null))throw Error('Invalid recovery attempt');
  if(s.attempts.length>=this.maxAttemptsPerSituation)return {accepted:false,reason:'bounded_attempts_exhausted',recommendation:'table_goal'};
  s.attempts.push({attemptId,method,outcome:null,evidence:null});return {accepted:true};
 }
 finishRecovery({situationId,attemptId,before,after}){
  const s=this.situations.get(situationId),a=s?.attempts.find(x=>x.attemptId===attemptId);
  if(!a||a.outcome!==null||!before||!after||!Number.isFinite(before.distanceToGoal)||!Number.isFinite(after.distanceToGoal)||!Number.isFinite(before.tick)||!Number.isFinite(after.tick)||after.tick<=before.tick||typeof after.routeAvailable!=='boolean')throw Error('Invalid recovery outcome');
  const progress=before.distanceToGoal-after.distanceToGoal;
  const success=after.routeAvailable||progress>0.5;
  a.outcome=success?'observed_recovery_progress':'no_observed_recovery_progress';
  a.evidence={elapsedTicks:after.tick-before.tick,progress,routeAvailable:after.routeAvailable,causalAttribution:'temporal_association'};
  if(success)s.status='progress_observed';
  return {schema:'craftle.navigation-recovery.v1',situationId,attemptId,method:a.method,result:a.outcome,evidence:structuredClone(a.evidence),
   remainingAttempts:this.maxAttemptsPerSituation-s.attempts.length};
 }
 recommendation(situationId){
  const s=this.situations.get(situationId);if(!s)return 'no_evidence';
  if(s.attempts.some(a=>a.outcome===null))return 'await_outcome';
  if(s.status==='progress_observed')return 'reassess_navigation';
  if(s.attempts.length>=this.maxAttemptsPerSituation)return 'table_goal';
  return 'bounded_recovery_allowed';
 }
 snapshot(){return structuredClone({schema:'craftle.navigation-recovery-learner.v1',situations:[...this.situations.entries()]});}
}
