// Read-only projection for the native Fabric spectator HUD.
// All fields are derived from agent-observed event logs, never game commands.
import {readObservatoryEvents} from './spectator-observatory-data.js';
export function readHudState(root){
 const events=readObservatoryEvents(root,{tailBytes:4*1024*1024,limit:1800});
 const last=type=>{for(let i=events.length-1;i>=0;i--)if(events[i].type===type)return events[i];return null;};
 const decision=last('target_decision'),action=last('target_action'),density=last('spectator_density_audit');
 const transition=last('target_transition'),navigation=last('target_navigation_result');
 const death=last('death_screen_observed'),respawn=last('life_feedback_available');
 const points=events.filter(e=>e.type==='pose_sample'&&e.position&&
  ['x','y','z'].every(k=>Number.isFinite(e.position[k]))).slice(-120)
  .map(e=>({x:e.position.x,y:e.position.y,z:e.position.z,t:e.timestamp}));
 const current=points.at(-1)??(action?.position??null);
 const poses=events.filter(e=>e.type==='pose_sample'&&Number.isFinite(e.yaw)&&Number.isFinite(e.pitch));
 const pose=poses.at(-1);
 const gaze=pose?{yaw:pose.yaw,pitch:pose.pitch,timestamp:pose.timestamp,
   history:poses.slice(-24).map(e=>({yaw:e.yaw,pitch:e.pitch,t:e.timestamp})),
   source:'mineflayer_head_orientation',learnedAttention:false,raycastHit:null}:null;
 const targets=(decision?.targets??[]).slice(0,4).map(t=>({
  kind:t.kind??null,distance:Number.isFinite(t.distance)?t.distance:null,
  reachable:t.reachable===true,relative:current&&t.position?{
   x:t.position.x-current.x,z:t.position.z-current.z}:null
 }));
 const newest=events.at(-1);
 return {schema:'craftle.native-hud.v1',readOnly:true,source:'filming_agent_jsonl',
  timestamp:newest?.timestamp??null,ageMs:newest?Date.now()-Date.parse(newest.timestamp):null,
  agent:'Turesla',decisionId:decision?.decisionId??null,
  action:decision?.action??action?.skill??null,health:action?.health??null,food:action?.food??null,
  position:current,points,targets,gaze,availableActions:decision?.mask?.filter(Boolean).length??null,
  reward:Number.isFinite(transition?.reward)?transition.reward:null,
  updates:transition?.updates??null,
  latestNavigation:navigation?{status:navigation.status,decisionId:navigation.decisionId,at:navigation.timestamp}:null,
  deaths:events.filter(e=>e.type==='death_screen_observed').length,
  lastDeathAt:death?.timestamp??null,
  lastRespawnAt:respawn?.timestamp??null,
  perception:{source:'policy_input_only',decisionId:decision?.decisionId??null,targetCount:targets.length,
    targets:targets.map(t=>({kind:t.kind,distance:t.distance,reachable:t.reachable})),
    note:'Observer nav/footing diagnostics are NOT DQN inputs'},
  density:density?{occupancyRatio:density.occupancyRatio,underfoot:density.underfootBlock,
    leaves:density.nearbyLeaves,at:density.timestamp}:null,
  events:events.filter(e=>['target_navigation_result','death_screen_observed','target_consumed',
    'target_verified_recovery','target_action_rejected','target_navigation_stall'].includes(e.type))
    .slice(-5).map(e=>({type:e.type,at:e.timestamp}))};
}
