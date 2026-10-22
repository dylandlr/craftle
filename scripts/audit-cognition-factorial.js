// Offline ablation contract audit: this verifies the experimental manipulation,
// not Minecraft success or the cognitive benefit of any feature.
import fs from 'node:fs';
import path from 'node:path';
import {createLlmAgent} from '../src/llm-agent.js';
import {cognitionFor,describeCognition} from '../src/cognition-config.js';
import {makeVisualObservation} from '../src/vision-observation.js';
const frame=makeVisualObservation({rgb:new Uint8Array(32*32*3).fill(110),width:32,height:32,frameId:1,capturedAt:'2026-10-22T00:00:00.000Z'});
const results=[];
for(let index=0;index<9;index++){
 const cognition=cognitionFor(index);
 let captured;
 const agent=createLlmAgent({cognition,maxSteps:1,infer:async input=>{
   captured=input;
   return JSON.stringify({goal:'observe',belief:'Uncertain terrain',plan:'look around',action:'look_left',target:null,memory:'Terrain appearance uncertain'});
 }});
 const decision=await agent.decide(frame,{health:20,hunger:20,position:{x:24,z:16},inventory:[]});
 const row={agentId:'agent_'+String(index+1).padStart(3,'0'),treatment:describeCognition(cognition),cognition,
   decision:decision.action,hasMainImage:captured.observation.jpeg.subarray(0,2).equals(Buffer.from([255,216])),
   hasFovealImage:Boolean(captured.observation.fovealJpeg),
   hasVisitGrid:captured.observation.text.includes('Egocentric exploration grid'),
   hasHypothesisRecall:captured.observation.text.includes('Unverified hypotheses recalled'),
   inputsMatchFlags: Boolean(captured.observation.fovealJpeg)===cognition.foveatedVision&&
     captured.observation.text.includes('Egocentric exploration grid')===cognition.cognitiveMap&&
     captured.observation.text.includes('Unverified hypotheses recalled')===cognition.knowledgeGraph};
 results.push(row);
}
const baselinesEqual=JSON.stringify(results[0].cognition)===JSON.stringify(results[8].cognition);
const pass=results.every(r=>r.inputsMatchFlags&&r.hasMainImage)&&baselinesEqual;
const report={schemaVersion:1,kind:'offline_mock_contract_audit',pass,baselinesEqual,rows:results,
 note:'Mock outputs do not demonstrate autonomy, Minecraft exploration, or factual knowledge-graph construction.'};
const output=process.argv[2];
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
if(!pass)process.exitCode=1;
