// READ ONLY: use an existing verified live decision to test whether the
// local reward gate can validate a scripted, non-learning policy manifest.
// Never alters source evidence, creates bindings or starts Minecraft.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyMotorRewardEvidence} from '../src/verified-motor-reward-gate.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runId=process.argv[2];
if(process.argv.length!==3||!/^four-target-[0-9]{14}$/.test(runId??''))
  throw Error('Usage: node scripts/check-resource-chain-gate.js four-target-YYYYMMDDHHMMSS');
const dir=path.join(root,'recordings/live-motor-four-target',runId);
const getJson=file=>JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
const manifest=getJson('manifest.json');
const summary=getJson('summary.json');
const source=fs.readFileSync(path.join(dir,'server-events.jsonl'));
const digest=createHash('sha256').update(source).digest('hex');
if(summary.complete!==true||summary.runId!==runId||
   manifest.runId!==runId||summary.eventsSha256!==digest||
   !source.toString('utf8').endsWith('\n'))
  throw Error('Prior run is incomplete or server event SHA-256 differs');
const events=source.toString('utf8').split(/\r?\n/)
  .filter(Boolean).map(JSON.parse);
const rows=fs.readFileSync(path.join(dir,'runner.jsonl'),'utf8')
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
const first=rows.find(e=>e.type==='policy_choice'&&
  typeof e.id==='string'&&e.chosenKey&&e.operation&&
  e.targets?.[e.chosenKey]&&Array.isArray(e.features));
if(!first)throw Error('No original policy decision could be reconstructed');
const target=first.targets[first.chosenKey];
const before=events.filter(e=>e.event==='acceptance_probe'&&
  e.probeId===first.id+'-'+first.chosenKey+'-before');
if(before.length!==1||before[0].sequence!==first.preProbeSequence)
  throw Error('Original pre-decision server probe was not unique or matched');
const pre=before[0];
const decision={
  id:first.id,runId,
  operation:first.operation,
  serverBootId:pre.serverBootId,
  playerUuid:pre.playerUuid,
  world:pre.world,
  x:target.x,y:target.y,z:target.z,
  placedBlock:'minecraft:dirt',
  features:first.features
};
function inspect(run){
  const result=verifyMotorRewardEvidence({run,decision,events});
  return {eligible:result?.eligible===true,
    reason:result?.reason??null,
    decisionKey:result?.decisionKey??null,
    evidenceKey:result?.evidenceKey??null};
}
const original=inspect(manifest);
if(!original.eligible)
  throw Error('Original previously verified action failed current local gate: '+
    JSON.stringify(original));
const scripted=inspect({
  ...manifest,
  learningEnabled:false,
  trainingEligible:false,
  assistance:'scripted_planner',
  initialStateSource:'single_admin_reset_before_entire_episode',
  task:'four_step_dirt_collection_and_construction_with_two_distractors',
  reward:'terminal_world_state_only_not_action_id',
  policy:'scripted_nonlearning_smoke'
});
const report={
  schema:'craftle.resource-chain-gate-contract-check.v1',
  source:'READ_ONLY_PREVIOUS_MINECRAFT_RECORDING',
  runId,
  decisionId:first.id,
  eventsSha256:digest,
  originalBaseline:{assistance:manifest.assistance,
    learningEnabled:manifest.learningEnabled,
    trainingEligible:manifest.trainingEligible,
    result:original},
  scriptedPolicyManifest:scripted,
  readyForScriptedLiveSmoke:scripted.eligible,
  scope:'Verifies gate eligibility contract on prior event data, NOT a live four-step episode'
};
console.log(JSON.stringify(report,null,2));
if(!scripted.eligible){
  console.error('SCRIPTED_POLICY_GATE_BLOCKED: preserve truthful baseline metadata; '+
    'do not override it to learningEnabled=true or assistance=none.');
  process.exitCode=1;
}
