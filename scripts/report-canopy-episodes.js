// Streaming canopy outcomes from actual agent JSONL. No inferred escapes.
import fs from 'node:fs';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';

export function summarizeCanopyEvents(events){
 const episodes=new Map(),outcomes=[],warnings=[];
 let session=0,previousId=null,latestTimestamp=null;
 for(const e of events){
  if(!e||typeof e!=='object')continue;
  if(e.timestamp)latestTimestamp=e.timestamp;
  if(e.type==='exploration_execution_variant'){session++;previousId=null;continue;}
  if(!String(e.type??'').startsWith('canopy_episode_'))continue;
  if(!Number.isInteger(e.episodeId))continue;
  if(previousId!==null&&e.type==='canopy_episode_started'&&e.episodeId<=previousId){session++;}
  if(e.type==='canopy_episode_started')previousId=e.episodeId;
  const key=session+':'+e.episodeId;
  if(e.type==='canopy_episode_started'){
   if(episodes.has(key)){warnings.push('duplicate start: '+key);continue;}
   episodes.set(key,{id:key,start:e.timestamp,startY:e.startY,health:e.health,food:e.food,status:'open'});
  }else{
   const episode=episodes.get(key);
   if(!episode){warnings.push('outcome without observed start: '+key);continue;}
   if(e.type==='canopy_episode_still_trapped'){episode.lastTrapped=e.timestamp;continue;}
   if(episode.status!=='open'){warnings.push('multiple terminal outcomes: '+key);continue;}
   if(e.type==='canopy_episode_exited'){
    episode.status='exited';episode.elapsedMs=e.elapsedMs;episode.verticalDescent=e.verticalDescent;
    episode.healthAfter=e.health;episode.foodAfter=e.food;episode.end=e.timestamp;
    episode.healthChange=Number.isFinite(e.health)&&Number.isFinite(episode.health)?e.health-episode.health:null;
   }else if(e.type==='canopy_episode_censored'){
    episode.status='censored';episode.reason=e.reason??'unknown';episode.elapsedMs=e.elapsedMs;episode.end=e.timestamp;
   }
  }
 }
 outcomes.push(...episodes.values());
 const exits=outcomes.filter(e=>e.status==='exited'),censored=outcomes.filter(e=>e.status==='censored'),open=outcomes.filter(e=>e.status==='open');
 const durations=exits.map(e=>e.elapsedMs).filter(n=>Number.isFinite(n)&&n>=0).sort((a,b)=>a-b);
 const median=durations.length?(durations[Math.floor((durations.length-1)/2)]+durations[Math.floor(durations.length/2)])/2:null;
 return {schema:'craftle.canopy-report.v1',source:'observed_agent_jsonl',latestTimestamp,
  episodes:outcomes.length,verifiedExits:exits.length,censored:censored.length,unresolved:open.length,
  observedExitFraction:outcomes.length?exits.length/outcomes.length:null,
  medianExitMs:median,observedHealthChanges:exits.map(e=>e.healthChange).filter(Number.isFinite),
  outcomes,warnings,
  note:'Descriptive episodes only, not independent trials. Open episodes remain unresolved; censored episodes are not failed escapes. Escape is not food acquisition, survival success, or evidence of DQN learning.'};
}
export async function readCanopyReport(file){
 const input=fs.createReadStream(file,{encoding:'utf8'});
 const lines=readline.createInterface({input,crlfDelay:Infinity});
 const events=[];
 for await(const line of lines){
  if(!line.startsWith('{"timestamp":'))continue;
  if(!line.includes('"canopy_episode_')&&!line.includes('"exploration_execution_variant"'))continue;
  try{events.push(JSON.parse(line));}catch{}
 }
 return summarizeCanopyEvents(events);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error('Usage: node scripts/report-canopy-episodes.js /path/to/agent.log');
 console.log(JSON.stringify(await readCanopyReport(file),null,2));
}
