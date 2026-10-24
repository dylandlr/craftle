import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSurvivalReference} from '../scripts/report-survival-reference.js';

const event=(second,type,extra={})=>({timestamp:new Date(1700000000000+second*1000).toISOString(),type,...extra});
test('survival metrics separate deaths from respawn teleport displacement',()=>{
  const result=summarizeSurvivalReference([
    event(0,'survival_reference_started'),
    event(1,'survival_reference_action',{objective:'forage',inventoryCount:0,position:{x:0,y:64,z:0}}),
    event(2,'pose_sample',{position:{x:3,y:64,z:4}}),
    event(3,'survival_reference_death'),
    event(4,'life_feedback_available'),
    event(5,'pose_sample',{position:{x:1000,y:64,z:1000}}),
    event(6,'survival_reference_action',{objective:'explore',inventoryCount:2,position:{x:1003,y:64,z:1004}}),
    event(10,'shutdown')
  ]);
  assert.equal(result.sampledHorizontalPathBlocks,10);
  assert.equal(result.deaths,1);
  assert.equal(result.firstLifeSeconds,3);
  assert.equal(result.firstLifeRightCensored,false);
  assert.equal(result.observedSeconds,10);
  assert.equal(result.maxInventoryStacks,2);
  assert.equal(result.learned,false);
});
test('surviving the observation window is right censored, not infinite survival',()=>{
  const result=summarizeSurvivalReference([event(0,'survival_reference_started'),event(90,'shutdown')]);
  assert.equal(result.firstLifeSeconds,90);
  assert.equal(result.firstLifeRightCensored,true);
  assert.equal(result.completed,true);
  assert.equal(result.uniqueHorizontalCells4Blocks,0);
});
test('missing completion and corrupt telemetry cannot pass the report',()=>{
  const result=summarizeSurvivalReference([event(0,'survival_reference_started'),
    event(1,'survival_reference_action',{position:{x:null,y:0,z:0}}),event(2,'recording_error',{message:'fixture failure'})]);
  assert.equal(result.completed,false);
  assert.equal(result.invalidPositions,1);
  assert.equal(result.runtimeErrors.length,1);
  assert.throws(()=>summarizeSurvivalReference([event(2,'spawn'),event(1,'spawn')]),/out-of-order/);
});

test('stalls count stationary action intervals and reset across lives',()=>{
 const p={x:0,y:64,z:0};
 const result=summarizeSurvivalReference([
   event(0,'survival_reference_started'),
   event(1,'survival_reference_action',{objective:'forage',position:p}),
   event(2,'survival_reference_action',{objective:'forage',position:p}),
   event(3,'survival_reference_death'),
   event(4,'spawn'),
   event(5,'survival_reference_action',{objective:'forage',position:p}),
   event(6,'shutdown')
 ]);
 assert.equal(result.stalledActionIntervals,1);
});
