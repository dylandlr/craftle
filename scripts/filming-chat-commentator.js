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
const minimumMs=Math.max(1500,Number(process.env.CRAFTLE_CHAT_INTERVAL_MS??3500));
let lastSent=0,queued=[],busy=false,seen=new Set(),lastSummary=0,lastDecision=null,lastPosition=null,lastVitals=null,lastReward=null;
const maxAgeMs=6500;const criticalTypes=new Set(['death_screen_observed','target_consumed','target_verified_recovery']);
function describe(e){
 if(!e||!e.timestamp||typeof e.type!=='string')return null;
 if(e.type==='target_decision'){
  const a=typeof e.action==='string'?e.action:'unknown';
  if(a==='explore')return 'DQN chose EXPLORE (#'+(e.decisionId??'?')+'); targets='+((e.targets??[]).length)+'; options masked='+((e.mask??[]).filter(Boolean).length);
  if(a==='retreat')return 'DQN chose RETREAT (#'+(e.decisionId??'?')+')';
  if(a==='eat')return 'Decided to eat';
  if(a.startsWith('approach_'))return 'Approaching target '+(e.targetId??a);
  if(a.startsWith('attack_'))return 'Selected attack '+(e.targetId??a)+' (not verified)';
  if(a.startsWith('harvest_'))return 'Selected harvest '+(e.targetId??a)+' (not verified)';
  return 'Selected '+a;
 }
 if(e.type==='target_attack_attempt')return 'Punched / attacked '+(e.targetId??'target')+' (attempt)';
 if(e.type==='target_harvest_attempt')return 'Tried harvesting '+(e.plant??e.targetId??'block');
 if(e.type==='target_harvest_block_observation'&&e.changed)return 'Observed block change at harvest target';
 if(e.type==='target_consumed')return 'Ate '+(e.item??'food')+' (hunger '+e.beforeFood+' -> '+e.afterFood+')';
 if(e.type==='target_verified_recovery')return 'Hunger recovery verified';
 if(e.type==='food_provenance_pickup_event')return 'Item pickup observed';
 if(e.type==='death_screen_observed')return 'Turesla died';
 if(e.type==='food_sequence_started')return 'Started seeking food at '+(e.targetId??'a target');
 if(e.type==='food_sequence_recovery')return 'Completed food sequence: '+(e.status??'recovery observed');
 if(e.type==='health'&&Number.isFinite(e.health)&&Number.isFinite(e.food)){
  if(e.health<=8||e.food<=6)return 'Low vitals: '+e.health+' HP, '+e.food+' hunger';
 }
 if(e.type==='target_navigation_result'&&e.status==='noPath')return 'Pathfinder reported NO PATH';
 if(e.type==='target_action_rejected')return 'Action rejected: '+(e.reason??'unknown');
 if(e.type==='target_runtime_error')return 'Agent skill error: '+String(e.message??'unknown').slice(0,85);
 if(e.type==='target_reward_components')return null;
 if(e.type==='target_transition'&&Number.isFinite(e.reward)&&Math.abs(e.reward)>.25)return 'DQN reward '+e.reward.toFixed(2)+' from '+(e.action??'action');
 return null;
}
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
function chatCommand(message){
 // Minecraft text-component JSON is escaped by JSON.stringify, preventing command injection.
 const component=JSON.stringify({text:'[Craftle] Turesla: '+message.slice(0,150),color:'aqua'});
 return 'tellraw '+username+' '+component;
}
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
     const message=describe(e);if(!message)continue;
     const key=[e.timestamp,e.type,e.decisionId??'',e.targetId??''].join('|');
     if(seen.has(key))continue;seen.add(key);if(seen.size>5000)seen.clear();
     // Keep important outcomes even when rapid decisions occur.
     if(e.type==='target_decision'&&queued.length>=2)continue;
     const age=Date.now()-Date.parse(e.timestamp);
     if(!Number.isFinite(age)||age>maxAgeMs||age< -30000)continue;
     const entry={message,time:Date.parse(e.timestamp),type:e.type};
     if(criticalTypes.has(e.type)){
       queued=queued.filter(item=>!criticalTypes.has(item.type));queued.unshift(entry);
       console.log(JSON.stringify({type:'filming_chat_priority_event',event:e.type,ageMs:age}));
     }else{
       queued.push(entry);
     }
     if(queued.length>12)queued=queued.filter(item=>criticalTypes.has(item.type)).concat(queued.filter(item=>!criticalTypes.has(item.type)).slice(-8));
    }
   }finally{fs.closeSync(fd);}
  }
  // Slow telemetry summary: ground in observed position and decision, never invent terrain type.
  if(Date.now()-lastSummary>=15000&&lastDecision){
   lastSummary=Date.now();
   const pos=lastPosition&&[lastPosition.x,lastPosition.y,lastPosition.z].every(Number.isFinite)?
     [lastPosition.x,lastPosition.y,lastPosition.z].map(v=>v.toFixed(1)).join(','):'unknown';
   const vit=lastVitals&&Number.isFinite(lastVitals.health)&&Number.isFinite(lastVitals.food)?
     ' HP='+lastVitals.health+' food='+lastVitals.food:'';
   queued=queued.filter(item=>item.type!=='status');
   queued.push({message:'STATUS action='+(lastDecision.action??'?')+' pos='+pos+vit+
     (Number.isFinite(lastReward)?' lastReward='+lastReward.toFixed(2):''),time:Date.now(),type:'status'});
  }
  queued=queued.filter(e=>Date.now()-e.time<=maxAgeMs);
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
