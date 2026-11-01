import {interpretNeuralTrace,neuralTraceText,neuralTraceChat} from './observer-neural-traces.js';
import {explainEvent,explanationChat} from './observer-explainability.js';
import {formatEvent,recommendedLevel,observerCommand} from './observer-presentation.js';
// Filming-only RCON chat commentator. Reads the agent log; never modifies policy,
// sends controls to Mineflayer, or broadcasts messages to Turesla.
import fs from 'node:fs';
import net from 'node:net';

const file=process.env.CRAFTLE_COMMENTARY_LOG??'/state/agent/continuous/agent.log';
const username=process.env.CRAFTLE_CAMERA_USERNAME??'';
if(!/^[A-Za-z0-9_]{3,16}$/.test(username)||username==='Turesla')
 throw Error('Set CRAFTLE_CAMERA_USERNAME to your spectator Minecraft username (not Turesla)');
const host=process.env.CRAFTLE_RCON_HOST??'minecraft';
const port=Number(process.env.CRAFTLE_RCON_PORT??25575);
const password=fs.readFileSync(process.env.CRAFTLE_RCON_PASSWORD_FILE??'/run/secrets/rcon_password','utf8').trim();
if(!password)throw Error('Missing RCON password');
const minimumMs=Math.max(750,Number(process.env.CRAFTLE_CHAT_INTERVAL_MS??1200));
let lastSent=0,queued=[],busy=false,seen=new Set(),lastSummary=0,lastDecision=null,lastPosition=null,lastVitals=null,lastReward=null;
let lastDecisionAnnouncement=null,lastDecisionAnnouncedAt=0,lastVitalsWarningAt=0;
const eventCooldown=new Map();
const maxAgeMs=4000;const criticalTypes=new Set(['death_screen_observed','target_consumed','target_verified_recovery']);
function describe(e){return formatEvent(e);}
function verbosity(){try{const c=JSON.parse(fs.readFileSync(process.env.CRAFTLE_OBSERVER_CONFIG??'/state/observer/config.json','utf8'));return ['off','minimal','normal','verbose'].includes(c.mode)?c.mode:'normal';}catch{return 'normal';}}
function allowed(e){const level=verbosity();return level!=='off'&&(level==='verbose'||(level==='normal'&&recommendedLevel(e)!=='verbose')||(level==='minimal'&&recommendedLevel(e)==='minimal'));}
function packet(id,type,payload){
 const bytes=Buffer.from(payload+'\0\0');
 const buf=Buffer.alloc(14+Buffer.byteLength(payload));
 buf.writeInt32LE(buf.length-4,0);buf.writeInt32LE(id,4);buf.writeInt32LE(type,8);
 bytes.copy(buf,12);return buf;
}
function rcon(command){
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection({host,port});
  let buffer=Buffer.alloc(0),authenticated=false,completed=false;
  const timeout=setTimeout(()=>finish(new Error('RCON timeout')),5000);
  function finish(err){if(completed)return;completed=true;clearTimeout(timeout);socket.destroy();err?reject(err):resolve();}
  socket.on('connect',()=>socket.write(packet(1,3,password)));
  socket.on('data',chunk=>{
   buffer=Buffer.concat([buffer,chunk]);
   while(buffer.length>=4){
    const len=buffer.readInt32LE(0);if(len<10||len>65536){finish(new Error('Invalid RCON packet'));return;}
    if(buffer.length<len+4)break;
    const id=buffer.readInt32LE(4),type=buffer.readInt32LE(8);
    buffer=buffer.subarray(len+4);
    if(id===-1){finish(new Error('RCON authentication failed'));return;}
    if(!authenticated&&id===1&&type===2){authenticated=true;socket.write(packet(2,2,command));}
    else if(authenticated&&id===2){finish();return;}
   }
  });
  socket.on('error',finish);
  socket.on('close',()=>{if(!completed)finish(new Error('RCON closed'));});
 });
}
function chatCommand(component){return observerCommand(username,component,'chat');}
let offset=0,remainder='';
try{offset=fs.statSync(file).size;}catch{}
async function poll(){
 if(busy)return;busy=true;
 try{
  const size=fs.statSync(file).size;
  if(size<offset){offset=0;remainder='';seen.clear();}
  if(size>offset){
   const fd=fs.openSync(file,'r');
   try{
    const amount=Math.min(size-offset,1024*1024),buf=Buffer.alloc(amount);
    fs.readSync(fd,buf,0,amount,offset);offset+=amount;
    const lines=(remainder+buf.toString('utf8')).split('\n');
    remainder=lines.pop()??'';
    for(const line of lines){
     if(!line.startsWith('{"timestamp":'))continue;
     let e;try{e=JSON.parse(line);}catch{continue;}
     if(e.type==='pose_sample'&&e.position)lastPosition=e.position;
     if(e.type==='target_action')lastVitals={health:e.health,food:e.food};
     if(e.type==='target_decision')lastDecision=e;
     if(e.type==='target_transition')lastReward=e.reward;
     const modeNow=verbosity();
     if(e.type==='decision_trace_v1'&&modeNow==='verbose'){
       const detail=interpretNeuralTrace(e);
       if(detail)console.log(JSON.stringify({type:'observer_neural_decision',timestamp:e.timestamp,...detail,description:neuralTraceText(detail)}));
     }
     const explanation=modeNow==='verbose'?explainEvent(e,lastDecision):null;
     // Full explanatory record goes to the human observer console, even when chat dedupes.
     if(explanation)console.log(JSON.stringify({type:'observer_explanation',timestamp:e.timestamp,decisionId:explanation.decisionId,...explanation}));
     let message=allowed(e)?(e.type==='decision_trace_v1'&&modeNow==='verbose'?neuralTraceChat(e):explanation?explanationChat(explanation):describe(e)):null;
     if(e.type==='target_decision'&&modeNow!=='verbose'){
       const kind=String(e.action??'unknown');
       if(kind===lastDecisionAnnouncement&&Date.now()-lastDecisionAnnouncedAt<60000)continue;
       lastDecisionAnnouncement=kind;lastDecisionAnnouncedAt=Date.now();
     }
     if(e.type==='health'&&message){
       if(Date.now()-lastVitalsWarningAt<12000)continue;
       lastVitalsWarningAt=Date.now();
     }
     if(!message)continue;
     const signature=e.type+':'+(e.reason??'')+':'+(e.action??'')+':'+(e.result??'');
     const cooldownMs=e.type==='decision_trace_v1'&&modeNow==='verbose'?0:['death_screen_observed','target_consumed','navigation_recovery_outcome'].includes(e.type)?0:25000;
     if(Date.now()-(eventCooldown.get(signature)??0)<cooldownMs)continue;
     eventCooldown.set(signature,Date.now());
     if(eventCooldown.size>1000)eventCooldown.clear();
     if(verbosity()==='verbose')console.log(JSON.stringify({type:'observer_verbose_event',event:e}));
     const key=[e.timestamp,e.type,e.decisionId??'',e.targetId??''].join('|');
     if(seen.has(key))continue;seen.add(key);if(seen.size>5000)seen.clear();
     // Keep important outcomes even when rapid decisions occur.
     // Latest-state messages replace older summaries instead of forming backlog.
     if(e.type==='target_decision')queued=queued.filter(item=>item.type!=='target_decision');
     if(e.type==='decision_trace_v1')queued=queued.filter(item=>item.type!=='decision_trace_v1');
     const age=Date.now()-Date.parse(e.timestamp);
     if(!Number.isFinite(age)||age>maxAgeMs||age< -30000)continue;
     const entry={message,time:Date.parse(e.timestamp),type:e.type};
     if(criticalTypes.has(e.type)){
       queued=queued.filter(item=>!criticalTypes.has(item.type));queued.unshift(entry);
       console.log(JSON.stringify({type:'filming_chat_priority_event',event:e.type,ageMs:age}));
     }else{
       queued.push(entry);
     }
     if(queued.length>6)queued=queued.filter(item=>criticalTypes.has(item.type)).concat(queued.filter(item=>!criticalTypes.has(item.type)).slice(-4));
    }
   }finally{fs.closeSync(fd);}
  }
  // Slow telemetry summary: ground in observed position and decision, never invent terrain type.
  if(verbosity()==='verbose'&&Date.now()-lastSummary>=60000&&lastDecision&&Date.now()-Date.parse(lastDecision.timestamp)<10000){
   lastSummary=Date.now();
   const pos=lastPosition&&[lastPosition.x,lastPosition.y,lastPosition.z].every(Number.isFinite)?
     [lastPosition.x,lastPosition.y,lastPosition.z].map(v=>v.toFixed(1)).join(','):'unknown';
   const vit=lastVitals&&Number.isFinite(lastVitals.health)&&Number.isFinite(lastVitals.food)?
     ' HP='+lastVitals.health+' food='+lastVitals.food:'';
   queued=queued.filter(item=>item.type!=='status');
   // Detailed numerical status is available in the server JSONL, not spectator chat.
  }
  queued=queued.filter(e=>Date.now()-e.time<=maxAgeMs);
  // Prefer a recent event over a routine summary when both are available.
  queued.sort((a,b)=>(Number(criticalTypes.has(b.type))-Number(criticalTypes.has(a.type)))||a.time-b.time);
  if(queued.length&&(criticalTypes.has(queued[0].type)||Date.now()-lastSent>=minimumMs)){
   const entry=queued.shift();
   await rcon(chatCommand(entry.message));lastSent=Date.now();
   console.log(JSON.stringify({type:'filming_chat_sent',eventType:entry.type,message:entry.message,ageMs:Date.now()-entry.time,recipient:username}));
  }
 }catch(e){console.error(JSON.stringify({type:'filming_chat_error',message:e.message}));}
 finally{busy=false;}
}
console.log(JSON.stringify({type:'filming_chat_started',recipient:username,source:file,readOnly:true}));
setInterval(poll,750);
