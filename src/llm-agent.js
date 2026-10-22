import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import {LLM_ACTIONS} from './llm-tools.js';
const SYSTEM=`You are a Minecraft agent. Observe only the supplied first-person camera image and personal health/hunger. No world map, wiki or privileged blocks. You can form your own goals, maintain beliefs, plan, act and reflect. Explore and learn. Respond ONLY with JSON of this form: {"goal":"short goal","belief":"uncertain observation","plan":"next step","action":"forward","memory":"lesson learned"}.
Allowed actions: ${LLM_ACTIONS.join(', ')}. Keep memory concise. Never claim to have seen something not visible. Think in short steps. You are not given a Minecraft walkthrough.`;
export function parseAgentDecision(response){
 let parsed;
 try{parsed=JSON.parse(response.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('Invalid agent JSON decision');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!LLM_ACTIONS.includes(parsed.action))throw Error('Invalid agent action');
 for(const field of ['goal','belief','plan','memory'])if(typeof parsed[field]!=='string'||parsed[field].length>500)throw Error('Invalid agent field '+field);
 return Object.freeze({action:parsed.action,goal:parsed.goal,belief:parsed.belief,plan:parsed.plan,memory:parsed.memory});
}
export function createLlmAgent({infer,memoryFile,maxSteps=100,log=()=>{}}){
 if(typeof infer!=='function')throw Error('infer callback required');
 let steps=0,history=[],memories=[];
 if(memoryFile&&fs.existsSync(memoryFile)){
   const stored=JSON.parse(fs.readFileSync(memoryFile,'utf8'));
   if(Array.isArray(stored.memories))memories=stored.memories.filter(x=>typeof x==='string').slice(-20);
 }
 return {
   async decide(frame,{health=null,hunger=null}={}){
     if(steps>=maxSteps)throw Error('Decision budget exhausted');
     if(!frame||frame.source!=='first_person_rgb'||frame.rgb.length!==frame.width*frame.height*3)throw Error('Actual RGB frame required');
     const rgba=Buffer.alloc(frame.width*frame.height*4);
     for(let i=0,j=0;i<frame.rgb.length;i+=3,j+=4){rgba[j]=frame.rgb[i];rgba[j+1]=frame.rgb[i+1];rgba[j+2]=frame.rgb[i+2];rgba[j+3]=255;}
     const jpegBuffer=jpeg.encode({data:rgba,width:frame.width,height:frame.height},75).data;
     const context=`Frame ${frame.frameId}. Self status: health=${health??'unknown'}, hunger=${hunger??'unknown'}. Known lessons: ${memories.slice(-8).join(' | ')||'none'}.`;
     const raw=await infer({system:SYSTEM,observation:{text:context,jpeg:jpegBuffer},history});
     const decision=parseAgentDecision(raw);
     steps++;
     history=[...history,{role:'assistant',content:JSON.stringify({goal:decision.goal,action:decision.action})}].slice(-6);
     if(decision.memory.trim()&&!memories.includes(decision.memory))memories.push(decision.memory);
     memories=memories.slice(-20);
     if(memoryFile){fs.mkdirSync(path.dirname(memoryFile),{recursive:true});fs.writeFileSync(memoryFile,JSON.stringify({version:1,steps,memories},null,2));}
     log({type:'llm_decision',frameId:frame.frameId,action:decision.action,goal:decision.goal,belief:decision.belief,plan:decision.plan,memory:decision.memory,steps});
     return decision;
   },
   getState:()=>({steps,memories:[...memories]})
 };
}
