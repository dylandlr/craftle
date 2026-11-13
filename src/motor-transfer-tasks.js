// Pure, auditable held-out environment design for controlled Craftle motor transfer.
// No Minecraft access, reward generation, action selection or hidden-world state.
export const MOTOR_TRANSFER_SPLITS = Object.freeze({
  train: Object.freeze([0, 1]),
  heldout: Object.freeze([2, 3])
});
export const MOTOR_TRANSFER_DISTANCES = Object.freeze([2, 3]);

export function layoutForTask({rotation, distance} = {}) {
  if (!Number.isSafeInteger(rotation) || rotation < 0 || rotation > 3 ||
      !MOTOR_TRANSFER_DISTANCES.includes(distance))
    throw Error('Invalid controlled motor transfer layout');
  const xz = [[distance, 0], [0, distance], [-distance, 0], [0, -distance]][rotation];
  const dig = {x:xz[0], y:81, z:xz[1]};
  const place = {x:-xz[0], y:81, z:-xz[1]};
  return {rotation,distance,targets:{dig,place}};
}

export function assertTransferDisjoint() {
  const train = new Set();
  const heldout = new Set();
  for (const distance of MOTOR_TRANSFER_DISTANCES) {
    for (const rotation of MOTOR_TRANSFER_SPLITS.train) {
      const {targets}=layoutForTask({rotation,distance});
      train.add(JSON.stringify(targets));
    }
    for (const rotation of MOTOR_TRANSFER_SPLITS.heldout) {
      const {targets}=layoutForTask({rotation,distance});
      heldout.add(JSON.stringify(targets));
    }
  }
  for (const k of train) if (heldout.has(k))
    throw Error('Environment split leakage');
  return {trainLayouts:train.size,heldoutLayouts:heldout.size};
}

export function scheduleTransferTasks(count,{seed=17,salt=0,split='train'}={}) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000 ||
      !Number.isSafeInteger(seed) || seed < 0 ||
      !Number.isSafeInteger(salt) || salt < 0 ||
      !Object.hasOwn(MOTOR_TRANSFER_SPLITS,split))
    throw Error('Invalid motor transfer schedule');
  assertTransferDisjoint();
  const templates=[];
  for (const distance of MOTOR_TRANSFER_DISTANCES)
    for (const rotation of MOTOR_TRANSFER_SPLITS[split])
      for (const objective of ['dig','place'])
        templates.push({rotation,distance,objective});
  const tasks=Array.from({length:count},(_,i)=>({...templates[i%templates.length]}));
  let state=(seed+salt)>>>0;
  for(let i=tasks.length-1;i>0;i--){
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    const j=state%(i+1);
    [tasks[i],tasks[j]]=[tasks[j],tasks[i]];
  }
  return tasks;
}
