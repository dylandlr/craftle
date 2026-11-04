import test from 'node:test';
import assert from 'node:assert/strict';
import {executeShortDescent} from '../src/descent-executor.js';
const p=(x,y,z)=>({x,y,z,offset(dx,dy,dz){return p(x+dx,y+dy,z+dz)}});
const candidate={kind:'step_down',verified:true,drop:1,x:1,y:74,z:0,dx:1,dz:0};
function bot({moves=true,damage=false}={}){
 let forward=false,ticks=0;
 return {health:1,entity:{position:p(0.5,75,0.5)},
  async lookAt(){},
  setControlState(name,on){assert.equal(name,'forward');forward=on;},
  async waitForTicks(){ticks++;if(forward&&moves){this.entity.position=p(1.5,74,0.5);
   if(damage)this.health=0;}},
  controls:()=>forward,ticks:()=>ticks};
}
test('short descent succeeds only after observed movement without damage',async()=>{
 const b=bot(),r=await executeShortDescent(b,candidate);
 assert.equal(r.ok,true);assert.equal(r.reason,'verified_descent');
 assert.equal(r.dropped,1);assert.equal(b.controls(),false);
});
test('a collision/no movement is recorded as failed execution',async()=>{
 const b=bot({moves:false}),r=await executeShortDescent(b,candidate);
 assert.equal(r.ok,false);assert.equal(r.reason,'no_observed_descent');
 assert.equal(b.controls(),false);
});
test('fall damage prevents claiming a successful safe descent',async()=>{
 const b=bot({damage:true}),r=await executeShortDescent(b,candidate);
 assert.equal(r.ok,false);assert.equal(r.reason,'unexpected_damage');
 assert.equal(r.healthLoss,1);assert.equal(b.controls(),false);
});
test('wrong action type never activates controls',async()=>{
 const b=bot(),r=await executeShortDescent(b,{...candidate,kind:'risky_drop'});
 assert.equal(r.ok,false);assert.equal(b.ticks(),0);
});
