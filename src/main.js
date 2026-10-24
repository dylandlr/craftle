import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import mineflayer from 'mineflayer';
import {decideNavigation} from './navigation.js';
import {createScriptedControl,stepAgent} from './agent-core.js';
import {startLiveObservationServer} from './live-pov.js';
import {evaluateVisualPolicy,applyVisualAction} from './visual-policy.js';
import {createVisualDatasetWriter} from './visual-dataset.js';
import {openTorchPolicy} from './torch-policy.js';
import {createVisionClient} from './llm-client.js';
import {createLlmAgent} from './llm-agent.js';
import {executeLlmAction} from './llm-tools.js';
import {snapshotAgentState,summarizeActionEffect} from './llm-effects.js';
import {createProgressTracker} from './llm-progress.js';
import {createOnlineVisualQLearner,visualState,intrinsicVisualReward} from './online-visual-rl.js';
import {attachRecorder,recordingOptions,prepareRecorder} from './recording.js';
import {createLifeFeedback} from './life-feedback.js';
import {createRewardV2} from './reward-v2.js';
import {startSurvivalReference} from './survival-reference.js';
import {createLearningOptionController} from './learning-options.js';
const config=JSON.parse(fs.readFileSync('config.json','utf8'));
fs.mkdirSync('recordings',{recursive:true});
const events=fs.createWriteStream('recordings/events.jsonl',{flags:'a'});
const log=(name,type,extra={})=>{const e={timestamp:new Date().toISOString(),agent:name,type,...extra};events.write(JSON.stringify(e)+'\n');console.log(JSON.stringify(e));};
const bots=[];
let stopping=false;
const allowedIds=process.env.CRAFTLE_AGENT_IDS?.split(',').map(x=>x.trim()).filter(Boolean);
const activeProfiles=allowedIds?config.agents.filter(a=>allowedIds.includes(a.id)):config.agents;
if(allowedIds && activeProfiles.length!==allowedIds.length)throw Error('Unknown agent in CRAFTLE_AGENT_IDS');
for(const [index,profile] of activeProfiles.entries()){
 await new Promise(resolve=>setTimeout(resolve,index===0?0:6000));
 if(stopping)break;
 log(profile.name,'connecting',{agent_id:profile.id,index});
 const bot=mineflayer.createBot({host:config.host,port:config.port,username:profile.name,version:config.version,hideErrors:true});
 bots.push(bot);
 const lifeFeedback=createLifeFeedback();
 bot.on('messagestr',(message,position)=>{
   const entry=lifeFeedback.chat(message,position??'chat');
   log(profile.name,'minecraft_text_observed',{agent_id:profile.id,...entry});
 });
 bot.on('death',()=>{
   const position=bot.entity?.position;
   const entry=lifeFeedback.death({message:'You Died!',position:position?{x:position.x,y:position.y,z:position.z}:null,health:bot.health});
   log(profile.name,'death_screen_observed',{agent_id:profile.id,...entry,source:'mineflayer_death_event'});
 });
 bot.on('respawn',()=>{
   const entry=lifeFeedback.respawn();
   log(profile.name,'life_feedback_available',{agent_id:profile.id,...entry,history:lifeFeedback.snapshot({max:16})});
 });
 // Minecraft time_update packets provide an authoritative but periodic world-age anchor.
 let lastWorldAge=null;
 bot._client.on('update_time',packet=>{const raw=packet.age??packet.worldAge??packet.time; if(raw!==undefined)lastWorldAge=String(raw);});
 let lastSample=0;
 bot.on('physicsTick',()=>{
   if(process.env.CRAFTLE_CAPTURE_TELEMETRY!=='1'||!bot.entity)return;
   const now=Date.now();if(now-lastSample<250)return;lastSample=now;
   const p=bot.entity.position;
   log(profile.name,'pose_sample',{agent_id:profile.id,worldAgeAnchor:lastWorldAge,position:{x:p.x,y:p.y,z:p.z},yaw:bot.entity.yaw,pitch:bot.entity.pitch});
 });
 let rlRuntimeInitialized=false;
 bot.on('spawn',()=>{
   log(profile.name,'spawn',{agent_id:profile.id,position:bot.entity?.position});
   if(process.env.CRAFTLE_CAMERA_SWEEP==='1'){
     let tick=0;
     const sweep=setInterval(()=>{
       if(!bot.entity||stopping){clearInterval(sweep);return;}
       bot.look((tick++%12)*Math.PI/6,0).catch(e=>log(profile.name,'camera_sweep_error',{message:e.message}));
     },1000);
     bot.once('end',()=>clearInterval(sweep));
   }
   const startRecorder=async()=>{
     const barrier=process.env.CRAFTLE_CAPTURE_BARRIER;
     if(barrier){
       await prepareRecorder();
       log(profile.name,'capture_waiting',{agent_id:profile.id,barrier});
       const deadline=Date.now()+180000;
       while(!stopping && !fs.existsSync(barrier) && Date.now()<deadline)
         await new Promise(resolve=>setTimeout(resolve,100));
       if(stopping || !fs.existsSync(barrier)){
         log(profile.name,'recording_error',{message:'Capture barrier timed out'});
         return;
       }
       log(profile.name,'capture_released',{agent_id:profile.id,releaseTime:fs.readFileSync(barrier,'utf8').trim()});
     }
     if(stopping)return;
   if(process.env.CRAFTLE_BEHAVIOR==='llm_agent'){
     if(activeProfiles.length!==1)throw Error('LLM MVP requires exactly one agent');
     const agent=createLlmAgent({
       infer:createVisionClient(),
       memoryFile:process.env.CRAFTLE_LLM_MEMORY_FILE??'recordings/llm/agent-memory.json',
       maxSteps:Number(process.env.CRAFTLE_LLM_MAX_STEPS??100),
       cognition:profile.cognition,
       log:entry=>log(profile.name,entry.type,{agent_id:profile.id,...entry})
     });
     const size=Number(process.env.CRAFTLE_LIVE_SIZE??128);
     let busy=false,lastDecision=0,lastOutcome=null,budgetExhausted=false;
     const progress=createProgressTracker();
     const intervalMs=Math.max(1000,Number(process.env.CRAFTLE_LLM_INTERVAL_MS??5000));
     const server=await startLiveObservationServer({width:size,height:size,onObservation:async frame=>{
       if(stopping||busy||budgetExhausted||Date.now()-lastDecision<intervalMs)return;
       busy=true;
       try{
         const decision=await agent.decide(frame,{health:bot.health,hunger:bot.food,inventory:bot.inventory.items().map(({name,count})=>({name,count})),position:bot.entity?.position?{x:bot.entity.position.x,z:bot.entity.position.z}:null,lastOutcome,lifeFeedback:lifeFeedback.snapshot({max:24})});
         const before=snapshotAgentState(bot);
         const outcome=await executeLlmAction(bot,decision.action,{target:decision.target});
         await new Promise(resolve=>setTimeout(resolve,350));
         const effect=summarizeActionEffect(before,snapshotAgentState(bot),decision.action,outcome);
         // A single decision must not leave movement held during the next LLM request.
         bot.clearControlStates();
         const reflection=progress.observe({goal:decision.goal,action:decision.action,effect});
         lastOutcome={...outcome,effect,reflection};
         log(profile.name,'llm_progress',{agent_id:profile.id,frameId:frame.frameId,...reflection});
         log(profile.name,'llm_action_effect',{agent_id:profile.id,frameId:frame.frameId,...effect});
         lastDecision=Date.now();
         log(profile.name,'llm_action_applied',{agent_id:profile.id,frameId:frame.frameId,action:decision.action,...outcome});
       }catch(error){
         bot.clearControlStates();
         if(error.message==='Decision budget exhausted'){
           budgetExhausted=true;
           log(profile.name,'llm_episode_finished',{agent_id:profile.id,reason:'decision_budget',steps:agent.getState().steps});
           server.close().catch(()=>{});
         }
         lastDecision=Date.now();
         log(profile.name,'llm_agent_error',{agent_id:profile.id,message:error.message});
       }finally{busy=false;}
     }});
     bot.once('end',()=>{server.close().catch(()=>{});bot.clearControlStates();});
     const headless=await prepareRecorder();
     headless(bot,{output:`${server.host}:${server.port}`,frames:Number(process.env.CRAFTLE_RECORD_FRAMES??1000),width:size,height:size});
     log(profile.name,'llm_agent_started',{agent_id:profile.id,size,source:'first_person_rgb',model:process.env.CRAFTLE_LLM_MODEL,cognition:profile.cognition});
   }
   if(['visual_online_rl','visual_random_control','visual_frozen_eval'].includes(process.env.CRAFTLE_BEHAVIOR)){
     if(rlRuntimeInitialized){log(profile.name,'rl_respawn_continuity',{agent_id:profile.id,learningRuntimePreserved:true});return;}
     if(activeProfiles.length!==1)throw Error('Online RL treatment requires one agent');
     const checkpoint=process.env.CRAFTLE_RL_CHECKPOINT??'recordings/rl/agent-q.json';
     const randomControl=process.env.CRAFTLE_BEHAVIOR==='visual_random_control';
     const frozen=process.env.CRAFTLE_BEHAVIOR==='visual_frozen_eval';
     const durationMs=Math.max(100,Math.min(1500,Number(process.env.CRAFTLE_RL_ACTION_MS??350)));
     if(frozen&&!fs.existsSync(checkpoint))throw Error('Frozen evaluation requires trained checkpoint');
     const learner=createOnlineVisualQLearner({checkpoint,training:!frozen,
       epsilon:Number(process.env.CRAFTLE_RL_EPSILON??0.3),
       alpha:Number(process.env.CRAFTLE_RL_ALPHA??0.2),
       gamma:Number(process.env.CRAFTLE_RL_GAMMA??0.9)});
     const rewardVersion=process.env.CRAFTLE_RL_REWARD_VERSION??'v1';
     if(!['v1','v2'].includes(rewardVersion))throw Error('Unsupported reward version');
     const rewardV2=rewardVersion==='v2'?createRewardV2():null;
     let busy=false,lastTime=0,previous=null,inFlight=null,dead=false,life=0;
     const deathPenalty=Number(process.env.CRAFTLE_RL_DEATH_PENALTY??-5);
     if(!Number.isFinite(deathPenalty)||deathPenalty>=0)throw Error('Death penalty must be finite and negative');
     bot.on('death',()=>{
       if(dead)return;
       dead=true;
       bot.clearControlStates();
       const terminalAction=inFlight??previous;
       if(terminalAction&&!randomControl&&!frozen){
         learner.learn({state:terminalAction.state,index:terminalAction.index,reward:deathPenalty,terminal:true});
         learner.save(checkpoint);
       }
       if(terminalAction)log(profile.name,'rl_terminal_transition',{agent_id:profile.id,state:terminalAction.state,action:terminalAction.action,reward:deathPenalty,terminal:true});
       log(profile.name,'rl_terminal_death',{agent_id:profile.id,penalty:deathPenalty,action:terminalAction?.action??null,cause:lifeFeedback.snapshot().latestDeathCause,learningUpdates:learner.stats().transitions});
       previous=null;inFlight=null;life++;
     });
     bot.on('respawn',()=>{dead=false;previous=null;inFlight=null;life++;rewardV2?.resetLife();});
     const actions=['forward','left','right','jump','look_left','look_right'];
     const seen=new Set();
     const videoDirectory=process.env.CRAFTLE_RL_VIDEO_FRAMES_DIR;
     let lastVideoFrameAt=0,videoFrames=0;
     if(videoDirectory)fs.mkdirSync(videoDirectory,{recursive:true});
     const onJpeg=videoDirectory?(jpeg)=>{
       const now=Date.now();
       if(now-lastVideoFrameAt<500||videoFrames>=180)return;
       lastVideoFrameAt=now;
       fs.writeFileSync(path.join(videoDirectory,String(videoFrames++).padStart(5,'0')+'.jpg'),jpeg);
     }:undefined;
     const server=await startLiveObservationServer({width:128,height:128,onJpeg,onObservation:async frame=>{
       if(busy||dead||stopping||Date.now()-lastTime<700||!bot.entity)return;
       busy=true;
       try{
         const currentLife=life;
         const state=visualState(frame),now=bot.entity.position.clone();
         const feedback=lifeFeedback.snapshot({max:8});
         let reward=null;
         if(previous){
           const displacement=previous.displacement;
           const rewardDetail=rewardV2?rewardV2.observe({position:previous.endPosition,healthDelta:previous.healthDelta})
             :{reward:intrinsicVisualReward({displacement,healthDelta:previous.healthDelta,novelState:!seen.has(state)}),terms:null};
           reward=rewardDetail.reward;
           if(!randomControl&&!frozen)learner.learn({...previous,reward,nextState:state});
           log(profile.name,'rl_transition',{agent_id:profile.id,frameId:frame.frameId,previousFrameId:previous.frameId,
             state:previous.state,action:previous.action,reward,nextState:state,rewardVersion,rewardTerms:rewardDetail.terms,displacement,healthDelta:previous.healthDelta,lifeFeedbackSeq:feedback.latestSeq,life:feedback.life,deathCount:feedback.deathCount,
             actionStartedAt:previous.actionStartedAt,actionEndedAt:previous.actionEndedAt});
         }
         seen.add(state);
         const choice=randomControl?{state,action:actions[Math.floor(Math.random()*actions.length)],index:-1}:learner.choose(state);
         bot.clearControlStates();
         inFlight=choice;
         const actionStartedAt=Date.now();
         const startPosition=bot.entity.position.clone(),startHealth=bot.health;
         try{
           await applyVisualAction(bot,choice.action);
           await new Promise(resolve=>setTimeout(resolve,durationMs));
         }finally{bot.clearControlStates();}
         const actionEndedAt=Date.now();
         const actionPosition=bot.entity?.position?.clone()??startPosition;
         if(dead||life!==currentLife)return;
         inFlight=null;
         previous={...choice,frameId:frame.frameId,actionStartedAt,actionEndedAt,
           displacement:actionPosition.distanceTo(startPosition),endPosition:{x:actionPosition.x,z:actionPosition.z},healthDelta:bot.health-startHealth};
         lastTime=Date.now();
         if(!randomControl&&!frozen&&learner.stats().transitions%10===0)learner.save(checkpoint);
         log(profile.name,'rl_action',{agent_id:profile.id,frameId:frame.frameId,state,action:choice.action,reward,policy:randomControl?'random_rgb_control':frozen?'frozen_visual_q':'online_visual_q',actionDurationMs:durationMs});
       }catch(error){bot.clearControlStates();log(profile.name,'rl_error',{message:error.message});}
       finally{busy=false;}
     }});
     bot.once('end',()=>{log(profile.name,'rl_video_frames',{agent_id:profile.id,count:videoFrames,directory:videoDirectory??null});bot.clearControlStates();if(!randomControl&&!frozen)learner.save(checkpoint);server.close().catch(()=>{});});
     rlRuntimeInitialized=true;
     const headless=await prepareRecorder();
     headless(bot,{output:`${server.host}:${server.port}`,frames:Number(process.env.CRAFTLE_RECORD_FRAMES??1200),width:128,height:128});
     log(profile.name,'online_rl_started',{agent_id:profile.id,checkpoint:randomControl?null:checkpoint,loadedLearningUpdates:learner.stats().transitions,observationSource:'first_person_rgb',rewardVersion,alpha:Number(process.env.CRAFTLE_RL_ALPHA??0.2),gamma:Number(process.env.CRAFTLE_RL_GAMMA??0.9),policy:randomControl?'random_rgb_control':'online_visual_q',actionDurationMs:durationMs});
     const maxMs=Number(process.env.CRAFTLE_RL_MAX_MS??0);
     if(Number.isFinite(maxMs)&&maxMs>=1000){const timer=setTimeout(()=>shutdown(),maxMs);bot.once('end',()=>clearTimeout(timer));}
   }
   if(['vision_probe','vision_learned'].includes(process.env.CRAFTLE_BEHAVIOR)){
     // Test-only vision policy: brightness heuristic, NOT a learned intelligent agent.
     // Receives only RGB and cannot access Mineflayer block state.
     let busy=false,lastAction=0;
     const dataset=process.env.CRAFTLE_VISUAL_DATASET_DIR?createVisualDatasetWriter(process.env.CRAFTLE_VISUAL_DATASET_DIR):null;
     const policy={predict:({rgb,width,height})=>{
       let left=0,right=0;
       for(let y=0;y<height;y+=4)for(let x=0;x<width;x+=4){
         const k=(y*width+x)*3;
         const brightness=rgb[k]+rgb[k+1]+rgb[k+2];
         if(x<width/2)left+=brightness;else right+=brightness;
       }
       return Math.abs(left-right)>45000?(left>right?'look_left':'look_right'):'forward';
     }};
     const learned=process.env.CRAFTLE_BEHAVIOR==='vision_learned';
     const activePolicy=learned?await openTorchPolicy({checkpoint:process.env.CRAFTLE_POLICY_CHECKPOINT,python:process.env.CRAFTLE_PYTHON??'python3'}):policy;
     const policyName=learned?'torch_visual_bc':'rgb_brightness_probe';
     const size=Number(process.env.CRAFTLE_LIVE_SIZE??128);
     const server=await startLiveObservationServer({width:size,height:size,onObservation:async frame=>{
       if(busy||Date.now()-lastAction<250)return;
       busy=true;
       try{
         const decision=await evaluateVisualPolicy(activePolicy,frame);
         await applyVisualAction(bot,decision.action);
         if(dataset)dataset.append(frame,decision.action,{policy:policyName,episode:profile.id});
         lastAction=Date.now();
         log(profile.name,'visual_decision',{agent_id:profile.id,policy:policyName,observationSource:'first_person_rgb',frameId:decision.frameId,capturedAt:decision.capturedAt,frameSha256:createHash('sha256').update(frame.rgb).digest('hex'),action:decision.action});
       }catch(error){log(profile.name,'visual_policy_error',{message:error.message});}
       finally{busy=false;}
     }});
     bot.once('end',()=>{server.close().catch(()=>{});if(learned)activePolicy.close();});
     const headless=await prepareRecorder();
     headless(bot,{output:`${server.host}:${server.port}`,frames:Number(process.env.CRAFTLE_RECORD_FRAMES??180),width:size,height:size});
     log(profile.name,'live_rgb_started',{agent_id:profile.id,size,source:'prismarine-viewer-jpeg-tcp'});
   }
   if(process.env.CRAFTLE_BEHAVIOR==='explore'){
     // Simple deterministic, non-LLM baseline: short walks and occasional turns.
     // Preserve action telemetry and avoid random behavior confounding cognition comparisons.
     let step=0;
     const timer=setInterval(()=>{
       if(stopping || !bot.entity){clearInterval(timer);return;}
       const ahead=bot.blockAt(bot.entity.position.offset(0,-1,0));
       bot.clearControlStates();
       const phase=step++%16;
       const yaw=(Number(profile.id.slice(-3))*0.71+Math.floor(step/16)*0.6)%(2*Math.PI);
       bot.look(yaw,0).catch(()=>{});
       if(phase<10)bot.setControlState('forward',true);
       if(phase===11)bot.setControlState('jump',true);
       log(profile.name,'baseline_action',{agent_id:profile.id,phase,yaw,groundBlock:ahead?.name??null});
     },1500);
     bot.once('end',()=>clearInterval(timer));
   }
   if(['survival_reference','learned_survival_options'].includes(process.env.CRAFTLE_BEHAVIOR)){
     if(activeProfiles.length!==1)throw Error('Survival reference requires one agent');
     if(!bot.__survivalReferenceStarted){
       bot.__survivalReferenceStarted=true;
       const optionController=process.env.CRAFTLE_BEHAVIOR==='learned_survival_options'?createLearningOptionController({mode:process.env.CRAFTLE_OPTION_POLICY??'training',seed:Number(process.env.CRAFTLE_OPTION_SEED??1),checkpoint:process.env.CRAFTLE_OPTION_CHECKPOINT??'recordings/options/policy.json',log:e=>log(profile.name,e.type,{agent_id:profile.id,...e})}):null;
       startSurvivalReference(bot,{decisionController:optionController,log:e=>log(profile.name,e.type,{agent_id:profile.id,...e,informationAccess:'privileged_mineflayer_state'})});
       const videoDir=process.env.CRAFTLE_REFERENCE_VIDEO_DIR;
       if(videoDir){
         fs.mkdirSync(path.join(videoDir,'frames'),{recursive:true});
         let captureCount=0,lastCapture=0;
         const manifest=path.join(videoDir,'frames.jsonl');
         fs.writeFileSync(manifest,'');
         const server=await startLiveObservationServer({width:256,height:256,
           onObservation:()=>{},
           onJpeg:(jpeg,frame)=>{
             const now=Date.parse(frame.capturedAt);
             if(now-lastCapture<100)return;
             lastCapture=now;
             const file=String(captureCount++).padStart(6,'0')+'.jpg';
             fs.writeFileSync(path.join(videoDir,'frames',file),jpeg);
             fs.appendFileSync(manifest,JSON.stringify({file,frameId:frame.frameId,capturedAt:frame.capturedAt})+'\n');
           }});
         bot.once('end',()=>{
           log(profile.name,'reference_capture_finished',{frames:captureCount,...server.stats()});
           server.close().catch(()=>{});
         });
         const headless=await prepareRecorder();
         const output=server.host+':'+server.port;
         headless(bot,{output,frames:Number(process.env.CRAFTLE_RECORD_FRAMES??20000),width:256,height:256});
         log(profile.name,'reference_video_capture_started',{directory:videoDir,manifest,width:256,height:256,maxSampleFps:10,source:'rendered_first_person_rgb'});
       }
       const maxMs=Number(process.env.CRAFTLE_RL_MAX_MS??60000);
       if(Number.isFinite(maxMs)&&maxMs>=1000){const t=setTimeout(()=>shutdown(),maxMs);bot.once('end',()=>clearTimeout(t));}
       log(profile.name,'survival_reference_started',{agent_id:profile.id,policy:optionController?(process.env.CRAFTLE_OPTION_POLICY??'training')+'_assisted_options':'scripted_privileged_mineflayer',learned:Boolean(optionController)&&['training','frozen'].includes(process.env.CRAFTLE_OPTION_POLICY??'training')});
     }
   }
   if(process.env.CRAFTLE_BEHAVIOR==='scripted_agent'){
     // Explicit privileged-state control, never the first-person learned-policy treatment.
     const agent=createScriptedControl();
     let heading=bot.entity?.yaw??0,lastPos=bot.entity?.position?.clone();
     let busy=false,step=0;
     const timer=setInterval(async()=>{
       if(stopping||!bot.entity){clearInterval(timer);return;}
       if(busy)return;
       busy=true;
       try{
         const pos=bot.entity.position;
         const ahead=pos.offset(-Math.sin(heading),0,-Math.cos(heading));
         const feet=bot.blockAt(ahead);
         const head=bot.blockAt(ahead.offset(0,1,0));
         const ground=bot.blockAt(ahead.offset(0,-1,0));
         const displacement=lastPos?Math.hypot(pos.x-lastPos.x,pos.z-lastPos.z):1;
         const observations={displacement,forwardBlocked:[feet,head].some(b=>b?.boundingBox==='block'),groundAhead:ground?.boundingBox==='block',danger:bot.health<8};
         const {goal,action}=await stepAgent(agent,observations);
         if(action.turn)heading=(heading+Math.PI*(0.5+((Number(profile.id.slice(-3))+step)%3)/4))%(Math.PI*2);
         bot.clearControlStates();
         await bot.look(heading,0);
         bot.setControlState('forward',action.forward);
         bot.setControlState('jump',action.jump);
         log(profile.name,'agent_decision',{agent_id:profile.id,policy:'scripted_block_control',observationSource:'privileged_block_state',goal,action,observations,heading});
         lastPos=pos.clone();step++;
       }catch(error){log(profile.name,'agent_decision_error',{message:error.message});}
       finally{busy=false;}
     },1000);
     bot.once('end',()=>{clearInterval(timer);bot.clearControlStates();});
   }
   if(process.env.CRAFTLE_BEHAVIOR==='navigate'){
     let tick=0, lastPos=bot.entity?.position?.clone(), heading=bot.entity?.yaw??0;
     const timer=setInterval(()=>{
       if(stopping||!bot.entity){clearInterval(timer);return;}
       const pos=bot.entity.position;
       const forward=pos.offset(-Math.sin(heading),0,-Math.cos(heading));
       const obstacle=bot.blockAt(forward.offset(0,1,0));
       const feet=bot.blockAt(forward);
       const ground=bot.blockAt(forward.offset(0,-1,0));
       const blocked=[obstacle,feet].some(b=>b&&b.boundingBox==='block');
       const moved=lastPos?Math.hypot(pos.x-lastPos.x,pos.z-lastPos.z):0;
       const action=decideNavigation({forwardBlocked:blocked,groundAhead:ground?.boundingBox==='block',displacement:moved,tick,agentIndex:Number(profile.id.slice(-3))});
       tick++;
       if(action.yawDelta)heading=(heading+action.yawDelta)%(Math.PI*2);
       bot.clearControlStates();
       bot.look(heading,0).catch(()=>{});
       bot.setControlState('forward',action.forward);
       bot.setControlState('jump',action.jump);
       log(profile.name,'navigation_action',{agent_id:profile.id,...action,heading,displacement:moved});
       lastPos=pos.clone();
     },1000);
     bot.once('end',()=>clearInterval(timer));
   }
     if(!['vision_probe','vision_learned','llm_agent','visual_online_rl','visual_random_control'].includes(process.env.CRAFTLE_BEHAVIOR))await attachRecorder(bot,profile,recordingOptions(),(name,type,data)=>log(name,type,data));
   };
   startRecorder().catch(e=>log(profile.name,'recording_error',{message:e.message}));
 });
 bot.on('health',()=>log(profile.name,'health',{health:bot.health,food:bot.food}));
 if(process.env.CRAFTLE_BEHAVIOR==='llm_agent'){
   let lastInventory='';
   const sampleInventory=()=>{
     const items=bot.inventory?.items?.().map(({name,count})=>({name,count}))??[];
     const signature=JSON.stringify(items);
     if(signature!==lastInventory){lastInventory=signature;log(profile.name,'inventory_snapshot',{agent_id:profile.id,items});}
   };
   bot.on('spawn',sampleInventory);
   bot.inventory?.on('updateSlot',sampleInventory);
   bot.on('respawn',()=>log(profile.name,'minecraft_dimension',{agent_id:profile.id,dimension:String(bot.game?.dimension??'unknown')}));
 }

 bot.on('death',()=>log(profile.name,'death'));
 bot.on('kicked',reason=>log(profile.name,'kicked',{reason:String(reason)}));
 bot.on('error',e=>log(profile.name,'error',{message:e.message}));
 bot.on('end',()=>log(profile.name,'disconnected'));
}
const shutdown=()=>{
 if(stopping)return;
 stopping=true;
 log('system','shutdown',{agents:bots.length});
 for(const bot of bots)try{bot.quit('Recording complete');}catch{}
 setTimeout(()=>{events.end();process.exit(0);},2000);
};
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);
log('system','recording_started',{agents:activeProfiles.map(a=>({id:a.id,name:a.name})),mode:'true-rendered-pov',note:'Recording smoke test; agent intelligence not yet evaluated'});
