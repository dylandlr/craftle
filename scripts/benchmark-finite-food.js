// Harder, seed-controlled resource-limited synthetic survival benchmark.
// Uses REAL controller and DQN but NO Minecraft physics/world or real checkpoint.
// Plants are finite, targets must be approached and drops picked up before eating.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createTargetedController} from '../src/targeted-controller.js';
const seeds=[1,7,19,42,101];
const versions=['v1','v2','v3'];
function run({controller,steps,seed}){
 const patches=Array.from({length:16},(_,i)=>10+i*18+(seed%3)*2);
 const plants=new Set(patches),drops=new Set();
 let x=0,food=10,health=20,inventory=0,displacement=0;
 const stats={steps:0,explore:0,approach:0,harvest:0,collect:0,eats:0,death:0,
  plantFound:0,foodCollected:0,failedHarvest:0,finalFood:0,finalHealth:0};
 for(let step=0;step<steps;step++){
  // Detect visible finite food resources in a local 24 block sensory window.
  const candidates=[...plants].filter(p=>Math.abs(p-x)<=24).map(p=>({
   id:'plant:'+p,kind:'plant',position:{x:p,y:70,z:0},distance:Math.abs(p-x),
   visible:true,reachable:Math.abs(p-x)<4.2
  })).concat([...drops].filter(p=>Math.abs(p-x)<=24).map(p=>({
   id:'drop:'+p,kind:'drop',position:{x:p,y:70,z:0},distance:Math.abs(p-x),
   visible:true,reachable:Math.abs(p-x)<1
  })));
  candidates.sort((a,b)=>(a.kind==='drop'?0:1)-(b.kind==='drop'?0:1)||a.distance-b.distance);
  const observation={health,food,foodAvailable:inventory>0,foodUnits:inventory,
   foodPoints:inventory*2,hostileDistance:24,blocked:false,displacement,
   position:{x,y:70,z:0},targets:candidates.slice(0,4)};
  const choice=controller.choose(observation);stats.steps++;
  let delta=0;
  if(choice.skill==='explore'){delta=5;stats.explore++;}
  else if(choice.skill==='approach'){
   const t=candidates.find(t=>t.id===choice.targetId);
   if(t){delta=Math.sign(t.position.x-x)*Math.min(5,Math.abs(t.position.x-x));stats.approach++;}
  }else if(choice.skill==='harvest'){
   const t=candidates.find(t=>t.id===choice.targetId);
   if(t&&t.kind==='plant'&&t.reachable&&plants.delete(t.position.x)){
    drops.add(t.position.x);stats.harvest++;stats.plantFound++;
   }else stats.failedHarvest++;
  }else if(choice.skill==='eat'&&food<20&&inventory>0){
   const before=food;food=Math.min(20,food+6);inventory--;
   if(controller.consumed(choice.decisionId,before,food))stats.eats++;
  }
  x+=delta;displacement=Math.abs(delta);
  // Drops require being physically close AFTER movement, not automatic on harvest.
  for(const p of [...drops])if(Math.abs(p-x)<1){drops.delete(p);inventory++;stats.collect++;stats.foodCollected++;}
  if((step+1)%6===0)food=Math.max(0,food-1);
  if(food===0&&(step+1)%2===0)health=Math.max(0,health-1);
  if(health===0){stats.death++;controller.terminal();x=0;food=10;health=20;inventory=0;displacement=0;}
 }
 controller.stop();stats.finalFood=food;stats.finalHealth=health;
 return stats;
}
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-resource-benchmark-'));
try{
 const results=[];
 for(const version of versions)for(const seed of seeds){
  const checkpoint=path.join(temporary,version+'-'+seed+'.json');
  const train=run({controller:createTargetedController({
   checkpoint,mode:'training',epsilon:0.25,seed,rewardVersion:version}),steps:500,seed});
  // Different plant layout from training, no training updates.
  const evaluate=run({controller:createTargetedController({
   checkpoint,mode:'frozen',epsilon:0,seed:seed+900,rewardVersion:version}),steps:250,seed:seed+100});
  results.push({version,seed,train,evaluate});
 }
 const summary=versions.map(version=>{
  const group=results.filter(r=>r.version===version);
  const mean=k=>+(group.reduce((s,r)=>s+r.evaluate[k],0)/group.length).toFixed(3);
  return {version,meanFrozenEats:mean('eats'),meanCollected:mean('collect'),
   meanHarvested:mean('harvest'),meanExplored:mean('explore'),
   meanApproaches:mean('approach'),meanDeaths:mean('death'),
   meanHungerAtEnd:mean('finalFood')};
 });
 console.log(JSON.stringify({schema:'craftle.finite-resource-benchmark.v1',
  actualController:true,syntheticMinecraft:false,trainStepsPerSeed:500,evalStepsPerSeed:250,
  trainEvalLayoutDifferent:true,plantSupplyFinite:true,foodPickupRequired:true,
  seeds,summary,results,limits:[
   'Simplified 1D movement; no pathfinding, combat, crafting, server physics, or Mineflayer inventory.',
   'Only the synthetic plant layout changes between training and frozen evaluation.',
   'A higher meal count does not imply Minecraft survival capability.'
  ]},null,2));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
