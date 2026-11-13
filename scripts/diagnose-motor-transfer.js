// Synthetic convergence diagnostic for the live held-out-orientation experiment.
// Mirrors candidate encoding and scheduling. No Minecraft events, rewards or
// checkpoint files are written. Outputs PREDICTIONS, not live experiment results.
import {createMotorQPolicy} from '../src/motor-q-policy.js';
import {layoutForTask,scheduleTransferTasks,assertTransferDisjoint} from '../src/motor-transfer-tasks.js';
const results=[];
function context(task) {
  const {targets}=layoutForTask(task);
  const blockAt=(x,y,z)=>{
    const isDig=x===targets.dig.x&&y===targets.dig.y&&z===targets.dig.z;
    const solid=y===80||isDig;
    return {name:isDig?'dirt':solid?'stone':'air',boundingBox:solid?'block':'empty'};
  };
  const observation={
    position:{x:0,y:81,z:0},
    goal:{...targets[task.objective]},
    health:20,food:20,stalls:0,
    inventory:[{name:'dirt',count:1,placeable:true}],blockAt
  };
  const candidates=[
    {id:'dig:'+targets.dig.x+':'+targets.dig.z,
      operation:'dig',executable:true,
      arguments:{position:{...targets.dig}},
      evidence:{source:'observed_block',block:'dirt'}},
    {id:'place:'+targets.place.x+':'+targets.place.z,
      operation:'place',executable:true,
      arguments:{reference:{x:targets.place.x,y:80,z:targets.place.z},
        face:{x:0,y:1,z:0},itemName:'dirt'},
      evidence:{source:'observed_empty_destination_and_inventory',
        destination:{...targets.place}}}
  ];
  return {observation,candidates};
}
function model(snapshot,seed,alpha,n,training){
  return createMotorQPolicy({seed:seed+n*7919,epsilon:training?0.35:0,
    alpha,hidden:24,gamma:0.95,training,snapshot});
}
function accuracy(snapshot,seed,alpha,tasks){
  const records=tasks.map((task,i)=>{
    const {observation,candidates}=context(task);
    const chosen=model(snapshot,seed,alpha,i+1,false).choose(observation,candidates);
    return {...task,ok:chosen.candidate.operation===task.objective};
  });
  return {
    overall:records.filter(x=>x.ok).length/records.length,
    dig:records.filter(x=>x.objective==='dig'&&x.ok).length/
      records.filter(x=>x.objective==='dig').length,
    place:records.filter(x=>x.objective==='place'&&x.ok).length/
      records.filter(x=>x.objective==='place').length,
    byRotation:Object.fromEntries([2,3].map(rotation=>{
      const rows=records.filter(x=>x.rotation===rotation);
      return [rotation,rows.filter(x=>x.ok).length/rows.length];
    }))
  };
}
assertTransferDisjoint();
for(const seed of [17,23,41]){
  for(const alpha of [0.015,0.05,0.1]){
    let snapshot=model(null,seed,alpha,0,false).snapshot();
    const goals=scheduleTransferTasks(256,{seed,salt:0x51f0,split:'train'});
    const holdout=scheduleTransferTasks(48,{seed,salt:0x2b71,split:'heldout'});
    const baseline=accuracy(snapshot,seed,alpha,holdout);
    const stages=[];
    for(let i=0;i<goals.length;i++){
      const task=goals[i];
      const {observation,candidates}=context(task);
      const learner=model(snapshot,seed,alpha,i+1,true);
      const selected=learner.choose(observation,candidates);
      const reward=selected.candidate.operation===task.objective?1:-1;
      learner.observe({features:selected.features,reward,terminal:true,steps:1});
      snapshot=learner.snapshot();
      if([32,64,128,256].includes(i+1))
        stages.push({updates:i+1,...accuracy(snapshot,seed,alpha,holdout)});
    }
    const row={seed,alpha,baseline,stages};
    results.push(row);
    console.log(JSON.stringify(row));
  }
}
const defaultConfig=results.find(x=>x.seed===17&&x.alpha===0.05);
console.log(JSON.stringify({
  type:'SYNTHETIC_ONLY_NO_MINECRAFT',
  trainRotations:[0,1],heldoutRotations:[2,3],
  defaultConfiguration:defaultConfig,
  seedCount:3,
  casesLearnedBothGoalsAt256:results.filter(x=>
    x.stages.at(-1).dig===1&&x.stages.at(-1).place===1).length,
  totalCases:results.length
}));
