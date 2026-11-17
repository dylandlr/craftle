// Read-only audit of TWO completed real-Minecraft frozen neural episodes.
// Replays the bound server action proofs and dirt pickup UUID evidence, checks
// both frozen checkpoints, and recomputes task success from server probes.
// It never starts Minecraft, changes checkpoints, or grants training rewards.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chainLayout,chainSnapshotFromProbes,chainFinalOutcome,
  CHAIN_KEYS,CHAIN_MAX_STEPS}
  from '../src/motor-resource-chain.js';
import {verifyMotorBaselineActionEvidence}
  from '../src/verified-motor-baseline-action.js';
import {findResourceChainPickup}
  from '../src/motor-resource-pickup-proof.js';
import {loadResourceChainOfflineCheckpoint}
  from '../src/resource-chain-offline-checkpoint.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'recordings/live-resource-chain-frozen-eval');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=msg=>{throw Error('PAIR_AUDIT_FAIL: '+msg);};
const requireTrue=(ok,msg)=>{if(!ok)fail(msg);};
function loadJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function loadJsonl(file){
  const buf=fs.readFileSync(file,'utf8');
  requireTrue(buf.endsWith('\n'),'unterminated JSONL '+path.basename(file));
  return buf.split(/\r?\n/).filter(Boolean).map(JSON.parse);
}
const countDirt=s=>s.inventory.filter(i=>i.name==='dirt')
  .reduce((n,i)=>n+i.count,0);

