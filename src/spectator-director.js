// Pure read-only chase-drone camera planner. No bot or Minecraft API imports.
// Produces desired camera pose for a renderer capable of applying an external camera.
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function directorShot({position,yaw=0,velocity=null,onGround=true,action=null,threatDistance=null}={}){
 if(!position||![position.x,position.y,position.z].every(finite))return null;
 const speed=velocity&&finite(velocity.x)&&finite(velocity.z)?Math.hypot(velocity.x,velocity.z):0;
 const vy=velocity&&finite(velocity.y)?velocity.y:0;
 const air=onGround===false;
 const motion=air?(vy>0.15?'jump':vy< -0.15?'fall':'airborne'):speed>4.3?'sprint':speed>0.16?'walk':'idle';
 const close=action==='attack'||action==='harvest'||(finite(threatDistance)&&threatDistance<5);
 const distance=close?4.4:speed>3?7.5:6;
 const height=close?2.5:3.6;
 const target={x:position.x,y:position.y+1.1,z:position.z};
 // Minecraft yaw has +sin(yaw) toward negative X, +cos(yaw) toward negative Z.
 // Place the camera *behind* the facing direction.
 const camera={x:target.x+Math.sin(yaw)*distance,
   y:target.y+height,z:target.z+Math.cos(yaw)*distance};
 return {camera,target,distance,height,animation:motion,zoomIntent:close?'close':'standard',
   smoothing:0.15,source:'spectator_derived_not_policy_input'};
}
export function smoothDirectorPose(previous,next,alpha=0.15){
 if(!next)return previous??null;
 if(!previous)return next;
 const t=clamp(alpha,0,1),mix=(a,b)=>a+(b-a)*t;
 return {...next,camera:{x:mix(previous.camera.x,next.camera.x),
   y:mix(previous.camera.y,next.camera.y),z:mix(previous.camera.z,next.camera.z)},
   target:{x:mix(previous.target.x,next.target.x),y:mix(previous.target.y,next.target.y),
     z:mix(previous.target.z,next.target.z)}};
}
