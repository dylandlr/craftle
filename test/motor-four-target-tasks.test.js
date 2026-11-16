import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOUR_TARGET_KEYS, FOUR_TARGET_SPLITS, FOUR_TARGET_DISTANCES,
  fourTargetLayout, fourTargetTasks, fourTargetCandidates,
  fourTargetReward, assertFourTargetSplit
} from '../src/motor-four-target-tasks.js';
import {createMotorQPolicy, MOTOR_FEATURE_COUNT} from '../src/motor-q-policy.js';

function context(task) {
  const {targets}=fourTargetLayout(task);
  const blockAt=(x,y,z)=>{
    const isDig=FOUR_TARGET_KEYS.filter(k=>k.startsWith('dig'))
      .some(k=>targets[k].x===x&&targets[k].y===y&&targets[k].z===z);
    const solid=y===80||isDig;
    return {name:isDig?'dirt':solid?'stone':'air',
      boundingBox:solid?'block':'empty'};
  };
  return {
    task,position:{x:0.5,y:81,z:0.5},health:20,food:20,
    inventory:[{name:'dirt',count:2,placeable:true}],blockAt
  };
}

test('train and held-out orientations are different PHYSICAL worlds',()=>{
  assert.deepEqual(assertFourTargetSplit(),{trainLayouts:4,heldoutLayouts:4,choices:4});
  assert.deepEqual(FOUR_TARGET_SPLITS.train,[0,1]);
  assert.deepEqual(FOUR_TARGET_SPLITS.heldout,[2,3]);
});

test('each of 8 layouts contains four distinct reachable target blocks',()=>{
  for(let rotation=0;rotation<4;rotation++)
    for(const distance of FOUR_TARGET_DISTANCES){
      const task={rotation,distance,goalKey:'dig0'};
      const {targets}=fourTargetLayout(task);
      const positions=FOUR_TARGET_KEYS.map(k=>targets[k]);
      assert.equal(new Set(positions.map(t=>[t.x,t.z].join(':'))).size,4);
      const actual=fourTargetCandidates(context(task));
      assert.deepEqual(actual.candidates.map(c=>c.id),FOUR_TARGET_KEYS);
      assert.ok(actual.candidates.every(c=>c.executable));
    }
});

test('stratified schedule contains every goal in every layout once per 16',()=>{
  for(const split of ['train','heldout'])
    for(const seed of [17,23,41]){
      const tasks=fourTargetTasks(256,{seed,split,salt:271});
      assert.deepEqual(tasks,fourTargetTasks(256,{seed,split,salt:271}));
      for(let i=0;i<256;i+=16){
        const rows=tasks.slice(i,i+16);
        assert.equal(new Set(rows.map(t=>
          [t.rotation,t.distance,t.goalKey].join(':'))).size,16);
        assert.equal(rows.filter(t=>t.goalKey.startsWith('dig')).length,8);
        assert.ok(rows.every(t=>FOUR_TARGET_SPLITS[split].includes(t.rotation)));
      }
    }
});

test('same operation wrong target is negative reward',()=>{
  assert.equal(fourTargetReward('dig0','dig0'),1);
  assert.equal(fourTargetReward('dig0','dig1'),-1);
  assert.equal(fourTargetReward('place0','place1'),-1);
  assert.equal(fourTargetReward('dig1','place0'),-1);
  assert.throws(()=>fourTargetReward('dig0','unknown'));
});

test('missing observed support, dirt, or inventory fails closed',()=>{
  const task={rotation:0,distance:2,goalKey:'place1'};
  const valid=context(task);
  assert.throws(()=>fourTargetCandidates({...valid,inventory:[]}));
  assert.throws(()=>fourTargetCandidates({
    ...valid,blockAt:(x,y,z)=>y===80?{name:'air',boundingBox:'empty'}:
      valid.blockAt(x,y,z)
  }));
  const {targets}=fourTargetLayout(task);
  assert.throws(()=>fourTargetCandidates({
    ...valid,blockAt:(x,y,z)=>x===targets.dig0.x&&y===81&&z===targets.dig0.z?
      {name:'air',boundingBox:'empty'}:valid.blockAt(x,y,z)
  }));
  assert.throws(()=>fourTargetLayout({rotation:4,distance:2}));
  assert.throws(()=>fourTargetTasks(8));
  assert.throws(()=>fourTargetTasks(16,{split:'unknown'}));
});

test('goal-relative features are finite and rotation consistent for four choices',()=>{
  for(const distance of FOUR_TARGET_DISTANCES)
    for(const goalKey of FOUR_TARGET_KEYS){
      const baseline=fourTargetCandidates(context({rotation:0,distance,goalKey}));
      const vector=(row,c)=>createMotorQPolicy({training:false})
        .scoreCandidates(row.observation,[c])[0].q;
      for(let rotation=0;rotation<4;rotation++){
        const row=fourTargetCandidates(context({rotation,distance,goalKey}));
        const policy=createMotorQPolicy({seed:17,epsilon:0,training:false});
        const scored=policy.scoreCandidates(row.observation,row.candidates);
        assert.equal(scored.length,4);
        assert.ok(scored.every(s=>Number.isFinite(s.q)));
        assert.equal(policy.choose(row.observation,row.candidates).features.length,
          MOTOR_FEATURE_COUNT);
        for(let i=0;i<4;i++){
          const a=vector(baseline,baseline.candidates[i]);
          const b=vector(row,row.candidates[i]);
          assert.ok(Math.abs(a-b)<1e-9,
            `rotation ${rotation} distance ${distance} goal ${goalKey} candidate ${i} differs`);
        }
      }
    }
});
