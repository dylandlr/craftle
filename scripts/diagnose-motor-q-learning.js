// Offline model-learning diagnostic: no Minecraft, no observer evidence, no reward credit.
// This isolates whether the existing Q network can distinguish two goal contexts.
import { createMotorQPolicy } from '../src/motor-q-policy.js';

const OPERATIONS = ['dig','place'];
const GOALS = {
  dig:{x:2,y:81,z:0},
  place:{x:-2,y:81,z:0}
};
function worldBlock(x,y,z){
  const solid = y===80 || (x===2&&y===81&&z===0);
  return {name: x===2&&y===81&&z===0?'dirt': solid?'stone':'air',
    boundingBox:solid?'block':'empty'};
}
function context(objective){
  const observation={
    position:{x:0.5,y:81,z:0.5},
    goal:{...GOALS[objective]},
    health:20,food:20,stalls:0,
    inventory:[{name:'dirt',count:1,placeable:true}],
    blockAt:worldBlock
  };
  const candidates=[
    {id:'dig:dirt-east',operation:'dig',executable:true,
      arguments:{position:{...GOALS.dig}}, evidence:{source:'observed_block',block:'dirt'}},
    {id:'place:dirt-west',operation:'place',executable:true,
      arguments:{reference:{x:-2,y:80,z:0},
      face:{x:0,y:1,z:0},itemName:'dirt'},
      evidence:{source:'observed_empty_destination_and_inventory',destination:{...GOALS.place}}}
  ];
  return {observation,candidates};
}
function scheduledGoals(count,seed,salt){
  const goals=Array.from({length:count},(_,i)=>i%2?'place':'dig');
  let s=(seed+salt)>>>0;
  for(let i=goals.length-1;i>0;i--){
    s=(Math.imul(s,1664525)+1013904223)>>>0;
    const j=s%(i+1);
    [goals[i],goals[j]]=[goals[j],goals[i]];
  }
  return goals;
}
function evaluate(snapshot,seed,alpha){
  const policy=createMotorQPolicy({seed,epsilon:0,hidden:24,alpha,training:false,snapshot});
  const margins=Object.fromEntries(OPERATIONS.map(goal=>{
    const {observation,candidates}=context(goal);
    const scored=policy.scoreCandidates(observation,candidates);
    const dig=scored.find(s=>s.operation==='dig').q;
    const place=scored.find(s=>s.operation==='place').q;
    return [goal,{preferred:dig>place?'dig':'place',
      margin:goal==='dig'?dig-place:place-dig}];
  }));
  return {
    digPreferred:margins.dig.preferred,
    placePreferred:margins.place.preferred,
    digMargin:margins.dig.margin,
    placeMargin:margins.place.margin,
    learnedBoth:margins.dig.margin>0&&margins.place.margin>0
  };
}
const rows=[];
for(const alpha of [0.015,0.03,0.05,0.1]){
  for(const seed of [17,23,41]){
    let snapshot=createMotorQPolicy({seed,epsilon:0,alpha,hidden:24}).snapshot();
    const goals=scheduledGoals(512,seed,0x51f0);
    const first=evaluate(snapshot,seed,alpha);
    rows.push({alpha,seed,updates:0,...first});
    for(let step=1;step<=512;step++){
      const {observation,candidates}=context(goals[step-1]);
      const policy=createMotorQPolicy({seed:seed+step*7919,
        epsilon:0.35,alpha,hidden:24,training:true,snapshot});
      const chosen=policy.choose(observation,candidates);
      const reward=chosen.candidate.operation===goals[step-1]?1:-1;
      policy.observe({features:chosen.features,reward,terminal:true});
      snapshot=policy.snapshot();
      if([8,32,64,128,256,512].includes(step))
        rows.push({alpha,seed,updates:step,...evaluate(snapshot,seed,alpha)});
    }
  }
}
for(const row of rows)
  console.log(JSON.stringify({alpha:row.alpha,seed:row.seed,
    updates:row.updates,learnedBoth:row.learnedBoth,
    preferredDigGoal:row.digPreferred,preferredPlaceGoal:row.placePreferred,
    digMargin:+row.digMargin.toFixed(5),
    placeMargin:+row.placeMargin.toFixed(5)}));
console.log(JSON.stringify({
  experiment:'synthetic_convergence_diagnostic_only',
  updatesDoneInMinecraft:0,
  modelsThatLearnedBothBy64:rows.filter(r=>r.updates===64&&r.learnedBoth).length,
  modelsThatLearnedBothBy128:rows.filter(r=>r.updates===128&&r.learnedBoth).length,
  modelsThatLearnedBothBy256:rows.filter(r=>r.updates===256&&r.learnedBoth).length
}));
