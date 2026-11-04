// Bounded embodied primitive for the safe one-block candidate from unified-descent.
// The controller must not count a completed action until the observed pose changed.
export async function executeShortDescent(bot,candidate,{valid=()=>true,waitTicks=3,maxSamples=6}={}){
 if(candidate?.kind!=='step_down'||candidate?.verified!==true||candidate.drop!==1)
  return {ok:false,reason:'not_verified_short_step'};
 if(!bot?.entity?.position||typeof bot.lookAt!=='function'||
  typeof bot.waitForTicks!=='function'||typeof bot.setControlState!=='function')
  return {ok:false,reason:'missing_minecraft_actuator'};
 const before=bot.entity.position;
 const start={x:before.x,y:before.y,z:before.z,health:bot.health};
 let thrown=null;
 try{
  await bot.lookAt(before.offset(candidate.dx*2,0,candidate.dz*2),true);
  if(!valid())return {ok:false,reason:'stale_life'};
  bot.setControlState('forward',true);
  for(let i=0;i<maxSamples;i++){
   await bot.waitForTicks(waitTicks);
   if(!valid())break;
   const p=bot.entity.position;
   if(p.y<=candidate.y+0.15||Math.hypot(p.x-start.x,p.z-start.z)>=1.5)break;
  }
 }catch(error){thrown=error;}finally{bot.setControlState('forward',false);}
 const p=bot.entity.position;
 const displacement=Math.hypot(p.x-start.x,p.z-start.z);
 const dropped=start.y-p.y;
 const observed=valid()&&dropped>=0.75&&
  Math.hypot(p.x-(candidate.x+0.5),p.z-(candidate.z+0.5))<=1.4;
 const healthLoss=Number.isFinite(start.health)&&Number.isFinite(bot.health)?
   Math.max(0,start.health-bot.health):null;
 const ok=observed&&healthLoss===0&&!thrown;
 return {ok,reason:thrown?'execution_error':!observed?'no_observed_descent':
  healthLoss!==0?'unexpected_damage':'verified_descent',
  before:start,after:{x:p.x,y:p.y,z:p.z,health:bot.health},
  displacement,dropped,healthLoss,message:thrown?.message??null};
}
