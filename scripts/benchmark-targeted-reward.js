// Deterministic abstract food-loop experiment against the REAL Craftle
// targeted controller and DQN implementation. No Minecraft, no network,
// no real checkpoint modifications. Results are a capability smoke test,
// NOT evidence of in-world food acquisition or generalization.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createTargetedController} from '../src/targeted-controller.js';
import {TARGET_ACTIONS,encodeTargets} from '../src/target-opportunities.js';
const seeds=[1,7,19,42,101];
function mean(a){return a.reduce((x,y)=>x+y,0)/a.length;}
function runEpisode({controller,steps,decayEvery=8}){
 const world={health:20,food:10,units:0,x:0,displacement:0};const stats={
  decisions:0,explore:0,harvest:0,eat:0,retreat:0,
  verifiedEats:0,deaths:0,newCells:new Set(),foodGains:0};
 for(let t=0;t<steps;t++){
  // Plant is deliberately always reachable: a synthetic controllability test.
  // Explore displaces the agent and accesses novelty rewards by construction.
  const obs={health:world.health,food:world.food,foodAvailable:world.units>0,
   foodUnits:world.units,foodPoints:world.units*2,hostileDistance:24,
   blocked:false,displacement:world.displacement,
   position:{x:world.x,y:70,z:0},targets:[{id:'plant:synthetic',kind:'plant',
    position:{x:world.x+2,y:70,z:0},distance:2,visible:true,reachable:true}]};
  const choice=controller.choose(obs);stats.decisions++;
  world.displacement=0;
  if(choice.skill==='explore'){world.x+=9;world.displacement=9;stats.explore++;}
  if(choice.skill==='harvest'){world.units++;stats.foodGains++;stats.harvest++;}
  if(choice.skill==='eat'){
   const before=world.food;if(world.units>0&&world.food<20){
    world.food=Math.min(20,world.food+6);world.units--;
    if(controller.consumed(choice.decisionId,before,world.food))stats.verifiedEats++;
   }
   stats.eat++;
  }
  if(choice.skill==='retreat')stats.retreat++;
  stats.newCells.add(Math.floor(world.x/8));
  if((t+1)%decayEvery===0)world.food=Math.max(0,world.food-1);
  if(world.food===0&&t%2===0)world.health=Math.max(0,world.health-1);
  if(world.health===0){stats.deaths++;controller.terminal();world.health=20;world.food=10;world.units=0;world.x=0;}
 }
 controller.stop();
 return {...stats,newCells:stats.newCells.size,finalHunger:world.food};
}
const actionSpace=TARGET_ACTIONS;
const contract={
  schema:'craftle.reward-abstract-benchmark.v1',seeds,
  capabilities:{eat:actionSpace.includes('eat'),harvest:actionSpace.includes('harvest_0'),
   attack:actionSpace.includes('attack_0'),approach:actionSpace.includes('approach_0'),
   explore:actionSpace.includes('explore'),retreat:actionSpace.includes('retreat'),
   mine:actionSpace.some(a=>a.startsWith('mine')),craft:actionSpace.some(a=>a.startsWith('craft')),
   place:actionSpace.some(a=>a.startsWith('place')),descend:actionSpace.some(a=>a.startsWith('descend'))},
  rewardFormulas:{v1:'credit + min(0,healthDelta)*0.7 - 0.03',
   v2:'v1 + firstCell*0.12 + min(0.45,foodGain*0.15) + min(0.03,displacement*0.01)',
   v3:'-0.03 + 0.8*healthLoss + 0.02*hungerLoss + 0.025*newCellWhenFoodAbove8 + min(0.36,foodGain*0.12) + 2*verifiedEat'},
  caveats:['Synthetic mature plant remains reachable at all times.',
   'No world physics, inventory pickup, navigation, item consumption latency, or mobs.',
   'Evaluation is an abstract frozen-policy smoke test, not a Minecraft survival benchmark.']};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-reward-probe-'));
try{
 const results=[];
 for(const version of ['v1','v2','v3']){
  for(const seed of seeds){
   const checkpoint=path.join(root,version+'-'+seed+'.json');
   const trainController=createTargetedController({checkpoint,mode:'training',seed,epsilon:0.25,rewardVersion:version});
   const train=runEpisode({controller:trainController,steps:400});
   const frozen=createTargetedController({checkpoint,mode:'frozen',seed:seed+2000,epsilon:0,rewardVersion:version});
   const evaluation=runEpisode({controller:frozen,steps:200});
   results.push({version,seed,train,evaluation});
  }
 }
 contract.results=results;
 contract.summary=['v1','v2','v3'].map(version=>{
  const group=results.filter(r=>r.version===version);
  return {version,meanFrozenEats:mean(group.map(r=>r.evaluation.verifiedEats)),
   meanFrozenExplore:mean(group.map(r=>r.evaluation.explore)),
   meanFrozenHarvests:mean(group.map(r=>r.evaluation.harvest)),
   meanFrozenDeaths:mean(group.map(r=>r.evaluation.deaths)),
   meanFrozenNewCells:mean(group.map(r=>r.evaluation.newCells))};
 });
 console.log(JSON.stringify(contract,null,2));
}finally{fs.rmSync(root,{recursive:true,force:true});}
