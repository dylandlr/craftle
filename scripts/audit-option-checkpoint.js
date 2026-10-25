import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createOptionDQN} from '../src/option-dqn.js';

export const TRAINING_CONTRACT='structured7-assisted4-rewardv3-commit4-v1';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function inspectCheckpoint(file){
 const bytes=fs.readFileSync(file),snapshot=JSON.parse(bytes);
 if(!Number.isSafeInteger(snapshot.updates)||snapshot.updates<0)throw Error('Invalid checkpoint update count');
 // Validate the actual network schema, action order, dimensions and finite weights.
 createOptionDQN({snapshot,training:false,random:()=>0.5});
 const training=snapshot.trainingState;
 const replaySize=training?.replay?.length??null;
 return {schema:snapshot.schema,updates:snapshot.updates,sha256:digest(bytes),trainingStateSchema:training?.schema??null,replaySize,rngPresent:Number.isSafeInteger(training?.rngState),targetWeightsPresent:Boolean(training?.tw&&training?.tv)};
}
export function captureIncoming(file){
 const checkpoint=fs.existsSync(file)?inspectCheckpoint(file):null;
 return {schema:'craftle.checkpoint-input.v1',contract:TRAINING_CONTRACT,coldStart:checkpoint===null,checkpoint};
}
export function auditCheckpoint(file,events,incoming){
 if(incoming.schema!=='craftle.checkpoint-input.v1'||incoming.contract!==TRAINING_CONTRACT)throw Error('Incompatible incoming checkpoint manifest');
 if(typeof incoming.coldStart!=='boolean'||incoming.coldStart!==(incoming.checkpoint===null))throw Error('Invalid cold-start manifest');
 const initial=incoming.coldStart?0:incoming.checkpoint?.updates;
 if(!Number.isSafeInteger(initial)||initial<0)throw Error('Invalid incoming update count');
 if(!incoming.coldStart&&(!/^[a-f0-9]{64}$/.test(incoming.checkpoint.sha256)||incoming.checkpoint.schema!=='craftle.options.dqn.v1'))throw Error('Invalid incoming checkpoint identity');
 const outgoing=inspectCheckpoint(file);
 if(!outgoing.targetWeightsPresent||!outgoing.rngPresent||outgoing.replaySize===null)throw Error('Missing complete resumable DQN state');
 if(!incoming.coldStart&&incoming.checkpoint.trainingStateSchema==='craftle.dqn.training-state.v1'){
  if(!incoming.checkpoint.targetWeightsPresent||!incoming.checkpoint.rngPresent||incoming.checkpoint.replaySize===null)throw Error('Restored checkpoint missing resumable state');
 }
 const decisions=events.filter(e=>e.type==='option_decision');
 if(!decisions.length||decisions.some(e=>e.mode!=='training'||e.rewardVersion!=='v3'||e.commitmentSteps!==4))throw Error('Mismatched training decision contract');
 let expected=initial,transitions=0,terminals=0;
 for(const event of events){
  if(!['option_transition','option_terminal'].includes(event.type))continue;
  if(!Number.isFinite(event.reward))throw Error('Invalid transition reward');
  expected+=4;
  if(event.type==='option_terminal'){terminals++;continue;}
  transitions++;
  if(event.updates!==expected)throw Error('Transition update count does not follow checkpoint lineage');
 }
 if(expected===initial||outgoing.updates!==expected)throw Error('Checkpoint update delta does not match episode transitions');
 if(!incoming.coldStart&&outgoing.sha256===incoming.checkpoint.sha256)throw Error('Training checkpoint did not change');
 return {schema:'craftle.checkpoint-audit.v1',status:'passed',contract:TRAINING_CONTRACT,coldStart:incoming.coldStart,
  incoming:incoming.checkpoint,outgoing,episodeUpdates:outgoing.updates-initial,transitions,terminals,decisions:decisions.length};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [command,file,...args]=process.argv.slice(2);
 if(command==='capture'&&args.length===1){
  fs.writeFileSync(args[0],JSON.stringify(captureIncoming(file),null,2)+'\n');
 }else if(command==='verify'&&args.length===3){
  const [log,incoming,output]=args;
  const events=fs.readFileSync(log,'utf8').split('\n').filter(line=>line.startsWith('{"timestamp":')).map(line=>JSON.parse(line));
  const audit=auditCheckpoint(file,events,JSON.parse(fs.readFileSync(incoming,'utf8')));
  fs.writeFileSync(output,JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit));
 }else throw Error('Usage: audit-option-checkpoint.js capture checkpoint manifest | verify checkpoint log incoming-manifest output');
}
