import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTOR_TRANSFER_SPLITS, MOTOR_TRANSFER_DISTANCES,
  layoutForTask, assertTransferDisjoint, scheduleTransferTasks
} from '../src/motor-transfer-tasks.js';
import {encodeMotorCandidate, MOTOR_FEATURE_COUNT} from '../src/motor-q-policy.js';

const p = {x:0,y:81,z:0};
function candidateFeatures(task,operation){
  const {targets} = layoutForTask(task);
  const t=targets[operation];
  const at=operation==='dig'?t:targets.place;
  const blockAt=(x,y,z)=>({
    name:y===80?'stone':x===targets.dig.x&&y===81&&z===targets.dig.z?'dirt':'air',
    boundingBox:y===80||x===targets.dig.x&&y===81&&z===targets.dig.z?'block':'empty'
  });
  const candidate=operation==='dig'?
    {operation:'dig',executable:true,arguments:{position:t},
      evidence:{source:'observed_block',block:'dirt'}}:
    {operation:'place',executable:true,
      arguments:{reference:{x:t.x,y:80,z:t.z},face:{x:0,y:1,z:0},itemName:'dirt'},
      evidence:{source:'observed_empty_destination_and_inventory',destination:t}};
  return encodeMotorCandidate({
    position:p,goal:targets[task.objective],
    health:20,food:20,inventory:[{name:'dirt',count:1,placeable:true}],
    stalls:0,blockAt
  },candidate);
}

test('held-out orientations never duplicate training layouts',()=>{
  assert.deepEqual(assertTransferDisjoint(),{trainLayouts:4,heldoutLayouts:4});
  assert.deepEqual(MOTOR_TRANSFER_SPLITS.train,[0,1]);
  assert.deepEqual(MOTOR_TRANSFER_SPLITS.heldout,[2,3]);
});

test('geometry has distinct opposite targets and safe reach',()=>{
  for(let rotation=0;rotation<4;rotation++)
    for(const distance of MOTOR_TRANSFER_DISTANCES){
      const {targets}=layoutForTask({rotation,distance});
      assert.equal(targets.dig.x,-targets.place.x);
      assert.equal(targets.dig.z,-targets.place.z);
      assert.equal(targets.dig.y,81);
      assert.equal(Math.hypot(targets.dig.x,targets.dig.z),distance);
      assert.notDeepEqual(targets.dig,targets.place);
    }
});

test('balanced schedules are deterministic and training/eval disjoint',()=>{
  for(const split of ['train','heldout']){
    const a=scheduleTransferTasks(256,{seed:17,salt:810,split});
    const b=scheduleTransferTasks(256,{seed:17,salt:810,split});
    assert.deepEqual(a,b);
    assert.equal(a.filter(t=>t.objective==='dig').length,128);
    assert.equal(a.filter(t=>t.objective==='place').length,128);
    const counts=new Map();
    for(const t of a){
      assert.ok(MOTOR_TRANSFER_SPLITS[split].includes(t.rotation));
      const k=[t.rotation,t.distance,t.objective].join(':');
      counts.set(k,(counts.get(k)||0)+1);
    }
    assert.equal(counts.size,8);
    for(const n of counts.values())assert.equal(n,32);
  }
});

test('invalid layout or schedule fails closed',()=>{
  for(const input of [{rotation:4,distance:2},{rotation:1,distance:4},{}])
    assert.throws(()=>layoutForTask(input));
  assert.throws(()=>scheduleTransferTasks(0));
  assert.throws(()=>scheduleTransferTasks(8,{split:'eval'}));
  assert.throws(()=>scheduleTransferTasks(8,{seed:-1}));
});

test('all rotated task layouts produce finite grounded Q features',()=>{
  for(let rotation=0;rotation<4;rotation++)
    for(const distance of MOTOR_TRANSFER_DISTANCES)
      for(const objective of ['dig','place'])
        for(const operation of ['dig','place']){
          const features=candidateFeatures({rotation,distance,objective},operation);
          assert.equal(features.length,MOTOR_FEATURE_COUNT);
          assert.ok(features.every(Number.isFinite));
        }
});

test('goal-frame Q features rotate coherently across every cardinal direction',()=>{
  for(const distance of MOTOR_TRANSFER_DISTANCES)
    for(const objective of ['dig','place'])
      for(const operation of ['dig','place']){
        const baseline=candidateFeatures({rotation:0,distance,objective},operation);
        for(let rotation=1;rotation<4;rotation++){
          const candidate=candidateFeatures({rotation,distance,objective},operation);
          candidate.forEach((value,i)=>{
            assert.ok(Math.abs(value-baseline[i])<1e-9,
              `Feature ${i} differs at rotation ${rotation}: ${value} vs ${baseline[i]}`);
          });
        }
      }
});
