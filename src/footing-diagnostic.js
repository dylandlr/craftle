// Observation only. Never equate block bounding boxes with actual entity collision.
export function diagnoseFooting({position,blockAt,onGround=null}={}){
 if(!position||![position.x,position.y,position.z].every(Number.isFinite)||typeof blockAt!=='function')
  return {status:'missing_observation',traversable:false};
 const x=Math.floor(position.x),y=Math.floor(position.y),z=Math.floor(position.z);
 const get=(dy)=>blockAt(x,y+dy,z);
 const ground=get(-1),feet=get(0),head=get(1);
 const describe=b=>b?{name:b.name??null,boundingBox:b.boundingBox??null}:null;
 let status='verified_full_block_footing';
 if(!ground||!feet||!head)status='unknown_terrain';
 else if(feet.boundingBox!=='empty')status='feet_obstructed';
 else if(head.boundingBox!=='empty')status='head_obstructed';
 else if(ground.boundingBox==='empty')status='unsupported_position';
 else if(ground.boundingBox!=='block')status='partial_block_geometry';
 else if(['lava','magma_block','cactus','campfire','soul_campfire'].includes(ground.name))status='hazardous_footing';
 else if(onGround===false)status='physics_support_disagreement';
 return {status,traversable:status==='verified_full_block_footing',
  grid:{x,y,z},fractionalY:position.y-y,onGround,ground:describe(ground),feet:describe(feet),head:describe(head),
  note:'Diagnostic classification, not a complete collision-shape or movement guarantee'};
}
