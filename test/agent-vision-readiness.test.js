import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAgentVisionPose,cameraContract} from '../src/agent-vision-readiness.js';
const now=Date.parse('2026-10-28T06:00:00.000Z');
const pose={position:{x:5,y:64,z:-3},yaw:0,pitch:0,
 timestamp:new Date(now-200).toISOString(),dimension:'minecraft:overworld',
 anglesUnit:'radians',eyeHeight:1.62,eyeHeightVerified:true,
 positionSource:'mineflayer_entity_feet'};
test('camera contract never claims frame exists even with valid pose',()=>{
 assert.deepEqual(assessAgentVisionPose(pose,now),{ready:true,reason:'pose_valid_only'});
 const state=cameraContract(pose,now);
 assert.equal(state.frameAvailable,false);
 assert.equal(state.poseReadyForRenderer,true);
 assert.equal(state.renderStatus,'unavailable');
 assert.equal(state.pose.dimension,'minecraft:overworld');
});
test('unverified eye height prevents camera readiness',()=>{
 const result=cameraContract({...pose,eyeHeight:null,eyeHeightVerified:false},now);
 assert.equal(result.reason,'eye_height_unverified');
 assert.equal(result.poseReadyForRenderer,false);
});
test('stale and future samples fail closed',()=>{
 assert.equal(assessAgentVisionPose({...pose,timestamp:new Date(now-3100).toISOString()},now).reason,'pose_missing_or_stale');
 assert.equal(assessAgentVisionPose({...pose,timestamp:new Date(now+2000).toISOString()},now).reason,'pose_missing_or_stale');
});
test('invalid geometry, dimension and angular units fail closed',()=>{
 assert.equal(assessAgentVisionPose({...pose,position:{x:NaN,y:64,z:2}},now).reason,'pose_missing_or_invalid');
 assert.equal(assessAgentVisionPose({...pose,dimension:null},now).reason,'dimension_unverified');
 assert.equal(assessAgentVisionPose({...pose,anglesUnit:'degrees'},now).reason,'angles_unit_unverified');
});
