// Reward v2 uses privileged environment telemetry ONLY for reward computation.
// It is never inserted into the visual policy's observation.
export const rewardV2Defaults=Object.freeze({newCell:0.30,taskProgress:1,damage:0.5,stepCost:0.02,idlePenalty:0.10});
export function createRewardV2({cellSize=4,weights={}}={}){
 if(!Number.isFinite(cellSize)||cellSize<=0)throw Error('Invalid spatial cell size');
 const w={...rewardV2Defaults,...weights};
 if(Object.values(w).some(v=>!Number.isFinite(v)||v<0))throw Error('Invalid reward weights');
 const visited=new Set();
 let previous=null;
 const cell=p=>[Math.floor(p.x/cellSize),Math.floor(p.z/cellSize)].join(':');
 return {
  resetLife(){previous=null;},
  observe({position,healthDelta=0,taskProgress=0}={}){
   if(!position||![position.x,position.z,healthDelta,taskProgress].every(Number.isFinite)||taskProgress<0)throw Error('Invalid reward telemetry');
   const key=cell(position);
   const newCell=!visited.has(key);
   visited.add(key);
   const horizontal=previous?Math.hypot(position.x-previous.x,position.z-previous.z):0;
   previous={x:position.x,z:position.z};
   const terms={explore:newCell?w.newCell:0,task:Math.min(1,taskProgress)*w.taskProgress,
    damage:Math.min(0,healthDelta)*w.damage,step:-w.stepCost,
    idle:horizontal<0.1?-w.idlePenalty:0};
   return {reward:Object.values(terms).reduce((a,b)=>a+b,0),terms,newCell,visitedCells:visited.size,horizontalMovement:horizontal};
  },
  stats(){return {visitedCells:visited.size}}
 };
}
