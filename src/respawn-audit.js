// Observation-only audit. Minecraft server owns the spawn selection.
// Never teleport the bot, issue spawnpoint commands, or alter learning.
export function createRespawnAudit({log=()=>{}}={}){
 let death=null,life=0;
 const point=p=>p&&[p.x,p.y,p.z].every(Number.isFinite)?{x:p.x,y:p.y,z:p.z}:null;
 return {
  death({position,dimension}){death={position:point(position),dimension:dimension??null};},
  spawn({position,dimension}){
   life++;
   const result={type:'vanilla_respawn_position',life,phase:death?'post_death':'initial_or_dimension_spawn',
    position:point(position),dimension:dimension??null,priorDeath:death,
    source:'mineflayer_server_position',spawnSelection:'server_controlled',
    verification:'location_observed_not_spawnpoint_proven'};
   log(result);death=null;return result;
  }
 };
}
