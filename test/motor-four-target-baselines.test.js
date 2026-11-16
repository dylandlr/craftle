import test from 'node:test';
import assert from 'node:assert/strict';
import {fourTargetLayout,fourTargetCandidates,
  FOUR_TARGET_KEYS,FOUR_TARGET_DISTANCES} from '../src/motor-four-target-tasks.js';
import {chooseByGoalCoordinates,candidateTargetCoordinates}
  from '../src/motor-four-target-baselines.js';

function controlledObservation(task){
  const {targets}=fourTargetLayout(task);
  const digPositions=Object.entries(targets)
    .filter(([key])=>key.startsWith('dig'))
    .map(([,pos])=>pos);
  const blockAt=(x,y,z)=>{
    const isDig=digPositions.some(t=>t.x===x&&t.y===y&&t.z===z);
    const solid=y===80||isDig;
    return {name:isDig?'dirt':solid?'stone':'air',
      boundingBox:solid?'block':'empty'};
  };
  return fourTargetCandidates({
    task,position:{x:.5,y:81,z:.5},health:20,food:20,
    inventory:[{name:'dirt',count:2}],blockAt
  });
}

test('no-training coordinate matching solves every exact four-choice heldout task',()=>{
  let correct=0;
  for(const rotation of [2,3])
    for(const distance of FOUR_TARGET_DISTANCES)
      for(const goalKey of FOUR_TARGET_KEYS){
        const {observation,candidates}=controlledObservation({
          rotation,distance,goalKey
        });
        const picked=chooseByGoalCoordinates(observation,candidates);
        assert.equal(picked.candidate.id,goalKey);
        assert.equal(picked.distance,0);
        correct++;
      }
  assert.equal(correct,16);
});

test('every training layout and candidate permutation has same nonlearning solution',()=>{
  let correct=0;
  for(const rotation of [0,1])
    for(const distance of FOUR_TARGET_DISTANCES)
      for(const goalKey of FOUR_TARGET_KEYS){
        const {observation,candidates}=controlledObservation({
          rotation,distance,goalKey
        });
        const picked=chooseByGoalCoordinates(observation,candidates.slice().reverse());
        assert.equal(picked.candidate.id,goalKey);
        correct++;
      }
  assert.equal(correct,16);
});

test('different goal coordinates change the policy choice without weights',()=>{
  const task={rotation:2,distance:3,goalKey:'dig0'};
  const {observation,candidates,targets}=controlledObservation(task);
  for(const goalKey of FOUR_TARGET_KEYS){
    const picked=chooseByGoalCoordinates({
      ...observation,goal:targets[goalKey]
    },candidates);
    assert.equal(picked.candidate.id,goalKey);
  }
});

test('candidate location comes solely from executable action arguments',()=>{
  const task={rotation:0,distance:2,goalKey:'place1'};
  const {candidates,targets}=controlledObservation(task);
  for(const candidate of candidates)
    assert.deepEqual(candidateTargetCoordinates(candidate),targets[candidate.id]);
});

test('ambiguous or malformed action/goal fails closed',()=>{
  const task={rotation:0,distance:2,goalKey:'place1'};
  const {observation,candidates}=controlledObservation(task);
  assert.equal(chooseByGoalCoordinates(observation,[]).candidate,null);
  assert.equal(chooseByGoalCoordinates(observation,[...candidates,candidates[3]])
    .reason,'ambiguous_nearest_goal');
  assert.throws(()=>chooseByGoalCoordinates({goal:null},candidates));
  assert.throws(()=>chooseByGoalCoordinates(observation,[{
    id:'bad',operation:'place',executable:true,arguments:{
      reference:{x:1,y:80,z:1},face:{x:0,y:2,z:0}
    }
  }]));
  assert.throws(()=>candidateTargetCoordinates({
    operation:'move',executable:true,arguments:{dx:1}
  }));
});
