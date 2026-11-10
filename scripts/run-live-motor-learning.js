// Craftle: first controlled live Minecraft task-conditioned Q-learning experiment.
// Additive script: never modifies existing runner, observer, or local checkpoints.
// The world is reset BEFORE each independent decision; this is not free survival.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import mineflayer from 'mineflayer';
import { createMotorQPolicy, MOTOR_FEATURE_COUNT } from '../src/motor-q-policy.js';
import { executeMotorPrimitive, waitPhysicsTicks } from '../src/motor-acceptance.js';
import { verifyMotorRewardEvidence } from '../src/verified-motor-reward-gate.js';
import { paper1211ProtocolOverride } from '../src/paper-1211-protocol.js';
import { guardProtocolIntegrity } from '../src/motor-protocol-integrity.js';

const require = createRequire(import.meta.url);
const { Vec3 } = require('vec3');
const protocolOverride = paper1211ProtocolOverride(require('minecraft-data')('1.21.1'));
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonHash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fileHash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const CHECKPOINT_SCHEMA = 'craftle.live-task-q-checkpoint.v1';
const TARGETS = Object.freeze({
  dig: { x: 2, y: 81, z: 0 },
  place: { x: -2, y: 81, z: 0 }
});
const available = n => Number.isSafeInteger(n) && n >= 0;
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const name = process.argv[i], value = process.argv[i + 1];
  if (!name.startsWith('--') || value === undefined) throw Error('Use --key value pairs');
  if (Object.hasOwn(args, name.slice(2))) throw Error('Duplicate option: ' + name);
  args[name.slice(2)] = value;
}
const trainCount = Number(args.train ?? 24), evalCount = Number(args.eval ?? 8);
const port = Number(args.port ?? 25619);
const seed = Number(args.seed ?? 17);
const paperJar = path.resolve(args['paper-jar'] ??
  'C:/Users/delar/Downloads/craftle-main/craftle-observer-verify/observer-test/paper-1.21.1-133.jar');
const runId = args['run-id'] ?? ('live-dqn-' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14));
const selfTest = Object.hasOwn(args, 'self-test');
if (!Object.keys(args).every(k => ['train','eval','port','seed','paper-jar','run-id','self-test'].includes(k)))
  throw Error('Unknown option');
if (![trainCount, evalCount, port, seed].every(Number.isSafeInteger) ||
    trainCount < 1 || trainCount > 1000 || evalCount < 2 || evalCount > 500 ||
    port < 1024 || port > 65535 || seed < 0 ||
    !/^[A-Za-z0-9_-]{1,54}$/.test(runId) || port === 25565 || port === 25567 || port === 25575)
  throw Error('Invalid run configuration or live-server port');
if (port === 25617) throw Error('Port 25617 is reserved for prior calibration runs');
const plugin = path.join(root, 'observer/target/craftle-observer-0.1.0.jar');
const base = path.join(root, 'recordings/live-motor-learning');
const runDir = path.join(base, runId);
const containerName = 'craftle-live-' + runId;
const botName = 'CraftleProbe';

