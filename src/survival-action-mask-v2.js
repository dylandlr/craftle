// Candidate action-mask gate for the *future* v2 survival policy.
// A named action is never executable without an implementation and its local
// preconditions. Unwired actions remain masked, not claimed as learned skills.
import {SURVIVAL_SKILLS,SURVIVAL_ACTION_SCHEMA} from './survival-action-contract-v2.js';
export function availableSurvivalActions({observation={},executors={}}={}){
 const isReady=id=>typeof executors[id]==='function';
 const hasItem=id=>Boolean(observation.inventory?.some(x=>x.name===id&&x.count>0));
 const targets=observation.targets??[];
 const near=t=>t?.reachable===true&&t.visible===true;
 const preconditions={
  eat_item:()=>observation.food<20&&observation.edibleInInventory===true,
  explore:()=>observation.exploreFeasible!==false,
  approach_entity:()=>targets.some(t=>t.kind==='animal'||t.kind==='drop'),
  approach_block:()=>targets.some(t=>t.kind==='plant'||t.kind==='block'),
  retreat:()=>observation.hostileDistance<24,
  look_scan:()=>true,
  jump:()=>observation.onGround===true,
  descend:()=>observation.descentCandidate?.fullyObserved===true,
  swim:()=>observation.isInWater===true,
  climb:()=>observation.climbableAdjacent===true,
  dig_block:()=>targets.some(t=>t.kind==='block'&&near(t)),
  attack_entity:()=>targets.some(t=>t.kind==='animal'&&near(t)),
  attack_hostile:()=>targets.some(t=>t.kind==='hostile'&&near(t)),
  collect_drop:()=>targets.some(t=>t.kind==='drop'&&near(t)),
  equip_item:()=>observation.inventory?.length>0,
  craft_item:()=>observation.craftableRecipes?.length>0,
  place_block:()=>observation.placementCandidate?.fullyObserved===true,
  use_block:()=>observation.interactableBlock?.reachable===true,
  open_container:()=>observation.container?.reachable===true,
  transfer_item:()=>observation.container?.open===true,
  smelt_item:()=>observation.furnace?.open===true,
  build_shelter:()=>observation.buildPlan?.validated===true,
  place_light:()=>hasItem('torch')&&observation.placementCandidate?.fullyObserved===true,
  sleep:()=>observation.bed?.reachable===true&&observation.bed?.safe===true,
  set_spawn:()=>observation.bed?.reachable===true,
  recover_stuck:()=>observation.blocked===true,
  wait:()=>true
 };
 const rows=SURVIVAL_SKILLS.map(s=>{
  const executorReady=isReady(s.id),precondition=preconditions[s.id]?.()===true;
  return {id:s.id,status:s.status,executorReady,precondition,available:executorReady&&precondition};
 });
 return {schema:SURVIVAL_ACTION_SCHEMA,rows,mask:rows.map(r=>r.available),
  executableIds:rows.filter(r=>r.available).map(r=>r.id),
  blockedByMissingExecutor:rows.filter(r=>!r.executorReady).map(r=>r.id),
  caveat:'No DQN head or Minecraft executable implementation is supplied by this mask; integration must bind real executors.'};
}
