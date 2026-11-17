// Controlled delayed-outcome benchmark: mine two dirt blocks and use the
// actual inventory to place two dirt blocks, ignoring legal distractors. World state, inventory and
// executable operations must come from observations; this module NEVER
// creates server evidence, changes Minecraft or updates Q weights.
// The final reward contract is intentionally distinct from action matching.
export const CHAIN_SCHEMA='craftle.resource-chain-task.v1';
export const CHAIN_SOURCES=['source0','source1'];
export const CHAIN_DESTINATIONS=['site0','site1'];
export const CHAIN_DECOYS=['decoySource','decoySite'];
export const CHAIN_ALL_SOURCES=[...CHAIN_SOURCES,'decoySource'];
export const CHAIN_ALL_DESTINATIONS=[...CHAIN_DESTINATIONS,'decoySite'];
export const CHAIN_KEYS=[...CHAIN_SOURCES,...CHAIN_DESTINATIONS,...CHAIN_DECOYS];
export const CHAIN_MAX_STEPS=4;
const samePosition=(a,b)=>integer3(a)&&integer3(b)&&a.x===b.x&&a.y===b.y&&a.z===b.z;
export const CHAIN_SPLITS=Object.freeze({train:Object.freeze([0,1]),
  heldout:Object.freeze([2,3])});

function integer3(p) {
  return !!p && ['x','y','z'].every(k=>Number.isSafeInteger(p[k]));
}
function rotate(x,z,n) {
  for(let i=0;i<n;i++) [x,z]=[-z,x];
  return {x:x||0,y:81,z:z||0};
}
function keyOf(p) {return [p.x,p.y,p.z].join(':');}
function itemCount(inventory,item) {
  return inventory.filter(x=>x?.name===item).reduce((n,x)=>n+x.count,0);
}
export function chainLayout(rotation) {
  if(!Number.isSafeInteger(rotation)||rotation<0||rotation>3)
    throw Error('Invalid chain layout rotation');
  const sites={
    source0:rotate(1,0,rotation),
    source1:rotate(0,1,rotation),
    site0:rotate(-2,0,rotation),
    site1:rotate(0,-2,rotation),
    decoySource:rotate(1,1,rotation),
    decoySite:rotate(-1,-1,rotation)
  };
  if(new Set(Object.values(sites).map(keyOf)).size!==6)
    throw Error('Overlapping resource-chain sites');
  return {schema:CHAIN_SCHEMA,rotation,sites};
}
export function assertChainSplitDisjoint() {
  const fingerprint=r=>JSON.stringify(chainLayout(r).sites);
  const train=new Set(CHAIN_SPLITS.train.map(fingerprint));
  const heldout=new Set(CHAIN_SPLITS.heldout.map(fingerprint));
  if([...train].some(x=>heldout.has(x)))
    throw Error('Resource-chain train/test layout overlap');
  return {train:train.size,heldout:heldout.size};
}
export function chainTasks(count,{seed=17,split='train'}={}) {
  if(!Number.isSafeInteger(count)||count<2||count>1000||count%2!==0||
    !Number.isSafeInteger(seed)||seed<0||
    !Object.hasOwn(CHAIN_SPLITS,split))
    throw Error('Invalid balanced resource-chain task schedule');
  assertChainSplitDisjoint();
  const choices=CHAIN_SPLITS[split];
  const tasks=Array.from({length:count},(_,i)=>({rotation:choices[i%2]}));
  let rng=seed>>>0;
  for(let i=tasks.length-1;i>0;i--){
    rng=(Math.imul(1664525,rng)+1013904223)>>>0;
    const j=rng%(i+1);
    [tasks[i],tasks[j]]=[tasks[j],tasks[i]];
  }
  return tasks;
}

