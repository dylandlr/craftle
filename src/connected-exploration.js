// Optional non-learning navigation control: bounded locally loaded blocks only.
// It cannot infer unseen terrain, mine, build, teleport, or select the DQN's skill.
const K=(x,y,z)=>x+','+y+','+z;
const directions=[[1,0],[-1,0],[0,1],[0,-1]];
export function chooseConnectedExploreGoal({origin,blockAt,radius=9,maxNodes=220,avoid=new Set()}){
 const o={x:Math.floor(origin.x),y:Math.floor(origin.y),z:Math.floor(origin.z)};
 const inspect=(x,y,z)=>{
  const ground=blockAt(x,y-1,z),feet=blockAt(x,y,z),head=blockAt(x,y+1,z);
  if(!ground||!feet||!head)return null;
  if(ground.boundingBox!=='block'||feet.boundingBox!=='empty'||head.boundingBox!=='empty')return null;
  if(['lava','magma_block','cactus','campfire','soul_campfire'].includes(ground.name))return null;
  return {x,y,z,leaves:ground.name?.includes('leaves')??false,footing:ground.name};
 };
 const start=inspect(o.x,o.y,o.z);
 if(!start)return {selected:null,reason:'no_known_start_footing',examined:0};
 const nodes=[{...start,cost:0,steps:0}],seen=new Set([K(o.x,o.y,o.z)]);
 let best=null,examined=0;
 for(let i=0;i<nodes.length&&i<maxNodes;i++){
  const n=nodes[i];examined++;
  if(n.steps>=2&&!n.leaves&&!avoid.has(K(n.x,n.y,n.z))){
   // Favor stable ground and discovery distance, penalize leaf paths and vertical climbs.
   const netDistance=Math.hypot(n.x-o.x,n.z-o.z);
   const score=netDistance*1.2-n.cost*.23;
   if(!best||score>best.score)best={position:{x:n.x,y:n.y,z:n.z},score,ground:n.footing,leaves:n.leaves,steps:n.steps};
  }
  for(const [dx,dz] of directions){
   const x=n.x+dx,z=n.z+dz;
   if(Math.max(Math.abs(x-o.x),Math.abs(z-o.z))>radius)continue;
   // Minecraft step-up <=1, descent <=1; never use unknown ground or unsupported air.
   for(const dy of [0,1,-1]){
    const y=n.y+dy,key=K(x,y,z);
    if(seen.has(key)||avoid.has(key))continue;
    const candidate=inspect(x,y,z);
    if(!candidate)continue;
    // Leaves are traversable only when starting stranded on them; do not climb onto new canopy footing.
    if(candidate.leaves&&!(start.leaves&&n.leaves))continue;
    // Blocked at eye level between cells when moving uphill.
    if(dy===1){
     const clearance=blockAt(n.x,n.y+2,n.z);
     if(!clearance||clearance.boundingBox!=='empty')continue;
    }
    seen.add(key);
    nodes.push({...candidate,steps:n.steps+1,cost:n.cost+1+(candidate.leaves?3:0)+(dy!==0?.4:0)});
    break;
   }
  }
 }
 return {selected:best,reason:best?'known_connected_footing':'no_known_connected_route',examined};
}
