// Host-side, non-destructive snapshot before deliberately recreating a running agent.
// Requires Node 22. Does not stop Docker, mutate source files, or touch the world.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {inspectTargetCheckpoint} from '../src/persistent-session.js';
const source=path.resolve(process.argv[2]??'deploy/filming/state/agent');
const backups=path.resolve(process.argv[3]??'craftle-backups');
const policy=path.join(source,'continuous-policy.json');
const log=path.join(source,'continuous','agent.log');
function sha(file){const h=createHash('sha256');const data=fs.readFileSync(file);h.update(data);return h.digest('hex');}
if(!fs.existsSync(policy))throw Error('Refusing backup: continuous-policy.json does not exist at '+source);
if(!fs.existsSync(log))throw Error('Refusing backup: current continuous/agent.log is missing at '+source);
const inspected=inspectTargetCheckpoint(policy);
const destination=path.join(backups,'neural-trace-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
fs.mkdirSync(destination,{recursive:true});
const copiedPolicy=path.join(destination,'continuous-policy.json');
const copiedLog=path.join(destination,'agent.log');
fs.copyFileSync(policy,copiedPolicy,fs.constants.COPYFILE_EXCL);
fs.copyFileSync(log,copiedLog,fs.constants.COPYFILE_EXCL);
const verified=inspectTargetCheckpoint(copiedPolicy);
if(verified.sha256!==sha(copiedPolicy))throw Error('Checkpoint hash mismatch after snapshot');
const manifest={schema:'craftle.neural-trace-backup.v1',createdAt:new Date().toISOString(),source,
 destination,checkpoint:{...verified,sourceHashAtStart:inspected.sha256},
 log:{bytes:fs.statSync(copiedLog).size,sha256:sha(copiedLog)},rewardVersion:'v1',
 note:'Source run remains active. Log snapshot may not contain writes after copying began. Server world and volumes were not changed.'};
fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'snapshot_verified',destination,checkpointUpdates:verified.updates,checkpointSha256:verified.sha256,logBytes:manifest.log.bytes},null,2));