// Probe samples are independent server read-only events. Require consistent
// identity and inventory across all six site probes, or fail closed; a future live
// runner must also guard against unrelated world mutations during the readout.
export function chainSnapshotFromProbes(layout,probes) {
  if(layout?.schema!==CHAIN_SCHEMA||!Array.isArray(probes)||probes.length!==CHAIN_KEYS.length)
    throw Error('Six authoritative server probes required');
  const mapping={};
  const ids=new Set(), boots=new Set(), actors=new Set(), worlds=new Set();
  let inventoryFingerprint=null;
  for(const key of CHAIN_KEYS){
    const p=layout.sites[key];
    const matching=probes.filter(e=>e&&e.event==='acceptance_probe'&&
      e.phase==='read_only_console_probe'&&e.x===p.x&&e.y===p.y&&e.z===p.z);
    if(matching.length!==1)throw Error('Missing or ambiguous chain-site probe '+key);
    const e=matching[0];
    if(e.onlinePlayers!==1||!Number.isSafeInteger(e.sequence)||
       !Number.isSafeInteger(e.serverTick)||e.serverTick<0||
       typeof e.probeId!=='string'||!e.probeId||
       typeof e.serverBootId!=='string'||!e.serverBootId||
       typeof e.playerUuid!=='string'||!e.playerUuid||
       typeof e.world!=='string'||!e.world||
       !Array.isArray(e.inventory)||e.inventory.some(i=>
         typeof i.item!=='string'||!Number.isSafeInteger(i.count)||i.count<0))
      throw Error('Invalid authoritative chain probe metadata');
    const inventory=e.inventory.map(i=>({name:i.item.replace(/^minecraft:/,''),
      count:i.count})).sort((a,b)=>a.name.localeCompare(b.name));
    const fp=JSON.stringify(inventory);
    if(inventoryFingerprint!==null&&inventoryFingerprint!==fp)
      throw Error('Inventory changed during non-atomic chain readout');
    inventoryFingerprint=fp;
    ids.add(e.probeId);boots.add(e.serverBootId);actors.add(e.playerUuid);
    worlds.add(e.world);
    mapping[key]={block:e.block,sequence:e.sequence,serverTick:e.serverTick,
      probeId:e.probeId};
  }
  if(ids.size!==6||boots.size!==1||actors.size!==1||worlds.size!==1)
    throw Error('Chain probes do not have one consistent server/player');
  const sequences=CHAIN_KEYS.map(k=>mapping[k].sequence);
  if(new Set(sequences).size!==CHAIN_KEYS.length)throw Error('Duplicated event sequence in probes');
  return {
    schema:'craftle.resource-chain-snapshot.v1',
    layoutRotation:layout.rotation,
    serverBootId:probes[0].serverBootId,
    playerUuid:probes[0].playerUuid,
    world:probes[0].world,
    inventory:probes[0].inventory.map(i=>({
      name:i.item.replace(/^minecraft:/,''),count:i.count
    })),
    blocks:Object.fromEntries(CHAIN_KEYS.map(k=>[k,mapping[k].block])),
    probeIds:CHAIN_KEYS.map(k=>mapping[k].probeId),
    firstSequence:Math.min(...sequences),lastSequence:Math.max(...sequences)
  };
}
export function validateInitialChainSnapshot(snapshot) {
  if(snapshot?.schema!=='craftle.resource-chain-snapshot.v1'||
     !Array.isArray(snapshot.inventory)||
     itemCount(snapshot.inventory,'dirt')!==0||
     !CHAIN_ALL_SOURCES.every(k=>snapshot.blocks?.[k]==='minecraft:dirt')||
     !CHAIN_ALL_DESTINATIONS.every(k=>snapshot.blocks?.[k]==='minecraft:air'))
    throw Error('Chain must start without carried dirt, with three sources and three empty sites');
  return true;
}
export function chainCandidateMenu({layout,position,blockAt,inventory=[],
    health=20,food=20}={}) {
  if(layout?.schema!==CHAIN_SCHEMA||!integer3(layout.sites.source0)||
     !position||!['x','y','z'].every(k=>Number.isFinite(position[k]))||
     typeof blockAt!=='function'||!Array.isArray(inventory)||
     inventory.some(i=>typeof i.name!=='string'||
       !Number.isSafeInteger(i.count)||i.count<0))
    throw Error('Missing or invalid observed state for resource chain');
  const dirt=itemCount(inventory,'dirt');
  const options=[];
  const hasSupport=p=>blockAt(p.x,p.y-1,p.z)?.boundingBox==='block';
  for(const key of CHAIN_ALL_SOURCES){
    const p=layout.sites[key],b=blockAt(p.x,p.y,p.z);
    if(b?.name==='dirt'&&b.boundingBox==='block')
      options.push({id:key,operation:'dig',executable:true,
        arguments:{position:{...p}},
        evidence:{source:'observed_block',block:'dirt'}});
  }
  for(const key of CHAIN_ALL_DESTINATIONS){
    const p=layout.sites[key],b=blockAt(p.x,p.y,p.z);
    if(dirt>0&&b?.boundingBox==='empty'&&hasSupport(p))
      options.push({id:key,operation:'place',executable:true,
        arguments:{reference:{x:p.x,y:p.y-1,z:p.z},
          face:{x:0,y:1,z:0},itemName:'dirt'},
        evidence:{source:'observed_empty_destination_and_inventory',
          destination:{...p}}});
  }
  if(options.some(c=>{
    const p=layout.sites[c.id];
    return Math.hypot(p.x+.5-position.x,p.y+.5-position.y,p.z+.5-position.z)>4.5;
  }))
    throw Error('Resource-chain candidate exceeds Minecraft action reach');
  // The complete required-source and destination blueprint is PUBLIC to all
  // policies. Distractors are legitimate observed candidates but are absent
  // from the blueprint. Do not leak candidate id or the intended next action.
  const blueprint={
    sources:CHAIN_SOURCES.map(key=>({...layout.sites[key]})),
    sites:CHAIN_DESTINATIONS.map(key=>({...layout.sites[key]}))
  };
  return {observation:{
    blueprint,
    remainingSteps:CHAIN_MAX_STEPS-CHAIN_KEYS.filter(key=>{
      const p=layout.sites[key],block=blockAt(p.x,p.y,p.z);
      return CHAIN_ALL_SOURCES.includes(key)?block?.boundingBox!=='block':
        block?.boundingBox==='block';
    }).length,
    position:{x:Math.floor(position.x),y:Math.floor(position.y),
      z:Math.floor(position.z)},
    // A shared global construction objective, NOT the label of the next action.
    goal:{x:(layout.sites.site0.x+layout.sites.site1.x)/2,
      y:81,z:(layout.sites.site0.z+layout.sites.site1.z)/2},
    inventory:inventory.map(i=>({...i})),health,food,stalls:0,blockAt
  },candidates:options};
}
// Both the scripted baseline and learning agents receive identical public
// observation.blueprint, inventory and executable candidate action arguments.
// No hidden key IDs or task-generation labels are used to select an action.
export function chainActionTarget(candidate) {
  if(!candidate?.executable||!['dig','place'].includes(candidate.operation))
    throw Error('Nonexecutable chain candidate');
  const args=candidate.arguments;
  if(candidate.operation==='dig') {
    if(!integer3(args?.position))throw Error('Invalid dig action geometry');
    return {...args.position};
  }
  if(!integer3(args?.reference)||!integer3(args?.face)||
      Math.abs(args.face.x)+Math.abs(args.face.y)+Math.abs(args.face.z)!==1)
    throw Error('Invalid placement action geometry');
  return {
    x:args.reference.x+args.face.x,
    y:args.reference.y+args.face.y,
    z:args.reference.z+args.face.z
  };
}
export function validateChainBlueprint(observation) {
  const blueprint=observation?.blueprint;
  if(!blueprint||!Array.isArray(blueprint.sources)||
      !Array.isArray(blueprint.sites)||
      blueprint.sources.length!==2||blueprint.sites.length!==2||
      ![...blueprint.sources,...blueprint.sites].every(integer3)||
      new Set([...blueprint.sources,...blueprint.sites].map(keyOf)).size!==4)
    throw Error('Missing or invalid public construction blueprint');
  return blueprint;
}
export function scriptedResourcePlanner(observation,candidates) {
  const blueprint=validateChainBlueprint(observation);
  if(!Array.isArray(candidates)||!Array.isArray(observation.inventory))
    throw Error('Planner requires public observation and candidate menu');
  const dirt=itemCount(observation.inventory,'dirt');
  const matching=candidates.filter(c=>{
    if(!c?.executable)return false;
    const target=chainActionTarget(c);
    const required=c.operation==='dig'?blueprint.sources:blueprint.sites;
    return required.some(p=>samePosition(p,target));
  });
  const operation=dirt>0?'place':'dig';
  return matching.find(c=>c.operation===operation)??null;
}
export function chainFinalOutcome({initial,final,proofs,maxSteps=CHAIN_MAX_STEPS}={}){
  validateInitialChainSnapshot(initial);
  if(!final||final.schema!=='craftle.resource-chain-snapshot.v1'||
     initial.serverBootId!==final.serverBootId||
     initial.playerUuid!==final.playerUuid||initial.world!==final.world||
     initial.layoutRotation!==final.layoutRotation||
     !Array.isArray(proofs)||!Number.isSafeInteger(maxSteps)||maxSteps<4||
     maxSteps>8||proofs.length>maxSteps)
    throw Error('Invalid chain outcome identity or proof ledger');
  const decisionIds=new Set(),evidenceIds=new Set(),usedTargets=new Set();
  let lastSequence=initial.lastSequence;
  for(const entry of proofs){
    if(!entry||!['dig','place'].includes(entry.operation)||
      typeof entry.targetKey!=='string'||!CHAIN_KEYS.includes(entry.targetKey)||
      entry.operation!== (CHAIN_ALL_SOURCES.includes(entry.targetKey)?'dig':'place')||
      typeof entry.decisionKey!=='string'||!entry.decisionKey||
      typeof entry.evidenceKey!=='string'||!entry.evidenceKey||
      !Number.isSafeInteger(entry.eventSequence)||entry.eventSequence<=lastSequence||
      !entry.gateEligible)
      throw Error('Invalid or unverified resource-chain transition');
    lastSequence=entry.eventSequence;
    decisionIds.add(entry.decisionKey);evidenceIds.add(entry.evidenceKey);
    usedTargets.add(entry.targetKey);
  }
  if(decisionIds.size!==proofs.length||evidenceIds.size!==proofs.length||
     usedTargets.size!==proofs.length||final.firstSequence<=lastSequence)
    throw Error('Duplicate proof or stale final-world observation');
  const complete=CHAIN_SOURCES.every(k=>final.blocks?.[k]==='minecraft:air')&&
    CHAIN_DESTINATIONS.every(k=>final.blocks?.[k]==='minecraft:dirt')&&
    final.blocks?.decoySource==='minecraft:dirt'&&
    final.blocks?.decoySite==='minecraft:air'&&
    itemCount(final.inventory??[],'dirt')===0&&proofs.length===4;
  if(complete)return {terminal:true,reward:1,success:true,
    reason:'final_blocks_and_proofs_verified'};
  if(proofs.length>=maxSteps)return {terminal:true,reward:-1,success:false,
    reason:'budget_exhausted_without_final_state'};
  return {terminal:false,reward:0,success:false,
    reason:'awaiting_complete_verified_construction'};
}
