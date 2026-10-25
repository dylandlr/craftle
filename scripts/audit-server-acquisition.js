// Read-only evidence matching. Server sequence/tick and actor identity outrank wall-clock proximity.
export function auditServerAcquisition(serverEvents,clientEvents){
 const server=serverEvents.filter(e=>e.schema==='craftle.server-event.v1');
 for(let i=1;i<server.length;i++){
  if(server[i].serverBootId===server[i-1].serverBootId&&(server[i].sequence<=server[i-1].sequence||server[i].serverTick<server[i-1].serverTick))throw Error('Nonmonotonic server event stream');
 }
 const drops=new Map(),pickups=[],consumptions=[],foodChanges=[];
 for(const e of server){
  if(e.event==='block_drops_event')for(const d of e.drops??[])drops.set(d.entityUuid,{...d,block:e,world:e.world});
  if(e.event==='item_pickup_event')pickups.push(e);
  if(e.event==='item_consume_event')consumptions.push(e);
  if(e.event==='food_level_change_event')foodChanges.push(e);
 }
 const results=pickups.map(p=>{
  const drop=drops.get(p.itemEntityUuid);
  const sameWorld=drop?.world===undefined||drop.world===p.world;
  const withinBoot=drop?.block.serverBootId===p.serverBootId;
  const rightOrder=drop?.block.sequence<p.sequence&&drop?.block.serverTick<=p.serverTick;
  const identity=drop?.item===p.item&&drop?.count>=p.count;
  const link=drop&&sameWorld&&withinBoot&&rightOrder&&identity;
  return {pickupSequence:p.sequence,playerUuid:p.playerUuid,item:p.item,count:p.count,dropSequence:link?drop.block.sequence:null,classification:link?'server_drop_to_pickup_identity_match':'unmatched_server_pickup',agentDecisionId:null};
 });
 return {schema:'craftle.server-acquisition-audit.v1',serverEvents:server.length,serverPickups:pickups.length,matchedServerDropPickups:results.filter(r=>r.dropSequence!==null).length,serverConsumptionEvents:consumptions.length,serverFoodChangeEvents:foodChanges.length,unmatchedServerPickups:results.filter(r=>r.dropSequence===null).length,pickups:results,clientEvents:clientEvents.length,limitations:'Server drop/pickup identity matching establishes item lineage, not neural decision causation. Server event callbacks are pre-mutation; confirm outcomes with later state snapshots.'};
}
