// One-episode scripted-baseline LIVE smoke test for a Minecraft dirt resource
// chain. World resets only ONCE, before the episode; never between the four
// actions. No neural updates, no planner imitation, no DQN success claim.
// Fail closed on action, drop/pickup, inventory or observer proof mismatch.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {encodeMotorCandidate} from '../src/motor-q-policy.js';
import {
  chainLayout,chainCandidateMenu,scriptedResourcePlanner,chainActionTarget,
  chainSnapshotFromProbes,validateInitialChainSnapshot,chainFinalOutcome,
  CHAIN_ALL_SOURCES,CHAIN_KEYS,CHAIN_MAX_STEPS
} from '../src/motor-resource-chain.js';
import {syntheticEpisode} from '../src/resource-chain-simulator.js';
import {findResourceChainPickup} from '../src/motor-resource-pickup-proof.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const command=promisify(execFile);
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const args={};
for(let i=2;i<process.argv.length;i+=2){
  if(!process.argv[i]?.startsWith('--')||!process.argv[i+1])
    throw Error('Arguments must be --key value pairs');
  const key=process.argv[i].slice(2);
  if(Object.hasOwn(args,key))throw Error('Duplicate option '+key);
  args[key]=process.argv[i+1];
}
if(!Object.keys(args).every(k=>['self-test','port','rotation','variant',
  'run-id','paper-jar'].includes(k)))throw Error('Unknown option');
const selfTest=args['self-test']==='true';
if(args['self-test']!==undefined&&!['true','false'].includes(args['self-test']))
  throw Error('Invalid self-test');
const port=Number(args.port??25624),rotation=Number(args.rotation??0);
const variant=args.variant??'base';
const runId=args['run-id']??('chain-smoke-'+
  new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14));
if(!Number.isSafeInteger(port)||port<1024||port>65535||
  [25565,25567,25575,25617,25623].includes(port)||
  !Number.isSafeInteger(rotation)||rotation<0||rotation>3||
  !/^[A-Za-z0-9_-]{1,54}$/.test(runId))
  throw Error('Invalid isolated server configuration');
const layout=chainLayout(rotation,variant);
const outcome=syntheticEpisode(rotation,menu=>
  scriptedResourcePlanner(menu.observation,menu.candidates),{variant});
if(!outcome.success||outcome.choices.length!==4)
  throw Error('Scripted planner self-test failed');
console.log(JSON.stringify({
  selfTest:'passed',policy:'scripted_nonlearning',
  expectedActions:4,goalFeedback:'terminal_only',
  rotation,variant,syntheticSuccess:true,liveActions:0
}));
if(selfTest)process.exit(0);

const paperJar=path.resolve(args['paper-jar']??
  'C:/Users/delar/Downloads/craftle-main/craftle-observer-verify/observer-test/paper-1.21.1-133.jar');
const plugin=path.join(root,'observer/target/craftle-observer-0.1.0.jar');
const dependencies=[
  paperJar,plugin,
  path.join(root,'src/motor-acceptance.js'),
  path.join(root,'src/verified-motor-reward-gate.js')
];
if(dependencies.some(p=>!fs.existsSync(p)))
  throw Error('Missing local Paper, compiled observer, motor executor or gate');
const {executeMotorPrimitive}=await import('../src/motor-acceptance.js');
const {verifyMotorRewardEvidence}=await import('../src/verified-motor-reward-gate.js');
const {paper1211ProtocolOverride}=await import('../src/paper-1211-protocol.js');
const {guardProtocolIntegrity}=await import('../src/motor-protocol-integrity.js');
const mineflayer=(await import('mineflayer')).default;
const {Vec3}=require('vec3');
const protocolOverride=paper1211ProtocolOverride(require('minecraft-data')('1.21.1'));
if(typeof executeMotorPrimitive!=='function'||
  typeof verifyMotorRewardEvidence!=='function'||
  typeof paper1211ProtocolOverride!=='function'||
  typeof guardProtocolIntegrity!=='function')
  throw Error('Local Minecraft action verifier interfaces are incompatible');

