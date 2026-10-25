import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {preparePersistentSession,promotePersistentSession} from '../src/persistent-session.js';
import {startSpectatorMonitor} from '../src/spectator-monitor.js';
const root=path.resolve(process.env.CRAFTLE_PERSISTENT_ROOT??'deploy/persistent/state/agent');
const monitor=startSpectatorMonitor({telemetryRoot:root});
monitor.on('error',error=>console.error(JSON.stringify({type:'spectator_monitor_error',message:error.message})));
const duration=Number(process.env.CRAFTLE_PERSISTENT_SESSION_MS??180000);
if(!Number.isInteger(duration)||duration<80000||duration>300000)throw Error('Persistent session must be 80000..300000 ms');
fs.writeFileSync('config.json',JSON.stringify({host:process.env.CRAFTLE_SERVER_HOST??'127.0.0.1',port:Number(process.env.CRAFTLE_SERVER_PORT??25565),version:process.env.CRAFTLE_MC_VERSION??'1.21.1',agents:[{id:'agent_001',name:'Turesla'}]},null,2));
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
