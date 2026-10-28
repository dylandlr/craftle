// Observer-only camera readiness gate. Pure data validation: NEVER renders pixels or controls agents.
const finitePoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
export function assessAgentVisionPose(pose,now=Date.now()){
 if(!pose||!finitePoint(pose.position)||!Number.isFinite(pose.yaw)||!Number.isFinite(pose.pitch))
   return {ready:false,reason:'pose_missing_or_invalid'};
 const t=Date.parse(pose.timestamp);
 if(!Number.isFinite(t)||t>now+1000||now-t>3000)
   return {ready:false,reason:'pose_missing_or_stale'};
 if(typeof pose.dimension!=='string'||!pose.dimension.trim())
   return {ready:false,reason:'dimension_unverified'};
 if(pose.anglesUnit!=='radians')
   return {ready:false,reason:'angles_unit_unverified'};
 if(pose.eyeHeightVerified!==true||!Number.isFinite(pose.eyeHeight)||pose.eyeHeight<=0||pose.eyeHeight>=3)
   return {ready:false,reason:'eye_height_unverified'};
 return {ready:true,reason:'pose_valid_only'};
}
export function cameraContract(pose,now=Date.now()){
 const check=assessAgentVisionPose(pose,now);
 return {
   schema:'craftle.agent-vision-contract.v1',
   readOnly:true,renderStatus:'unavailable',frameAvailable:false,
   source:'not_implemented',
   pose:pose&&finitePoint(pose.position)?{
      position:pose.position,yaw:Number.isFinite(pose.yaw)?pose.yaw:null,
      pitch:Number.isFinite(pose.pitch)?pose.pitch:null,
      timestamp:pose.timestamp??null,dimension:pose.dimension??null,
      anglesUnit:pose.anglesUnit??'unverified',positionSource:pose.positionSource??'unverified',
      eyeHeight:pose.eyeHeightVerified===true&&Number.isFinite(pose.eyeHeight)?pose.eyeHeight:null,
      eyeHeightVerified:pose.eyeHeightVerified===true,
      eyeHeightSource:pose.eyeHeightSource??null,
      eyePosition:pose.eyeHeightVerified===true&&Number.isFinite(pose.eyeHeight)?{
        x:pose.position.x,y:pose.position.y+pose.eyeHeight,z:pose.position.z
      }:null
   }:null,
   poseReadyForRenderer:check.ready,
   camera:{projectionVerified:false,fovDegrees:null,frameTimestamp:null,frameLatencyMs:null},
   reason:check.ready?'no_second_camera_render':check.reason,
   note:'Verified pose alone is not rendered Minecraft pixels or DQN input'
 };
}
