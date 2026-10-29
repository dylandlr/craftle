// Bounded, non-learning recovery from locally observed navigation stalls.
// No teleport, digging, world mutation, unknown-block assumptions or policy override.
import {chooseConnectedExploreGoal} from './connected-exploration.js';
export function planTrapRecovery({origin,blockAt,failed=new Set(),maxDrop=3,health=20}={}){
 if(!origin||typeof blockAt!=='function')return {selected:null,reason:'missing_local_observation'};
 // At low health never request a multi-block drop; movement still requires a pathfinder route.
 const canDrop=Number.isFinite(health)&&health>=8&&maxDrop>=2;
 const route=chooseConnectedExploreGoal({
  origin,blockAt,radius:6,maxNodes:240,avoid:failed,
  allowShortDescent:canDrop,
  scoreNode:(node,{origin:o,netDistance})=>{
   const rise=node.y-o.y;
   return netDistance*0.8-node.cost*.28-(rise>0?rise*2:0)+(rise<0?Math.min(-rise,3)*.9:0);
  }
 });
 return {...route,recovery:true,source:'local_loaded_blocks',maxDrop:canDrop?3:1,
  reason:route.selected?'verified_connected_candidate':route.reason};
}
export function createTrapMonitor({threshold=3}={}){
 let last=null,streak=0;
 return {
  observe({position,displacement=0,attempted=false}={}){
   if(!position||![position.x,position.y,position.z].every(Number.isFinite)){
    streak=0;last=null;return {trapped:false,streak:0,reason:'no_position'};
   }
   const stationary=last&&Math.hypot(position.x-last.x,position.z-last.z)<.3;
   streak=attempted&&stationary&&displacement<.3?streak+1:0;
   last={x:position.x,z:position.z};
   return {trapped:streak>=threshold,streak,reason:streak>=threshold?'repeated_failed_movement':'monitoring'};
  },
  reset(){last=null;streak=0;}
 };
}
