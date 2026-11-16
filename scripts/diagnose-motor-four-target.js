// Offline model diagnostic for the EXACT four-target policy task.
// Only synthetic block observations; no Minecraft evidence or training credit.
import {createMotorQPolicy} from '../src/motor-q-policy.js';
import {FOUR_TARGET_KEYS,fourTargetLayout,fourTargetTasks,
  fourTargetCandidates,fourTargetReward} from '../src/motor-four-target-tasks.js';

function context(task){
  const {targets}=fourTargetLayout(task);
  const blockAt=(x,y,z)=>{
    const dig=FOUR_TARGET_KEYS.filter(k=>k.startsWith('dig'))
      .some(k=>targets[k].x===x&&targets[k].y===y&&targets[k].z===z);
    const solid=y===80||dig;
    return {name:dig?'dirt':solid?'stone':'air',
      boundingBox:solid?'block':'empty'};
  };
  return fourTargetCandidates({
    task,position:{x:.5,y:81,z:.5},blockAt,
    inventory:[{name:'dirt',count:2,placeable:true}],
    health:20,food:20
  });
}
const model=(snapshot,seed,alpha,n,training)=>
  createMotorQPolicy({seed:seed+n*7919,epsilon:training?0.35:0,
    hidden:24,alpha,gamma:0.95,training,snapshot});
function evaluate(snapshot,seed,alpha,tasks){
  const rows=tasks.map((task,i)=>{
    const {observation,candidates}=context(task);
    const chosen=model(snapshot,seed,alpha,i+1,false)
      .choose(observation,candidates);
    return {...task,correct:chosen.candidate.id===task.goalKey};
  });
  const rate=rows=>rows.filter(r=>r.correct).length/rows.length;
  return {accuracy:rate(rows),
    byGoal:Object.fromEntries(FOUR_TARGET_KEYS.map(goalKey=>{
      const g=rows.filter(r=>r.goalKey===goalKey);
      return [goalKey,rate(g)];
    }))
  };
}
let mastered=0;
for(const seed of [17,23,41]){
  for(const alpha of [0.03,0.05,0.1]){
    const train=fourTargetTasks(512,{seed,salt:0x51f0,split:'train'});
    const heldout=fourTargetTasks(64,{seed,salt:0x2b71,split:'heldout'});
    let snapshot=model(null,seed,alpha,0,false).snapshot();
    const stages=[{updates:0,...evaluate(snapshot,seed,alpha,heldout)}];
    for(let i=0;i<train.length;i++){
      const task=train[i];
      const {observation,candidates}=context(task);
      const policy=model(snapshot,seed,alpha,i+1,true);
      const selected=policy.choose(observation,candidates);
      const reward=fourTargetReward(task.goalKey,selected.candidate.id);
      policy.observe({features:selected.features,reward,terminal:true,steps:1});
      snapshot=policy.snapshot();
      if([64,128,256,384,512].includes(i+1))
        stages.push({updates:i+1,...evaluate(snapshot,seed,alpha,heldout)});
    }
    if(stages.at(-1).accuracy===1)mastered++;
    console.log(JSON.stringify({seed,alpha,stages}));
  }
}
console.log(JSON.stringify({
  classification:'SYNTHETIC_ONLY_NOT_MINECRAFT',
  trainRotations:[0,1],heldoutRotations:[2,3],
  choices:4,trainingDecisionsPerModel:512,
  modelsCorrectOnAll64Heldout:mastered,totalModels:9,
  note:'This is not an independent live world result. Training and evaluation use a shared goal-relative encoder.'
}));
