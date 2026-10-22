import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=process.argv[2];if(!root)throw Error('Usage: node scripts/compare-heldout-rl.js folder');
const read=t=>JSON.parse(fs.readFileSync(path.join(root,t+'.json'),'utf8'));
const a=read('visual_frozen_eval'),b=read('visual_random_control');
if(a.policy!=='frozen_visual_q'||b.policy!=='random_rgb_control'||a.transitions<3||b.transitions<3)throw Error('Missing comparable non-LLM evaluation traces');
const ckpt=t=>fs.readFileSync(path.join(root,t+'.checkpoint.json'));
if(createHash('sha256').update(ckpt('visual_frozen_eval')).digest('hex')!==createHash('sha256').update(ckpt('visual_random_control')).digest('hex'))throw Error('Evaluation unexpectedly mutated trained checkpoint');
console.log(JSON.stringify({schemaVersion:1,design:'one held-out seed, separate freshly initialized worlds; equal target duration',
 frozen:a,random:b,
 meanRewardDifference:(a.meanReward??0)-(b.meanReward??0),
 important:'ONE paired seed does not establish statistical improvement; displacement reward can be gamed; checkpoint equality rules out updates during evaluation, not procedural world variance.'},null,2));
