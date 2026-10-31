// Pure observational detector for navigation deadlocks; no direct bot controls.
// Use server-position samples and motion intent; do not infer a dirt collision from a camera image.
export class NavigationDeadlockMonitor {
 constructor({minimumSamples=4,minDisplacement=0.35,minDurationTicks=60,cooldownTicks=100}={}){
  if(!Number.isSafeInteger(minimumSamples)||minimumSamples<2||![minDisplacement,minDurationTicks,cooldownTicks].every(x=>Number.isFinite(x)&&x>=0))throw Error('Invalid thresholds');
  Object.assign(this,{minimumSamples,minDisplacement,minDurationTicks,cooldownTicks});
  this.samples=[];this.lastFlagTick=-Infinity;this.intentKey=null;
 }
 sample({tick,position,goalId=null,moving=false,mode='navigation',pathStatus=null,frontBlock=null}){
  if(!Number.isSafeInteger(tick)||tick<0||!position||![position.x,position.y,position.z].every(Number.isFinite))throw Error('Invalid sample');
  if(this.samples.length&&tick<=this.samples.at(-1).tick)throw Error('Ticks must increase');
  const key=JSON.stringify([goalId,mode]);
  if(!moving||mode!=='navigation'||!goalId||key!==this.intentKey){this.samples=[];this.intentKey=key;}
  if(!moving||mode!=='navigation'||!goalId)return {deadlocked:false,reason:'no_navigation_intent'};
  this.samples.push({tick,position:{...position},pathStatus,frontBlock});
  if(this.samples.length>this.minimumSamples)this.samples.shift();
  if(this.samples.length<this.minimumSamples)return {deadlocked:false,reason:'insufficient_samples'};
  const first=this.samples[0],last=this.samples.at(-1),durationTicks=last.tick-first.tick;
  const displacement=Math.hypot(last.position.x-first.position.x,last.position.y-first.position.y,last.position.z-first.position.z);
  const deadlocked=durationTicks>=this.minDurationTicks&&displacement<this.minDisplacement&&tick-this.lastFlagTick>=this.cooldownTicks;
  if(deadlocked)this.lastFlagTick=tick;
  return {schema:'craftle.navigation-deadlock.v1',deadlocked,reason:deadlocked?'persistent_low_displacement':'moving_or_window_too_short',
   goalId,mode,durationTicks,displacement,frontBlock:last.frontBlock??null,pathStatus:last.pathStatus??null,
   evidenceSource:'agent_observation',attribution:'possible_navigation_deadlock_not_proven_collision'};
 }
 reset(){this.samples=[];this.intentKey=null;}
}
