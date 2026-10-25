import fs from 'node:fs';
import path from 'node:path';

// Read the tail only; never expose raw logs, environment, or checkpoint contents.
export function parseAgentTelemetry(lines, now=Date.now()){
  let position=null, yaw=null, pitch=null, health=null, food=null, lastAction=null, lastEvent=null, timestamp=null;
  let agent='Turesla', id='agent_001';
  for(const line of lines){
    if(!line.startsWith('{"timestamp":'))continue;
    let event;try{event=JSON.parse(line);}catch{continue;}
    if(typeof event.timestamp!=='string'||!Number.isFinite(Date.parse(event.timestamp)))continue;
    if(typeof event.agent==='string')agent=event.agent.slice(0,64);
    if(typeof event.agent_id==='string')id=event.agent_id.slice(0,64);
    timestamp=event.timestamp;
    if(event.type==='pose_sample'&&event.position){
      const p=event.position;
      if([p.x,p.y,p.z].every(Number.isFinite))position={x:p.x,y:p.y,z:p.z};
      if(Number.isFinite(event.yaw))yaw=event.yaw;
      if(Number.isFinite(event.pitch))pitch=event.pitch;
    }
    if(event.type==='health'){
      if(Number.isFinite(event.health))health=event.health;
      if(Number.isFinite(event.food))food=event.food;
    }
    if(['agent_decision','navigation_action','target_decision','targeted_skill_action','option_decision','rl_action','llm_action_applied'].includes(event.type)){
      lastAction={type:event.type,timestamp:event.timestamp,
        action:typeof event.action==='string'?event.action:
          typeof event.option==='string'?event.option:
          typeof event.action?.type==='string'?event.action.type:
          typeof event.goal==='string'?event.goal:null};
    }
    if(['death','spawn','respawn','health','inventory_snapshot','rl_terminal_death'].includes(event.type))
      lastEvent={type:event.type,timestamp:event.timestamp};
  }
  return {id,name:agent,position,yaw,pitch,health,food,lastAction,lastEvent,
    lastObservedAt:timestamp,stale:!timestamp||now-Date.parse(timestamp)>10000};
}

export function readAgentTelemetry(root,{tailBytes=262144}={}){
  const entries=fs.readdirSync(path.join(root,'sessions'),{withFileTypes:true})
    .filter(e=>e.isDirectory()).map(e=>{
      const file=path.join(root,'sessions',e.name,'agent.log');
      try{return {file,mtime:fs.statSync(file).mtimeMs};}catch{return null;}
    }).filter(Boolean).sort((a,b)=>b.mtime-a.mtime);
  if(!entries.length)return {available:false,agent:null};
  const file=entries[0].file;
  const fd=fs.openSync(file,'r');
  let sample='';
  try{
    const size=fs.fstatSync(fd).size,amount=Math.min(size,tailBytes);
    const buffer=Buffer.alloc(amount);
    fs.readSync(fd,buffer,0,amount,size-amount);
    sample=buffer.toString('utf8');
    if(size>amount)sample=sample.slice(sample.indexOf('\n')+1);
  }finally{fs.closeSync(fd);}
  const agent=parseAgentTelemetry(sample.split('\n'));
  return {available:!!agent.lastObservedAt,agent};
}
