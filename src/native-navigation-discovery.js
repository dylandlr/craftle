// Native A* route discovery for exploration when the conservative grid search finds no exit.
// Probes bounded horizontal goals; never executes a partial or failed route.
export function discoverNativeRoute({position,pathfinder,movements,GoalNearXZ,seed=0,distance=8,timeout=80}={}){
 if(!position||!pathfinder?.getPathTo||!movements||!GoalNearXZ)return {selected:null,reason:'native_probe_unavailable',probes:[]};
 const directions=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]];
 const probes=[];
 for(let i=0;i<directions.length;i++){
  const [dx,dz]=directions[(i+seed%directions.length+directions.length)%directions.length];
  const x=Math.floor(position.x+dx*distance),z=Math.floor(position.z+dz*distance);
  let result;
  try{result=pathfinder.getPathTo(movements,new GoalNearXZ(x,z,2),timeout);}
  catch(error){probes.push({x,z,status:'error',message:String(error.message).slice(0,120)});continue;}
  const status=result?.status??'unknown',pathLength=Array.isArray(result?.path)?result.path.length:0;
  probes.push({x,z,status,pathLength});
  if(status==='success'&&pathLength>0)return {selected:{x,y:Math.floor(position.y),z,horizontal:true},reason:'native_astar_success',probes};
 }
 return {selected:null,reason:'no_native_complete_route',probes};
}