const base=path.join(root,'recordings/live-resource-chain-smoke');
const runDir=path.join(base,runId);
const containerName='craftle-'+runId;
const botName='CraftleProbe';
const serverImage='itzg/minecraft-server:java21';
const docker=async(...argv)=>(await command('docker',argv,{
  cwd:root,windowsHide:true,timeout:45000,maxBuffer:8*1024*1024
})).stdout.trim();
const journal=row=>fs.appendFileSync(path.join(runDir,'runner.jsonl'),
  JSON.stringify({time:new Date().toISOString(),...row})+'\n');
const writeJson=(name,value)=>fs.writeFileSync(path.join(runDir,name),
  JSON.stringify(value,null,2)+'\n');
let bot=null,eventPath=null,created=false,protocolFailure=null,
  interrupted=false,summary={complete:false};
const evidence=[];
const creditedPickupEntities=[];
const abort=()=>{interrupted=true;};
process.on('SIGINT',abort);process.on('SIGTERM',abort);
function assertRunning(){
  if(interrupted)throw Error('Interrupted');
  if(protocolFailure)throw Error('Protocol integrity failure: '+
    protocolFailure.message);
}
function readEvents(){
  if(!eventPath||!fs.existsSync(eventPath))return [];
  const data=fs.readFileSync(eventPath,'utf8');
  return data.slice(0,data.lastIndexOf('\n')+1).split('\n')
    .filter(Boolean).map(JSON.parse);
}
async function rcon(text){
  assertRunning();
  const reply=await docker('exec',containerName,'rcon-cli',text);
  journal({type:'server_command',command:text,reply});
  return reply;
}
async function settle(n=6){
  assertRunning();
  if(!bot||!Number.isSafeInteger(n)||n<1||n>100)
    throw Error('Invalid physics settle');
  await new Promise((resolve,reject)=>{
    let ticks=0,finished=false;
    const cleanup=()=>{
      bot.removeListener('physicsTick',onTick);
      bot.removeListener('end',onEnd);
      clearTimeout(timer);
    };
    const finish=error=>{
      if(finished)return;
      finished=true;cleanup();
      if(error)reject(error);else resolve();
    };
    const onTick=()=>{if(++ticks>=n)finish();};
    const onEnd=()=>finish(Error('Bot disconnected during settle'));
    const timer=setTimeout(()=>
      finish(Error('Physics clock stalled')),Math.max(8000,n*500));
    bot.on('physicsTick',onTick);bot.once('end',onEnd);
  });
  await delay(120);
}
async function probe(id,target){
  const reply=await rcon('craftleprobe '+id+' '+botName+' '+
    target.x+' '+target.y+' '+target.z);
  if(!reply.includes('CRAFTLE_PROBE '+id+' '))
    throw Error('Server rejected probe: '+reply);
  const records=readEvents().filter(e=>
    e.event==='acceptance_probe'&&e.probeId===id);
  if(records.length!==1)throw Error('Missing/duplicate authoritative probe');
  return records[0];
}
async function probeAll(phase){
  const probes=[];
  for(const key of CHAIN_KEYS)
    probes.push(await probe(phase+'-'+key,layout.sites[key]));
  const snapshot=chainSnapshotFromProbes(layout,probes);
  journal({type:'authoritative_snapshot',phase,
    blocks:snapshot.blocks,inventory:snapshot.inventory,
    firstSequence:snapshot.firstSequence,
    lastSequence:snapshot.lastSequence,
    boot:snapshot.serverBootId,actor:snapshot.playerUuid});
  return snapshot;
}
const itemCount=snapshot=>snapshot.inventory
  .filter(i=>i.name==='dirt').reduce((n,i)=>n+i.count,0);
