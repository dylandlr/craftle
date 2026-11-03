import {NavigationRecoveryLearner} from './navigation-recovery-learning.js';
import {loader as autoEatPlugin} from 'mineflayer-auto-eat';
import pathfinderPackage from 'mineflayer-pathfinder';
import {HOSTILE_MOBS} from './survival-reference.js';
import {observeTargets,edible} from './target-opportunities.js';
import {canSeeTargetEntity} from './target-visibility.js';
import {foodPlantAction} from './food-foraging.js';
import {attachFoodProvenance} from './food-provenance.js';
import {createFoodSequenceTracker} from './food-sequence-tracker.js';
import {chooseGroundedExploreGoal} from './grounded-exploration.js';
import {chooseConnectedExploreGoal} from './connected-exploration.js';
import {createCanopyOutcomeTracker} from './canopy-outcome.js';
import {createDiscoveryMemory,discoveryMemoryPath} from './discovery-memory.js';
import {planTrapRecovery} from './trap-recovery.js';
import {diagnoseFooting} from './footing-diagnostic.js';
import {inspectLedge,isHazardAdjacent} from './ledge-observation.js';
import {shouldReplaceNavigationGoal} from './navigation-goal-control.js';
import {configurePathfinderSafety,summarizePathUpdate} from './pathfinder-safety.js';
import {discoverNativeRoute} from './native-navigation-discovery.js';
import {createNativeRouteFailureGate} from './native-route-failure-gate.js';
import {findCanopyStepdown,shouldInspectCanopyStepdown} from './canopy-stepdown.js';
import {planCanopyGroundRoute} from './canopy-ground-route.js';
import {auditDiggingNeighbors} from './dig-navigation-audit.js';
// Each decision selects one skill and one concrete target. No automatic forage chain.
export function startTargetedSurvival(bot,{decisionController,log=()=>{},navigation=pathfinderPackage,autoStart=true,intervalMs=1800,clock=Date.now,autoEatControl=false}={}){
 if(!decisionController)throw Error('Targeted policy required');
 const {pathfinder,Movements,goals:{GoalNear,GoalXZ,GoalNearXZ}}=navigation;
 if(autoEatControl){
  bot.loadPlugin(autoEatPlugin);
  bot.autoEat.setOpts({minHunger:15,priority:'foodPoints'});
  bot.autoEat.on('eatStart',opts=>log({type:'auto_eat_start',food:opts.food?.name??null,foodBefore:bot.food,decisionSource:'plugin_threshold',learned:false}));
  bot.autoEat.on('eatFinish',opts=>log({type:'auto_eat_finish',food:opts.food?.name??null,foodAfter:bot.food,decisionSource:'plugin_threshold',learned:false}));
  bot.autoEat.on('eatFail',error=>log({type:'auto_eat_failure',message:error?.message??String(error),decisionSource:'plugin_threshold'}));
  bot.autoEat.enableAuto();log({type:'auto_eat_control_enabled',minHunger:15,priority:'foodPoints',learned:false});
 }
 bot.loadPlugin(pathfinder);const movements=new Movements(bot);
 const canopyDescent=process.env.CRAFTLE_TREE_NAVIGATION==='1'&&process.env.CRAFTLE_CANOPY_DESCENT==='1';
 const traversalMode=process.env.CRAFTLE_NATIVE_TRAVERSAL_MODE==='ordinary'?'ordinary':'conservative';
 configurePathfinderSafety(movements,{registry:bot.registry,maxDropDown:canopyDescent?3:1,mode:traversalMode});bot.pathfinder.setMovements(movements);
 let ended=false,dead=false,busy=false,life=0,tick=0,lastPosition=null,stalls=0,goal=null,timer,activeDecision=null;
 const provenance=attachFoodProvenance(bot,{log,getDecision:()=>activeDecision,clock});
 const sequences=createFoodSequenceTracker({log,clock});
 const canopyTracker=createCanopyOutcomeTracker({clock});
 const discoveryEnabled=process.env.CRAFTLE_DISCOVERY_MEMORY==='1';
 const discovery=discoveryEnabled?createDiscoveryMemory({
  agentId:process.env.CRAFTLE_DISCOVERY_AGENT_ID??bot.username??'agent',
  worldId:process.env.CRAFTLE_DISCOVERY_WORLD_ID??'unscoped',
  file:discoveryMemoryPath({root:process.env.CRAFTLE_PERSISTENT_ROOT??'recordings',agentId:process.env.CRAFTLE_DISCOVERY_AGENT_ID??bot.username??'agent'}),
  clock,log
 }):null;
 const saveDiscovery=()=>{if(!discovery)return;try{discovery.save();}catch(error){log({type:'discovery_memory_save_error',message:error.message});}};
 let previousFoodUnits=null;
 let lastLookScan=0;
 let lastTargetAudit=0;
 const targetAuditEnabled=process.env.CRAFTLE_TARGET_PERCEPTION_AUDIT==='1';
 const nativeRouteGate=createNativeRouteFailureGate();
 const connectedExplore=process.env.CRAFTLE_TREE_NAVIGATION==='1';
 const nativeDiscovery=process.env.CRAFTLE_NATIVE_ROUTE_DISCOVERY==='1';
 const canopyStepdown=process.env.CRAFTLE_CANOPY_STEPDOWN==='1';
 const canopyGroundRoute=process.env.CRAFTLE_CANOPY_GROUND_ROUTE==='1';
 let lastStepdown=0;
 const groundedExplore=connectedExplore||process.env.CRAFTLE_GROUNDED_EXPLORATION==='1';
 const failedExplore=new Set();
 const recentExploreDestinations=[];
 const rememberExploreDestination=q=>{recentExploreDestinations.push({x:q.x,z:q.z});if(recentExploreDestinations.length>12)recentExploreDestinations.shift();};
 const explorationNoveltyScore=(node,{origin,netDistance})=>{
  const nearest=recentExploreDestinations.length?Math.min(...recentExploreDestinations.map(q=>Math.hypot(node.x-q.x,node.z-q.z))):Infinity;
  const revisitPenalty=Number.isFinite(nearest)?Math.max(0,6-nearest)*2.4:0;
  const mapNovelty=discovery?discovery.novelty({...node,dimension:bot.game?.dimension??'overworld'}):0;
  return netDistance*1.2-node.cost*.23-revisitPenalty+mapNovelty;
 };
 const failedConnected=new Set();
 const markConnectedFailure=g=>{if(!connectedExplore||!['explore','canopy_egress'].includes(g?.key))return;failedConnected.add([Math.floor(g.x),Math.floor(g.y),Math.floor(g.z)].join(','));if(failedConnected.size>180)failedConnected.delete(failedConnected.values().next().value);};
 log({type:'native_traversal_config',mode:traversalMode,maxDropDown:movements.maxDropDown,allowParkour:movements.allowParkour,canDig:movements.canDig,learned:false});
 log({type:'exploration_execution_variant',variant:connectedExplore?'connected_cached_v1':groundedExplore?'grounded_v1':'legacy_v1',canopyDescent,maximumDrop:canopyDescent?3:1,learned:false});
 const clearGoal=()=>{goal=null;bot.pathfinder.setGoal(null);};
 const navRecovery=process.env.CRAFTLE_NAVIGATION_RECOVERY_LEARNING==='1'?new NavigationRecoveryLearner():null;
 const observedSituation=(p)=>['overworld',Math.floor(p.x/4),Math.floor(p.y/4),Math.floor(p.z/4)].join(':');
 let pendingRecovery=null,recoverySerial=0,lastNavFailurePosition=null;
 const recordNavigationImpossible=(p,reason)=>{
  if(!navRecovery)return;
  const situationId=observedSituation(p),decisionId=String(activeDecision?.decisionId??'unassigned');
  const outcome=navRecovery.observeFailure({situationId,decisionId,routeStatus:'no_known_connected_route',goalId:activeDecision?.skill??'explore'});
  // No guaranteed action success: the native pathfinder can be unable to form a route.
  if(!lastNavFailurePosition||lastNavFailurePosition!==situationId||stalls%25===0){
   log({type:'navigation_impossibility_observed',...outcome,reasonDetail:reason,stalls,learned:false});
   lastNavFailurePosition=situationId;
  }
 };
 const settleRecovery=(p)=>{
  if(!pendingRecovery||!navRecovery||tick-pendingRecovery.tick<3)return;
  const d=Math.hypot(p.x-pendingRecovery.origin.x,p.z-pendingRecovery.origin.z);
  const remainingDistance=Math.hypot(p.x-pendingRecovery.destination.x,p.y-pendingRecovery.destination.y,p.z-pendingRecovery.destination.z);
  const available=Boolean(goal&&bot.pathfinder.goal&&bot.pathfinder.isMoving?.());
  const outcome=navRecovery.finishRecovery({situationId:pendingRecovery.situationId,attemptId:pendingRecovery.attemptId,
   before:{tick:pendingRecovery.tick,distanceToGoal:pendingRecovery.initialDistance},
   after:{tick,distanceToGoal:remainingDistance,routeAvailable:available}});
  log({type:'navigation_recovery_outcome',...outcome,measuredDisplacement:d,learned:false});
  const recommendation=navRecovery.recommendation(pendingRecovery.situationId);
  if(recommendation==='table_goal')log({type:'navigation_recovery_goal_tabling_recommended',situationId:pendingRecovery.situationId,decisionId:pendingRecovery.decisionId,reason:'attempt_budget_exhausted',learned:false});
  pendingRecovery=null;
 };
 const recoverTrap=(p,reason)=>{
  if(!connectedExplore||stalls<3)return false;
  const plan=planTrapRecovery({origin:p,health:bot.health,
   blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false),failed:failedConnected,
   maxDrop:canopyDescent?3:1});
  log({type:'trap_recovery_audit',reason,decisionId:activeDecision?.decisionId??null,
   outcome:plan.reason,examined:plan.examined??0,selected:plan.selected?.position??null,
   health:bot.health,stalls,learned:false,informationAccess:'privileged_mineflayer_state'});
  if(!plan.selected)recordNavigationImpossible(p,reason);
  if(plan.selected){
   const q=plan.selected.position;
   const unsafe=isHazardAdjacent({x:q.x,y:q.y,z:q.z,blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false)});
   if(unsafe){log({type:'trap_recovery_hazard_rejected',decisionId:activeDecision?.decisionId??null,position:q,reason:'hazard_or_unknown_near_destination',learned:false});return false;}
   setGoal('trap_recovery',q,1);
   if(navRecovery&&!pendingRecovery){
    const situationId=observedSituation(p);
    if(!navRecovery.situations.has(situationId))recordNavigationImpossible(p,reason);
    const attemptId=String(++recoverySerial);
    const accepted=navRecovery.beginRecovery({situationId,attemptId,method:'existing_trap_recovery'});
    if(accepted.accepted){
     pendingRecovery={situationId,attemptId,tick,decisionId:activeDecision?.decisionId??null,origin:{x:p.x,z:p.z},destination:{x:q.x,y:q.y,z:q.z},initialDistance:Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)};
     log({type:'navigation_recovery_attempt',situationId,attemptId,method:'existing_trap_recovery',decisionId:activeDecision?.decisionId??null,learned:false});
    }else if(accepted.recommendation==='table_goal'){
     log({type:'navigation_recovery_goal_tabling_recommended',situationId,reason:accepted.reason,learned:false});
    }
   }
   return true;
  }
  return false;
 };
 const cancel=()=>{nativeRouteGate.reset();clearGoal();bot.clearControlStates();bot.deactivateItem?.();lastPosition=null;stalls=0;};
 const death=()=>{if(ended||dead)return;pendingRecovery=null;for(const event of canopyTracker.reset('death'))log(event);dead=true;bot.__craftleActiveDecision=null;life++;sequences.death();decisionController.terminal();cancel();};
 const spawn=()=>{if(ended)return;pendingRecovery=null;for(const event of canopyTracker.reset('respawn'))log(event);dead=false;bot.__craftleActiveDecision=null;life++;decisionController.truncate?.();cancel();};
 const reached=()=>{goal=null;};
 const pathUpdate=result=>{if(result.status==='noPath'&&goal){const failed={...goal};markConnectedFailure(failed);if(groundedExplore&&failed.key==='explore'){failedExplore.add([Math.floor(failed.x),Math.floor(failed.z)].join(','));if(failedExplore.size>256)failedExplore.clear();}clearGoal();log({type:'target_navigation_result',status:'noPath',life,decisionId:activeDecision?.decisionId??null,skill:activeDecision?.skill??null,goal:failed,position:bot.entity?.position?{x:bot.entity.position.x,y:bot.entity.position.y,z:bot.entity.position.z}:null,pathStatus:result.status});}};
 const pathReset=reason=>log({type:'native_pathfinder_reset',reason,
  decisionId:activeDecision?.decisionId??null,goal:goal?{...goal}:null,learned:false});
 const pathDiagnostics=result=>{
  if(['success','partial','timeout'].includes(result?.status))
   log({type:'native_pathfinder_update',...summarizePathUpdate(result),
    decisionId:activeDecision?.decisionId??null,goal:goal?{...goal}:null,learned:false});
 };
 const setGoal=(key,p,range=1,horizontal=false)=>{
  const requested={key,x:p.x,y:p.y,z:p.z};
  const replacement=shouldReplaceNavigationGoal({current:goal,requested,now:clock(),stalls});
  if(!replacement.replace)return;
  if(goal)log({type:'navigation_goal_replanned',previous:{...goal},requested,reason:replacement.reason,learned:false});
  goal={key,x:p.x,y:p.y,z:p.z,at:clock()};
  log({type:'target_navigation_goal',decisionId:activeDecision?.decisionId??null,skill:activeDecision?.skill??null,goal:{...goal},range,horizontal});
  bot.pathfinder.setGoal(horizontal?new GoalXZ(Math.floor(p.x),Math.floor(p.z)):new GoalNear(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z),range));
 };
 const step=async()=>{
  if(ended||dead||busy||!bot.entity||bot.health<=0)return;
  busy=true;const epoch=life,valid=()=>!ended&&!dead&&epoch===life;
  try{
   let p=bot.entity.position;
   if(discovery){
    discovery.sample({position:p,dimension:bot.game?.dimension??'overworld',
     blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false),
     entities:Object.values(bot.entities??{})});
    saveDiscovery();
   }
   if(connectedExplore){
    const underfoot=bot.blockAt(p.offset(0,-0.3,0),false)?.name??null;
    for(const event of canopyTracker.sample({position:p,underfoot,life,health:bot.health,food:bot.food}))log(event);
   }
   const displacement=lastPosition?Math.hypot(p.x-lastPosition.x,p.z-lastPosition.z):0;
   stalls=lastPosition&&displacement<0.3?stalls+1:0;
   if(stalls===3&&['explore','canopy_egress'].includes(goal?.key)&&connectedExplore){markConnectedFailure(goal);log({type:'connected_navigation_recovery',reason:'three_low_displacement_samples',failedGoal:{...goal},learned:false});clearGoal();}
   if(stalls===3||stalls===8)log({type:'target_navigation_stall',decisionId:activeDecision?.decisionId??null,stalls,displacement,goal:goal?{...goal}:null,position:{x:p.x,y:p.y,z:p.z}});
   if(connectedExplore&&(stalls===3||stalls===8||(stalls>8&&stalls%100===0))){
    const at=(dy)=>{const b=bot.blockAt(p.offset(0,dy,0),false);return b?{name:b.name,boundingBox:b.boundingBox,position:{x:b.position.x,y:b.position.y,z:b.position.z}}:null;};
    const footing=diagnoseFooting({position:p,onGround:bot.entity.onGround??null,
     blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false)});
    log({type:'navigation_footing_diagnostic',stalls,decisionId:activeDecision?.decisionId??null,
     ...footing,learned:false,informationAccess:'privileged_mineflayer_state'});
    log({type:'navigation_immobility_audit',stalls,decisionId:activeDecision?.decisionId??null,
     position:{x:p.x,y:p.y,z:p.z},onGround:bot.entity.onGround??null,
     isInWater:Boolean(bot.entity.isInWater),isInLava:Boolean(bot.entity.isInLava),
     velocity:bot.entity.velocity?{x:bot.entity.velocity.x,y:bot.entity.velocity.y,z:bot.entity.velocity.z}:null,
     footMinusPointThree:at(-0.3),footMinusOne:at(-1),feet:at(0),head:at(1),
     pathGoal:goal?{...goal}:null,learned:false,informationAccess:'privileged_mineflayer_state'});
   }
   if(connectedExplore&&(stalls===3||stalls===8)&&process.env.CRAFTLE_DIG_NAVIGATION_AUDIT==='1'){
    log({type:'native_dig_neighbor_audit',stalls,decisionId:activeDecision?.decisionId??null,
     ...auditDiggingNeighbors({bot,Movements,configure:configurePathfinderSafety,position:p,mode:traversalMode}),
     learned:false,executed:false,informationAccess:'privileged_mineflayer_state'});
   }
   if(connectedExplore&&stalls>=3&&clock()-lastLookScan>=12000){
    lastLookScan=clock();
    const blockAt=(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false);
    const surroundings=inspectLedge({position:p,blockAt});
    log({type:'trap_visual_survey',stalls,decisionId:activeDecision?.decisionId??null,
     position:{x:p.x,y:p.y,z:p.z},...surroundings,learned:false,
     informationAccess:'privileged_mineflayer_state'});
    // Looking changes camera heading only. It does not move, jump, dig or choose a policy action.
    const yaw=bot.entity.yaw+Math.PI/2;
    try{await bot.look(yaw,Math.PI/12,true);}
    catch(e){log({type:'trap_visual_survey_error',message:e.message});}
    if(!valid())return;
   }
   // Periodically inspect safe descent while traversing leaves, not only when stationary.
   // The connected canopy-waypoint fallback can otherwise keep stalls at zero indefinitely.
   const canopyUnderfoot=bot.blockAt(p.offset(0,-0.3,0),false)?.name??null;
   const onLeafCanopy=canopyUnderfoot?.includes('leaves')??false;
   if(shouldInspectCanopyStepdown({enabled:canopyStepdown,connected:connectedExplore,stalls,onLeafCanopy,elapsedMs:clock()-lastStepdown})){
    lastStepdown=clock();
    const candidate=findCanopyStepdown({position:p,health:bot.health,
     blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false)});
    log({type:'canopy_stepdown_plan',reason:candidate.reason,selected:candidate.selected,
     decisionId:activeDecision?.decisionId??null,onLeafCanopy,stalls,learned:false});
    if(candidate.selected&&bot.waitForTicks){
     clearGoal();
     const start={x:p.x,y:p.y,z:p.z},q=candidate.selected;
     try{
      await bot.lookAt(p.offset(q.dx*2,0,q.dz*2),true);
      if(!valid())return;
      bot.setControlState('forward',true);
      for(let n=0;n<5;n++){
       await bot.waitForTicks(3);
       if(!valid())break;
       const current=bot.entity.position;
       // Stop at an observed landing or after a bounded movement attempt.
       if(current.y<=q.y+0.1||Math.hypot(current.x-start.x,current.z-start.z)>1.4)break;
      }
     }finally{bot.setControlState('forward',false);}
     if(!valid())return;
     const end=bot.entity.position;
     log({type:'canopy_stepdown_execution',start,end:{x:end.x,y:end.y,z:end.z},
      selected:q,displacement:Math.hypot(end.x-start.x,end.z-start.z),
      healthBefore:null,healthAfter:bot.health,learned:false});
     lastPosition={x:end.x,z:end.z};
     return;
    }
   }
   // Emergency locomotion primitive: do not let alternating explore/retreat
   // objectives replace a verified canopy escape before reaching the ground.
   // This is SCRIPTED assistance, not a DQN choice or a learned skill.
   if(canopyGroundRoute&&connectedExplore&&onLeafCanopy){
    const escape=planCanopyGroundRoute({
     origin:p,health:bot.health,maxWaypoints:2,
     blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false),
     avoid:failedConnected
    });
    if(escape.selected){
     const waypoint=escape.selected.position;
     const was=goal?.key==='canopy_egress';
     setGoal('canopy_egress',waypoint,1,false);
     if(!was||tick%10===0)log({type:'canopy_egress_execution_audit',
      reason:escape.reason,routeSteps:escape.routeSteps??null,waypoint,
      goal:goal?{...goal}:null,health:bot.health,food:bot.food,
      examined:escape.examined,learned:false,
      informationAccess:'privileged_mineflayer_state'});
     // This branch exits before the normal DQN decision/accounting footer.
     // Keep movement-stall detection and periodic audit cadence operational.
     lastPosition={x:p.x,z:p.z};
     tick++;
     return;
    }
    if(tick%10===0)log({type:'canopy_egress_no_route',reason:escape.reason,
     health:bot.health,food:bot.food,examined:escape.examined,
     frontierNodes:escape.frontierNodes??null,learned:false,
     informationAccess:'privileged_mineflayer_state'});
   }
   if(goal?.key==='canopy_egress'){
    const old={...goal};clearGoal();
    log({type:'canopy_egress_released',reason:onLeafCanopy?'no_verified_route':'nonleaf_footing',
     previous:old,learned:false});
   }
   settleRecovery(p);
   const now=clock();
   const sampleAudit=targetAuditEnabled&&(lastTargetAudit===0||now-lastTargetAudit>=15000);
   const observation=observeTargets(bot,{hostileNames:HOSTILE_MOBS,blocked:stalls>=3,displacement,
    audit:sampleAudit?details=>log({type:'target_perception_audit',...details}):null});
   if(sampleAudit)lastTargetAudit=now;
   const proposed=decisionController.choose(observation);
   const choice=typeof proposed?.then==='function'?await proposed:proposed;
   if(!valid())return;
   p=bot.entity.position;
   if(previousFoodUnits!==null)sequences.inventory({before:previousFoodUnits,after:observation.foodUnits});
   previousFoodUnits=observation.foodUnits;
   sequences.decision(choice);
   activeDecision={decisionId:choice.decisionId,skill:choice.skill,targetId:choice.targetId};
   bot.__craftleActiveDecision=activeDecision;
   const current=observeTargets(bot,{hostileNames:HOSTILE_MOBS,blocked:stalls>=3,displacement});
   const target=current.targets.find(t=>t.id===choice.targetId);
   if(['approach','harvest','attack'].includes(choice.skill)&&!target){clearGoal();log({type:'target_action_rejected',decisionId:choice.decisionId,reason:'target_no_longer_available'});return;}
   if(choice.skill==='approach'&&target){setGoal(target.id,target.position,target.kind==='drop'?0:1);}
   else if(choice.skill==='explore'){
    if(goal?.key!=='explore'||stalls>=3||clock()-goal.at>=15000){
     if(groundedExplore){
      const canopyRoute=canopyGroundRoute&&connectedExplore&&bot.blockAt(p.offset(0,-0.3,0),false)?.name?.includes('leaves')
       ? planCanopyGroundRoute({origin:p,blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false),health:bot.health,avoid:failedConnected})
       : null;
      if(canopyRoute)log({type:'canopy_ground_route_audit',decisionId:activeDecision?.decisionId??null,
       reason:canopyRoute.reason,selected:canopyRoute.selected?.position??null,routeSteps:canopyRoute.routeSteps??null,
       examined:canopyRoute.examined,maxDrop:canopyRoute.maxDrop??null,
       path:canopyRoute.route?.length?canopyRoute.route.slice(0,40).map(n=>({x:n.x,y:n.y,z:n.z,footing:n.ground})):[],
       learned:false,informationAccess:'privileged_mineflayer_state'});
      const choice=canopyRoute?.selected
       ? {...canopyRoute,reason:canopyRoute.reason,examined:canopyRoute.examined}
       : connectedExplore
        ? chooseConnectedExploreGoal({origin:p,blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false),avoid:failedConnected,allowShortDescent:canopyDescent,scoreNode:explorationNoveltyScore})
        : chooseGroundedExploreGoal({origin:p,blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false),failed:failedExplore,seed:tick});
      log({type:'grounded_exploration_candidates',decisionId:activeDecision?.decisionId,viableCandidates:choice.viableCandidates,totalCandidates:choice.totalCandidates,chosen:choice.selected?.position??null,ground:choice.selected?.ground??null,leafFooting:choice.selected?.leaves??null});
      if(connectedExplore)log({type:'connected_exploration_audit',decisionId:activeDecision?.decisionId,reason:choice.reason,examined:choice.examined,selected:choice.selected?.position??null,footing:choice.selected?.ground??null,learned:false});
      if(choice.selected){
       const prevGoal=goal;
       setGoal('explore',choice.selected.position,1,false);
       if(goal!==prevGoal&&goal?.key==='explore'){
        rememberExploreDestination(choice.selected.position);
        log({type:'exploration_novelty_goal',selected:choice.selected.position,recentDestinations:recentExploreDestinations.length,learned:false});
       }
      }
      else{
       clearGoal();
       let found=false;
       if(nativeDiscovery&&connectedExplore){
        const gate=nativeRouteGate.check({position:p,now:clock()});
        if(gate.allow){
         const probe=discoverNativeRoute({position:p,pathfinder:bot.pathfinder,movements,GoalNearXZ,seed:tick});
         if(probe.selected)nativeRouteGate.succeeded();
         else nativeRouteGate.failed({position:p,now:clock()});
         log({type:'native_route_discovery_audit',decisionId:activeDecision?.decisionId??null,
          reason:probe.reason,probes:probe.probes,selected:probe.selected,
          executor:{isMoving:bot.pathfinder.isMoving?.()??null,hasGoal:Boolean(bot.pathfinder.goal),
           activeGoal:goal?{...goal}:null,onGround:bot.entity?.onGround??null,
           velocity:bot.entity?.velocity?{x:bot.entity.velocity.x,y:bot.entity.velocity.y,z:bot.entity.velocity.z}:null},
          learned:false});
         if(probe.selected){setGoal('explore',probe.selected,2,true);found=true;}
         else log({type:'navigation_requires_nonwalking_recovery',decisionId:activeDecision?.decisionId??null,
          reason:'no_verified_native_route',at:{x:p.x,y:p.y,z:p.z},learned:false});
        }else if(stalls===3||stalls===8)log({type:'native_route_probe_suppressed',...gate,learned:false});
       }
       if(!found)recoverTrap(p,'explore_no_connected_route');
       log({type:'grounded_exploration_no_safe_goal',decisionId:activeDecision?.decisionId});
      }
     }else{const a=tick*2.399963229728653;setGoal('explore',{x:p.x+Math.cos(a)*16,y:p.y,z:p.z+Math.sin(a)*16},1,true);}
    }
   }else if(choice.skill==='retreat'){
    const threats=Object.values(bot.entities).filter(e=>e?.position&&HOSTILE_MOBS.has(e.name));
    threats.sort((a,b)=>a.position.distanceTo(p)-b.position.distanceTo(p));const threat=threats[0];
    if(threat){
     if(connectedExplore){
      const startDistance=Math.hypot(p.x-threat.position.x,p.z-threat.position.z);
      const escape=canopyGroundRoute&&bot.blockAt(p.offset(0,-0.3,0),false)?.name?.includes('leaves')
       ? planCanopyGroundRoute({origin:p,blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false),health:bot.health,avoid:failedConnected})
       : null;
      const escapeDistance=escape?.selected?.position
       ? Math.hypot(escape.selected.position.x-threat.position.x,escape.selected.position.z-threat.position.z)
       : -Infinity;
      // Never replace a retreat with a route that moves toward the currently nearest threat.
      const useEscape=escape?.selected&&escapeDistance>=startDistance-0.5;
      if(escape)log({type:'canopy_retreat_ground_route_audit',decisionId:choice.decisionId,
       reason:escape.reason,selected:escape.selected?.position??null,routeSteps:escape.routeSteps??null,
       examined:escape.examined,threatDistanceBefore:startDistance,threatDistanceAtWaypoint:escapeDistance,
       accepted:Boolean(useEscape),learned:false,informationAccess:'privileged_mineflayer_state'});
      const route=useEscape?escape:chooseConnectedExploreGoal({
       origin:p,
       blockAt:(x,y,z)=>bot.blockAt(p.offset(x-p.x,y-p.y,z-p.z),false),
       avoid:failedConnected,
       allowShortDescent:canopyDescent,
       scoreNode:(n)=>Math.hypot(n.x-threat.position.x,n.z-threat.position.z)-startDistance-n.cost*.15
      });
      log({type:'connected_retreat_audit',decisionId:choice.decisionId,reason:route.reason,examined:route.examined,
       selected:route.selected?.position??null,underfoot:bot.blockAt(p.offset(0,-0.3,0),false)?.name??null,learned:false});
      if(route.selected)setGoal('retreat',route.selected.position,1);
      else {clearGoal();recoverTrap(p,'retreat_no_connected_route');}
     }else{
      const dx=p.x-threat.position.x,dz=p.z-threat.position.z,len=Math.max(0.01,Math.hypot(dx,dz));
      setGoal('retreat',{x:p.x+dx/len*12,y:p.y,z:p.z+dz/len*12},2);
     }
    }else clearGoal();
   }else{
    clearGoal();
    if(choice.skill==='eat'){
     const item=bot.inventory.items().find(item=>edible(bot,item));
     if(item&&bot.food<20){await bot.equip(item,'hand');if(!valid())return;const before=bot.food;await bot.consume();if(!valid())return;const credited=decisionController.consumed(choice.decisionId,before,bot.food);sequences.consumed({before,after:bot.food,decisionId:choice.decisionId});log({type:bot.food>before?'target_consumed':'target_consume_no_hunger_gain',decisionId:choice.decisionId,item:item.name,beforeFood:before,afterFood:bot.food,credited});}
    }else if(choice.skill==='harvest'&&target?.kind==='plant'&&target.reachable){
     const block=bot.blockAt(p.offset(target.position.x-p.x,target.position.y-p.y,target.position.z-p.z)),action=foodPlantAction(block);
     if(action&&bot.canSeeBlock?.(block)){
      const before={name:block.name,stateId:block.stateId??null,properties:block.getProperties?.()??null};
      log({type:'target_harvest_intent',timestampMs:clock(),decisionId:choice.decisionId,targetId:target.id,targetPosition:{x:block.position.x,y:block.position.y,z:block.position.z},plant:block.name});
      if(action==='dig')await bot.dig(block);else await bot.activateBlock(block);
      if(!valid())return;
      const afterBlock=bot.blockAt(block.position);
      const after={name:afterBlock?.name??null,stateId:afterBlock?.stateId??null,properties:afterBlock?.getProperties?.()??null};
      const changed=before.stateId!==null&&after.stateId!==null?before.stateId!==after.stateId:JSON.stringify(before)!==JSON.stringify(after);
      log({type:'target_harvest_block_observation',timestampMs:clock(),decisionId:choice.decisionId,targetId:target.id,targetPosition:{x:block.position.x,y:block.position.y,z:block.position.z},action,before,after,changed,evidence:'client_world_observation_not_server_confirmation'});
      log({type:'target_harvest_attempt',decisionId:choice.decisionId,targetId:target.id,plant:block.name});
     }
    }else if(choice.skill==='attack'&&target?.kind==='animal'){
     const entity=Object.values(bot.entities).find(e=>`entity:${e?.id}`===target.id);
     if(entity?.position&&entity.position.distanceTo(p)<3&&canSeeTargetEntity(bot,entity)){log({type:'target_attack_intent',timestampMs:clock(),decisionId:choice.decisionId,targetId:target.id,targetPosition:{x:entity.position.x,y:entity.position.y,z:entity.position.z}});await bot.lookAt(entity.position.offset(0,(entity.height??1)/2,0),true);if(!valid())return;bot.attack(entity);log({type:'target_attack_attempt',decisionId:choice.decisionId,targetId:target.id});}
    }
   }
   if(!valid())return;
   provenance.sample();lastPosition={x:p.x,z:p.z};tick++;
   log({type:'target_action',life,...choice,health:bot.health,food:bot.food,position:{x:p.x,y:p.y,z:p.z}});
  }catch(error){if(valid())log({type:'target_runtime_error',message:error.message});}finally{busy=false;}
 };
 const stop=()=>{if(ended)return;
  if(discovery)try{discovery.save(true);}catch(error){log({type:'discovery_memory_save_error',message:error.message});}for(const event of canopyTracker.reset('agent_stopped'))log(event);ended=true;bot.__craftleActiveDecision=null;life++;if(timer)clearInterval(timer);decisionController.stop();provenance.stop();sequences.stop();if(autoEatControl){bot.autoEat.disableAuto();bot.autoEat.cancelEat();}for(const [event,listener] of [['death',death],['spawn',spawn],['goal_reached',reached],['path_update',pathUpdate],['path_update',pathDiagnostics],['path_reset',pathReset],['end',stop]])bot.removeListener(event,listener);cancel();};
 bot.on('death',death);bot.on('spawn',spawn);bot.on('goal_reached',reached);bot.on('path_update',pathUpdate);bot.on('path_update',pathDiagnostics);bot.on('path_reset',pathReset);bot.once('end',stop);
 if(autoStart)timer=setInterval(()=>void step(),intervalMs);
 return {step,stop};
}
