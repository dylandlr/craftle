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
const allowedIds=process.env.CRAFTLE_AGENT_IDS?.split(',').map(x=>x.trim()).filter(Boolean);
const activeProfiles=allowedIds?config.agents.filter(a=>allowedIds.includes(a.id)):config.agents;
if(allowedIds && activeProfiles.length!==allowedIds.length)throw Error('Unknown agent in CRAFTLE_AGENT_IDS');
for(const [index,profile] of activeProfiles.entries()){
 await new Promise(resolve=>setTimeout(resolve,index===0?0:6000));
 if(stopping)break;
 log(profile.name,'connecting',{agent_id:profile.id,index});
 const bot=mineflayer.createBot({host:config.host,port:config.port,username:profile.name,version:config.version,hideErrors:true});
 bots.push(bot);
 bot.on('spawn',()=>{
   log(profile.name,'spawn',{agent_id:profile.id,position:bot.entity?.position});
   if(process.env.CRAFTLE_CAMERA_SWEEP==='1'){
     let tick=0;
     const sweep=setInterval(()=>{
       if(!bot.entity||stopping){clearInterval(sweep);return;}
       bot.look((tick++%12)*Math.PI/6,0).catch(e=>log(profile.name,'camera_sweep_error',{message:e.message}));
     },1000);
     bot.once('end',()=>clearInterval(sweep));
   }
   const startRecorder=async()=>{
     const barrier=process.env.CRAFTLE_CAPTURE_BARRIER;
     if(barrier){
       log(profile.name,'capture_waiting',{agent_id:profile.id,barrier});
       const deadline=Date.now()+180000;
       while(!stopping && !fs.existsSync(barrier) && Date.now()<deadline)
         await new Promise(resolve=>setTimeout(resolve,100));
       if(stopping || !fs.existsSync(barrier)){
         log(profile.name,'recording_error',{message:'Capture barrier timed out'});
         return;
       }
       log(profile.name,'capture_released',{agent_id:profile.id,releaseTime:fs.readFileSync(barrier,'utf8').trim()});
     }
     if(stopping)return;
     await attachRecorder(bot,profile,recordingOptions(),(name,type,data)=>log(name,type,data));
   };
   startRecorder().catch(e=>log(profile.name,'recording_error',{message:e.message}));
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
log('system','recording_started',{agents:activeProfiles.map(a=>({id:a.id,name:a.name})),mode:'true-rendered-pov',note:'Recording smoke test; agent intelligence not yet evaluated'});
