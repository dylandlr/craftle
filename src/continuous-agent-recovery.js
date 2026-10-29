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
export function inspectAgentExitLog(filename,{bytes=65536}={}){
 let fd;
 try{
  fd=fs.openSync(filename,'r');
  const size=fs.fstatSync(fd).size;
  const len=Math.min(size,bytes);
  const buf=Buffer.alloc(len);
  fs.readSync(fd,buf,0,len,size-len);
  const content=buf.toString('utf8');
  const lines=content.slice(size>len?content.indexOf('\n')+1:0).split('\n');
  let last=null;
  for(const line of lines){
   if(!line.startsWith('{"timestamp":'))continue;
   try{const item=JSON.parse(line);if(item.type==='error'||item.type==='disconnected'||item.type==='connected')last=item;}catch{}
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
