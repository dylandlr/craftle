import fs from 'node:fs';
import path from 'node:path';
import mineflayer from 'mineflayer';
import {attachRecorder,recordingOptions} from './recording.js';
const config=JSON.parse(fs.readFileSync('config.json','utf8'));
fs.mkdirSync('recordings',{recursive:true});
const events=fs.createWriteStream('recordings/events.jsonl',{flags:'a'});
const log=(name,type,extra={})=>{const e={timestamp:new Date().toISOString(),agent:name,type,...extra};events.write(JSON.stringify(e)+'\n');console.log(JSON.stringify(e));};
const bots=[];
let stopping=false;
for(const profile of config.agents){
 const bot=mineflayer.createBot({host:config.host,port:config.port,username:profile.name,version:config.version,hideErrors:true});
 bots.push(bot);
 bot.on('spawn',()=>{
   log(profile.name,'spawn',{agent_id:profile.id,position:bot.entity?.position});
   attachRecorder(bot,profile,recordingOptions(),(name,type,data)=>log(name,type,data))
     .catch(e=>log(profile.name,'recording_error',{message:e.message}));
 });
 bot.on('health',()=>log(profile.name,'health',{health:bot.health,food:bot.food}));
 bot.on('death',()=>log(profile.name,'death'));
 bot.on('kicked',reason=>log(profile.name,'kicked',{reason:String(reason)}));
 bot.on('error',e=>log(profile.name,'error',{message:e.message}));
 bot.on('end',()=>log(profile.name,'disconnected'));
}
const shutdown=()=>{
 if(stopping)return;
 stopping=true;
 log('system','shutdown',{agents:bots.length});
 for(const bot of bots)try{bot.quit('Recording complete');}catch{}
 setTimeout(()=>{events.end();process.exit(0);},2000);
};
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);
log('system','recording_started',{agents:config.agents.map(a=>({id:a.id,name:a.name})),mode:'true-rendered-pov',note:'Recording smoke test; agent intelligence not yet evaluated'});