function auditRun(runId,expectedMode){
  requireTrue(/^chain-frozen-[0-9]{14}$/.test(runId),'unsafe run ID');
  const dir=path.join(base,runId);
  const summary=loadJson(path.join(dir,'summary.json'));
  const manifest=loadJson(path.join(dir,'manifest.json'));
  requireTrue(summary.schema==='craftle.live-resource-chain-frozen-eval.v1'&&
    summary.runId===runId&&manifest.runId===runId&&
    summary.complete===true&&manifest.policyMode===expectedMode&&
    summary.policy==='frozen_'+expectedMode+'_neural'&&
    manifest.policy==='frozen_neural_evaluation'&&
    manifest.assistance==='frozen_offline_neural'&&
    manifest.learningEnabled===false&&
    manifest.trainingEligible===false&&
    manifest.isolated===true&&
    summary.learnedPolicyUpdates===0,
    'missing honest completed frozen-neural manifest for '+runId);
  requireTrue(Number.isSafeInteger(summary.rotation)&&
    typeof summary.variant==='string','missing task geometry');
  const layout=chainLayout(summary.rotation,summary.variant);
  requireTrue(manifest.rotation===summary.rotation&&
    manifest.variant===summary.variant,'task layout disagreement');

  // Verify both original source hashes and the exact copied checkpoint bytes.
  for(const [name,recorded] of Object.entries(manifest.sourceHashes??{})){
    requireTrue(/^[a-z0-9][a-z0-9/.-]*$/.test(name)&&
      !name.includes('..')&&/^[a-f0-9]{64}$/.test(recorded)&&
      digest(fs.readFileSync(path.join(root,name)))===recorded,
      'code/observer source hash changed: '+name);
  }
  const checkpointBytes=fs.readFileSync(path.join(dir,
    'frozen-neural-checkpoint.json'));
  const checkpointHash=digest(checkpointBytes);
  requireTrue(checkpointHash===manifest.checkpointSha256&&
    checkpointHash===summary.checkpointSha256,
    'checkpoint file hash mismatch');
  const checkpoint=loadResourceChainOfflineCheckpoint(
    JSON.parse(checkpointBytes.toString('utf8')));
  requireTrue(checkpoint.metadata.mode===expectedMode&&
    checkpoint.metadata.training.seed>=0&&
    checkpoint.metadata.sourceHashes&&
    Object.entries(checkpoint.metadata.sourceHashes).every(([name,hash])=>
      manifest.sourceHashes[name]===hash)&&
    checkpoint.metadata.model.updates===summary.offlineModelUpdates&&
    digest(JSON.stringify(checkpoint.policy.snapshot()))===
      summary.modelDigestBefore,
    'checkpoint/provenance/model digest mismatch');

  const eventsPath=path.join(dir,'server-events.jsonl');
  const eventBytes=fs.readFileSync(eventsPath);
  requireTrue(digest(eventBytes)===summary.eventsSha256,
    'server-events SHA-256 mismatch');
  const events=loadJsonl(eventsPath);
  const journal=loadJsonl(path.join(dir,'runner.jsonl'));
  const choices=journal.filter(x=>x.type==='policy_choice');
  const executions=journal.filter(x=>x.type==='motor_execution');
  const verified=journal.filter(x=>x.type==='verified_step');
  requireTrue(choices.length===4&&executions.length===4&&
    verified.length===4&&summary.evidence?.length===4,
    'not exactly four policy choices, executions, and proof entries');

  function snapshot(phase){
    const probes=events.filter(e=>e.event==='acceptance_probe'&&
      typeof e.probeId==='string'&&e.probeId.startsWith(phase+'-'));
    return chainSnapshotFromProbes(layout,probes);
  }
  const initial=snapshot('initial');
  const final=snapshot('final');
  const pickups=[];
  const proofIds=new Set();
  const chosen=[];
  let lastServerSequence=initial.lastSequence;
  let priorPost=initial;
  for(let i=0;i<4;i++){
    const choice=choices[i],exec=executions[i],j=verified[i],
      saved=summary.evidence[i];
    const decisionId='chain-'+String(i+1).padStart(3,'0');
    const pre=i===0?initial:snapshot('before-'+(i+1));
    const post=snapshot(choice.operation==='dig'?
      'pickup-'+decisionId:'after-'+decisionId);
    requireTrue(choice.id===decisionId&&choice.step===i+1&&
      choice.arm==='frozen_neural_evaluation'&&
      choice.policyTrainingUpdates===0&&
      choice.offlineTrainingUpdates===summary.offlineModelUpdates&&
      exec.id===decisionId&&exec.execution?.status==='completed'&&
      j.action===decisionId&&saved.action===decisionId&&
      JSON.stringify(saved)===JSON.stringify(Object.fromEntries(
        Object.keys(saved).map(k=>[k,j[k]])))&&
      choice.operation===j.operation&&
      choice.candidateKey===j.targetKey&&
      choice.target&&
      JSON.stringify(choice.target)===
        JSON.stringify(layout.sites[choice.candidateKey])&&
      pre.serverBootId===initial.serverBootId&&
      post.serverBootId===initial.serverBootId&&
      pre.playerUuid===initial.playerUuid&&
      post.playerUuid===initial.playerUuid,
      'action/journal/proof identity mismatch at step '+(i+1));
    const key=choice.candidateKey;
    const before=choice.operation==='dig'?'minecraft:dirt':'minecraft:air';
    const after=choice.operation==='dig'?'minecraft:air':'minecraft:dirt';
    requireTrue(pre.blocks[key]===before&&post.blocks[key]===after&&
      j.preInventory===countDirt(pre)&&
      j.postInventory===countDirt(post)&&
      pre.firstSequence>=priorPost.firstSequence&&
      pre.lastSequence<post.firstSequence&&
      post.firstSequence>lastServerSequence,
      'server pre/post world or inventory mismatch at '+decisionId);
    const decision={
      id:decisionId,runId,
      operation:choice.operation,
      serverBootId:pre.serverBootId,
      playerUuid:pre.playerUuid,
      world:pre.world,
      ...choice.target,placedBlock:'minecraft:dirt'
    };
    const proof=verifyMotorBaselineActionEvidence({
      run:manifest,decision,events
    });
    requireTrue(proof.actionVerified===true&&
      proof.trainingRewardEligible===false&&
      proof.rewardEligible===false&&
      proof.evidenceKey===saved.evidenceKey&&
      proof.decisionKey===saved.decisionKey&&
      proof.eventSequence===saved.eventSequence&&
      proof.eventSequence>pre.lastSequence&&
      proof.eventSequence<post.firstSequence&&
      saved.trainingRewardEligible===false&&
      saved.scriptedActionVerified===true&&
      saved.gateEligible===true&&
      saved.serverBootId===initial.serverBootId&&
      !proofIds.has(proof.evidenceKey),
      'server-bound action evidence mismatch at '+decisionId);
    proofIds.add(proof.evidenceKey);
    lastServerSequence=proof.eventSequence;
    if(choice.operation==='dig'){
      const pickup=findResourceChainPickup({
        events,source:choice.target,playerUuid:pre.playerUuid,
        serverBootId:pre.serverBootId,afterSequence:pre.lastSequence,
        consumedEntityUuids:pickups
      });
      requireTrue(pickup&&
        pickup.dropEventSequence>proof.eventSequence&&
        pickup.pickupEventSequence<post.firstSequence&&
        countDirt(post)===countDirt(pre)+1,
        'missing real item entity pickup at '+decisionId);
      pickups.push(pickup.itemEntityUuid);
    }else{
      requireTrue(countDirt(post)===countDirt(pre)-1,
        'placement did not consume dirt at '+decisionId);
    }
    const scores=choice.candidateScores;
    requireTrue(Array.isArray(scores)&&scores.length>0&&
      scores.every(c=>typeof c.id==='string'&&
        Number.isFinite(c.q))&&
      scores.some(c=>c.id===key&&
        Math.abs(c.q-choice.chosenEstimatedQ)<1e-10)&&
      choice.chosenEstimatedQ>=Math.max(...scores.map(c=>c.q))-1e-10&&
      choice.chosenReason==='learned_value',
      'chosen neural action was not greedy Q maximum '+decisionId);
    chosen.push(key);
    priorPost=post;
  }
  const outcome=chainFinalOutcome({
    initial,final,proofs:summary.evidence,maxSteps:CHAIN_MAX_STEPS
  });
  requireTrue(outcome.terminal===true&&outcome.success===summary.success&&
    outcome.reward===summary.terminalReward&&
    JSON.stringify(outcome)===JSON.stringify(summary.taskResult)&&
    summary.verifiedActions===4&&
    summary.verifiedDigActions===2&&
    summary.verifiedPlaceActions===2&&
    summary.verifiedRealPickups===2&&
    pickups.length===2&&
    final.firstSequence>lastServerSequence,
    'final-world outcome or episode evidence mismatch');
  return {
    runId,policy:summary.policy,seed:checkpoint.metadata.training.seed,
    trainingEpisodes:checkpoint.metadata.training.episodes,
    offlineModelUpdates:summary.offlineModelUpdates,
    rotation:summary.rotation,variant:summary.variant,
    success:outcome.success,terminalReward:outcome.reward,
    executedActions:chosen,verifiedActions:4,realPickups:2,
    liveUpdates:0,serverEvidenceSha256:summary.eventsSha256,
    checkpointSha256:checkpointHash,
    sourceHashes:manifest.sourceHashes,
    modelArchitecture:{
      schema:checkpoint.metadata.model.schema,
      hidden:checkpoint.metadata.model.hidden,
      weights:checkpoint.metadata.model.w.length,
      outputWeights:checkpoint.metadata.model.v.length
    }
  };
}
export function auditPairedLiveRuns({trainedRunId,controlRunId}={}){
  const trained=auditRun(trainedRunId,'trained');
  const control=auditRun(controlRunId,'untrained');
  requireTrue(trained.runId!==control.runId&&
    trained.seed===control.seed&&
    trained.rotation===control.rotation&&
    trained.variant===control.variant&&
    JSON.stringify(trained.modelArchitecture)===
      JSON.stringify(control.modelArchitecture)&&
    JSON.stringify(trained.sourceHashes)===
      JSON.stringify(control.sourceHashes)&&
    trained.offlineModelUpdates>0&&control.offlineModelUpdates===0,
    'paired runs do not use the same seed, architecture, code or layout');
  const fourthStepDiffers=trained.executedActions[3]!==
    control.executedActions[3];
  return {
    schema:'craftle.live-resource-chain-paired-server-audit.v1',
    observation:'TWO_REAL_MINECRAFT_EPISODES',
    evidenceChecked:true,rewardsAreTerminalOnly:true,
    trained,control,
    trainedMinusControlReward:
      trained.terminalReward-control.terminalReward,
    differenceInFourthChoice:fourthStepDiffers,
    interpretation:trained.success&&!control.success?
      'The trained model succeeded and the matched untrained model failed; supports a learning contribution on THIS ONE controlled layout, not a population-level causal estimate.':
      'No trained-only success contrast in this matched pair.',
    limitation:'One public-blueprint layout; no live neural updates; results cannot establish reliable open-world generalization.'
  };
}
if(process.argv[1]&&
  path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    requireTrue(process.argv.length===4,
      'Usage: node scripts/audit-live-resource-chain-pair.js TRAINED_RUN_ID UNTRAINED_RUN_ID');
    const report=auditPairedLiveRuns({
      trainedRunId:process.argv[2],controlRunId:process.argv[3]
    });
    console.log(JSON.stringify(report,null,2));
  }catch(e){
    console.error(e.stack??String(e));process.exitCode=1;
  }
}
