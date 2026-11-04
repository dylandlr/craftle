// Generic bounded beam search over the exact same atomic actions as the agent.
// This is a CONTROL, not part of the learned policy or a prescribed solution.
// Uses a fork of the synthetic world: never use this with real Minecraft.
function fingerprint(w){
 const s=w.exportState();
 const extra=s.blocks.filter(([k,v])=>{
  const [x,y,z]=k.split(',').map(Number);
  // Keep the entire editable world for correctness of state equivalence.
  return y>0;
 }).sort((a,b)=>a[0].localeCompare(b[0]));
 return JSON.stringify([s.position,s.health,s.inventory,extra]);
}
function reachableSupportPotential(w){
 const s=w.snapshot(),p=s.position,g=s.goal;
 const y=p.y,x=p.x,z=p.z;
 const canStand=(a,b)=>w.blockAt(a,y-1,b)?.boundingBox==='block'&&
  w.blockAt(a,y,b)?.boundingBox==='empty'&&
  w.blockAt(a,y+1,b)?.boundingBox==='empty';
 const queue=[[x,z]],seen=new Set([x+','+z]);let best=Infinity;
 for(let i=0;i<queue.length&&i<120;i++){
  const [a,b]=queue[i];
  best=Math.min(best,Math.abs(g.x-a)+Math.abs(g.z-b));
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=a+dx,nz=b+dz,k=nx+','+nz;
   if(seen.has(k)||Math.abs(nx-x)>8||Math.abs(nz-z)>8||!canStand(nx,nz))continue;
   seen.add(k);queue.push([nx,nz]);
  }
 }
 return Math.max(0,16-best);
}
function score(w){
 const s=w.snapshot(),p=s.position,g=s.goal;
 const distance=Math.abs(g.x-p.x)+Math.abs(g.z-p.z)+Math.abs(g.y-p.y);
 // Generic connectivity over physically observed support, not a constructed
 // bridge template. This is a planning CONTROL only, never policy training input.
 return (20-distance)*2+s.health*.5-s.steps*.02+
  reachableSupportPotential(w)*4;
}
export function searchMutableTerrain(start,{depth=10,beamWidth=16,maxCandidates=150}={}){
 if(!start?.fork||!start?.affordances||!start?.snapshot)
  throw Error('Forkable simulator required');
 if(!Number.isInteger(depth)||depth<1||depth>50||
  !Number.isInteger(beamWidth)||beamWidth<1||beamWidth>100||
  !Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>500)
  throw Error('Invalid planning budget');
 let frontier=[{world:start.fork(),trace:[]}],expanded=0;
 const seen=new Set([fingerprint(start)]);
 for(let layer=0;layer<depth;layer++){
  const next=[];
  for(const node of frontier){
   const candidates=node.world.affordances().filter(c=>c.operation!=='wait');
   for(const c of candidates.slice(0,maxCandidates)){
    const w=node.world.fork(),out=w.act(c);
    expanded++;
    if(!out.ok||w.snapshot().health<=0)continue;
    const trace=[...node.trace,{operation:c.operation,
     args:c.arguments,change:out.change,after:out.after}];
    if(out.reachedLowerGround)return {solved:true,trace,expanded,
     depth:layer+1,reason:'terminal_goal_observed'};
    if(w.snapshot().done)continue;
    const fp=fingerprint(w);if(seen.has(fp))continue;
    seen.add(fp);
    next.push({world:w,trace,rank:score(w)});
   }
  }
  next.sort((a,b)=>b.rank-a.rank);
  frontier=next.slice(0,beamWidth);
  if(!frontier.length)break;
 }
 return {solved:false,trace:[],expanded,depth,reason:'budget_exhausted_or_no_success'};
}
