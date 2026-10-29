// Experimental embodied canopy recovery: walk off a known short edge.
// No teleport, digging, unknown landing, or blind jump. All observations are local.
const hazard=new Set(['lava','flowing_lava','fire','soul_fire','magma_block','cactus','campfire','soul_campfire']);
export function findCanopyStepdown({position,blockAt,health=20,maxDrop=3}={}){
 if(!position||typeof blockAt!=='function'||!Number.isFinite(health)||health<8)
  return {selected:null,reason:'unavailable_or_low_health'};
 const o={x:Math.floor(position.x),y:Math.floor(position.y),z:Math.floor(position.z)};
 const under=blockAt(o.x,o.y-1,o.z);
 if(!under?.name?.includes('leaves'))return {selected:null,reason:'not_on_canopy'};
 const empty=b=>b?.boundingBox==='empty'&&!hazard.has(b.name);
 const full=b=>b?.boundingBox==='block'&&!hazard.has(b.name);
 const candidates=[];
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const x=o.x+dx,z=o.z+dz;
  for(let drop=1;drop<=maxDrop;drop++){
   const y=o.y-drop;
   const ground=blockAt(x,y-1,z);
   if(!full(ground)||ground.name?.includes('leaves'))continue;
   let clear=true;
   for(let h=y;h<=o.y+1;h++)if(!empty(blockAt(x,h,z))){clear=false;break;}
   if(!clear)continue;
   // At the lip and the landing, require observed non-hazardous blocks within one cell.
   for(const [cx,cz] of [[o.x,o.z],[x,z]]){
    for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++)
     for(let h=y-1;h<=o.y;h++){
      const b=blockAt(cx+ox,h,cz+oz);
      if(!b||hazard.has(b.name)){clear=false;break;}
     }
   }
   if(clear)candidates.push({x,y,z,dx,dz,drop,ground:ground.name});
  }
 }
 candidates.sort((a,b)=>a.drop-b.drop);
 return {selected:candidates[0]??null,reason:candidates.length?'verified_short_stepdown':'no_verified_safe_stepdown'};
}
