// Pure, fail-closed correlation for a real dirt block drop and server-observed
// pickup event by the same Minecraft actor. Never creates reward evidence.
const xyz=p=>p&&['x','y','z'].every(k=>Number.isSafeInteger(p[k]));
export function findResourceChainPickup({
  events,source,playerUuid,serverBootId,afterSequence,
  consumedEntityUuids=[]
}={}){
  if(!Array.isArray(events)||!xyz(source)||
    typeof playerUuid!=='string'||!playerUuid||
    typeof serverBootId!=='string'||!serverBootId||
    !Number.isSafeInteger(afterSequence)||
    afterSequence<0||!Array.isArray(consumedEntityUuids)||
    consumedEntityUuids.some(x=>typeof x!=='string'))
    throw Error('Invalid real pickup evidence query');
  const used=new Set(consumedEntityUuids);
  const drops=events.filter(e=>
    e?.event==='block_drops_event'&&
    e.playerUuid===playerUuid&&e.serverBootId===serverBootId&&
    Number.isSafeInteger(e.sequence)&&e.sequence>afterSequence&&
    e.x===source.x&&e.y===source.y&&e.z===source.z);
  const matches=[];
  for(const drop of drops){
    if(!Array.isArray(drop.drops))throw Error('Malformed block-drop server evidence');
    for(const entity of drop.drops){
      if(entity.item!=='minecraft:dirt')continue;
      if(typeof entity.entityUuid!=='string'||!entity.entityUuid||
        !Number.isSafeInteger(entity.count)||entity.count!==1)
        throw Error('Invalid dropped dirt entity or unsupported quantity');
      if(used.has(entity.entityUuid))
        throw Error('Item entity was credited in an earlier action');
      const pickup=events.filter(e=>
        e?.event==='item_pickup_event'&&
        e.playerUuid===playerUuid&&e.serverBootId===serverBootId&&
        e.itemEntityUuid===entity.entityUuid&&
        e.item==='minecraft:dirt'&&e.count===1&&
        e.phase==='event_before_inventory_mutation'&&
        Number.isSafeInteger(e.sequence)&&e.sequence>drop.sequence);
      if(pickup.length>1)
        throw Error('Ambiguous repeated pickup of one entity');
      if(pickup.length===1)matches.push({
        itemEntityUuid:entity.entityUuid,
        dropEventSequence:drop.sequence,
        pickupEventSequence:pickup[0].sequence
      });
    }
  }
  if(matches.length>1)
    throw Error('Ambiguous multiple credited dirt item pickups');
  return matches[0]??null;
}
