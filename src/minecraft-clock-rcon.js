import net from 'node:net';
export function parseGameTime(reply){
 const text=String(reply??'').trim();
 // Vanilla /time query gametime returns an integer, sometimes prefixed with informational prose.
 const match=text.match(/(?:^|\s)(\d{1,16})(?:\s|$)/g);
 if(!match?.length)throw Error('No integer gametime in server reply: '+text.slice(0,120));
 const value=Number(match.at(-1).trim());
 if(!Number.isSafeInteger(value))throw Error('Unsafe gametime');
 return value;
}
function packet(id,type,data){const raw=Buffer.from(data+'\0\0');const b=Buffer.alloc(12+raw.length);b.writeInt32LE(b.length-4);b.writeInt32LE(id,4);b.writeInt32LE(type,8);raw.copy(b,12);return b;}
export function rconQuery({host,port,password,command='time query gametime',timeoutMs=5000}){
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection({host,port});let buffer=Buffer.alloc(0),authed=false,settled=false;
  const timer=setTimeout(()=>finish(new Error('RCON timeout')),timeoutMs);
  function finish(err,val){if(settled)return;settled=true;clearTimeout(timer);socket.destroy();err?reject(err):resolve(val);}
  socket.on('connect',()=>socket.write(packet(1,3,password)));
  socket.on('error',finish);socket.on('close',()=>{if(!settled)finish(new Error('RCON closed'));});
  socket.on('data',chunk=>{
   buffer=Buffer.concat([buffer,chunk]);
   while(buffer.length>=4){
    const len=buffer.readInt32LE(0);if(len<10||len>65536)return finish(new Error('Invalid RCON packet'));
    if(buffer.length<len+4)break;
    const id=buffer.readInt32LE(4),type=buffer.readInt32LE(8),body=buffer.subarray(12,len+2).toString('utf8');
    buffer=buffer.subarray(len+4);
    if(id===-1)return finish(new Error('RCON authentication failed'));
    if(!authed&&id===1&&type===2){authed=true;socket.write(packet(2,2,command));}
    else if(authed&&id===2)return finish(null,body);
   }
  });
 });
}
