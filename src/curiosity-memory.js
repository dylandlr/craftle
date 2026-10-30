// Curiosity observation journal. Unknown means unfamiliar to THIS agent, not a claim
// about Minecraft semantics. No block drops, recipe tables, server seed, or LLM labels.
import fs from 'node:fs';
import path from 'node:path';
const key=(kind,name)=>kind+':'+name;
export function createCuriosityMemory({file,worldId='unknown',agentId='agent',clock=Date.now,log=()=>{}}={}){
 let state={schema:'craftle.curiosity.v1',worldId,agentId,concepts:{},encounters:0};
 if(file&&fs.existsSync(file)){
  try{const s=JSON.parse(fs.readFileSync(file,'utf8'));if(s.schema===state.schema&&s.worldId===worldId&&s.agentId===agentId)state=s;
   else log({type:'curiosity_scope_mismatch'});}
  catch(e){log({type:'curiosity_load_error',message:e.message});}
 }
 let dirty=false,lastSave=0;
 function observe({position,dimension='overworld',blocks=[],entities=[]}){
  const events=[],now=clock();
  const items=[...blocks.map(b=>({kind:'block',name:b?.name,position:b?.position})),
   ...entities.map(e=>({kind:'entity',name:e?.name,position:e?.position}))];
  const once=new Set();
  for(const item of items){
   if(typeof item.name!=='string'||!item.name||item.name==='air'||item.name==='cave_air')continue;
   const id=key(item.kind,item.name);
   if(once.has(id))continue;once.add(id);
   let concept=state.concepts[id];
   if(!concept){
    concept={kind:item.kind,name:item.name,firstSeen:now,lastSeen:now,encounters:0,
      inspected:0,outcomes:[],firstLocation:position&&{x:position.x,y:position.y,z:position.z},
      dimension,knowledge:'uninvestigated'};
    state.concepts[id]=concept;
    events.push({type:'curiosity_new_concept',conceptId:id,kind:item.kind,name:item.name,
     location:concept.firstLocation,dimension,learned:false});
   }
   concept.encounters++;concept.lastSeen=now;state.encounters++;dirty=true;
  }
  for(const e of events)log(e);
  return events;
 }
 function recordOutcome({kind,name,action,outcome,position}){
  const id=key(kind,name),c=state.concepts[id];if(!c)return false;
  if(typeof action!=='string'||typeof outcome!=='string')return false;
  c.inspected++;c.knowledge='tested';
  c.outcomes.push({action,outcome,at:clock(),position});if(c.outcomes.length>32)c.outcomes.shift();
  dirty=true;log({type:'curiosity_experiment_result',conceptId:id,action,outcome,learned:false});
  return true;
 }
 function novelty(kind,name){const c=state.concepts[key(kind,name)];return c?1/Math.sqrt(1+c.encounters):1;}
 function save(force=false){if(!file||!dirty||(!force&&clock()-lastSave<15000))return false;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',JSON.stringify(state));fs.renameSync(file+'.tmp',file);dirty=false;lastSave=clock();return true;}
 return {observe,recordOutcome,novelty,save,snapshot:()=>structuredClone(state)};
}
