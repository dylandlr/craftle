// Isolated-world factorial executor: one trial per fresh Minecraft container.
// Default dry-run; live execution is opt-in and requires a configured model endpoint.
// Usage: node scripts/run-isolated-trial.js --manifest path --trial seed_12091__agent_001 [--execute]
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const args=process.argv.slice(2);
const opt=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const manifestPath=opt('--manifest')??'experiments/llm-factorial-trials.v1.json';
const trialId=opt('--trial');
const execute=args.includes('--execute');
if(!trialId)throw Error('Provide --trial ID');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const trial=manifest.trials.find(t=>t.id===trialId);
if(!trial||trial.worldMode!=='isolated'||trial.worldReset!=='fresh')throw Error('Invalid isolated trial');
if(!/^seed_[0-9]+__agent_[0-9]{3}$/.test(trialId))throw Error('Invalid trial ID');
const output=path.resolve('recordings/factorial',trial.id);
if(fs.existsSync(output))throw Error('Trial output already exists; refusing overwrite: '+output);
const model=process.env.CRAFTLE_LLM_MODEL;
const plan={trialId,seed:trial.seed,agentId:trial.agentId,condition:trial.condition,
 dockerName:'craftle-'+trial.id.replaceAll('_','-'),
 output,decisionBudget:trial.maxDecisions,model:model??'NOT_CONFIGURED',
 execute,runner:'fresh_docker_world'};
if(!execute){console.log(JSON.stringify(plan,null,2));process.exit(0);}
if(!model||!process.env.CRAFTLE_LLM_API_KEY)throw Error('Live trial requires model and gateway key');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'trial.json'),JSON.stringify({...plan,status:'started',startedAt:new Date().toISOString()},null,2));
async function run(command,argv,{env=process.env,timeoutMs=120000,logFile}={}){
 const child=spawn(command,argv,{env,stdio:['ignore','pipe','pipe']});
 const chunks=[];child.stdout.on('data',x=>chunks.push(x));child.stderr.on('data',x=>chunks.push(x));
 let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},timeoutMs);
 const result=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));}).finally(()=>clearTimeout(timeout));
 const outputText=Buffer.concat(chunks).toString('utf8');
 if(logFile)fs.writeFileSync(logFile,outputText);
 return {...result,timedOut,outputText};
}
const docker=plan.dockerName;
try{
 const start=await run('docker',['run','-d','--name',docker,'-p','25565:25565','-e','EULA=TRUE','-e','ONLINE_MODE=FALSE','-e','MAX_PLAYERS=2','-e','MEMORY=2G','-e','TYPE=PAPER','-e','VERSION=1.21.1','-e','SEED='+String(trial.seed),'itzg/minecraft-server:java21'],{timeoutMs:180000});
 if(start.code!==0)throw Error('Docker world failed to start: '+start.outputText.slice(-300));
 let ready=false;
 for(let i=0;i<120;i++){
   const logs=await run('docker',['logs',docker],{timeoutMs:15000});
   if(logs.outputText.includes('For help, type "help"')){ready=true;break;}
   await new Promise(resolve=>setTimeout(resolve,2500));
 }
 if(!ready)throw Error('Fresh world did not become ready');
 const env={...process.env,CRAFTLE_AGENT_IDS:trial.agentId,CRAFTLE_BEHAVIOR:'llm_agent',CRAFTLE_LLM_MAX_STEPS:String(trial.maxDecisions),
  CRAFTLE_LLM_MEMORY_FILE:path.join(output,'memory.json'),CRAFTLE_CAPTURE_TELEMETRY:'1'};
 const result=await run('xvfb-run',['-a','node','src/main.js'],{env,timeoutMs:Math.max(120000,trial.maxDecisions*25000),logFile:path.join(output,'agent.log')});
 const report=await run('node',['scripts/report-llm-episode.js',path.join(output,'agent.log')],{logFile:path.join(output,'episode-report.json')});
 if(report.code!==0)throw Error('Episode report failed');
 const parsed=JSON.parse(report.outputText);
 const final={...plan,status:parsed.appliedActions>0?'completed':'no_actions',finishedAt:new Date().toISOString(),timedOut:result.timedOut,
   agentExitCode:result.code,appliedActions:parsed.appliedActions};
 fs.writeFileSync(path.join(output,'trial.json'),JSON.stringify(final,null,2));
 console.log(JSON.stringify(final,null,2));
 if(final.status!=='completed')process.exitCode=1;
}catch(error){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:error.message,at:new Date().toISOString()},null,2));console.error(error.message);process.exitCode=1;}
finally{
 const logs=await run('docker',['logs',docker],{timeoutMs:15000}).catch(()=>({outputText:''}));
 fs.writeFileSync(path.join(output,'server.log'),logs.outputText);
 await run('docker',['rm','-f',docker],{timeoutMs:20000}).catch(()=>{});
}
