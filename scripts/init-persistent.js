import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const root=path.resolve('deploy/persistent');
for(const name of ['state/server','state/agent','secrets'])fs.mkdirSync(path.join(root,name),{recursive:true});
const secret=path.join(root,'secrets/rcon_password.txt');
if(!fs.existsSync(secret))fs.writeFileSync(secret,randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'});
console.log('Persistent directories are ready. Existing world, checkpoints and credentials were preserved.');