function stateEnvelope(payload) {
  return {schema: CHECKPOINT_SCHEMA, sha256:jsonHash(payload), payload};
}
function loadCheckpoint(checkpointFile) {
  const doc = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
  if (doc.schema !== CHECKPOINT_SCHEMA || doc.sha256 !== jsonHash(doc.payload))
    throw Error('Checkpoint integrity verification failed');
  const state = doc.payload;
  if (!Array.isArray(state.entries) || state.entries.length !== state.model.updates ||
      new Set(state.entries.map(e => e.decisionKey)).size !== state.entries.length ||
      new Set(state.entries.map(e => e.evidenceKey)).size !== state.entries.length)
    throw Error('Checkpoint reward ledger mismatch');
  createMotorQPolicy({training:false, hidden:24, snapshot:state.model});
  return state;
}
function atomicCheckpoint(file, payload) {
  const temp = file + '.tmp-' + randomUUID();
  const lock = file + '.lock';
  const fdLock = fs.openSync(lock, 'wx');
  try {
    const fd = fs.openSync(temp, 'wx');
    try {
      fs.writeFileSync(fd, JSON.stringify(stateEnvelope(payload), null, 2) + '\n');
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
    fs.closeSync(fdLock);
    fs.unlinkSync(lock);
  }
}
function taskReward(objective, actual) {
  if (!['dig','place'].includes(objective) || !['dig','place'].includes(actual))
    throw Error('Invalid controlled task reward');
  return objective === actual ? 1 : -1;
}
function taskCandidates(bot, objective) {
  const playerPos = bot.entity?.position;
  if (!playerPos) throw Error('Missing bot position');
  const lookup = (x, y, z) => bot.blockAt(new Vec3(x,y,z));
  const digBlock = lookup(2,81,0);
  const emptyCell = lookup(-2,81,0);
  const floor = lookup(-2,80,0);
  const dirt = bot.inventory.items().find(i => i.name === 'dirt' && i.count > 0);
  if (digBlock?.name !== 'dirt' ||
      emptyCell?.boundingBox !== 'empty' ||
      floor?.boundingBox !== 'block' || !dirt)
    throw Error('Both candidate actions must be observed as executable');
  const inventory = bot.inventory.items().map(i => ({
    name: i.name, count: i.count, placeable: i.name === 'dirt'
  }));
  const observation = {
    position: {x:playerPos.x, y:playerPos.y, z:playerPos.z},
    goal: {...TARGETS[objective]},
    health: bot.health, food: bot.food,
    inventory, stalls:0,
    blockAt: lookup
  };
  const candidates = [
    {id:'dig:dirt-east', operation:'dig', executable:true,
      arguments:{position:{...TARGETS.dig}},
      evidence:{source:'observed_block',block:'dirt'}},
    {id:'place:dirt-west', operation:'place', executable:true,
      arguments:{reference:{x:-2,y:80,z:0},
        face:{x:0,y:1,z:0},itemName:'dirt'},
      evidence:{source:'observed_empty_destination_and_inventory',
        destination:{...TARGETS.place}}}
  ];
  return {observation,candidates};
}
function scheduledGoals(count, salt) {
  // Both objective types are represented equally (within one episode).
  const goals = Array.from({length:count},(_,i)=>i%2 ? 'place':'dig');
  let s = (seed + salt) >>> 0;
  for(let i=goals.length-1;i>0;i--) {
    s=(Math.imul(s,1664525)+1013904223)>>>0;
    const j=s%(i+1);
    [goals[i],goals[j]]=[goals[j],goals[i]];
  }
  return goals;
}
function selfCheck() {
  const sample={
    entity:{position:{x:0.5,y:81,z:0.5}},
    health:20,food:20,
    inventory:{items:()=>[{name:'dirt',count:1}]},
    blockAt: pos=>({name:pos.x===2&&pos.y===81?'dirt':'air',
      boundingBox:pos.y===80 || pos.x===2&&pos.y===81?'block':'empty'})
  };
  const left=taskCandidates(sample,'dig'), right=taskCandidates(sample,'place');
  const policy=createMotorQPolicy({seed,epsilon:0.5,hidden:24});
  const picked=policy.choose(left.observation,left.candidates);
  if(picked.features.length!==MOTOR_FEATURE_COUNT ||
     !['dig','place'].includes(picked.candidate.operation) ||
     !right.candidates.every(x=>x.executable) ||
     taskReward('dig','dig')!==1 || taskReward('dig','place')!==-1)
    throw Error('Live-task model preflight failed');
  const first=policy.snapshot();
  policy.observe({features:picked.features,reward:1,terminal:true});
  const state={model:policy.snapshot(),entries:[{
    decisionKey:'test:d1',evidenceKey:'test:e1'}]};
  if(state.model.updates !== first.updates+1 ||
     jsonHash(stateEnvelope(state).payload)!==stateEnvelope(state).sha256)
    throw Error('Live-task update/checkpoint preflight failed');
  console.log(JSON.stringify({selfTest:'passed',candidateCount:2,
    featureCount:MOTOR_FEATURE_COUNT,syntheticUpdates:1,liveUpdates:0}));
}
selfCheck();
if (selfTest) process.exit(0);
if (!fs.existsSync(paperJar) || !fs.existsSync(plugin))
  throw Error('Paper or compiled observer JAR missing; original paths left unchanged');
if (!fs.existsSync(path.join(root,'src/verified-motor-reward-gate.js')))
  throw Error('Local verified reward gate missing');
fs.mkdirSync(base,{recursive:true});
if (fs.existsSync(runDir))
  throw Error('Run ID already exists: refusing to overwrite evidence');
const serverImage = 'itzg/minecraft-server:java21';
const command = async (binary,argv,timeout=45000) => (await exec(binary,argv,{
  cwd:root,timeout,windowsHide:true,maxBuffer:8*1024*1024
})).stdout.trim();
const docker = (...a) => command('docker',a);
let created=false, bot=null, protocolFailure=null, interrupted=false, summary={};
let dataDir, eventPath, checkpointFile;
const journal = row => fs.appendFileSync(path.join(runDir,'runner.jsonl'),
  JSON.stringify({time:new Date().toISOString(),...row})+'\n');
const writeJson=(name,value)=>fs.writeFileSync(path.join(runDir,name),
  JSON.stringify(value,null,2)+'\n');
function readEvents() {
  if(!fs.existsSync(eventPath)) return [];
  const data=fs.readFileSync(eventPath,'utf8');
  return data.slice(0,data.lastIndexOf('\n')+1).split('\n').filter(Boolean).map(JSON.parse);
}
const rcon=async text => {
  const reply=await docker('exec',containerName,'rcon-cli',text);
  journal({type:'server_command',command:text,reply});
  return reply;
};
async function probe(id,target) {
  const reply=await rcon('craftleprobe '+id+' '+botName+' '+target.x+' '+target.y+' '+target.z);
  if(!reply.includes('CRAFTLE_PROBE '+id+' ')) throw Error('Server probe rejected: '+reply);
  const matches=readEvents().filter(e=>e.event==='acceptance_probe'&&e.probeId===id);
  if(matches.length!==1) throw Error('Ambiguous server probe');
  return matches[0];
}
async function settle(n=6) { await waitPhysicsTicks(bot,n); await delay(120); }
async function resetFixture() {
  // Every intervention occurs before the decision's initial probe.
  const commands=[
    'tp '+botName+' 0.5 81 0.5 0 0','clear '+botName,
    'fill -4 81 -4 4 83 4 air',
    'kill @e[type=minecraft:item]',
    'setblock 2 81 0 dirt',
    'setblock -2 81 0 air',
    'give '+botName+' dirt 1'
  ];
  for(const cmd of commands) await rcon(cmd);
  await settle(8);
}
function modelFrom(snapshot, training, iteration) {
  return createMotorQPolicy({seed:seed+iteration*7919,
    epsilon:training?0.35:0,hidden:24,alpha:0.015,
    gamma:0.95,training,snapshot});
}
function validateServerProof(manifest, decision, events) {
  const result=verifyMotorRewardEvidence({run:manifest,decision,events});
  if(!result.eligible) throw Error('Server proof rejected: '+result.reason);
  return result;
}
async function episode({arm,number,objective,modelSnapshot,mode,manifest,checkpoint}) {
  if(interrupted) throw Error('Interrupted');
  await resetFixture();
  const beforeDig=await probe(arm+'-'+String(number).padStart(4,'0')+'-dig-before',TARGETS.dig);
  const beforePlace=await probe(arm+'-'+String(number).padStart(4,'0')+'-place-before',TARGETS.place);
  if(beforeDig.onlinePlayers!==1 || beforePlace.onlinePlayers!==1 ||
     beforeDig.serverBootId!==beforePlace.serverBootId ||
     beforeDig.block!=='minecraft:dirt' || beforePlace.block!=='minecraft:air')
    throw Error('Server predecision fixture mismatch');
  const {observation,candidates}=taskCandidates(bot,objective);
  let selection;
  if(mode==='random') {
    const randomSeed=(Math.imul(seed+number,1664525)+arm.length*31)>>>0;
    const index=randomSeed%2;
    const candidate=candidates[index];
    const scorer=modelFrom(modelSnapshot,false,number);
    selection={candidate,features:scorer.choose(observation,[candidate]).features,
      estimatedQ:null,exploratory:true,reason:'uniform_random_baseline'};
  } else {
    selection=modelFrom(modelSnapshot,mode==='train',number)
      .choose(observation,candidates);
  }
  if(!selection.candidate || !selection.candidate.executable ||
     !['dig','place'].includes(selection.candidate.operation))
    throw Error('Policy selected nonexecutable action');
  const operation=selection.candidate.operation;
  const target=TARGETS[operation];
  const id=arm+'-'+String(number).padStart(4,'0');
  const pre=operation==='dig'?beforeDig:beforePlace;
  const decision={id,runId,operation,
    serverBootId:pre.serverBootId,playerUuid:pre.playerUuid,
    world:pre.world,x:target.x,y:target.y,z:target.z,
    placedBlock:'minecraft:dirt',features:selection.features};
  journal({type:'policy_choice',arm,id,objective,operation,
    candidates:candidates.map(c=>({id:c.id,operation:c.operation})),
    features:selection.features,estimatedQ:selection.estimatedQ,
    exploratory:selection.exploratory,reason:selection.reason,
    preProbeSequence:pre.sequence});
  const reply=await rcon('craftlebind '+id+' '+botName+' '+operation+
    ' '+target.x+' '+target.y+' '+target.z);
  if(!reply.includes('CRAFTLE_BIND '+id+' ')) throw Error('Binding rejected: '+reply);
  const trial={id,runId,operation,target,maxWindowTicks:400,
    expectedClientBlock:operation==='dig'?'dirt':'air',playerUuid:pre.playerUuid};
  let execution;
  try {
    execution=await executeMotorPrimitive(bot,trial,{timeoutMs:12000});
  } catch(error) {
    execution={status:'failed',reason:String(error)};
  }
  journal({type:'motor_execution',id,execution});
  if(execution.status!=='completed') {
    const cancellation=await rcon('craftlecancel '+id);
    journal({type:'motor_cancel',id,reply:cancellation});
    if(!cancellation.includes('CRAFTLE_CANCELLED '+id))
      throw Error('Failed motor action could not be revoked: '+cancellation);
    throw Error('Live actuator failed or rejected '+id+': '+execution.status);
  }
  await settle(5);
  const post=await probe(id+'-after',target);
  const allEvents=readEvents();
  if(post.serverBootId!==pre.serverBootId || post.playerUuid!==pre.playerUuid)
    throw Error('Server reboot or actor identity changed');
  const proof=validateServerProof(manifest,decision,allEvents);
  const reward=taskReward(objective,operation);
  const success=reward>0;
  if(mode==='train') {
    const state=loadCheckpoint(checkpoint);
    const decisionKey=proof.decisionKey, evidenceKey=proof.evidenceKey;
    if(state.entries.some(e=>e.decisionKey===decisionKey ||
       e.evidenceKey===evidenceKey)) throw Error('Duplicate reward proof');
    const policy=modelFrom(state.model,true,number);
    const update=policy.observe({features:selection.features,reward,
      nextObservation:{},nextCandidates:[],terminal:true,steps:proof.steps});
    const nextState={model:policy.snapshot(),entries:[...state.entries,{
      decisionKey,evidenceKey,objective,operation,reward,
      serverBootId:decision.serverBootId,
      proofDigest:jsonHash(allEvents.filter(e=>
        e.decisionId===id||e.boundDecisionId===id||
        e.sourceEventSequence===Number(evidenceKey.split(':').pop()))),
      updateNumber:update.updates
    }]};
    atomicCheckpoint(checkpoint,nextState);
  }
  journal({type:'episode_result',id,arm,objective,operation,
    reward,success,serverEvidenceKey:proof.evidenceKey,
    updates:mode==='train'?loadCheckpoint(checkpoint).model.updates:0});
  console.log(JSON.stringify({arm,number,objective,chosen:operation,
    success,verified:true,updated:mode==='train'}));
  return {arm,number,objective,chosen:operation,success,
    evidenceKey:proof.evidenceKey};
}
const abort=()=>{interrupted=true;};
process.on('SIGINT',abort);
process.on('SIGTERM',abort);
const results=[];
try {
  const socket=net.createServer();
  await new Promise((yes,no)=>{
    socket.once('error',no);socket.listen(port,'127.0.0.1',yes);
  });
  await new Promise(yes=>socket.close(yes));
  const image=JSON.parse(await docker('image','inspect',serverImage))[0];
  fs.mkdirSync(runDir,{recursive:false});
  dataDir=path.join(runDir,'data');
  fs.mkdirSync(path.join(dataDir,'plugins'),{recursive:true});
  fs.copyFileSync(plugin,path.join(dataDir,'plugins/craftle-observer-0.1.0.jar'));
  fs.copyFileSync(paperJar,path.join(dataDir,'paper.jar'));
  eventPath=path.join(dataDir,'plugins/CraftleObserver/events.jsonl');
  checkpointFile=path.join(runDir,'q-checkpoint.json');
  const manifest={schema:'craftle.motor-learning-manifest.v1',runId,
    learningEnabled:true,trainingEligible:true,isolated:true,assistance:'none',
    initialStateSource:'controlled_administrative_reset_before_decision',
    task:'goal_conditioned_dig_or_place',reward:'verified_action:+1_if_goal_else_-1'};
  writeJson('manifest.json',{...manifest,trainCount,evalCount,port,seed,
    modelSchema:'craftle.motor-q.v3.goal-frame',
    fixedCandidateSet:['dig','place'],
    note:'Controlled one-step task learning, not general survival; fixture provisioning occurs before every decision.',
    sourceHashes:Object.fromEntries([
      'scripts/run-live-motor-learning.js',
      'src/motor-q-policy.js',
      'src/motor-acceptance.js',
      'src/verified-motor-reward-gate.js',
      'observer/target/craftle-observer-0.1.0.jar'
    ].map(f=>[f,fileHash(path.join(root,f))]))});
  const initialModel=modelFrom(null,false,0).snapshot();
  atomicCheckpoint(checkpointFile,{model:initialModel,entries:[]});
  await docker('run','-d','--name',containerName,
    '--label','org.craftle.live-learning='+runId,
    '--cpus','2','--memory','2g',
    '-p','127.0.0.1:'+port+':25565',
    '--mount','type=bind,source='+dataDir+',target=/data',
    '-e','EULA=TRUE','-e','TYPE=CUSTOM','-e','CUSTOM_SERVER=/data/paper.jar',
    '-e','ONLINE_MODE=FALSE','-e','ENABLE_RCON=TRUE','-e','MEMORY=1G',
    '-e','LEVEL_TYPE=minecraft:flat','-e','SEED=91361109',
    '-e','MODE=survival','-e','DIFFICULTY=peaceful',
    '-e','SPAWN_PROTECTION=0','-e','VIEW_DISTANCE=3','-e','SIMULATION_DISTANCE=3',
    '-e','MAX_PLAYERS=1','-e','CRAFTLE_ACCEPTANCE_PROBES=true',
    '-e','CRAFTLE_LEARNING_BINDINGS=true',
    '-e','CRAFTLE_EXPERIMENT_ID='+runId,image.Id);
  created=true;
  const inspected=JSON.parse(await docker('inspect',containerName))[0];
  if(inspected.Config.Labels['org.craftle.live-learning']!==runId ||
     inspected.Mounts.length!==1 ||
     inspected.Mounts[0].Destination!=='/data' ||
     inspected.HostConfig.PortBindings['25565/tcp'][0].HostIp!=='127.0.0.1')
    throw Error('Isolated server verification failed');
  let ready=false;
  for(let i=0;i<180;i++){
    if(interrupted) throw Error('Interrupted before Minecraft startup');
    try {
      if((await rcon('time query gametime')).includes('The time is')) {ready=true;break;}
    } catch {}
    await delay(1000);
  }
  if(!ready||!readEvents().some(e=>e.event==='observer_boot'&&e.experimentId===runId))
    throw Error('Minecraft observer readiness timeout');
  for(const cmd of [
    'gamerule doMobSpawning false','gamerule doDaylightCycle false',
    'gamerule doWeatherCycle false','gamerule randomTickSpeed 0',
    'gamerule spawnRadius 0','time set 1000','weather clear',
    'forceload add -16 -16 16 16','fill -8 80 -8 12 80 12 stone',
    'fill -8 81 -8 12 85 12 air','setworldspawn 0 81 0'
  ]) await rcon(cmd);
  bot=mineflayer.createBot({host:'127.0.0.1',port,username:botName,
    auth:'offline',version:'1.21.1',customPackets:protocolOverride,
    checkTimeoutInterval:45000});
  guardProtocolIntegrity(bot._client,(detail,buffer)=>{
    protocolFailure=detail;
    const out=path.join(runDir,'protocol-failure-'+detail.sha256+'.bin');
    if(buffer.length<4*1024*1024&&!fs.existsSync(out))
      fs.writeFileSync(out,buffer,{flag:'wx'});
  });
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Bot spawn timeout')),90000);
    bot.once('spawn',()=>{clearTimeout(timer);resolve();});
    bot.once('error',err=>{clearTimeout(timer);reject(err);});
  });
  await settle(10);
  const goals=scheduledGoals(trainCount,0x51f0);
  for(let i=0;i<trainCount;i++){
    const snapshot=loadCheckpoint(checkpointFile).model;
    results.push(await episode({arm:'train',number:i+1,objective:goals[i],
      modelSnapshot:snapshot,mode:'train',manifest,checkpoint:checkpointFile}));
    if(protocolFailure) throw Error('Protocol integrity error: '+protocolFailure.message);
  }
  const finalState=loadCheckpoint(checkpointFile);
  const trainedModel=finalState.model;
  const heldOut=scheduledGoals(evalCount,0x2b71);
  for(const arm of ['trained','untrained','random']){
    for(let i=0;i<evalCount;i++){
      results.push(await episode({arm,number:i+1,objective:heldOut[i],
        modelSnapshot:arm==='trained'?trainedModel:initialModel,
        mode:arm==='random'?'random':'frozen',manifest,
        checkpoint:checkpointFile}));
      if(protocolFailure) throw Error('Protocol integrity error: '+protocolFailure.message);
    }
  }
  if(loadCheckpoint(checkpointFile).model.updates!==trainCount)
    throw Error('Checkpoint update count mismatch');
  const armStats=Object.fromEntries(['trained','untrained','random'].map(arm=>{
    const rows=results.filter(r=>r.arm===arm);
    return [arm,{successes:rows.filter(r=>r.success).length,trials:rows.length,
      successRate:rows.filter(r=>r.success).length/rows.length}];
  }));
  summary={schema:'craftle.live-motor-learning-result.v1',runId,
    complete:true,trainingUpdates:trainCount,
    serverVerifiedTrainDecisions:trainCount,
    heldOutTasks:heldOut,
    eval:armStats,
    advantageOverRandom:armStats.trained.successRate-armStats.random.successRate,
    advantageOverUntrained:armStats.trained.successRate-armStats.untrained.successRate,
    demonstratedImprovement:armStats.trained.successRate>armStats.random.successRate &&
      armStats.trained.successRate>armStats.untrained.successRate,
    limitation:'Controlled independent one-step dig/place tasks with admin initial-state resets; not autonomous Minecraft survival or exclusive packet-level causality.'};
} catch(error){
  summary={schema:'craftle.live-motor-learning-result.v1',
    runId,complete:false,trainingUpdates:fs.existsSync(checkpointFile??'')?
      loadCheckpoint(checkpointFile).model.updates:0,
    error:error.stack??String(error)};
  console.error('LIVE_LEARNING_FAILED:',error.stack??error);
} finally {
  try {bot?.clearControlStates();bot?.quit('live_learning_finished');} catch {}
  if(created){
    try {
      const container=JSON.parse(await docker('inspect',containerName))[0];
      if(container.Config.Labels['org.craftle.live-learning']!==runId)
        throw Error('Container ownership changed; refusing shutdown');
      await docker('stop','--time','20',containerName);
      fs.writeFileSync(path.join(runDir,'server-console.log'),
        await docker('logs',containerName));
    } catch(e){
      summary.cleanupError=String(e);summary.complete=false;
    }
  }
  if(eventPath&&fs.existsSync(eventPath)){
    const eventsCopy=path.join(runDir,'server-events.jsonl');
    fs.copyFileSync(eventPath,eventsCopy);
    summary.eventsSha256=fileHash(eventsCopy);
  }
  if(protocolFailure){summary.protocolFailure=protocolFailure;summary.complete=false;}
  if(fs.existsSync(runDir)){
    writeJson('summary.json',summary);
    fs.writeFileSync(path.join(runDir,'episodes.jsonl'),
      results.map(r=>JSON.stringify(r)).join('\n')+'\n');
  }
  process.off('SIGINT',abort);process.off('SIGTERM',abort);
  console.log(JSON.stringify(summary,null,2));
}
if(!summary.complete)process.exitCode=1;
