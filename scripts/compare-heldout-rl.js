import fs from 'node:fs';import path from 'node:path';
const root=process.argv[2];if(!root)throw Error('Usage: node scripts/compare-heldout-rl.js folder');
const read=t=>JSON.parse(fs.readFileSync(path.join(root,t+'.json'),'utf8'));
const a=read('visual_frozen_eval'),b=read('visual_random_control');
if(a.policy!=='frozen_visual_q'||b.policy!=='random_rgb_control'||a.transitions<30||b.transitions<30)throw Error('Missing comparable non-LLM evaluation traces');
const validateTrace=(name,report)=>{
 const lines=fs.readFileSync(path.join(root,name+'.log'),'utf8').split(/\r?\n/);
 const events=lines.flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}});
 const actions=events.filter(e=>e.type==='rl_action'),transitions=events.filter(e=>e.type==='rl_transition');
 if(actions.length!==report.actions||transitions.length!==report.transitions)throw Error('Log/report count mismatch: '+name);
 if(actions.length<30)throw Error('Insufficient actions: '+name);
 if(events.some(e=>e.type==='rl_error'))throw Error('RL runtime errors detected: '+name);
 if(transitions.some(e=>!Number.isFinite(e.reward)||!Number.isFinite(e.displacement)||e.displacement<0))throw Error('Invalid reward or movement: '+name);
 if(actions.some(e=>e.actionDurationMs!==350||e.frameId==null))throw Error('Inconsistent action duration or missing frame: '+name);
 const ids=actions.map(e=>Number(e.frameId));
 if(ids.every(Number.isFinite)&&ids.some((n,i)=>i>0&&n<=ids[i-1]))throw Error('Non-increasing frame IDs: '+name);
 return {loggedActions:actions.length,loggedTransitions:transitions.length,rlErrors:0};
};
const audit={frozen:validateTrace('visual_frozen_eval',a),random:validateTrace('visual_random_control',b)};
const hash=name=>fs.readFileSync(path.join(root,name),'utf8').trim();
const baseline=hash('checkpoint-original.sha256');
if(hash('visual_frozen_eval.checkpoint.sha256')!==baseline||hash('visual_random_control.checkpoint.sha256')!==baseline)throw Error('Evaluation unexpectedly mutated trained checkpoint');
const diagnostic=report=>{
 const counts=Object.values(report.actionsByType??{});
 const total=counts.reduce((a,b)=>a+b,0);
 const largest=counts.length?Math.max(...counts):0;
 const probs=counts.filter(x=>x>0).map(x=>x/total);
 return {dominantActionFraction:total?largest/total:null,actionEntropyBits:probs.length?-probs.reduce((a,p)=>a+p*Math.log2(p),0):null};
};
console.log(JSON.stringify({schemaVersion:3,audit,diagnostics:{frozen:diagnostic(a),random:diagnostic(b)},design:'one held-out seed, separate freshly initialized worlds; equal target duration',
 frozen:a,random:b,
 meanRewardDifference:(a.meanReward??0)-(b.meanReward??0),
 validity:'Exploratory matched-seed proxy-reward comparison only; no controlled spawn equivalence, observation latency bound, confidence interval or independent task-completion metric',
 important:'ONE paired seed does not establish statistical improvement; displacement reward can be gamed; checkpoint equality rules out updates during evaluation, not procedural world variance.'},null,2));
