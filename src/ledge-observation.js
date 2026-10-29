// Bounded observation-only ledge scan. Never moves the agent or assumes unknown blocks are air.
export function inspectLedge({position,blockAt,radius=3}={}){
 if(!position||typeof blockAt!=='function')return {status:'unknown',hazardCells:[],unknownCells:0};
 const o={x:Math.floor(position.x),y:Math.floor(position.y),z:Math.floor(position.z)};
 const hazardous=new Set(['lava','flowing_lava','fire','soul_fire','magma_block','campfire','soul_campfire','cactus']);
 const hazardCells=[];let unknownCells=0;
 for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
  for(let dy=-4;dy<=1;dy++){
   const b=blockAt(o.x+dx,o.y+dy,o.z+dz);
   if(!b){unknownCells++;continue;}
   if(hazardous.has(b.name))hazardCells.push({dx,dy,dz,name:b.name});
  }
 }
 return {status:hazardCells.length?'hazard_nearby':unknownCells?'partially_unknown':'no_hazard_in_sample',
  hazardCells:hazardCells.slice(0,24),hazardCount:hazardCells.length,unknownCells,radius};
}
export function isHazardAdjacent({x,y,z,blockAt,radius=1}){
 // Fail closed if blocks around the proposed footing are unknown.
 for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)
  for(let dy=-3;dy<=1;dy++){
   const b=blockAt(x+dx,y+dy,z+dz);
   if(!b||['lava','flowing_lava','fire','soul_fire','magma_block','campfire','soul_campfire','cactus'].includes(b.name))return true;
  }
 return false;
}
