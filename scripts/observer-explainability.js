// Human-readable explanations use *observed* facts, not invented agent reasoning.
const comp=(s,color='gray')=>({text:String(s),color});
export function explainDecision(e){
 if(e?.type!=='target_decision')return null;
 const enabled=(e.mask??[]).flatMap((v,i)=>v?[i]:[]);
 const targets=Array.isArray(e.targets)?e.targets:[];
 const label=String(e.action??e.skill??'unknown').replaceAll('_',' ');
 const reason=e.mode==='training'||e.mode==='frozen'
  ? 'DQN selected an available option; exact Q-value ranking requires decision_trace_v1.'
  : 'Controller mode '+String(e.mode??'unknown')+' selected this option.';
 const scarcity=targets.length===0?'No target candidates were observed.':targets.length+' target candidates were observed.';
 const feasible='Enabled options: '+enabled.length+' of '+(e.mask?.length??'?')+'.';
 const blocked=e.features?.[6]>=0.5?' Navigation is marked blocked.':'';
 return {decisionId:e.decisionId,summary:'Selected '+label+'.',explanation:[reason,scarcity,feasible+blocked],
  // Decision trace may contain scores; this does NOT claim the agent thought in language.
  evidence:'target_decision',unknown:'The decision log alone does not establish why this option had the highest learned value.'};
}
export function explainEvent(e,decision=null){
 if(!e||!e.type)return null;
 if(e.type==='target_decision')return explainDecision(e);
 const action=decision?.action??'current action';
 let summary=null,explanation=[];
 if(e.type==='connected_exploration_audit'&&e.reason==='no_known_connected_route'){
  summary='Exploration has no connected route.';
  explanation=['The route chooser examined its known local candidates but selected no destination.','This is a planning limit, not proof that the world is physically impassable.'];
 }else if(e.type==='native_route_discovery_audit'&&e.reason==='no_native_complete_route'){
  summary='Native pathfinder also found no route.';
  explanation=['Path probes returned without a complete route.','Check footing and the available traversal capabilities before attributing failure to the policy.'];
 }else if(e.type==='grounded_exploration_no_safe_goal'){
  summary='Exploration could not execute.';
  explanation=['No safe goal was selected, so choosing EXPLORE was not the same as moving.'];
 }else if(e.type==='target_transition'){
  summary='Previous '+(e.action??action)+' episode settled.';
  explanation=['Observed reward: '+(Number.isFinite(e.reward)?e.reward:'unknown')+'.','This reward is feedback, not a complete causal explanation of the action.'];
 }else if(e.type==='target_navigation_stall'){
  summary='Movement has stopped.';
  explanation=['Stall counter: '+(e.stalls??'unknown')+'.','Inspect route failures to distinguish no available path from blocked movement.'];
 }else if(e.type==='trap_recovery_audit'&&e.outcome==='no_known_connected_route'){
  summary='Trap recovery found no safe alternative.';
  explanation=['The recovery planner did not find a candidate move.'];
 }else if(e.type==='navigation_recovery_outcome'){
  summary='Recovery experiment: '+String(e.result??'unknown').replaceAll('_',' ')+'.';
  explanation=['The observed result does not by itself prove the experiment caused the change.'];
 }
 if(!summary)return null;
 return {decisionId:e.decisionId??decision?.decisionId??null,summary,explanation,evidence:e.type};
}
export function explanationChat(x){
 if(!x)return null;
 return {text:'',extra:[comp('CRAFTLE › ','aqua'),comp(x.summary,'white'),...x.explanation.flatMap(s=>[comp('\n  ↳ ','dark_gray'),comp(s,'gray')])]};
}
