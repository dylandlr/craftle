import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

export function summarizeSurvivalReference(events) {
  const actions=events.filter(e=>e.type==='survival_reference_action');
  const started=events.find(e=>e.type==='survival_reference_started');
  const shutdown=events.find(e=>e.type==='shutdown');
  const errors=events.filter(e=>['survival_reference_error','recording_error','error','kicked'].includes(e.type));
  const deaths=events.filter(e=>e.type==='survival_reference_death');
  const cells=new Set();
  const objectives={};
  let previous=null,previousAction=null,distance=0,stalledActionIntervals=0,maxStacks=0,invalidPositions=0,lastTime=-Infinity;
  for(const e of events) {
    const time=Date.parse(e.timestamp);
    if(!Number.isFinite(time)||time<lastTime)throw Error('Invalid or out-of-order event timestamp');
    lastTime=time;
    if(['death','survival_reference_death','respawn','spawn','life_feedback_available'].includes(e.type)){previous=null;previousAction=null;}
    if(e.type==='survival_reference_action') {
      objectives[e.objective]=(objectives[e.objective]??0)+1;
      maxStacks=Math.max(maxStacks,e.inventoryCount??0);
    }
    if(!['pose_sample','survival_reference_action'].includes(e.type))continue;
    const p=e.position;
    if(!p||![p.x,p.y,p.z].every(Number.isFinite)){invalidPositions++;continue;}
    if(e.type==='survival_reference_action'){
      if(previousAction&&e.objective!=='eat'&&Math.hypot(p.x-previousAction.x,p.z-previousAction.z)<0.3)stalledActionIntervals++;
      previousAction=p;
    }
    cells.add(Math.floor(p.x/4)+','+Math.floor(p.z/4));
    if(previous)distance+=Math.hypot(p.x-previous.x,p.z-previous.z);
    previous=p;
  }
  const start=started?Date.parse(started.timestamp):NaN;
  const end=shutdown?Date.parse(shutdown.timestamp):NaN;
  const firstDeath=deaths[0]?Date.parse(deaths[0].timestamp):null;
  return {
    schemaVersion:'craftle.survival-reference.v1',
    policy:'scripted_privileged_mineflayer',learned:false,
    completed:Boolean(started&&shutdown&&end>start),
    observedSeconds:Number.isFinite(end-start)?(end-start)/1000:0,
    actions:actions.length,objectives,deaths:deaths.length,
    foodSearches:events.filter(e=>e.type==='survival_reference_food_search').length,
    noTargetSearches:events.filter(e=>e.type==='survival_reference_food_search'&&e.status==='no_target').length,
    harvestActions:events.filter(e=>e.type==='survival_reference_plant_harvest').length,
    meals:events.filter(e=>e.type==='survival_reference_consumed').length,
    measuredHungerRecoveries:events.filter(e=>e.type==='survival_reference_consumed'&&Number.isFinite(e.beforeFood)&&Number.isFinite(e.afterFood)&&e.afterFood>e.beforeFood).length,
    noPathEvents:events.filter(e=>e.type==='survival_reference_navigation_outcome'&&e.status==='noPath').length,
    firstLifeSeconds:Number.isFinite(start)?((firstDeath??end)-start)/1000:null,
    firstLifeRightCensored:firstDeath===null,
    uniqueHorizontalCells4Blocks:cells.size,
    sampledHorizontalPathBlocks:distance,stalledActionIntervals,maxInventoryStacks:maxStacks,
    invalidPositions,runtimeErrors:errors.map(e=>({type:e.type,message:e.message??e.reason??null})),
    limitations:[
      'Scripted controller has privileged block and entity state.',
      'Path length is sampled and resets at life boundaries; it is not unique coverage.',
      'Inventory stack count does not establish gathering or progression.',
      'Food acquisition is scripted; command completion alone does not prove inventory gain.',
      'A short smoke test does not establish long-term survival competence.'
    ]
  };
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const lines=fs.readFileSync(process.argv[2],'utf8').split('\n').filter(line=>line.startsWith('{"timestamp":'));
  const report=summarizeSurvivalReference(lines.map(line=>JSON.parse(line)));
  console.log(JSON.stringify(report,null,2));
  if(!report.completed||report.actions<3||report.invalidPositions||report.runtimeErrors.length)process.exitCode=1;
}
