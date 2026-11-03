// Grounded, local-only canopy egress route search. No spectator data, teleport, digging or unknown-block guesses.
// Separately labeled assisted movement; the DQN still chooses the high-level skill.
const directions=[[1,0],[-1,0],[0,1],[0,-1]];
const hazards=new Set(['lava','flowing_lava','fire','soul_fire','magma_block','cactus','campfire','soul_campfire','powder_snow']);
const key=p=>[p.x,p.y,p.z].join(',');
const isEmpty=b=>b?.boundingBox==='empty'&&!hazards.has(b.name);
const isSolid=b=>b?.boundingBox==='block'&&!hazards.has(b.name);
export function planCanopyGroundRoute({origin,blockAt,health=20,radius=24,maxNodes=900,maxWaypoints=5,avoid=new Set()}={}){
 if(!origin||typeof blockAt!=='function')return {reason:'missing_local_observation',selected:null,route:[],examined:0};
 const o={x:Math.floor(origin.x),y:Math.floor(origin.y),z:Math.floor(origin.z)};
 const cache=new Map();
 const at=(x,y,z)=>{const k=`${x},${y},${z}`;if(!cache.has(k))cache.set(k,blockAt(x,y,z));return cache.get(k);};
 const inspect=(x,y,z)=>{
  const floor=at(x,y-1,z),feet=at(x,y,z),head=at(x,y+1,z);
  if(!isSolid(floor)||!isEmpty(feet)||!isEmpty(head))return null;
  return {x,y,z,leaves:floor.name.includes('leaves'),ground:floor.name};
 };
 const start=inspect(o.x,o.y,o.z);
 if(!start)return {reason:'no_known_start_footing',selected:null,route:[],examined:0};
 if(!start.leaves)return {reason:'already_on_nonleaf_ground',selected:null,route:[],examined:0};
 // A verified five-block fall normally costs about two health points.
 // Require a substantial reserve; low-health recovery remains conservative.
 const maxDrop=Number.isFinite(health)&&health>=14?5:Number.isFinite(health)&&health>=8?3:1;
 const rejections={unknownFooting:0,unknownClearance:0,blockedFooting:0,blockedClearance:0,
  unsafeFooting:0,shaftBlocked:0,avoided:0,outOfRadius:0};
 const lowerGroundSamples=[];
 const nodes=[{...start,parent:-1,steps:0}];
 const seen=new Set([key(start)]);
 let found=-1,examined=0;
 for(let i=0;i<nodes.length&&i<maxNodes;i++){
  const node=nodes[i];examined++;
  if(!node.leaves&&i!==0){found=i;break;}
  for(const [dx,dz] of directions){
   const x=node.x+dx,z=node.z+dz;
   if(Math.max(Math.abs(x-o.x),Math.abs(z-o.z))>radius){rejections.outOfRadius++;continue;}
   for(const dy of [0,1,...Array.from({length:maxDrop},(_,j)=>-1-j)]){
    const y=node.y+dy,k=`${x},${y},${z}`;
    if(seen.has(k))continue;
    if(avoid.has(k)){rejections.avoided++;continue;}
    const target=inspect(x,y,z);
    if(!target){
     const footing=at(x,y-1,z),feet=at(x,y,z),head=at(x,y+1,z);
     if(!footing)rejections.unknownFooting++;
     else if(!isSolid(footing))rejections[hazards.has(footing.name)?'unsafeFooting':'blockedFooting']++;
     else if(!feet||!head)rejections.unknownClearance++;
     else rejections.blockedClearance++;
     continue;
    }
    // Verify every block in the landing shaft before stepping onto lower terrain.
    if(dy<0){
     let shaftClear=true;
     for(let h=node.y;h>y;h--)if(!isEmpty(at(x,h,z))){shaftClear=false;break;}
     if(!shaftClear){rejections.shaftBlocked++;continue;}
    }
    if(dy===1&&!isEmpty(at(node.x,node.y+2,node.z)))continue;
    seen.add(k);nodes.push({...target,parent:i,steps:node.steps+1});
    // Check all feasible elevations at the neighboring XZ cell.
    // The first walkable height need not be the only navigable height.
   }
  }
 }
 if(found<0){
  // Inspect a small *read-only* vertical column below each reachable edge.
  // Never turn these observations into a blind fall destination.
  const unique=new Set();
  for(const node of nodes){
   for(const [dx,dz] of directions){
    const x=node.x+dx,z=node.z+dz,k=x+','+z;
    if(unique.has(k))continue;unique.add(k);
    for(let drop=2;drop<=12;drop++){
     const floor=at(x,node.y-drop-1,z);
     if(!floor)break;
     if(isSolid(floor)&&!floor.name.includes('leaves')){
      lowerGroundSamples.push({x,y:node.y-drop,z,ground:floor.name,
       drop,feetClear:isEmpty(at(x,node.y-drop,z)),headClear:isEmpty(at(x,node.y-drop+1,z))});
      break;
     }
    }
   }
  }
  lowerGroundSamples.sort((a,b)=>a.drop-b.drop);
  return {reason:'no_verified_ground_route',selected:null,route:[],examined,
   frontierNodes:nodes.length,maxDrop,rejections,
   footprint:{minX:Math.min(...nodes.map(n=>n.x)),maxX:Math.max(...nodes.map(n=>n.x)),
    minY:Math.min(...nodes.map(n=>n.y)),maxY:Math.max(...nodes.map(n=>n.y)),
    minZ:Math.min(...nodes.map(n=>n.z)),maxZ:Math.max(...nodes.map(n=>n.z))},
   lowerGroundSamples:lowerGroundSamples.slice(0,8)};
 }

 const route=[];for(let i=found;i>=0;i=nodes[i].parent){const n=nodes[i];route.push({x:n.x,y:n.y,z:n.z,ground:n.ground,leaves:n.leaves});if(n.parent===-1)break;}
 route.reverse();
 // A close waypoint can be handed to native pathfinder without losing the intended egress.
 const waypointIndex=Math.min(route.length-1,Math.max(1,maxWaypoints));
 const selected=route[waypointIndex];
 return {reason:'verified_connected_ground_route',selected:{position:{x:selected.x,y:selected.y,z:selected.z},leaves:selected.leaves,ground:selected.ground},
  route,examined,routeSteps:route.length-1,waypointIndex,maxDrop};
}
