// Controlled four-target Minecraft task layouts and observation-grounded options.
// Training and evaluation share action classes but not physical arrangements.
// No server actions, model updates, hidden-state reads, or reward issuance here.
import {createHash} from 'node:crypto';

export const FOUR_TARGET_KEYS=Object.freeze(['dig0','dig1','place0','place1']);
export const FOUR_TARGET_SPLITS=Object.freeze({
  train:Object.freeze([0,1]),
  heldout:Object.freeze([2,3])
});
export const FOUR_TARGET_DISTANCES=Object.freeze([2,3]);

const rotate=(x,z,turns)=>{
  let a=x,b=z;
  for(let i=0;i<turns;i++) [a,b]=[-b,a];
  return {x:a,y:81,z:b};
};

export function fourTargetLayout({rotation,distance}={}){
  if(!Number.isSafeInteger(rotation)||rotation<0||rotation>3||
      !FOUR_TARGET_DISTANCES.includes(distance))
    throw Error('Invalid four-target layout');
  // Asymmetric fourth position prevents rotated physical worlds from
  // inadvertently overlapping the holdout split.
  const targets={
    dig0:rotate(distance,0,rotation),
    dig1:rotate(0,distance,rotation),
    place0:rotate(-distance,0,rotation),
    place1:rotate(1,-distance,rotation)
  };
  const seen=new Set(Object.values(targets).map(t=>t.x+':'+t.z));
  if(seen.size!==FOUR_TARGET_KEYS.length)
    throw Error('Four-target fixture contains overlapping blocks');
  return {rotation,distance,targets};
}

const fingerprint=layout=>{
  const {targets}=layout;
  return JSON.stringify({
    dig:FOUR_TARGET_KEYS.filter(k=>k.startsWith('dig')).map(k=>
      [targets[k].x,targets[k].z].join(',')).sort(),
    place:FOUR_TARGET_KEYS.filter(k=>k.startsWith('place')).map(k=>
      [targets[k].x,targets[k].z].join(',')).sort()
  });
};

export function assertFourTargetSplit(){
  const [train,heldout]=['train','heldout'].map(split=>
    new Set(FOUR_TARGET_DISTANCES.flatMap(distance=>
      FOUR_TARGET_SPLITS[split].map(rotation=>
        fingerprint(fourTargetLayout({rotation,distance}))))));
  if(train.size!==4||heldout.size!==4||
      [...train].some(k=>heldout.has(k)))
    throw Error('Four-target physical train/evaluation world leakage');
  return {trainLayouts:train.size,heldoutLayouts:heldout.size,choices:4};
}

export function fourTargetTasks(count,{seed=17,salt=0,split='train'}={}){
  if(!Number.isSafeInteger(count)||count<16||count>1024||count%16!==0||
      !Number.isSafeInteger(seed)||seed<0||
      !Number.isSafeInteger(salt)||salt<0||
      !Object.hasOwn(FOUR_TARGET_SPLITS,split))
    throw Error('Four-target schedules must contain complete 16-case blocks');
  assertFourTargetSplit();
  const templates=[];
  for(const rotation of FOUR_TARGET_SPLITS[split])
    for(const distance of FOUR_TARGET_DISTANCES)
      for(const goalKey of FOUR_TARGET_KEYS)
        templates.push({rotation,distance,goalKey});
  const tasks=[];
  // Stratified blocks: each 16-task group visits all 4 targets in every
  // (rotation,distance) combination once, in a pseudorandom order.
  for(let cycle=0;cycle<count/16;cycle++){
    const block=templates.map(x=>({...x}));
    let counter=0;
    const random=()=>createHash('sha256')
      .update([seed,salt,split,cycle,counter++].join(':'))
      .digest().readUInt32BE(0)/4294967296;
    for(let i=block.length-1;i>0;i--){
      const j=Math.floor(random()*(i+1));
      [block[i],block[j]]=[block[j],block[i]];
    }
    tasks.push(...block);
  }
  return tasks;
}

export function fourTargetCandidates({task,position,blockAt,inventory=[],
  health=20,food=20}={}){
  if(!task||!FOUR_TARGET_KEYS.includes(task.goalKey)||
      !position||!['x','y','z'].every(k=>Number.isFinite(position[k]))||
      typeof blockAt!=='function'||!Array.isArray(inventory))
    throw Error('Four-target observation missing required public context');
  const {targets}=fourTargetLayout(task);
  const dirt=inventory.find(item=>item?.name==='dirt'&&item.count>0);
  if(!dirt) throw Error('No observed dirt inventory for placement candidates');
  for(const key of FOUR_TARGET_KEYS){
    const t=targets[key], at=blockAt(t.x,t.y,t.z);
    const distance=Math.hypot(t.x+.5-position.x,
      t.y+.5-position.y,t.z+.5-position.z);
    if(distance>4.5) throw Error('Target outside verified interaction reach: '+key);
    if(key.startsWith('dig')){
      if(at?.name!=='dirt'||at?.boundingBox!=='block')
        throw Error('Dig target not observed as dirt: '+key);
    }else if(at?.boundingBox!=='empty'||
      blockAt(t.x,t.y-1,t.z)?.boundingBox!=='block')
      throw Error('Place target or support not observed: '+key);
  }
  const candidates=FOUR_TARGET_KEYS.map(key=>{
    const target=targets[key];
    if(key.startsWith('dig'))
      return {id:key,operation:'dig',executable:true,
        arguments:{position:{...target}},
        evidence:{source:'observed_block',block:'dirt'}};
    return {id:key,operation:'place',executable:true,
      arguments:{reference:{x:target.x,y:80,z:target.z},
        face:{x:0,y:1,z:0},itemName:'dirt'},
      evidence:{source:'observed_empty_destination_and_inventory',
        destination:{...target}}};
  });
  const observation={
    // The agent's own observed block-aligned frame, not a hidden world target.
    position:{x:Math.floor(position.x),y:Math.floor(position.y),
      z:Math.floor(position.z)},
    goal:{...targets[task.goalKey]},
    health,food,inventory:inventory.map(x=>({...x})),
    stalls:0,blockAt
  };
  return {targets,candidates,observation};
}
