// Suppress repeated identical, failed native A* probes without suppressing new locations.
// Failing to find a route is not evidence that a route can never exist.
export function createNativeRouteFailureGate({cooldownMs=30000,movementThreshold=1}={}){
 let last=null;
 return {
  check({position,now}={}){
   if(!position||![position.x,position.y,position.z,now].every(Number.isFinite))
    return {allow:false,reason:'invalid_position_or_time'};
   if(last&&now>=last.at&&now-last.at<cooldownMs&&
      Math.hypot(position.x-last.x,position.y-last.y,position.z-last.z)<movementThreshold)
    return {allow:false,reason:'unchanged_failed_origin',retryAfterMs:cooldownMs-(now-last.at)};
   return {allow:true,reason:'probe_allowed'};
  },
  failed({position,now}={}){
   if(position&&Number.isFinite(now))
    last={x:position.x,y:position.y,z:position.z,at:now};
  },
  succeeded(){last=null;},
  reset(){last=null;}
 };
}
