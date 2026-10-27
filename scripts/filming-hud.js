// Read-only HUD projected as a private Minecraft actionbar to the filming spectator.
// No scoreboard, teams, chat broadcasts or policy inputs; RCON only addresses spectator.
import fs from 'node:fs';
import net from 'node:net';

const camera=process.env.CRAFTLE_CAMERA_USERNAME??'';
if(!/^[A-Za-z0-9_]{3,16}$/.test(camera)||camera==='Turesla')throw Error('Invalid spectator CRAFTLE_CAMERA_USERNAME');
const file=process.env.CRAFTLE_COMMENTARY_LOG??'/state/agent/continuous/agent.log';
const password=fs.readFileSync(process.env.CRAFTLE_RCON_PASSWORD_FILE??'/run/secrets/rcon_password','utf8').trim();
const host=process.env.CRAFTLE_RCON_HOST??'minecraft',port=Number(process.env.CRAFTLE_RCON_PORT??25575);
const interval=Math.max(1500,Number(process.env.CRAFTLE_HUD_INTERVAL_MS??2500));
function frame(id,type,value){const body=Buffer.from(value+'\0\0');const buf=Buffer.alloc(body.length+12);buf.writeInt32LE(buf.length-4,0);buf.writeInt32LE(id,4);buf.writeInt32LE(type,8);body.copy(buf,12);return buf;}
function rcon(command){
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection({host,port});let data=Buffer.alloc(0),auth=false,done=false;
  const timer=setTimeout(()=>finish(new Error('RCON timeout')),5000);
  function finish(err){if(done)return;done=true;clearTimeout(timer);socket.destroy();err?reject(err):resolve();}
  socket.on('connect',()=>socket.write(frame(1,3,password)));
  socket.on('data',bytes=>{
   data=Buffer.concat([data,bytes]);
   while(data.length>=4){
    const len=data.readInt32LE(0);if(len<10||len>65536)return finish(new Error('Invalid RCON response'));
    if(data.length<len+4)break;
    const id=data.readInt32LE(4),type=data.readInt32LE(8);
    data=data.subarray(len+4);
    if(id===-1)return finish(new Error('RCON authentication failed'));
    if(!auth&&id===1&&type===2){auth=true;socket.write(frame(2,2,command));}
    else if(auth&&id===2)return finish();
   }
  });
  socket.on('error',finish);
  socket.on('close',()=>{if(!done)finish(new Error('RCON connection closed'));});
 });
}
let offset=0,partial='',busy=false,latest={action:'waiting',health:null,food:null,position:null,decisionId:null,reward:null,updates:null,deaths:0,updatedAt:null};
try{offset=fs.statSync(file).size;}catch{}
function consume(e){
 if(e.type==='target_decision'){latest.action=e.action??e.skill??'unknown';latest.decisionId=e.decisionId;latest.updatedAt=e.timestamp;}
 if(e.type==='target_action'){
  latest.action=e.action??e.skill??latest.action;latest.health=e.health;latest.food=e.food;
  if(e.position)latest.position=e.position;latest.updatedAt=e.timestamp;
 }
 if(e.type==='pose_sample'&&e.position)latest.position=e.position;
 if(e.type==='target_transition'){
  latest.reward=e.reward;latest.updates=e.updates??latest.updates;
 }
 if(e.type==='target_terminal'||e.type==='death_screen_observed'){latest.action='DEAD / respawning';latest.updatedAt=e.timestamp;latest.health=0;}
 if(e.type==='death_screen_observed')latest.deaths++;
 if(e.type==='life_feedback_available'){latest.action='RESPAWNED';latest.updatedAt=e.timestamp;latest.reward=null;latest.health=null;latest.food=null;}
}
function poll(){
 const size=fs.statSync(file).size;
 if(size<offset){offset=0;partial='';}
 if(size===offset)return;
 // Scan bounded batches and preserve partial JSONL line across intervals.
 const fd=fs.openSync(file,'r'),length=Math.min(size-offset,1024*1024),buf=Buffer.alloc(length);
 try{fs.readSync(fd,buf,0,length,offset);}finally{fs.closeSync(fd);}
 offset+=length;
 const lines=(partial+buf.toString('utf8')).split('\n');partial=lines.pop()??'';
 for(const line of lines){if(!line.startsWith('{"timestamp":'))continue;try{consume(JSON.parse(line));}catch{}}
}
const fmt=n=>Number.isFinite(n)?String(Math.round(n*10)/10):'?';
function hud(){
 const p=latest.position;
 const pos=p&&[p.x,p.y,p.z].every(Number.isFinite)?[p.x,p.y,p.z].map(v=>Math.round(v)).join(','):'?';
 const age=latest.updatedAt?Math.floor((Date.now()-Date.parse(latest.updatedAt))/1000):null;
 const stale=age===null?' [NO TELEMETRY]':age>8?' [STALE '+age+'s]':'';
 const line='TURESLA | '+String(latest.action).slice(0,19)+' #'+(latest.decisionId??'?')+
  ' | HP '+fmt(latest.health)+'/20 | Food '+fmt(latest.food)+'/20'+
  ' | XYZ '+pos+' | R '+fmt(latest.reward)+' | Updates '+(latest.updates??'?')+stale;
 return 'title '+camera+' actionbar '+JSON.stringify({text:line,color:'gold'});
}
async function tick(){
 if(busy)return;busy=true;
 try{poll();await rcon(hud());}
 catch(error){console.error(JSON.stringify({type:'filming_hud_error',message:error.message}));}
 finally{busy=false;}
}
console.log(JSON.stringify({type:'filming_hud_started',recipient:camera,log:file,interval,readOnly:true}));
void tick();setInterval(()=>void tick(),interval);
