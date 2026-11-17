// Read-only REPLAY of the first bound Minecraft action from an existing
// unsuccessful SCRIPTED chain smoke. This is a proof-contract check, not a
// new server execution, not a learning event, and never edits evidence.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyMotorBaselineActionEvidence} from '../src/verified-motor-baseline-action.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runId=process.argv[2];
if(process.argv.length!==3||!/^chain-smoke-[0-9]{14}$/.test(runId??''))
  throw Error('Usage: node scripts/audit-resource-chain-first-action.js chain-smoke-YYYYMMDDHHMMSS');
const folder=path.join(root,'recordings/live-resource-chain-smoke',runId);
const loadJson=name=>JSON.parse(fs.readFileSync(path.join(folder,name),'utf8'));
const summary=loadJson('summary.json');
const manifest=loadJson('manifest.json');
if(manifest.runId!==runId||summary.runId!==runId||
  summary.complete!==false||
  manifest.assistance!=='scripted_planner'||
  manifest.learningEnabled!==false||
  manifest.trainingEligible!==false)
  throw Error('Original failed scripted run and manifest do not match');
const raw=fs.readFileSync(path.join(folder,'server-events.jsonl'));
const sha=createHash('sha256').update(raw).digest('hex');
if(sha!==summary.eventsSha256||!raw.toString('utf8').endsWith('\n'))
  throw Error('Original server evidence is incomplete or its SHA-256 differs');
const events=raw.toString('utf8').split(/\r?\n/)
  .filter(Boolean).map(JSON.parse);
const journal=fs.readFileSync(path.join(folder,'runner.jsonl'),'utf8')
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
const choices=journal.filter(e=>e.type==='policy_choice');
const executions=journal.filter(e=>e.type==='motor_execution');
if(choices.length!==1||executions.length!==1||
  choices[0].id!==executions[0].id)
  throw Error('Expected exactly one executed decision in failed smoke');
const chosen=choices[0],execution=executions[0];
if(execution.execution?.status!=='completed')
  throw Error('Original actuator did not report a completed execution');
if(!chosen.target||!['dig','place'].includes(chosen.operation)||
  typeof chosen.candidateKey!=='string')
  throw Error('Original policy choice lacks executable action geometry');
const pre=events.filter(e=>e.event==='acceptance_probe'&&
  e.probeId==='initial-'+chosen.candidateKey);
const post=events.filter(e=>e.event==='acceptance_probe'&&
  e.probeId==='changed-'+chosen.id);
if(pre.length!==1||post.length!==1)
  throw Error('Missing or duplicate original pre/post target probes');
const decision={
  id:chosen.id,runId,operation:chosen.operation,
  serverBootId:pre[0].serverBootId,
  playerUuid:pre[0].playerUuid,
  world:pre[0].world,
  x:chosen.target.x,y:chosen.target.y,z:chosen.target.z,
  placedBlock:'minecraft:dirt'
};
const proof=verifyMotorBaselineActionEvidence({run:manifest,decision,events});
const expected=chosen.operation==='dig'?'minecraft:air':'minecraft:dirt';
const postValid=post[0].serverBootId===pre[0].serverBootId&&
  post[0].playerUuid===pre[0].playerUuid&&
  post[0].world===pre[0].world&&
  post[0].block===expected&&post[0].sequence>pre[0].sequence;
const sequenceValid=proof.actionVerified===true&&
  proof.eventSequence>pre[0].sequence&&
  proof.eventSequence<post[0].sequence;
const report={
  schema:'craftle.scripted-action-proof-replay.v1',
  runId,source:'SHA256_VERIFIED_PREVIOUS_FAILED_LIVE_RUN',
  eventSha256:sha,decisionId:decision.id,
  action:chosen.operation,target:chosen.target,
  actuatorStatus:execution.execution.status,
  preBlock:pre[0].block,
  postBlock:post[0].block,
  postStateValid:postValid,
  actionProof:proof,
  proofBetweenProbes:sequenceValid,
  firstActionProven:proof.actionVerified===true&&
    proof.trainingRewardEligible===false&&postValid&&sequenceValid,
  learningUpdates:0,
  explanation:'A previously executed scripted action is rechecked using real bound server events. This is not a successful four-action resource-chain experiment.'
};
console.log(JSON.stringify(report,null,2));
if(!report.firstActionProven)process.exitCode=1;
