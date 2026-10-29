// Agent-owned episodic spatial memory. Only locally cached Mineflayer observations are indexed.
// This is NOT a minimap of the server seed, unloaded chunks, or spectator knowledge.
import fs from 'node:fs';
import path from 'node:path';

const LANDMARKS = new Set(['crafting_table','furnace','chest','barrel','bed','white_bed','bell',
  'village_bell','campfire','lava','water','oak_log','birch_log','spruce_log','jungle_log',
  'acacia_log','mangrove_log','cherry_log','dark_oak_log','copper_ore','iron_ore',
  'gold_ore','diamond_ore','emerald_ore','coal_ore','ancient_debris']);
const PREFIXES = [/^(?:.*_bed|.*_door|.*_planks|.*_ore)$/];
const cellKey=(x,z,size)=>Math.floor(x/size)+','+Math.floor(z/size);
const finite=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
const blockName=b=>typeof b?.name==='string'?b.name:null;
const safeId=s=>String(s).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,64);
export function createDiscoveryMemory({file,agentId='agent',worldId='unknown',cellSize=16,
  clock=Date.now,write=fs.writeFileSync,read=fs.readFileSync,rename=fs.renameSync,
  mkdir=fs.mkdirSync,log=()=>{}}={}){
 if(!Number.isInteger(cellSize)||cellSize<4)throw Error('Invalid cell size');
 let state={schema:'craftle.discovery-memory.v1',agentId,worldId,cellSize,cells:{},landmarks:{},totalSamples:0};
 if(file&&fs.existsSync(file)){
  try{
   const previous=JSON.parse(read(file,'utf8'));
   if(previous.schema===state.schema&&previous.agentId===agentId&&previous.worldId===worldId&&previous.cellSize===cellSize
     &&previous.cells&&previous.landmarks) state=previous;
   else log({type:'discovery_memory_scope_mismatch',file,expectedWorldId:worldId});
  }catch(e){log({type:'discovery_memory_load_error',message:e.message});}
 }
 let dirty=false,lastSave=0;
 const sample=({position,dimension='overworld',blockAt,entities=[]})=>{
  if(!finite(position)||typeof blockAt!=='function')return [];
  const now=clock(),events=[],dim=String(dimension??'unknown'),ck=dim+':'+cellKey(position.x,position.z,cellSize);
  let cell=state.cells[ck];
  if(!cell){
   cell={dimension:dim,x:Math.floor(position.x/cellSize),z:Math.floor(position.z/cellSize),
     firstSeen:now,lastSeen:now,visits:0};
   state.cells[ck]=cell;
   events.push({type:'discovery_new_cell',cellKey:ck,cell:{...cell},evidence:'agent_position'});
  }
  cell.lastSeen=now;cell.visits++;state.totalSamples++;dirty=true;
  // A sparse local observation only; unknown/unloaded blocks are never inferred.
  const x0=Math.floor(position.x),y0=Math.floor(position.y),z0=Math.floor(position.z);
  for(let dx=-6;dx<=6;dx+=2)for(let dz=-6;dz<=6;dz+=2)for(let dy=-3;dy<=3;dy++){
   const x=x0+dx,y=y0+dy,z=z0+dz;
   const b=blockAt(x,y,z),name=blockName(b);
   if(!name||!(LANDMARKS.has(name)||PREFIXES.some(rx=>rx.test(name))))continue;
   // Trees and common materials can be found frequently: remember their cell, not every log.
   const key=dim+':'+name+':'+cellKey(x,z,cellSize);
   if(state.landmarks[key])continue;
   const landmark={id:key,name,dimension:dim,position:{x,y,z},firstSeen:now,
     source:'mineflayer_local_block_cache',confidence:'observed'};
   state.landmarks[key]=landmark;dirty=true;
   events.push({type:'discovery_landmark',landmark});
  }
  for(const e of entities){
   if(!finite(e?.position)||!['villager','iron_golem'].includes(e?.name))continue;
   if(Math.hypot(e.position.x-position.x,e.position.z-position.z)>16)continue;
   const key=dim+':entity:'+e.name+':'+cellKey(e.position.x,e.position.z,cellSize);
   if(state.landmarks[key])continue;
   const landmark={id:key,name:e.name,dimension:dim,
     position:{x:e.position.x,y:e.position.y,z:e.position.z},firstSeen:now,
     source:'mineflayer_local_entity',confidence:'observed'};
   state.landmarks[key]=landmark;dirty=true;
   events.push({type:'discovery_landmark',landmark});
  }
  for(const event of events)log({...event,learned:false,memoryKind:'episodic_observation'});
  return events;
 };
 const novelty=({x,z,dimension='overworld'})=>{
  const key=String(dimension)+':'+cellKey(x,z,cellSize);
  const visits=state.cells[key]?.visits??0;
  return visits===0?5:Math.max(-5,2-Math.log2(1+visits));
 };
 const save=(force=false)=>{
  const now=clock();
  if(!file||!dirty||(!force&&now-lastSave<10000))return false;
  mkdir(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp';
  write(tmp,JSON.stringify(state));rename(tmp,file);
  dirty=false;lastSave=now;return true;
 };
 const snapshot=()=>structuredClone(state);
 return {sample,novelty,save,snapshot};
}
export function discoveryMemoryPath({root='recordings',agentId='agent'}={}){
 return path.join(root,'discoveries',safeId(agentId)+'.json');
}
