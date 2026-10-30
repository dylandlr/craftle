// Freeze checkpoint files as immutable experiment artifacts before modifying training.
// Usage: node scripts/freeze-checkpoints.js <state-root> [tag]
// Does not modify existing checkpoints, and never overwrites a prior snapshot.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]??'deploy/filming/state/agent');
const tag=(process.argv[3]??new Date().toISOString().replace(/[:.]/g,'-'));
if(!/^[A-Za-z0-9_-]{1,100}$/.test(tag))throw Error('Invalid tag');
const names=['accepted-policy.json','continuous-policy.json','continuous-policy-reward-v2.json'];
const out=path.join(root,'checkpoints','frozen',tag);
fs.mkdirSync(out,{recursive:true});
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const manifest={schema:'craftle.frozen-checkpoint.v1',tag,createdAt:new Date().toISOString(),sources:[]};
for(const name of names){
 const file=path.join(root,name);
 if(!fs.existsSync(file))continue;
 const before=fs.statSync(file),bytes=fs.readFileSync(file),after=fs.statSync(file);
 if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||bytes.length!==after.size)throw Error('Checkpoint changed while backing up: '+name);
 const digest=sha(bytes);
 const target=path.join(out,name);
 fs.writeFileSync(target,bytes,{flag:'wx',mode:0o444});
 if(sha(fs.readFileSync(target))!==digest)throw Error('Snapshot verification failed: '+name);
 manifest.sources.push({name,bytes:bytes.length,sha256:digest});
}
if(manifest.sources.length===0)throw Error('No checkpoints found under '+root);
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({directory:out,...manifest},null,2));
