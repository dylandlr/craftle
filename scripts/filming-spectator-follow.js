import {shouldAttachCamera} from '../src/filming-camera-attachment.js';
// Filming-only spectator follow watchdog. It never connects to the learner,
// modifies its policy, or controls gameplay; RCON only changes the camera account.
import fs from 'node:fs';
import net from 'node:net';
const camera=process.env.CRAFTLE_CAMERA_USERNAME??'';
const target=process.env.CRAFTLE_FOLLOW_TARGET??'Turesla';
const name=/^[A-Za-z0-9_]{3,16}$/;
if(!name.test(camera)||!name.test(target)||camera===target)throw Error('Set distinct, valid CRAFTLE_CAMERA_USERNAME and CRAFTLE_FOLLOW_TARGET');
const host=process.env.CRAFTLE_RCON_HOST??'minecraft';
const port=Number(process.env.CRAFTLE_RCON_PORT??25575);
const password=fs.readFileSync(process.env.CRAFTLE_RCON_PASSWORD_FILE??'/run/secrets/rcon_password','utf8').trim();
if(!password)throw Error('Missing filming RCON password');
const logFile=process.env.CRAFTLE_COMMENTARY_LOG??'/state/agent/continuous/agent.log';
const interval=Math.max(2500,Number(process.env.CRAFTLE_FOLLOW_CHECK_MS??6000));
const reattachMs=Number(process.env.CRAFTLE_FOLLOW_REATTACH_MS??0);
function packet(id,type,payload){
 const body=Buffer.from(payload+'\0\0');
 const out=Buffer.alloc(body.length+12);out.writeInt32LE(out.length-4,0);
 out.writeInt32LE(id,4);out.writeInt32LE(type,8);body.copy(out,12);return out;
}
function command(input){
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection({host,port});let buffer=Buffer.alloc(0),auth=false,finished=false;
  const timer=setTimeout(()=>done(new Error('RCON timed out')),5000);
  function done(err,result){if(finished)return;finished=true;clearTimeout(timer);socket.destroy();err?reject(err):resolve(result);}
  socket.on('connect',()=>socket.write(packet(100,3,password)));
  socket.on('data',data=>{
   buffer=Buffer.concat([buffer,data]);
   while(buffer.length>=4){
    const length=buffer.readInt32LE(0);
    if(length<10||length>65536)return done(new Error('Invalid RCON response'));
    if(buffer.length<length+4)break;
    const id=buffer.readInt32LE(4),type=buffer.readInt32LE(8);
    const payload=buffer.toString('utf8',12,length+2);
    buffer=buffer.subarray(length+4);
    if(id===-1)return done(new Error('RCON authentication rejected'));
    if(!auth&&id===100&&type===2){auth=true;socket.write(packet(101,2,input));}
    else if(auth&&id===101)return done(null,payload);
   }
  });
  socket.on('error',done);
  socket.on('close',()=>{if(!finished)done(new Error('RCON disconnected'));});
 });
}
let offset=0,remaining='';
try{offset=fs.statSync(logFile).size;}catch{}
let pending=true,lastAttach=0,busy=false,cameraWasOnline=false;
function scan(){
 let size;try{size=fs.statSync(logFile).size;}catch{return;}
 if(size<offset){offset=0;remaining='';pending=true;}
 if(size===offset)return;
 const count=Math.min(size-offset,1024*1024),data=Buffer.alloc(count),fd=fs.openSync(logFile,'r');
 try{fs.readSync(fd,data,0,count,offset);}finally{fs.closeSync(fd);}
 offset+=count;
 const lines=(remaining+data.toString('utf8')).split('\n');
 remaining=lines.pop()??'';
 for(const line of lines){
  if(!line.startsWith('{"timestamp":'))continue;
  let e;try{e=JSON.parse(line);}catch{continue;}
  if(['death_screen_observed','death','spawn','life_feedback_available','respawn'].includes(e.type)){
   pending=true;
   console.log(JSON.stringify({type:'filming_follow_lifecycle',event:e.type}));
  }
 }
}
async function tick(){
 if(busy)return;busy=true;
 try{
  scan();
  // Detect camera reconnects independently of agent lifecycle events.
  // Running gamemode only upon reconnection avoids repeatedly resetting
  // the spectator target during normal follow.
  const onlineReply=await command('list');
  const online=onlineReply.split(':').slice(1).join(':').split(',').map(x=>x.trim()).includes(camera);
  if(!online){
    if(cameraWasOnline)console.log(JSON.stringify({type:'filming_camera_disconnected',camera}));
    cameraWasOnline=false;pending=true;return;
  }
  if(!cameraWasOnline){
    cameraWasOnline=true;pending=true;
    console.log(JSON.stringify({type:'filming_camera_reconnected',camera}));
    // Ensure survival/adventure reconnects return to spectator before /spectate.
    const mode=await command('gamemode spectator '+camera);
    console.log(JSON.stringify({type:'filming_camera_spectator_mode',camera,response:mode.slice(0,220)}));
  }
  // Do not repeatedly issue /spectate while attached: it can disturb client terrain rendering.
  // Lifecycle events and reconnects still trigger attachment. Optional heartbeat is opt-in.
  const decision=shouldAttachCamera({pending,lastAttach,now:Date.now(),heartbeatMs:reattachMs});
  if(!decision.attach)return;
  const response=await command('spectate '+target+' '+camera);
  // Vanilla command text varies with the server language; an empty response
  // is not proof of success. Report it, and keep retrying on the heartbeat.
  console.log(JSON.stringify({type:'filming_follow_attempt',target,camera,reason:decision.reason,response:response.slice(0,220)}));
  if(/no entity|not found|unknown|failed|cannot|can't|could not|not in spectator|not online/i.test(response)){
   pending=true;
  }else{
   pending=false;lastAttach=Date.now();
  }
 }catch(error){pending=true;console.error(JSON.stringify({type:'filming_follow_retry',message:error.message}));}
 finally{busy=false;}
}
console.log(JSON.stringify({type:'filming_follow_started',camera,target,checkMs:interval,source:logFile}));
void tick();setInterval(()=>void tick(),interval);
