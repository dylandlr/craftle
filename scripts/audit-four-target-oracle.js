// Read-only counterfactual audit of a completed live four-target experiment.
// The heuristic consumes the same publicly provided goal coordinates and
// candidate action geometry as the Q-network. It does not run Minecraft,
// credit learning, rewrite original results, or revalidate observer event proof.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chooseByGoalCoordinates} from '../src/motor-four-target-baselines.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runId=process.argv[2];
if(process.argv.length!==3||!/^four-target-[0-9]{14}$/.test(runId??''))
  throw Error('Usage: node scripts/audit-four-target-oracle.js four-target-YYYYMMDDHHMMSS');
const folder=path.join(root,'recordings/live-motor-four-target',runId);
const readJson=p=>JSON.parse(fs.readFileSync(path.join(folder,p),'utf8'));
const readJsonl=p=>fs.readFileSync(path.join(folder,p),'utf8')
  .split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
const summary=readJson('summary.json');
if(summary.schema!=='craftle.live-four-target-result.v1'||
   summary.runId!==runId||summary.complete!==true)
  throw Error('Not a completed four-target run');
const choices=readJsonl('runner.jsonl').filter(x=>x.type==='policy_choice');
const episodes=readJsonl('episodes.jsonl');
const chosenIds=new Set(choices.map(row=>row.id));
if(chosenIds.size!==choices.length)throw Error('Duplicate policy-choice identifiers');
const byId=new Map(choices.map(row=>[row.id,row]));
const stats={};
for(const arm of ['trained','untrained','random']){
  const rows=episodes.filter(e=>e.arm===arm);
  if(rows.length!==summary.eval[arm].trials)
    throw Error('Evaluation trial count differs from saved summary: '+arm);
  let correct=0;
  const mistakes=[];
  for(const episode of rows){
    const id=arm+'-'+String(episode.number).padStart(4,'0');
    const choice=byId.get(id);
    if(!choice||choice.arm!==arm||choice.goalKey!==episode.goalKey||
       choice.chosenKey!==episode.chosenKey||
       choice.task.rotation!==episode.rotation||
       choice.task.distance!==episode.distance)
      throw Error('Saved action and episode disagree: '+id);
    if(!Array.isArray(choice.candidates)||choice.candidates.length!==4||
       !choice.targets||!choice.targets[choice.goalKey])
      throw Error('Missing recorded candidate menu or public goal: '+id);
    const observation={goal:choice.targets[choice.goalKey]};
    const pick=chooseByGoalCoordinates(observation,
      choice.candidates.map(c=>({...c,executable:true})));
    if(!pick.candidate)
      throw Error('Coordinate heuristic returned no unique candidate: '+id);
    if(pick.distance!==0)
      throw Error('No action candidate matches the publicly supplied goal: '+id);
    correct+=Number(pick.candidate.id===episode.goalKey);
    if(pick.candidate.id!==episode.goalKey)
      mistakes.push({id,goalKey:episode.goalKey,chosen:pick.candidate.id});
  }
  stats[arm]={counterfactualCorrect:correct,
    trials:rows.length,counterfactualAccuracy:correct/rows.length,
    observedPolicyCorrect:summary.eval[arm].successes,
    mistakes};
}
const reference=stats.trained;
console.log(JSON.stringify({
  audit:'craftle.nonlearning-coordinate-matching.v1',
  runId,
  source:'original logged policy_choice menus plus supplied goal coordinates',
  type:'OFFLINE_COUNTERFACTUAL_NOT_MINECRAFT_EXECUTION',
  observedNeuralNetwork:summary.eval.trained,
  nonlearningCoordinateMatch:{
    successes:reference.counterfactualCorrect,trials:reference.trials,
    accuracy:reference.counterfactualAccuracy
  },
  perEvaluationArm:stats,
  policyUpdates:0,
  conclusion:'A zero-training coordinate-matching policy can solve these supervised one-step target tasks; perfect Q-network accuracy is not evidence of a need for reinforcement learning.',
  nextResearchTarget:'Multi-step resource acquisition and placement with reward based on final world state, plus a scripted planner baseline'
},null,2));
