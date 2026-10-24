import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export function buildOptionControlReport(events,metrics,{treatment,seed}){
 const decisions=events.filter(e=>e.type==='option_decision');
 if(!['scripted','random','frozen'].includes(treatment)||!decisions.length||decisions.some(e=>e.mode!==treatment))throw Error('Missing or mismatched policy decisions');
 const counters=events.filter(e=>e.type==='option_transition').map(e=>e.updates);
 if(!counters.length||!counters.every(Number.isFinite)||counters.some(n=>n!==counters[0]))throw Error('Control changed its update counter');
 const spawn=events.find(e=>e.type==='spawn')?.position;
 if(!spawn||![spawn.x,spawn.y,spawn.z].every(Number.isFinite))throw Error('Missing initial spawn');
 if(!metrics.completed||metrics.runtimeErrors.length)throw Error('Incomplete or failed control');
 return {schema:'craftle.option-controls.v1',contract:'structured7-assisted4-v1',seed:String(seed),treatment,initialPosition:spawn,seconds:metrics.observedSeconds,meals:metrics.meals,deaths:metrics.deaths,cells:metrics.uniqueHorizontalCells4Blocks,updateCounter:counters[0],decisions:decisions.length};
}
export function compareOptionControls(reports){
 const groups=new Map();
 for(const r of reports){if(r.schema!=='craftle.option-controls.v1')throw Error('Invalid control report');const group=groups.get(r.seed)??[];group.push(r);groups.set(r.seed,group);}
 if(!groups.size)throw Error('No control reports');
 return [...groups].map(([seed,rows])=>{
  if(rows.length!==3||new Set(rows.map(r=>r.treatment)).size!==3||!['scripted','random','frozen'].every(t=>rows.some(r=>r.treatment===t)))throw Error('Missing or duplicate control');
  const matchedSpawn=rows.every(r=>JSON.stringify(r.initialPosition)===JSON.stringify(rows[0].initialPosition));
  const matchedContract=rows.every(r=>r.contract==='structured7-assisted4-v1');
  const matchedDuration=Math.max(...rows.map(r=>r.seconds))-Math.min(...rows.map(r=>r.seconds))<=1;
  return {seed,pairedEligible:matchedSpawn&&matchedContract&&matchedDuration,matchedSpawn,matchedContract,matchedDuration,results:rows,interpretation:'Descriptive pilot; stochastic world evolution and two seeds do not establish statistical superiority.'};
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [mode,...args]=process.argv.slice(2);
 if(mode==='report'){
  const [treatment,seed,log,summary]=args;
  const events=fs.readFileSync(log,'utf8').split('\n').filter(l=>l.startsWith('{"timestamp":')).map(l=>JSON.parse(l));
  console.log(JSON.stringify(buildOptionControlReport(events,JSON.parse(fs.readFileSync(summary,'utf8')),{treatment,seed}),null,2));
 }else if(mode==='compare'){
  console.log(JSON.stringify(compareOptionControls(args.map(p=>JSON.parse(fs.readFileSync(p,'utf8')))),null,2));
 }else throw Error('Expected report or compare');
}
