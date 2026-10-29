// Configure the existing Mineflayer A* navigator, not a replacement search engine.
const BLOCK_HAZARDS=['lava','flowing_lava','fire','soul_fire','magma_block','campfire','soul_campfire','cactus'];
export function configurePathfinderSafety(movements,{registry,maxDropDown=1,mode='conservative'}={}){
 movements.canDig=false;
 movements.allow1by1towers=false;
 movements.allowParkour=mode==='ordinary';
 movements.maxDropDown=mode==='ordinary'?4:maxDropDown;
 movements.dontCreateFlow=true;
 movements.dontMineUnderFallingBlock=true;
 movements.allowEntityDetection=true;
 movements.canOpenDoors=false; // Unreliable in current pathfinder.
 movements.blocksToAvoid??=new Set();
 const ids=registry?.blocksByName??{};
 for(const name of BLOCK_HAZARDS)if(Number.isInteger(ids[name]?.id))movements.blocksToAvoid.add(ids[name].id);
 return movements;
}
export function summarizePathUpdate(result){
 return {status:result?.status??'unknown',pathLength:Array.isArray(result?.path)?result.path.length:null,
  visitedNodes:Number.isFinite(result?.visitedNodes)?result.visitedNodes:null,
  generatedNodes:Number.isFinite(result?.generatedNodes)?result.generatedNodes:null,
  cost:Number.isFinite(result?.cost)?result.cost:null,
  computeTimeMs:Number.isFinite(result?.time)?result.time:null};
}
