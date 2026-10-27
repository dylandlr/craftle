import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {preparePersistentSession,promotePersistentSession} from '../src/persistent-session.js';
import {startSpectatorMonitor} from '../src/spectator-monitor.js';
import {generateCitizenAppearance} from '../src/citizen-appearance.js';
import {makeSkin} from './generate-citizen-skins.js';
const root=path.resolve(process.env.CRAFTLE_PERSISTENT_ROOT??'deploy/persistent/state/agent');
const monitor=startSpectatorMonitor({telemetryRoot:root});
monitor.on('error',error=>console.error(JSON.stringify({type:'spectator_monitor_error',message:error.message})));
const duration=Number(process.env.CRAFTLE_PERSISTENT_SESSION_MS??180000);
if(!Number.isInteger(duration)||duration<80000||duration>300000)throw Error('Persistent session must be 80000..300000 ms');
fs.writeFileSync('config.json',JSON.stringify({host:process.env.CRAFTLE_SERVER_HOST??'127.0.0.1',port:Number(process.env.CRAFTLE_SERVER_PORT??25565),version:process.env.CRAFTLE_MC_VERSION??'1.21.1',agents:[{id:'agent_001',name:'Turesla'}]},null,2));
// Cosmetic citizen identities persist across agent sessions; nothing touches policy inputs.
const citizenDir=path.join(root,'citizens');
fs.mkdirSync(citizenDir,{recursive:true});
for(const citizen of [{id:'agent_001',name:'Turesla'}]){
 const profilePath=path.join(citizenDir,citizen.id+'.json'),skinPath=path.join(citizenDir,citizen.id+'.png');
 let appearance;
 try{appearance=JSON.parse(fs.readFileSync(profilePath,'utf8'));}
 catch{appearance=generateCitizenAppearance({citizenId:citizen.id,worldSeed:process.env.CRAFTLE_CITIZEN_WORLD_SEED??'craftle'});fs.writeFileSync(profilePath,JSON.stringify(appearance,null,2)+'\n');}
 if(!fs.existsSync(skinPath))fs.writeFileSync(skinPath,makeSkin(appearance));
 console.log(JSON.stringify({type:'citizen_appearance_ready',id:citizen.id,name:citizen.name,model:appearance.model,seed:appearance.seed,skinFile:skinPath,cosmeticOnly:true,skinAppliedInClient:false}));
}
// Docker runs this process under a kernel flock; it is released on crashes/reboots.
let stopping=false,child=null;
const terminate=()=>{if(child)try{process.kill(-child.pid,'SIGTERM');}catch{}};
const stop=()=>{stopping=true;terminate();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
function execute(command,args,{timeoutMs=0,...options}={}){
 return new Promise((resolve,reject)=>{
  const processChild=spawn(command,args,{...options,detached:true});child=processChild;let hardKill;
  const timer=timeoutMs?setTimeout(()=>{try{process.kill(-processChild.pid,'SIGTERM');}catch{}hardKill=setTimeout(()=>{try{process.kill(-processChild.pid,'SIGKILL');}catch{}},10000);},timeoutMs):null;
  const clean=()=>{if(timer)clearTimeout(timer);if(hardKill)clearTimeout(hardKill);child=null;};
  processChild.on('error',error=>{clean();reject(error);});
  processChild.on('exit',(code,signal)=>{clean();resolve({code,signal});});
 });
}
const continuous=process.env.CRAFTLE_CONTINUOUS_AGENT==='1';
if(continuous){
 // Continuous training is intentionally separate from validated session promotion.
 // Seed once; never overwrite or silently promote the accepted baseline.
 fs.mkdirSync(root,{recursive:true});
 const source=path.join(root,'accepted-policy.json');
 const rewardVersion=process.env.CRAFTLE_TARGET_REWARD_VERSION??'v1';
 if(!['v1','v2'].includes(rewardVersion))throw Error('Unknown targeted reward version');
 const target=path.join(root,rewardVersion==='v2'?'continuous-policy-reward-v2.json':'continuous-policy.json');
 if(!fs.existsSync(target)&&fs.existsSync(source))fs.copyFileSync(source,target);
 if(!fs.existsSync(target))throw Error('Continuous mode requires an existing accepted or continuous checkpoint');
 const continuousDir=path.join(root,'continuous');
 fs.mkdirSync(continuousDir,{recursive:true});
 console.log(JSON.stringify({type:'continuous_agent_enabled',checkpoint:target,rewardVersion,validatedBaselineUntouched:true,referenceVideo:false}));
 let errors=0;
 try{
  while(!stopping){
   const stream=fs.openSync(path.join(continuousDir,'agent.log'),'a');
   let result;
   try{
    result=await execute('xvfb-run',['-a','node','src/main.js'],{
      // No session timeout; Mineflayer reconnects only when the process actually exits.
      stdio:['ignore',stream,stream],
      env:{...process.env,CRAFTLE_BEHAVIOR:'targeted_survival_options',
        CRAFTLE_OPTION_POLICY:'training',CRAFTLE_OPTION_SEED:'17',
        CRAFTLE_TARGET_CHECKPOINT:target,
        CRAFTLE_RL_MAX_MS:'0',CRAFTLE_REFERENCE_VIDEO_DIR:'',
        CRAFTLE_CAPTURE_TELEMETRY:'1',CRAFTLE_RECORD_POV:'0'}
    });
   }finally{fs.closeSync(stream);}
   if(stopping)break;
   errors++;
   console.error(JSON.stringify({type:'continuous_agent_exit',code:result.code,signal:result.signal,consecutiveExits:errors}));
   if(errors>=5){
    console.error(JSON.stringify({type:'continuous_agent_paused',reason:'five unexpected exits; inspect agent.log'}));
    while(!stopping)await new Promise(resolve=>setTimeout(resolve,5000));
    break;
   }
   await new Promise(resolve=>setTimeout(resolve,5000));
  }
 }finally{terminate();monitor.close();}
}else{
let failures=0;
try{
 while(!stopping){
  const session=preparePersistentSession(root),log=path.join(session.directory,'agent.log');
  const output=fs.openSync(log,'a');let result;
  try{
   result=await execute('xvfb-run',['-a','node','src/main.js'],{timeoutMs:duration+90000,stdio:['ignore',output,output],env:{...process.env,CRAFTLE_BEHAVIOR:'targeted_survival_options',CRAFTLE_OPTION_POLICY:'training',CRAFTLE_OPTION_SEED:'17',CRAFTLE_TARGET_CHECKPOINT:session.candidate,CRAFTLE_RL_MAX_MS:String(duration),CRAFTLE_REFERENCE_VIDEO_DIR:session.directory,CRAFTLE_RECORD_FRAMES:'20000',CRAFTLE_CAPTURE_TELEMETRY:'1',CRAFTLE_RECORD_POV:'0'}});
  }finally{fs.closeSync(output);}
  let videoValid=false;
  if(!stopping){const encoded=await execute('python3',['scripts/encode-reference-video.py',session.directory],{timeoutMs:300000,stdio:'inherit'});videoValid=encoded.code===0;}
  try{
   const events=fs.readFileSync(log,'utf8').split('\n').filter(line=>line.startsWith('{"timestamp":')).map(line=>JSON.parse(line));
   const report=promotePersistentSession(session,events,{exitCode:result.code,videoValid});console.log(JSON.stringify({type:'persistent_session_finished',directory:session.directory,...report}));failures=0;
  }catch(error){failures++;fs.writeFileSync(path.join(session.directory,'failure.json'),JSON.stringify({error:error.message,exitCode:result.code,signal:result.signal})+'\n');console.error(JSON.stringify({type:'persistent_session_failed',directory:session.directory,message:error.message}));}
  if(failures>=3){
   console.error(JSON.stringify({type:'persistent_runner_paused',reason:'three consecutive failed sessions; inspect evidence and restart the agent'}));
   while(!stopping)await new Promise(resolve=>setTimeout(resolve,5000));
   break;
  }
  if(!stopping)await new Promise(resolve=>setTimeout(resolve,5000));
 }
}finally{terminate();monitor.close();}

}
