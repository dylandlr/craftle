// Creates an isolated, executable Docker Compose specification for one trial.
// Does NOT start containers. Never mounts or reads live filming state.
import fs from 'node:fs';
import path from 'node:path';
const [planPath,root,runId]=process.argv.slice(2);
if(!planPath||!root||!runId)throw Error('Usage: node scripts/materialize-experiment.js PLAN.json ROOT RUN_ID');
const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
if(plan.schema!=='craftle.experiment-plan.v1')throw Error('Invalid plan');
const run=plan.runs.find(r=>r.runId===runId);
if(!run||!/^[-_a-zA-Z0-9]{1,100}$/.test(runId))throw Error('Unknown or invalid run ID');
if(run.phase!=='planned')throw Error('Run must be planned');
const rootDir=path.resolve(root);
const filmDir=path.resolve('deploy/filming/state');
const inside=(p,d)=>p===d||p.startsWith(d+path.sep);
if(inside(rootDir,filmDir)||inside(filmDir,rootDir))throw Error('Experiment directory overlaps filming state');
const safe=(p)=>typeof p==='string'&&!path.isAbsolute(p)&&!p.split(/[\\/]+/).includes('..');
if(!safe(run.isolatedWorld)||!safe(run.isolatedState))throw Error('Unsafe run paths');
const world=path.resolve(rootDir,run.isolatedWorld),state=path.resolve(rootDir,run.isolatedState);
if(!inside(world,rootDir)||!inside(state,rootDir)||inside(world,state)||inside(state,world)||world===state)throw Error('Overlapping run paths');
const out=path.resolve(rootDir,'specs',runId);
if(fs.existsSync(out)||fs.existsSync(world)||fs.existsSync(state))throw Error('Run artifacts already exist');
if(!Number.isInteger(run.trainingBudgetDecisions)||run.trainingBudgetDecisions<=0)throw Error('Invalid decision budget');
const spec={schema:'craftle.isolated-run-spec.v1',runId,profile:run.profile,worldSeed:run.worldSeed,
 trainingSeed:run.trainingSeed,decisionBudget:run.trainingBudgetDecisions,
 worldDir:world,stateDir:state,config:{
 minecraftImage:'itzg/minecraft-server:java21',minecraftVersion:'1.21.1',serverType:'VANILLA',
 networkIsolation:'dedicated_project',hostPortPublished:false,spectatorsGenerateChunks:false},
 status:'unlaunched',blockingRequirements:['instinct_runtime_injection','decision_budget_enforcement',
 'checkpoint_isolation','automatic_result_capture'],
 note:'Spec only: deliberately cannot launch while blocking requirements remain'};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'spec.json'),JSON.stringify(spec,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file:path.join(out,'spec.json'),status:spec.status,blockingRequirements:spec.blockingRequirements},null,2));
