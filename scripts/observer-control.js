// Command from host: docker compose ... exec commentary node /app/scripts/observer-control.js verbose
import fs from 'node:fs';
const file=process.env.CRAFTLE_OBSERVER_CONFIG??'/state/observer/config.json';
const mode=process.argv[2]??'status';
if(mode==='status'){try{console.log(fs.readFileSync(file,'utf8'));}catch{console.log('normal');}process.exit(0);}
if(!['minimal','normal','verbose','off'].includes(mode)){console.error('Use minimal | normal | verbose | off | status');process.exit(2);}
fs.mkdirSync('/state/observer',{recursive:true});
fs.writeFileSync(file+'.tmp',JSON.stringify({mode,updatedAt:new Date().toISOString()}));
fs.renameSync(file+'.tmp',file);console.log('Observer commentary: '+mode);
