import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const prefix='craftle-options-v3-structured7-assisted4-commit4-audited-v1-';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export function verifyPredecessor({checkpoint,cacheKey,metadata,currentRunId}){
 const present=fs.existsSync(checkpoint);
 if(!present){if(cacheKey)throw Error('Cache key present without checkpoint');return {coldStart:true,predecessor:null};}
 const match=new RegExp('^'+prefix+'([0-9]+)-([0-9]+)$').exec(cacheKey||'');
 if(!match||match[1]===String(currentRunId))throw Error('Invalid predecessor cache identity');
 const policy=JSON.parse(fs.readFileSync(checkpoint,'utf8'));
 const digest=sha(checkpoint);
 if(metadata&&fs.existsSync(metadata)){
  const m=JSON.parse(fs.readFileSync(metadata,'utf8'));
  if(m.schema!=='craftle.checkpoint-lineage.v1'||m.runId!==match[1]||m.runAttempt!==Number(match[2])||m.sha256!==digest||m.updates!==policy.updates)throw Error('Checkpoint predecessor lineage mismatch');
 }else if(policy.updates!==408||digest!=='58d7ce5527d9ae0fe7ee81608fbb4ef2f9098f4d3f2624750c92771ce0600878'||match[1]!=='40172877981'){
  throw Error('Legacy checkpoint is not the verified bootstrap predecessor');
 }
 return {coldStart:false,predecessor:match[1],sha256:digest,updates:policy.updates};
}
export function writeLineage({checkpoint,metadata,runId,runAttempt}){
 const policy=JSON.parse(fs.readFileSync(checkpoint,'utf8'));
 if(!policy.trainingState)throw Error('Checkpoint lacks full training state');
 const record={schema:'craftle.checkpoint-lineage.v1',runId:String(runId),runAttempt:Number(runAttempt),updates:policy.updates,sha256:sha(checkpoint)};
 fs.mkdirSync(metadata.substring(0,metadata.lastIndexOf('/')),{recursive:true});
 fs.writeFileSync(metadata,JSON.stringify(record,null,2)+'\n');
 return record;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [mode,checkpoint,metadata,cacheKey,runId,runAttempt]=process.argv.slice(2);
 const result=mode==='verify'?verifyPredecessor({checkpoint,metadata,cacheKey,currentRunId:runId}):mode==='write'?writeLineage({checkpoint,metadata,runId,runAttempt}):null;
 if(!result)throw Error('Usage: verify checkpoint metadata cacheKey currentRunId | write checkpoint metadata ignored runId runAttempt');
 console.log(JSON.stringify(result));
}