async function verifyPickup(source,id,earliestSequence,expectedCount){
  const deadline=Date.now()+12000;
  let movementTicks=0;
  while(Date.now()<deadline){
    assertRunning();
    const records=readEvents();
    const correlated=findResourceChainPickup({
      events:records,source,playerUuid:id.playerUuid,
      serverBootId:id.serverBootId,afterSequence:earliestSequence,
      consumedEntityUuids:creditedPickupEntities
    });
    if(correlated){
      await settle(4);
      const post=await probeAll('pickup-'+id.action);
      if(itemCount(post)!==expectedCount||
        post.firstSequence<=correlated.pickupEventSequence)
        throw Error('Correlated pickup event lacks subsequent server inventory increase');
      creditedPickupEntities.push(correlated.itemEntityUuid);
      journal({type:'verified_real_pickup',action:id.action,
        ...correlated,afterInventory:itemCount(post)});
      return post;
    }
    const hasSourceDrop=records.some(e=>
      e.event==='block_drops_event'&&
      e.playerUuid===id.playerUuid&&
      e.serverBootId===id.serverBootId&&
      e.sequence>earliestSequence&&
      e.x===source.x&&e.y===source.y&&e.z===source.z);
    if(!hasSourceDrop){
      await settle(3);
      continue;
    }
    // Real client movement, not teleportation or an administrative item grant.
    // Move only toward the empty, just-dug source cell. Limit total motion,
    // re-evaluate the held item from server observations, and fail if stuck.
    const current=bot.entity?.position;
    if(!current)throw Error('Lost bot position during pickup approach');
    const target={x:source.x+.5,z:source.z+.5};
    const distance=Math.hypot(target.x-current.x,target.z-current.z);
    if(distance>0.38&&movementTicks<36){
      await bot.lookAt(new Vec3(target.x,current.y+1.2,target.z),true);
      bot.setControlState('forward',true);
      try{await settle(3);}finally{bot.setControlState('forward',false);}
      movementTicks+=3;
    }else await settle(3);
  }
  throw Error('Dirt drop was not collected in the live pickup window');
}
async function actionStep(number,pre,manifest){
  assertRunning();
  // Never use admin commands to clear, give, setblock or teleport at this point.
  const clientInventory=bot.inventory.items().map(i=>({
    name:i.name,count:i.count
  }));
  const {observation,candidates}=chainCandidateMenu({
    layout,position:bot.entity.position,
    blockAt:(x,y,z)=>bot.blockAt(new Vec3(x,y,z)),
    inventory:clientInventory,health:bot.health,food:bot.food
  });
  if(itemCount(pre)!==clientInventory.filter(i=>i.name==='dirt')
    .reduce((sum,i)=>sum+i.count,0))
    throw Error('Client inventory and authoritative server inventory disagree');
  const candidate=scriptedResourcePlanner(observation,candidates);
  if(!candidate||!candidate.executable)
    throw Error('Scripted planner has no executable, observed action');
  const target=chainActionTarget(candidate);
  const key=candidate.id,operation=candidate.operation;
  if(!CHAIN_KEYS.includes(key)||JSON.stringify(target)!==
      JSON.stringify(layout.sites[key]))
    throw Error('Illegal or inconsistent chosen target geometry');
  const blockBefore=pre.blocks[key];
  if(blockBefore!==(operation==='dig'?'minecraft:dirt':'minecraft:air'))
    throw Error('Server and client disagree on target prestate');
  const id='chain-'+String(number).padStart(3,'0');
  const decision={id,runId,operation,serverBootId:pre.serverBootId,
    playerUuid:pre.playerUuid,world:pre.world,x:target.x,y:target.y,
    z:target.z,placedBlock:'minecraft:dirt',
    features:encodeMotorCandidate(observation,candidate)};
  journal({type:'policy_choice',arm:'scripted_smoke',id,step:number,
    candidateKey:key,operation,target,
    candidates:candidates.map(c=>({id:c.id,operation:c.operation,
      args:c.arguments})),
    serverInventoryBefore:itemCount(pre),
    blueprint:observation.blueprint,policyTrainingUpdates:0});
  const reply=await rcon('craftlebind '+id+' '+botName+' '+operation+' '+
    target.x+' '+target.y+' '+target.z);
  if(!reply.includes('CRAFTLE_BIND '+id+' '))
    throw Error('Action binding was rejected: '+reply);
  let execution;
  try{
    execution=await executeMotorPrimitive(bot,{
      id,runId,operation,target,maxWindowTicks:400,
      expectedClientBlock:operation==='dig'?'dirt':'air',
      playerUuid:pre.playerUuid
    },{timeoutMs:12000});
  }catch(e){
    execution={status:'failed',reason:String(e)};
  }
  journal({type:'motor_execution',id,execution});
  if(execution.status!=='completed'){
    const cancel=await rcon('craftlecancel '+id);
    journal({type:'motor_cancel',id,reply:cancel});
    if(!cancel.includes('CRAFTLE_CANCELLED '+id))
      throw Error('Failed actuator could not be cancelled: '+cancel);
    throw Error('Motor action failed: '+JSON.stringify(execution));
  }
  await settle(5);
  const postTarget=await probe('changed-'+id,target);
  if(postTarget.serverBootId!==pre.serverBootId||
      postTarget.playerUuid!==pre.playerUuid||
      postTarget.sequence<=pre.lastSequence||
      postTarget.block!==(operation==='dig'?'minecraft:air':'minecraft:dirt'))
    throw Error('Server target post-state did not confirm executed action');
  const proof=verifyMotorRewardEvidence({
    run:manifest,decision,events:readEvents()
  });
  if(!proof?.eligible)throw Error('Server action proof rejected: '+proof?.reason);
  const sequence=Number(String(proof.evidenceKey).split(':').pop());
  if(!Number.isSafeInteger(sequence)||sequence<=pre.lastSequence||
    sequence>=postTarget.sequence)
    throw Error('Proof evidence sequence is outside observed action window');
  let post;
  if(operation==='dig'){
    post=await verifyPickup(target,{
      playerUuid:pre.playerUuid,serverBootId:pre.serverBootId,
      action:id
    },pre.lastSequence,itemCount(pre)+1);
  }else{
    post=await probeAll('after-'+id);
    if(itemCount(post)!==itemCount(pre)-1)
      throw Error('Placement did not consume one observed dirt item');
  }
  if(post.blocks[key]!==postTarget.block||
    post.serverBootId!==pre.serverBootId||
    post.playerUuid!==pre.playerUuid||
    post.firstSequence<=sequence)
    throw Error('Final step snapshot does not agree with bound motor action');
  const entry={action:id,targetKey:key,operation,decisionKey:proof.decisionKey,
    evidenceKey:proof.evidenceKey,eventSequence:sequence,gateEligible:true,
    preInventory:itemCount(pre),postInventory:itemCount(post),
    serverBootId:pre.serverBootId};
  if(evidence.some(e=>e.evidenceKey===entry.evidenceKey||
    e.decisionKey===entry.decisionKey))
    throw Error('Repeated server evidence receipt');
  evidence.push(entry);
  journal({type:'verified_step',...entry,
    targetBlockAfter:post.blocks[key]});
  console.log(JSON.stringify({step:number,operation,targetKey:key,
    serverVerified:true,inventory:itemCount(post),neuralUpdates:0}));
  return post;
}
try{
  const socket=net.createServer();
  await new Promise((resolve,reject)=>{
    socket.once('error',reject);
    socket.listen(port,'127.0.0.1',resolve);
  });
  await new Promise(resolve=>socket.close(resolve));
  const image=JSON.parse(await docker('image','inspect',serverImage))[0];
  fs.mkdirSync(base,{recursive:true});
  if(fs.existsSync(runDir))
    throw Error('Refusing to overwrite existing evidence directory');
  fs.mkdirSync(runDir,{recursive:false});
  const dataDir=path.join(runDir,'data');
  fs.mkdirSync(path.join(dataDir,'plugins'),{recursive:true});
  fs.copyFileSync(plugin,path.join(dataDir,'plugins/craftle-observer-0.1.0.jar'));
  fs.copyFileSync(paperJar,path.join(dataDir,'paper.jar'));
  eventPath=path.join(dataDir,'plugins/CraftleObserver/events.jsonl');
  const manifest={
    schema:'craftle.motor-learning-manifest.v1',runId,
    learningEnabled:false,trainingEligible:false,isolated:true,
    assistance:'scripted_planner',
    initialStateSource:'single_admin_reset_before_entire_episode',
    task:'four_step_dirt_collection_and_construction_with_two_distractors',
    reward:'terminal_world_state_only_not_action_id',
    policy:'scripted_nonlearning_smoke'
  };
  writeJson('manifest.json',{...manifest,port,rotation,variant,
    neuralUpdates:0,training:false,
    sourceHashes:Object.fromEntries([
      'scripts/run-live-resource-chain-smoke.js',
      'src/motor-resource-chain.js','src/motor-q-policy.js',
      'src/motor-acceptance.js',
      'src/verified-motor-reward-gate.js',
      'observer/target/craftle-observer-0.1.0.jar'
    ].map(p=>[p,sha(path.join(root,p))]))});
  await docker('run','-d','--name',containerName,
    '--label','org.craftle.chain-smoke='+runId,
    '--cpus','2','--memory','2g',
    '-p','127.0.0.1:'+port+':25565',
    '--mount','type=bind,source='+dataDir+',target=/data',
    '-e','EULA=TRUE','-e','TYPE=CUSTOM','-e','CUSTOM_SERVER=/data/paper.jar',
    '-e','ONLINE_MODE=FALSE','-e','ENABLE_RCON=TRUE','-e','MEMORY=1G',
    '-e','LEVEL_TYPE=minecraft:flat','-e','SEED=91361109',
    '-e','MODE=survival','-e','DIFFICULTY=peaceful',
    '-e','SPAWN_PROTECTION=0','-e','VIEW_DISTANCE=3',
    '-e','SIMULATION_DISTANCE=3','-e','MAX_PLAYERS=1',
    '-e','CRAFTLE_ACCEPTANCE_PROBES=true',
    '-e','CRAFTLE_LEARNING_BINDINGS=true',
    '-e','CRAFTLE_EXPERIMENT_ID='+runId,image.Id);
  created=true;
  const inspected=JSON.parse(await docker('inspect',containerName))[0];
  if(inspected.Config.Labels['org.craftle.chain-smoke']!==runId||
    inspected.Mounts.length!==1||
    inspected.Mounts[0].Destination!=='/data'||
    inspected.HostConfig.PortBindings['25565/tcp'][0].HostIp!=='127.0.0.1')
    throw Error('Unexpected isolated container configuration');
  let ready=false;
  for(let i=0;i<180;i++){
    assertRunning();
    try{
      if((await rcon('time query gametime')).includes('The time is')){
        ready=true;break;
      }
    }catch{}
    await delay(1000);
  }
  if(!ready||!readEvents().some(e=>
    e.event==='observer_boot'&&e.experimentId===runId))
    throw Error('Observer failed to boot in isolated server');
  for(const cmd of [
    'gamerule doMobSpawning false','gamerule doDaylightCycle false',
    'gamerule doWeatherCycle false','gamerule randomTickSpeed 0',
    'gamerule spawnRadius 0','time set 1000','weather clear',
    'forceload add -16 -16 16 16','fill -8 80 -8 12 80 12 stone',
    'fill -8 81 -8 12 85 12 air','setworldspawn 0 81 0'
  ])await rcon(cmd);
  bot=mineflayer.createBot({host:'127.0.0.1',port,
    username:botName,auth:'offline',version:'1.21.1',
    customPackets:protocolOverride,checkTimeoutInterval:45000});
  guardProtocolIntegrity(bot._client,(detail,buffer)=>{
    protocolFailure=detail;
    if(buffer.length<4*1024*1024){
      const out=path.join(runDir,'protocol-failure-'+detail.sha256+'.bin');
      if(!fs.existsSync(out))fs.writeFileSync(out,buffer,{flag:'wx'});
    }
  });
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Bot spawn timeout')),90000);
    bot.once('spawn',()=>{clearTimeout(timer);resolve();});
    bot.once('error',e=>{clearTimeout(timer);reject(e);});
  });
  await settle(10);
  // The only administrative fixture reset for this entire four-action run.
  for(const cmd of [
    'tp '+botName+' 0.5 81 0.5 0 0','clear '+botName,
    'fill -4 81 -4 4 83 4 air',
    'kill @e[type=minecraft:item]'
  ])await rcon(cmd);
  for(const key of CHAIN_KEYS){
    const target=layout.sites[key];
    await rcon('setblock '+target.x+' '+target.y+' '+target.z+' '+
      (CHAIN_ALL_SOURCES.includes(key)?'dirt':'air'));
  }
  await settle(10);
  const first=await probeAll('initial');
  validateInitialChainSnapshot(first);
  let current=first;
  for(let i=1;i<=CHAIN_MAX_STEPS;i++){
    // Explicitly refresh from the server; never reuse a stale action menu.
    if(i>1)current=await probeAll('before-'+i);
    current=await actionStep(i,current,manifest);
  }
  const final=await probeAll('final');
  const taskResult=chainFinalOutcome({
    initial:first,final,proofs:evidence,maxSteps:CHAIN_MAX_STEPS
  });
  if(!taskResult.success)throw Error('Four-step world objective failed: '+
    taskResult.reason);
  if(evidence.filter(x=>x.operation==='dig').length!==2||
    evidence.filter(x=>x.operation==='place').length!==2)
    throw Error('World success did not match exact 2-dig/2-place sequence');
  summary={schema:'craftle.live-resource-chain-smoke.v1',
    runId,complete:true,policy:'scripted_nonlearning',
    rotation,variant,verifiedActions:4,verifiedRealPickups:2,
    learnedPolicyUpdates:0,taskResult,
    evidence:evidence.map(x=>({...x}))};
}catch(error){
  summary={schema:'craftle.live-resource-chain-smoke.v1',
    runId,complete:false,policy:'scripted_nonlearning',
    rotation,variant,verifiedActions:evidence.length,
    learnedPolicyUpdates:0,
    error:error.stack??String(error)};
  console.error('RESOURCE_CHAIN_LIVE_SMOKE_FAILED',error.stack??error);
}finally{
  try{bot?.clearControlStates();bot?.quit('chain_smoke_finished');}catch{}
  if(created){
    try{
      const inspected=JSON.parse(await docker('inspect',containerName))[0];
      if(inspected.Config.Labels['org.craftle.chain-smoke']!==runId)
        throw Error('Container ownership changed; refusing shutdown');
      await docker('stop','--time','20',containerName);
      try{
        const logs=await docker('logs',containerName);
        fs.writeFileSync(path.join(runDir,'server-console.log'),logs);
      }catch{}
    }catch(e){
      summary.cleanupError=String(e);summary.complete=false;
    }
  }
  if(eventPath&&fs.existsSync(eventPath)){
    const copy=path.join(runDir,'server-events.jsonl');
    fs.copyFileSync(eventPath,copy);
    summary.eventsSha256=sha(copy);
  }
  if(fs.existsSync(runDir))writeJson('summary.json',summary);
  process.off('SIGINT',abort);process.off('SIGTERM',abort);
  console.log(JSON.stringify(summary,null,2));
}
if(!summary.complete)process.exitCode=1;
