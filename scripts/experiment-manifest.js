import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const validModes=new Set(['scripted','random','frozen','training']);
export function buildExperimentManifest({treatment,worldSeed,policySeed,commit,workflowRun,contract='structured7-assisted4-v1',commitmentSteps=1,seconds,checkpointPath,metricsPath,logPath,videoPath,recordingManifestPath}){
 if(!validModes.has(treatment))throw Error('Unrecognized treatment');
 if(!/^\d+$/.test(String(worldSeed))||!/^\d+$/.test(String(policySeed)))throw Error('Invalid seeds');
 if(!/^[a-f\d]{40}$/.test(commit))throw Error('Expected full Git commit SHA');
 if(!Number.isInteger(commitmentSteps)||commitmentSteps<1||!Number.isFinite(seconds)||seconds<=0)throw Error('Invalid time/commitment');
 const hashFile=p=>p&&fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
 const evidence={metrics:hashFile(metricsPath),log:hashFile(logPath),video:hashFile(videoPath),recordingManifest:hashFile(recordingManifestPath),checkpoint:hashFile(checkpointPath)};
 const missing=Object.entries(evidence).filter(([key,value])=>!value&&['metrics','log'].includes(key)).map(([key])=>key);
 if(missing.length)throw Error('Missing required evidence: '+missing.join(','));
 return {schema:'craftle.experiment.v1',treatment,worldSeed:String(worldSeed),policySeed:String(policySeed),
  commit,workflowRun:String(workflowRun??''),observationActionContract:contract,commitmentSteps,
  expectedSeconds:seconds,rewardSpecification:treatment==='training'?'neural-option-reward-v1':'evaluation-only',
  policyInformation:treatment==='scripted'?'structured7-with-scripted-choice':'structured7-with-assisted-options',
  evidence,videoAvailable:!!evidence.video,
  limitations:['Environment trajectories may vary between trials even with the same world seed','Checkpoint and replay state do not fully capture exact resumption RNG state']};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [out,treatment,worldSeed,policySeed,commit,run,seconds,steps,metrics,log,video,checkpoint,recordingManifest]=process.argv.slice(2);
 const record=buildExperimentManifest({treatment,worldSeed,policySeed,commit,workflowRun:run,seconds:Number(seconds),commitmentSteps:Number(steps),metricsPath:metrics,logPath:log,videoPath:video,checkpointPath:checkpoint,recordingManifestPath:recordingManifest});
 fs.writeFileSync(out,JSON.stringify(record,null,2)+'\n');
 console.log(JSON.stringify({type:'experiment_manifest',out,videoAvailable:record.videoAvailable,commit:record.commit}));
}
