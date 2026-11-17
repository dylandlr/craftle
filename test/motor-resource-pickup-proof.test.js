import test from 'node:test';
import assert from 'node:assert/strict';
import {findResourceChainPickup} from '../src/motor-resource-pickup-proof.js';
const source={x:1,y:81,z:0};
const identity={playerUuid:'player-abc',serverBootId:'boot-one'};
const rows=[
  {event:'block_drops_event',...identity,...source,sequence:101,
    drops:[{item:'minecraft:dirt',entityUuid:'drop-1',count:1}]},
  {event:'item_pickup_event',...identity,sequence:105,
    item:'minecraft:dirt',count:1,itemEntityUuid:'drop-1',
    phase:'event_before_inventory_mutation'}
];
const query=(events=rows,override={})=>findResourceChainPickup({
  events,source,...identity,afterSequence:100,...override
});

test('matches only a later same-actor pickup of the exact server item entity',()=>{
  assert.deepEqual(query(),{
    itemEntityUuid:'drop-1',dropEventSequence:101,
    pickupEventSequence:105
  });
});
test('not-yet-picked dropped dirt gives no proof',()=>{
  assert.equal(query(rows.slice(0,1)),null);
});
test('other players, boots, item UUIDs, locations and items cannot fulfill pickup',()=>{
  for(const modified of [
    {playerUuid:'intruder'},{serverBootId:'different-boot'},
    {itemEntityUuid:'drop-elsewhere'},{item:'minecraft:stone'},
    {phase:'client_reported_after_inventory'},
    {count:2}
  ]){
    const altered=[rows[0],{...rows[1],...modified}];
    assert.equal(query(altered),null);
  }
  assert.equal(query(rows,{source:{x:2,y:81,z:0}}),null);
});
test('pickup before drop event is not accepted',()=>{
  assert.equal(query([rows[0],{...rows[1],sequence:100}]),null);
});
test('reusing a previously credited item entity fails closed',()=>{
  assert.throws(()=>query(rows,{consumedEntityUuids:['drop-1']}),
    /credited/);
});
test('duplicate pickup events and duplicate matching drop entities fail',()=>{
  assert.throws(()=>query([...rows,{...rows[1],sequence:106}]),
    /Ambiguous/);
  const two=[
    {...rows[0],drops:[rows[0].drops[0],
      {item:'minecraft:dirt',entityUuid:'drop-2',count:1}]},
    rows[1],
    {...rows[1],sequence:106,itemEntityUuid:'drop-2'}
  ];
  assert.throws(()=>query(two),/Ambiguous/);
});
test('missing actor, invalid sequences and malformed drop entities fail closed',()=>{
  assert.throws(()=>query(rows,{serverBootId:null}));
  assert.throws(()=>query(rows,{afterSequence:-1}));
  assert.throws(()=>query([
    {...rows[0],drops:[{item:'minecraft:dirt',entityUuid:'',count:1}]},
    rows[1]
  ]),/Invalid dropped/);
});
