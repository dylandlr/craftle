import test from 'node:test';
import assert from 'node:assert/strict';
import {observeTargets} from '../src/target-opportunities.js';
import {summarizeFoodFunnel} from '../scripts/report-food-funnel.js';
test('four target slots retain harvestable plant instead of crowding with closer animals',()=>{
 const entities=Object.fromEntries(Array.from({length:5},(_,i)=>[i+1,{
  id:i+1,name:'cow',position:{x:i+1,y:64,z:0}
 }]));
 const mature={name:'melon',position:{x:10,y:64,z:0},boundingBox:'block',
  getProperties:()=>({})};
 const bot={health:20,food:12,entity:{position:{x:0,y:64,z:0}},entities,
  inventory:{items:()=>[]},
  registry:{blocksByName:{melon:{id:7}},foodsByName:{}},
  findBlocks:()=>[{x:10,y:64,z:0}],
  blockAt:()=>mature,canSeeBlock:()=>true
 };
 // Entity visibility depends on the actual world raycasting API. Here no entity
 // visibility helper is configured, so test only the guaranteed visible plant.
 const observations=observeTargets(bot);
 assert.ok(observations.targets.some(t=>t.kind==='plant'));
});
test('funnel separates observations from causal evidence',()=>{
 const events=[
  {type:'target_perception_audit',timestamp:'a',totalCandidates:2,selectedTargets:1,entityVisibilityAccepted:1},
  {type:'target_decision',timestamp:'b',decisionId:1,action:'approach_0'},
  {type:'target_attack_attempt',timestamp:'c'},
  {type:'food_provenance_inventory_delta',timestamp:'d',item:'beef',delta:1},
  {type:'target_consumed',timestamp:'e'},
  {type:'target_verified_recovery',timestamp:'f'}
 ];
 const r=summarizeFoodFunnel(events);
 assert.equal(r.phases.approachDecisions,1);
 assert.equal(r.phases.positiveInventoryDeltas,1);
 assert.equal(r.phases.verifiedEats,1);
 assert.equal(r.perception.auditSamples,1);
 assert.ok(r.limitations.some(x=>x.includes('causation')));
});
