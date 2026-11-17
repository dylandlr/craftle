// Read-only, privacy-preserving diagnostic for a failed live resource-chain
// smoke run. Report what the REAL server observer recorded; never upgrade a
// state observation to causal or reward-eligible evidence.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runId=process.argv[2];
if(process.argv.length!==3||!/^chain-smoke-[0-9]{14}$/.test(runId??''))
  throw Error('Usage: node scripts/inspect-resource-chain-failure.js chain-smoke-YYYYMMDDHHMMSS');
const dir=path.join(root,'recordings/live-resource-chain-smoke',runId);
const readJson=file=>JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
const summary=readJson('summary.json');
const manifest=readJson('manifest.json');
if(summary.runId!==runId||summary.complete!==false||
    manifest.runId!==runId||manifest.learningEnabled!==false||
    manifest.trainingEligible!==false)
  throw Error('Expected a completed-write, non-learning FAILED smoke run');
const eventFile=path.join(dir,'server-events.jsonl');
const bytes=fs.readFileSync(eventFile);
const digest=createHash('sha256').update(bytes).digest('hex');
if(digest!==summary.eventsSha256||!bytes.toString('utf8').endsWith('\n'))
  throw Error('Failed-run server event evidence does not match saved digest');
const events=bytes.toString('utf8').split(/\r?\n/).filter(Boolean)
  .map((text,i)=>{try{return JSON.parse(text);}catch{
    throw Error('Invalid event JSONL at line '+(i+1));
  }});
const journalFile=path.join(dir,'runner.jsonl');
const journal=fs.readFileSync(journalFile,'utf8').split(/\r?\n/)
  .filter(Boolean).map(JSON.parse);
const chosen=journal.find(e=>e.type==='policy_choice');
const action=journal.find(e=>e.type==='motor_execution');
const counts=Object.fromEntries([...new Set(events.map(e=>e.event))]
  .sort().map(kind=>[kind,events.filter(e=>e.event===kind).length]));
const target=chosen?.target;
const matching=events.filter(e=>
  target&&e.x===target.x&&e.y===target.y&&e.z===target.z);
const bindingRelated=events.filter(e=>{
  const json=JSON.stringify(e);
  return json.includes('chain-001')||
    (target&&e.playerName==='CraftleProbe'&&
      e.x===target.x&&e.y===target.y&&e.z===target.z);
});
const display=e=>({
  event:e.event,phase:e.phase??null,sequence:e.sequence??null,
  serverTick:e.serverTick??null,
  schema:e.schema??null,
  keys:Object.keys(e).sort(),
  decisionId:e.decisionId??null,
  boundDecisionId:e.boundDecisionId??null,
  sourceEventSequence:e.sourceEventSequence??null,
  block:e.block??null,
  sourceEvent:e.sourceEvent??null,
  // no player UUIDs, private server details, addresses, or raw packets
});
const evidenceKinds=[
  'block_break_event','block_place_event',
  'block_state_post_tick','acceptance_probe',
  'block_drops_event','item_pickup_event'
];
const excerpts=bindingRelated.filter(e=>
  evidenceKinds.includes(e.event)||
  Object.keys(e).some(key=>/bind|decision|action/i.test(key)));
const result={
  schema:'craftle.resource-chain-failed-live-diagnostic.v1',
  runId,eventsSha256:digest,
  savedResult:{complete:summary.complete,error:summary.error,
    reportedVerifiedActions:summary.verifiedActions},
  policyMetadata:{assistance:manifest.assistance,
    learningEnabled:manifest.learningEnabled,
    trainingEligible:manifest.trainingEligible},
  firstPolicyChoice:chosen?{
    step:chosen.step,operation:chosen.operation,
    target:chosen.target,candidateKey:chosen.candidateKey
  }:null,
  firstExecution:action?.execution??null,
  eventCounts:counts,
  matchingCoordinateEventCount:matching.length,
  actionRelevantEventCount:bindingRelated.length,
  actionEventShapes:excerpts.slice(0,16).map(display),
  earliestEventTypes:events.slice(0,6).map(e=>e.event),
  interpretation:'Proof-gate not_learning_eligible is a reward-authorization rejection, not by itself proof the Minecraft actuator failed. This report is observational only.'
};
console.log(JSON.stringify(result,null,2));
