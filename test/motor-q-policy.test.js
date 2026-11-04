import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotorQPolicy,encodeMotorCandidate,MOTOR_FEATURE_COUNT} from '../src/motor-q-policy.js';
const state={health:1,food:12,inventory:[{name:'dirt',count:4}],
 position:{x:1.5,y:80,z:2.5},stalls:200};
const dig={operation:'dig',arguments:{position:{x:2,y:79,z:2}},executable:true,
 evidence:{source:'observed_block',block:'stone'}};
const place={operation:'place',arguments:{reference:{x:1,y:79,z:2},
 itemName:'dirt',face:{x:0,y:-1,z:0}},executable:true,
 evidence:{source:'observed_empty_destination_and_inventory',
 destination:{x:1,y:78,z:2}}};
test('variable candidate encoding is finite and action-specific',()=>{
 const a=encodeMotorCandidate(state,dig),b=encodeMotorCandidate(state,place);
 assert.equal(a.length,MOTOR_FEATURE_COUNT);
 assert.notDeepEqual(a,b);
});
test('policy chooses only bound executable operations',()=>{
 const policy=createMotorQPolicy({seed:3,epsilon:1});
 for(let i=0;i<25;i++){
  const result=policy.choose(state,[{...dig,executable:false},place]);
  assert.equal(result.candidate.operation,'place');
 }
});
test('training updates candidate score and creates a compatible checkpoint',()=>{
 const policy=createMotorQPolicy({seed:5,epsilon:0});
 const selected=policy.choose(state,[dig,place]);
 const before=selected.estimatedQ;
 for(let i=0;i<80;i++)policy.observe({features:selected.features,reward:1,
  nextObservation:state,nextCandidates:[dig,place],terminal:true});
 const resumed=createMotorQPolicy({seed:100,epsilon:0,training:false,snapshot:policy.snapshot()});
 assert.equal(policy.stats().updates,80);
 assert.ok(resumed.choose(state,[selected.candidate]).estimatedQ>before);
 assert.throws(()=>resumed.observe({features:selected.features,reward:1}),/frozen/);
});
test('no executable options report an explicit unavailable state',()=>{
 const policy=createMotorQPolicy();
 assert.equal(policy.choose(state,[{...dig,executable:false}]).reason,'no_executable_candidate');
});
test('tampered model weights are rejected',()=>{
 const p=createMotorQPolicy(),snapshot=p.snapshot();
 snapshot.w[0][0]=Infinity;
 assert.throws(()=>createMotorQPolicy({snapshot}),/Incompatible/);
});
