import fs from 'node:fs';import path from 'node:path';
const root=process.argv[2];if(!root)throw Error('Usage: node scripts/compare-heldout-rl.js folder');
const read=t=>JSON.parse(fs.readFileSync(path.join(root,t+'.json'),'utf8'));
const a=read('visual_frozen_eval'),b=read('visual_random_control');
if(a.policy!=='frozen_visual_q'||b.policy!=='random_rgb_control'||a.transitions<3||b.transitions<3)throw Error('Missing comparable non-LLM evaluation traces');
const hash=name=>fs.readFileSync(path.join(root,name),'utf8').trim();
const baseline=hash('checkpoint-original.sha256');
if(hash('visual_frozen_eval.checkpoint.sha256')!==baseline||hash('visual_random_control.checkpoint.sha256')!==baseline)throw Error('Evaluation unexpectedly mutated trained checkpoint');
console.log(JSON.stringify({schemaVersion:1,design:'one held-out seed, separate freshly initialized worlds; equal target duration',
 frozen:a,random:b,
 meanRewardDifference:(a.meanReward??0)-(b.meanReward??0),
 important:'ONE paired seed does not establish statistical improvement; displacement reward can be gamed; checkpoint equality rules out updates during evaluation, not procedural world variance.'},null,2));
