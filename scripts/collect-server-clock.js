import fs from 'node:fs';
import path from 'node:path';
import {ServerTickClock} from '../src/server-tick-clock.js';
import {parseGameTime,rconQuery} from '../src/minecraft-clock-rcon.js';
const host=process.env.CRAFTLE_RCON_HOST??'minecraft';
const port=Number(process.env.CRAFTLE_RCON_PORT??25575);
const password=fs.readFileSync(process.env.CRAFTLE_RCON_PASSWORD_FILE??'/run/secrets/rcon_password','utf8').trim();
const worldId=process.env.CRAFTLE_CLOCK_WORLD_ID??'filming-vanilla-1.21.1';
const output=process.env.CRAFTLE_CLOCK_OUTPUT??'/state/observer/server-clock.jsonl';
const interval=Math.max(1000,Number(process.env.CRAFTLE_CLOCK_INTERVAL_MS??5000));
if(!password)throw Error('No RCON password');
fs.mkdirSync(path.dirname(output),{recursive:true});
const clock=new ServerTickClock();let running=false;
async function sample(){
 if(running)return;running=true;
 const requestedAt=Date.now();
 try{
  const reply=await rconQuery({host,port,password});
  const completedAt=Date.now();
  const tick=clock.observe({gameTime:parseGameTime(reply),observedAt:completedAt,source:'server_query',worldId});
  fs.appendFileSync(output,JSON.stringify({...tick,type:'server_clock_sample',requestedAt,completedAt,
   uncertainty:{wallIntervalMs:completedAt-requestedAt,precision:'asynchronous_rcon_query'}})+'\n');
 }catch(err){console.error(JSON.stringify({type:'server_clock_error',message:err.message}));}
 finally{running=false;}
}
await sample();setInterval(sample,interval);
