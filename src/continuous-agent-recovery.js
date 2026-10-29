import net from 'node:net';
import fs from 'node:fs';

export function probeMinecraft({host='minecraft',port=25565,timeoutMs=3000}={}){
 return new Promise(resolve=>{
  const socket=net.connect({host,port});
  let finished=false;
  const finish=ok=>{if(finished)return;finished=true;socket.destroy();resolve(ok);};
  socket.once('connect',()=>finish(true));
  socket.once('error',()=>finish(false));
  socket.setTimeout(timeoutMs,()=>finish(false));
 });
}

// Read only the tail of the large log; do not decode multi-GB experiment history.
export function inspectAgentExitLog(filename,{bytes=65536,startOffset=0}={}){
 let fd;
 try{
  fd=fs.openSync(filename,'r');
  const size=fs.fstatSync(fd).size;
  // Inspect only bytes written after this specific child was launched.
  // Old run errors must not be mistaken for the new run's failure.
  if(!Number.isSafeInteger(startOffset)||startOffset<0||size<=startOffset)return null;
  const cap=Number.isSafeInteger(bytes)&&bytes>0?Math.min(bytes,1048576):65536;
  const offset=Math.max(startOffset,size-cap);
  const len=size-offset;
  const buf=Buffer.alloc(len);
  fs.readSync(fd,buf,0,len,offset);
  const content=buf.toString('utf8');
  const complete=offset>startOffset?content.slice(content.indexOf('\n')+1):content;
  const lines=complete.split('\n');
  let last=null;
  for(const line of lines){
   if(!line.trimStart().startsWith('{'))continue;
   try{
    const item=JSON.parse(line);
    if(typeof item.timestamp==='string'&&
       (item.type==='error'||item.type==='disconnected'||item.type==='connected'))last=item;
   }catch{}
  }
  return last;
 }catch{return null;}
 finally{if(fd!==undefined)fs.closeSync(fd);}
}
export function classifyAgentExit({lastEvent,serverReady,now=Date.now()}){
 const eventTime=Date.parse(lastEvent?.timestamp??'');
 if(!Number.isFinite(eventTime)||Math.abs(now-eventTime)>30000)lastEvent=null;
 if(!serverReady)return 'minecraft_unreachable';
 if(lastEvent?.type==='error'&&/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|ECONNRESET/.test(lastEvent.message??''))return 'minecraft_connectivity';
 if(lastEvent?.type==='disconnected')return 'minecraft_disconnected';
 return 'unexpected_agent_exit';
}
