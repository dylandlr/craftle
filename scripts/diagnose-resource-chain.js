// Entirely SYNTHETIC task calibration. Do not cite these simulated block
// changes or rewards as Minecraft execution, observer proof or real learning.
import {createMotorQPolicy} from '../src/motor-q-policy.js';
import {chainLayout,chainCandidateMenu,scriptedResourcePlanner,
  CHAIN_KEYS,CHAIN_SPLITS,chainTasks} from '../src/motor-resource-chain.js';

function syntheticEpisode(rotation,choose,{update=null}={}){
  const layout=chainLayout(rotation);
  const blocks={source0:'dirt',source1:'dirt',decoySource:'dirt',
    site0:'air',site1:'air',decoySite:'air'};
  let inventory=0;
  const choices=[];
  const blockAt=(x,y,z)=>{
    const key=CHAIN_KEYS.find(k=>{
      const p=layout.sites[k];
      return x===p.x&&y===p.y&&z===p.z;
    });
    const solid=y===80||(key&&blocks[key]==='dirt');
    return {name:solid?'dirt':'air',boundingBox:solid?'block':'empty'};
  };
  for(let step=0;step<4;step++){
    const menu=chainCandidateMenu({
      layout,position:{x:.5,y:81,z:.5},blockAt,
      inventory:inventory?[{name:'dirt',count:inventory}]:[],
      health:20,food:20
    });
    if(menu.candidates.length===0)break;
    const selection=choose(menu,step,{blocks,inventory});
    const candidate=selection?.candidate??selection;
    if(!candidate||!menu.candidates.some(c=>c.id===candidate.id))
      throw Error('Synthetic sampler selected illegal action');
    const stateBefore={observation:menu.observation,
      candidates:menu.candidates,
      features:selection.features};
    if(candidate.operation==='dig'){
      if(blocks[candidate.id]!=='dirt')
        throw Error('Synthetic dig chose non-dirt');
      blocks[candidate.id]='air';inventory++;
    }else if(candidate.operation==='place'&&inventory>0){
      if(blocks[candidate.id]!=='air')
        throw Error('Synthetic placement was occupied');
      blocks[candidate.id]='dirt';inventory--;
    }else throw Error('Unsupported synthetic action');
    choices.push(candidate.id);
    const terminal=step===3;
    const complete=blocks.source0==='air'&&blocks.source1==='air'&&
      blocks.site0==='dirt'&&blocks.site1==='dirt'&&
      blocks.decoySource==='dirt'&&blocks.decoySite==='air'&&inventory===0;
    const next=terminal?null:chainCandidateMenu({
      layout,position:{x:.5,y:81,z:.5},blockAt,
      inventory:inventory?[{name:'dirt',count:inventory}]:[],
      health:20,food:20
    });
    if(update)update({
      ...stateBefore,candidate,terminal,
      reward:terminal?(complete?1:-1):0,
      nextObservation:next?.observation??{},
      nextCandidates:next?.candidates??[]
    });
  }
  const success=blocks.source0==='air'&&blocks.source1==='air'&&
    blocks.site0==='dirt'&&blocks.site1==='dirt'&&
    blocks.decoySource==='dirt'&&blocks.decoySite==='air'&&inventory===0;
  return {success,choices};
}
function randomGenerator(seed) {
  let s=seed>>>0;
  return () => {
    s=(Math.imul(s,1664525)+1013904223)>>>0;
    return s/4294967296;
  };
}
const runSeed=17;
const random=randomGenerator(3975);
const trials=400;
let plannerWins=0,randomWins=0;
for(let i=0;i<trials;i++){
  const rotation=CHAIN_SPLITS.heldout[i%2];
  const planner=syntheticEpisode(rotation,menu=>
    scriptedResourcePlanner(menu.observation,menu.candidates));
  const randomOutcome=syntheticEpisode(rotation,menu=>
    menu.candidates[Math.floor(random()*menu.candidates.length)]);
  plannerWins+=Number(planner.success);
  randomWins+=Number(randomOutcome.success);
}
const train=schedule=>chainTasks(schedule,{seed:runSeed,split:'train'});
const evalRotations=CHAIN_SPLITS.heldout;
const seeds=[17,23,41],results=[];
for(const seed of seeds){
  let model=createMotorQPolicy({seed,alpha:0.05,
    epsilon:0.35,hidden:24,training:true});
  const tasks=train(1000);
  for(const task of tasks){
    const nextSelection=(menu)=>
      model.choose(menu.observation,menu.candidates);
    syntheticEpisode(task.rotation,nextSelection,{
      update:t=>{
        model.observe({features:t.features,reward:t.reward,
          terminal:t.terminal,nextObservation:t.nextObservation,
          nextCandidates:t.nextCandidates,steps:1});
      }
    });
  }
  const frozen=createMotorQPolicy({seed,epsilon:0,
    hidden:24,snapshot:model.snapshot(),training:false});
  let won=0;
  for(let i=0;i<100;i++){
    const result=syntheticEpisode(evalRotations[i%2],
      menu=>frozen.choose(menu.observation,menu.candidates));
    won+=Number(result.success);
  }
  results.push({seed,trainedUpdates:model.stats().updates,
    heldoutSyntheticWins:won,heldoutSyntheticTrials:100,
    accuracy:won/100});
}
console.log(JSON.stringify({
  type:'SYNTHETIC_ONLY_NOT_MINECRAFT',
  task:'four required mutations with two executable distractors',
  stepsPerEpisode:4,
  random:{wins:randomWins,trials,rate:randomWins/trials},
  symbolicPlanner:{wins:plannerWins,trials,rate:plannerWins/trials},
  onlineNeuralQ:results,
  notes:['Simulated inventory pickup is instantaneous; real drops may require movement.',
    'No server proof, no live weights, no claim of autonomous planning.',
    'The scripted planner sees public construction blueprint targets and is a non-learning control.']
},null,2));
