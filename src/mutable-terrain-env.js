// Deterministic small-world motor experiment. Physics is intentionally simple.
// No bridge, staircase, ladder, dig-down or other human-authored solution macro.
// This is NOT Minecraft physics or an authoritative Minecraft experiment.
import {enumerateMotorAffordances} from './motor-affordances.js';
const AIR='air',STONE='stone',DIRT='dirt';
const key=(x,y,z)=>[x,y,z].join(',');
const solid=b=>b&&b.name!==AIR;
const block=name=>({name,boundingBox:name===AIR?'empty':'block'});
export function createMutableTerrain({seed=1,platformHeight=5,span=6,
 initialBlocks=5,maxSteps=120,layout='isolated'}={}){
 if(!Number.isInteger(platformHeight)||platformHeight<2||platformHeight>16||
  !Number.isInteger(span)||span<3||span>16||!Number.isInteger(initialBlocks)||
  initialBlocks<0||initialBlocks>64)throw Error('Invalid terrain setup');
 const world=new Map();
 const set=(x,y,z,name)=>{const k=key(x,y,z);if(name===AIR)world.delete(k);else world.set(k,name);};
 // Flat immutable bedrock level, a reachable ground surface outside a gap,
 // and a starting platform with no hand-authored escape arrangement.
 for(let x=-span*2;x<=span*2;x++)for(let z=-2;z<=2;z++)set(x,0,z,STONE);
 for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)set(x,platformHeight-1,z,DIRT);
 if(layout==='terraces'){
  for(let x=2;x<span;x++)for(let z=-1;z<=1;z++)set(x,Math.max(1,platformHeight-1-Math.floor(x/2)),z,STONE);
 }else if(layout!=='isolated')throw Error('Unknown world layout');
 let position={x:0,y:platformHeight,z:0},health=20,inventory=initialBlocks,
  steps=0,done=false;
 const blockAt=(x,y,z)=>block(world.get(key(x,y,z))??AIR);
 const falling=()=>{
  let d=0;
  while(position.y>1&&!solid(blockAt(position.x,position.y-1,position.z))){
   position={...position,y:position.y-1};d++;
  }
  const damage=Math.max(0,d-3);
  health=Math.max(0,health-damage);
  return {fall:d,damage};
 };
 const snapshot=()=>({position:{...position},health,food:20,
  inventory:[{name:DIRT,count:inventory,placeable:true}].filter(i=>i.count),
  worldBlocks:world.size,steps,done});
 const possible=(id)=>position.x===id.x&&position.y===id.y&&position.z===id.z;
 const reachable=pos=>Math.max(Math.abs(pos.x-position.x),Math.abs(pos.y-position.y),
  Math.abs(pos.z-position.z))<=1;
 const observe=()=>({...snapshot(),blockAt,
  observableOrigin:{...position},stalls:0});
 const affordances=(executors={move:()=>{},dig:()=>{},place:()=>{},wait:()=>{}})=>{
  const o=observe(),raw=enumerateMotorAffordances({
   position:o.position,blockAt:(x,y,z)=>Math.abs(x-o.position.x)<=4&&
   Math.abs(y-o.position.y)<=3&&Math.abs(z-o.position.z)<=4?blockAt(x,y,z):null,
   inventory:o.inventory,executors,maxReach:1.8});
  // Concrete legal movement and edits only. No goal-conditioned action selection.
  const operations=new Set(['move','dig','place','wait']);
  return raw.candidates.filter(c=>{
   if(!operations.has(c.operation)||!c.executable)return false;
   if(c.operation==='move')return c.arguments.dy===0&&
      Math.abs(c.arguments.dx)+Math.abs(c.arguments.dz)===1;
   if(c.operation==='dig')return c.arguments.position.y>=1&&
      reachable(c.arguments.position);
   if(c.operation==='place')return inventory>0&&
      reachable(c.evidence.destination);
   return true;
  });
 };
 const act=candidate=>{
  if(done)return {ok:false,reason:'terminal'};
  if(!candidate||!candidate.executable)return {ok:false,reason:'unavailable'};
  steps++;
  const before={...position},beforeHealth=health;
  let ok=false,reason='invalid_action',change=null;
  const a=candidate.arguments??{};
  if(candidate.operation==='move'){
   const nx=position.x+a.dx,ny=position.y,nz=position.z+a.dz;
   if(Math.abs(a.dx)+Math.abs(a.dz)===1&&a.dy===0&&
      !solid(blockAt(nx,ny,nz))&&!solid(blockAt(nx,ny+1,nz))){
    position={x:nx,y:ny,z:nz};ok=true;reason='moved';
   }else reason='blocked';
  }else if(candidate.operation==='dig'){
   const q=a.position;
   if(q&&reachable(q)&&q.y>=1&&solid(blockAt(q.x,q.y,q.z))){
    change={x:q.x,y:q.y,z:q.z,before:blockAt(q.x,q.y,q.z).name,after:AIR};
    set(q.x,q.y,q.z,AIR);ok=true;reason='block_changed';
   }else reason='unreachable_or_air';
  }else if(candidate.operation==='place'){
   const q=candidate.evidence?.destination,r=a.reference;
   if(inventory>0&&a.itemName===DIRT&&q&&r&&reachable(q)&&reachable(r)&&
      solid(blockAt(r.x,r.y,r.z))&&!solid(blockAt(q.x,q.y,q.z))){
    change={x:q.x,y:q.y,z:q.z,before:AIR,after:DIRT};
    set(q.x,q.y,q.z,DIRT);inventory--;ok=true;reason='block_changed';
   }else reason='invalid_placement';
  }else if(candidate.operation==='wait'){ok=true;reason='waited';}
  const physics=falling();
  const reachedLowerGround=position.y<=1&&Math.abs(position.x)>=span;
  done=health<=0||reachedLowerGround||steps>=maxSteps;
  // Outcome reward only: progress is measured vertically and terminal goal.
  // No reward for dig/place or a specific construction geometry.
  const reward=(reachedLowerGround?12:0)-physics.damage*3-0.02+(ok?0:-0.15);
  return {ok,reason,action:candidate.operation,change,before,
   after:{...position},healthBefore:beforeHealth,healthAfter:health,
   ...physics,reachedLowerGround,done,reward};
 };
 return {schema:'craftle.mutable-terrain.v1',observe,affordances,act,snapshot,
  blockAt,world,layout,seed,
  limits:['Discrete block positions, no Mineflayer movement or Minecraft physics.',
   'No entity, hunger, fluid simulation, crafting or tool durability.',
   'A successful benchmark does not establish live Minecraft mastery.']};
}
