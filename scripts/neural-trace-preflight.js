// Runs inside agent container, read-only. Does not stop/restart the learner.
import fs from 'node:fs';
import path from 'node:path';
const root=process.env.CRAFTLE_PERSISTENT_ROOT??'/state/agent';
const log=path.join(root,'continuous','agent.log');
function inspect(file){
 try{const st=fs.statSync(file);return {exists:true,bytes:st.size,modifiedAt:st.mtime.toISOString()};}
 catch{return {exists:false};}
}
const env={decisionTrace:process.env.CRAFTLE_DECISION_TRACE??'(unset)',rewardVersion:process.env.CRAFTLE_TARGET_REWARD_VERSION??'(unset)'};
const candidates=[path.join(root,'continuous'),path.join(root,'checkpoints'),path.join(root,'learning')];
const output={schema:'craftle.trace-rollout-preflight.v1',readOnly:true,root,environment:env,log:inspect(log),
 persistedLocations:candidates.map(folder=>({folder,...inspect(folder)})),warnings:[]};
if(env.decisionTrace!=='1')output.warnings.push('Neural tracing is not enabled in this running container.');
if(env.rewardVersion!=='v1')output.warnings.push('Reward version differs from the intended v1 baseline.');
if(!output.log.exists)output.warnings.push('Agent log not found at expected path; verify persistent-root layout.');
console.log(JSON.stringify(output,null,2));
