import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import {LLM_ACTIONS} from './llm-tools.js';
import {createCognition} from './llm-cognition.js';
const SYSTEM=`You are a Minecraft agent. Observe only the supplied first-person camera image and personal health/hunger. No world map, wiki or privileged blocks. You can form your own goals, maintain beliefs, plan, act and reflect. Explore and learn. Respond ONLY with JSON of this form: {"goal":"short goal","belief":"uncertain observation","plan":"next step","action":"forward","target":null,"memory":"lesson learned"}.
Allowed actions: ${LLM_ACTIONS.join(', ')}. For equip or craft, specify target as a Minecraft item name (e.g. oak_planks) based on your own hypotheses; failures provide feedback. Other actions use null target. Keep memory concise. Never claim to have seen something not visible. Think in short steps. You are not given a Minecraft walkthrough.`;
export function parseAgentDecision(response){
 let parsed;
 try{parsed=JSON.parse(response.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('Invalid agent JSON decision');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!LLM_ACTIONS.includes(parsed.action))throw Error('Invalid agent action');
 if(['equip','craft'].includes(parsed.action)&&!(typeof parsed.target==='string'&&/^[a-z0-9_]{1,64}$/.test(parsed.target)))throw Error('Item action requires valid target');
 for(const field of ['goal','belief','plan','memory'])if(typeof parsed[field]!=='string'||parsed[field].length>500)throw Error('Invalid agent field '+field);
 return Object.freeze({action:parsed.action,target:['equip','craft'].includes(parsed.action)?parsed.target:null,goal:parsed.goal,belief:parsed.belief,plan:parsed.plan,memory:parsed.memory});
}
export function createLlmAgent({infer,memoryFile,maxSteps=100,cognition={foveatedVision:false,cognitiveMap:false,knowledgeGraph:false},log=()=>{}}){
 if(typeof infer!=='function')throw Error('infer callback required');
 let steps=0,history=[],memories=[];
 const cognitive=createCognition({cognition});
 if(memoryFile&&fs.existsSync(memoryFile)){
   const stored=JSON.parse(fs.readFileSync(memoryFile,'utf8'));
   if(Array.isArray(stored.memories))memories=stored.memories.filter(x=>typeof x==='string').slice(-20);
 }
 return {
   async decide(frame,{health=null,hunger=null,inventory=[],position=null,lastOutcome=null,lifeFeedback=null}={}){
     if(steps>=maxSteps)throw Error('Decision budget exhausted');
     if(!frame||frame.source!=='first_person_rgb'||frame.rgb.length!==frame.width*frame.height*3)throw Error('Actual RGB frame required');
     const rgba=Buffer.alloc(frame.width*frame.height*4);
     for(let i=0,j=0;i<frame.rgb.length;i+=3,j+=4){rgba[j]=frame.rgb[i];rgba[j+1]=frame.rgb[i+1];rgba[j+2]=frame.rgb[i+2];rgba[j+3]=255;}
     const jpegBuffer=jpeg.encode({data:rgba,width:frame.width,height:frame.height},75).data;
     const cognitiveContext=cognitive.observe({position});
     const fovealJpeg=cognitive.fovealImage(frame);
     const context=`Frame ${frame.frameId}. Recent Minecraft chat/system text and death/respawn history (server-provided, may be incomplete or misleading): ${lifeFeedback?JSON.stringify(lifeFeedback).slice(-1400):'none'}. Self status: health=${health??'unknown'}, hunger=${hunger??'unknown'}, inventory=${JSON.stringify(inventory).slice(0,450)}. Previous action outcome: ${lastOutcome?JSON.stringify(lastOutcome).slice(0,400):'none'}. Known lessons: ${memories.slice(-8).join(' | ')||'none'}. ${cognitiveContext} ${fovealJpeg?'Second image is a central crop of the same frame.':''}`;
     const raw=await infer({system:SYSTEM,observation:{text:context,jpeg:jpegBuffer,fovealJpeg},history});
     const decision=parseAgentDecision(raw);
     cognitive.reflect(decision);
     steps++;
     history=[...history,{role:'assistant',content:JSON.stringify({goal:decision.goal,action:decision.action,target:decision.target})}].slice(-6);
     if(decision.memory.trim()&&!memories.includes(decision.memory))memories.push(decision.memory);
     memories=memories.slice(-20);
     if(memoryFile){fs.mkdirSync(path.dirname(memoryFile),{recursive:true});fs.writeFileSync(memoryFile,JSON.stringify({version:1,steps,memories},null,2));}
     log({type:'llm_decision',frameId:frame.frameId,action:decision.action,target:decision.target,goal:decision.goal,belief:decision.belief,plan:decision.plan,memory:decision.memory,steps});
     return decision;
   },
   getState:()=>({steps,memories:[...memories],cognition:cognitive.summary()})
 };
}
