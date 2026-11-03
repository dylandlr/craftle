// Diagnose water traversal, action masks, and the food acquisition funnel.
// Streaming, bounded memory: node scripts/diagnose-survival-funnel.js - < agent.log
// For a recent live sample: tail -n 100000 agent.log | node scripts/diagnose-survival-funnel.js -
import fs from 'node:fs';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';

const ACTIONS=['eat','explore','retreat',...Array.from({length:4},(_,i)=>['approach','harvest','attack'].map(s=>s+'_'+i)).flat()];
const kinds={eat:['eat'],retreat:['retreat'],approach:ACTIONS.filter(a=>a.startsWith('approach_')),harvest:ACTIONS.filter(a=>a.startsWith('harvest_')),attack:ACTIONS.filter(a=>a.startsWith('attack_'))};
const stats=Object.fromEntries(Object.entries(kinds).map(([k])=>[k,{available:0,chosen:0,chosenWhenAvailable:0}]));
const types={},errors={}; const quality={lines:0,jsonEvents:0,parseErrors:0,otherLines:0,first:null,last:null};
let decisions=0,validMasks=0,invalidMasks=0,onlyExplore=0,noTargets=0,targetsPresent=0,foodLow=0,lowFoodEatAvailable=0;
let eatAttempt=0,verifiedEats=0,inventoryGain=0,foodRecovered=0,foodSequences=0,death=0,foodValues=0,foodSamples=0,foodMin=null;
let prevMotion=null,waterEpisode=null,waterEpisodes=[],waterSamples=0,landSamples=0,inWaterSeconds=0,waterWindowVisits=new Map();
const waterMaxEpisodes=20; let longestWater=null;
const cell=(x,z)=>Math.floor(x/8)+','+Math.floor(z/8);
function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
const round=v=>Math.round(v*100)/100;
function finishWater(){
 if(!waterEpisode)return;
 const e=waterEpisode;
 const seconds=Math.max(0,(e.lastT-e.firstT)/1000);
 const result={start:e.firstIso,end:e.lastIso,seconds:round(seconds),samples:e.samples,
   horizontalPathBlocks:round(e.path),netDisplacementBlocks:round(dist(e.start,e.last)),
   pathEfficiency:e.path>0?round(dist(e.start,e.last)/e.path):null,
   maxRadiusFromStartBlocks:round(e.maxRadius),repeatCellSamples:e.repeatCells,
   distinctEightBlockCells:e.cells.size,firstPosition:e.start,lastPosition:e.last};
 if(!longestWater||result.seconds>longestWater.seconds)longestWater=result;
 if(waterEpisodes.length<waterMaxEpisodes)waterEpisodes.push(result);
 else {
  const shortest=waterEpisodes.reduce((a,b,i)=>waterEpisodes[b].seconds<waterEpisodes[a].seconds?b:a,0);
  if(result.seconds>waterEpisodes[shortest].seconds)waterEpisodes[shortest]=result;
 }
 waterEpisode=null;
}
function motion(e){
 const p=e.position, t=Date.parse(e.timestamp);
 if(!p||![p.x,p.z].every(Number.isFinite)||!Number.isFinite(t)||typeof e.isInWater!=='boolean')return;
 if(prevMotion && (t<prevMotion.t||t-prevMotion.t>5000))finishWater();
 if(e.isInWater){
  waterSamples++;
  const previous=prevMotion && t>=prevMotion.t && t-prevMotion.t<=5000 ? prevMotion : null;
  if(previous&&previous.isInWater)inWaterSeconds+=(t-previous.t)/1000;
  if(!waterEpisode)waterEpisode={firstT:t,lastT:t,firstIso:e.timestamp,lastIso:e.timestamp,start:{x:p.x,z:p.z},last:{x:p.x,z:p.z},path:0,maxRadius:0,samples:0,repeatCells:0,cells:new Set()};
  const w=waterEpisode;
  if(previous&&previous.isInWater)w.path+=dist(previous.p,p);
  const key=cell(p.x,p.z);
  if(w.cells.has(key))w.repeatCells++;
  w.cells.add(key);w.samples++;w.lastT=t;w.lastIso=e.timestamp;w.last={x:p.x,z:p.z};
  w.maxRadius=Math.max(w.maxRadius,dist(w.start,w.last));
  waterWindowVisits.set(key,(waterWindowVisits.get(key)||0)+1);
 }else{landSamples++;finishWater();}
 prevMotion={t,p:{x:p.x,z:p.z},isInWater:e.isInWater};
}
function processEvent(e){
 if(!e||typeof e!=='object'||typeof e.type!=='string')return;
 quality.jsonEvents++;types[e.type]=(types[e.type]||0)+1;
 if(e.timestamp){if(!quality.first)quality.first=e.timestamp;quality.last=e.timestamp;}
 if(e.type==='spectator_effect'&&e.kind==='motion')motion(e);
 if(e.type==='death')death++;
 if(e.type==='food_sequence_started')foodSequences++;
 if(e.type==='food_sequence_inventory_gain')inventoryGain++;
 if(e.type==='food_sequence_recovery')foodRecovered++;
 if(e.type==='target_verified_recovery')verifiedEats++;
 if(e.type==='target_action'&&e.action==='eat')eatAttempt++;
 if(e.type==='health'&&Number.isFinite(e.food)){foodValues+=e.food;foodSamples++;foodMin=foodMin===null?e.food:Math.min(foodMin,e.food);}
 if(['target_runtime_error','target_action_rejected','error','kicked'].includes(e.type)){
  let key=e.type+': '+String(e.message??e.reason??'unspecified').slice(0,150);
  errors[key]=(errors[key]||0)+1;
 }
 if(e.type!=='target_decision')return;
 decisions++;
 if(Array.isArray(e.targets)){if(e.targets.length)targetsPresent++;else noTargets++;}
 const mask=e.mask;
 if(!Array.isArray(mask)||mask.length!==ACTIONS.length||!mask.every(x=>typeof x==='boolean')){invalidMasks++;return;}
 validMasks++;
 if(mask[1]&&mask.filter(Boolean).length===1)onlyExplore++;
 const present = new Set(ACTIONS.filter((_,i)=>mask[i]));
 for(const [kind,choices]of Object.entries(kinds)){
  const available=choices.some(a=>present.has(a)),chosen=kind==='eat'?e.action==='eat':kind==='retreat'?e.action==='retreat':e.action?.startsWith(kind+'_');
  if(available)stats[kind].available++;
  if(chosen)stats[kind].chosen++;
  if(chosen&&available)stats[kind].chosenWhenAvailable++;
 }
 // Food value is not guaranteed to be in decisions; use target_action food when present instead.
}
const input=process.argv[2]??'-';
if(input!=='-'&&!fs.existsSync(input))throw Error('Missing log file: '+input);
const source=input==='-'?process.stdin:fs.createReadStream(input,{encoding:'utf8'});
const reader=readline.createInterface({input:source,crlfDelay:Infinity});
for await (const line of reader){
 quality.lines++;
 if(!line.startsWith('{')){quality.otherLines++;continue;}
 try{processEvent(JSON.parse(line));}catch{quality.parseErrors++;}
}
finishWater();
const elapsed=quality.first&&quality.last?(Date.parse(quality.last)-Date.parse(quality.first))/1000:null;
const actionBreakdown=Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,{...v,availablePctOfValidMasks:validMasks?round(100*v.available/validMasks):null,chosenWhenAvailablePct:v.available?round(100*v.chosenWhenAvailable/v.available):null}]));
const commonWaterCells=Array.from(waterWindowVisits.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([cell,samples])=>({cell,samples}));
const result={
 schema:'craftle.survival-funnel-diagnostic.v1',source:input,
 window:{start:quality.first,end:quality.last,minutes:elapsed===null?null:round(elapsed/60),...quality},
 actions:{decisions,validMasks,invalidMasks,onlyExplore,onlyExplorePct:validMasks?round(100*onlyExplore/validMasks):null,
  noTargets,targetsPresent,byKind:actionBreakdown},
 water:{motionSamples:waterSamples,landSamples,observedUnderwaterSeconds:round(inWaterSeconds),
  longestEpisode:longestWater,longestEpisodes:waterEpisodes.sort((a,b)=>b.seconds-a.seconds).slice(0,10),
  commonEightBlockCells:commonWaterCells,
  caveat:'Episode spans are sampled observations. Water position oscillation is not proven stuck unless movement stalls over a sustained period.'},
 food:{verifiedEats,foodSequences,inventoryGainEvents:inventoryGain,foodRecoveryEvents:foodRecovered,
  targetEatActions:eatAttempt,observedFoodSamples:foodSamples,observedAverageFood:foodSamples?round(foodValues/foodSamples):null,
  observedMinFood:foodMin,deaths:death,
  caveat:'No verified eating alone does not identify whether food was absent, invisible, masked, unreachable, or the policy refused it.'},
 noteworthyEventCounts:Object.fromEntries(Object.entries(types).filter(([k])=>/food|eat|inventory|harvest|attack|death|water|target_action_rejected|target_runtime_error|target_verified/.test(k)).sort((a,b)=>b[1]-a[1]).slice(0,40)),
 errors,
 interpretation:[
  validMasks&&onlyExplore/validMasks>0.5?'Most fully logged decisions only permit exploration; investigate availability and perception before tuning reward.':'Action availability must be interpreted using masks, not action counts alone.',
  waterSamples?'Use horizontal path, net displacement, max radius and repeated cells to distinguish traversal from water oscillation.':'No spectator motion telemetry with in-water flags in this sample.',
  verifiedEats===0?'Food success remains unverified in the sampled window; inspect food detection and inventory progression.':'Verified recovery events observed.'
 ],
 notes:'Read-only log analysis. Water sample counts and repeated-cell visits do not independently demonstrate causality or a navigation defect.'
};
console.log(JSON.stringify(result,null,2));
