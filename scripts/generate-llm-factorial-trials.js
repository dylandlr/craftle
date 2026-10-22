// Pre-register isolated trials: equal seeds, limits, model and objective.
// This file describes planned trials; it does not claim they were executed.
import fs from 'node:fs';
import path from 'node:path';
import {cognitionFor,describeCognition} from '../src/cognition-config.js';
const seeds=[12091,24083,36187,48109,60217];
const budget=Number(process.env.CRAFTLE_TRIAL_DECISIONS??30);
if(!Number.isInteger(budget)||budget<1||budget>1000)throw Error('Invalid decision budget');
const treatments=Array.from({length:9},(_,i)=>({
 agentId:'agent_'+String(i+1).padStart(3,'0'),
 condition:describeCognition(cognitionFor(i)),cognition:cognitionFor(i)
}));
const trials=seeds.flatMap(seed=>treatments.map(t=>({
 id:`seed_${seed}__${t.agentId}`,seed,agentId:t.agentId,condition:t.condition,
 worldMode:'isolated',worldReset:'fresh',gameMode:'survival',difficulty:'normal',
 maxDecisions:budget,model:'SAME_MODEL_REQUIRED',startingInventory:[],
 expectedOutputs:['events.jsonl','episode-report.json','server.log'],
 status:'planned',gatewayRequired:true
})));
const manifest={schemaVersion:1,experiment:'craftle_llm_cognition_factorial',
  seeds,treatments,trials,
  constraints:['A fresh world is required for each trial','Use the same model, prompt base and budget across treatments','Seed equality does not guarantee identical mob RNG','Baseline replica is a second condition, not proof of reproducibility','Hypotheses and planned trials are not verified achievements'],
  executionStatus:'not_run'};
const out=process.argv[2]??'experiments/llm-factorial-trials.v1.json';
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({trials:trials.length,seeds:seeds.length,treatments:treatments.length,output:out}));
