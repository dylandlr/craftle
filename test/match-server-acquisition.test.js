import test from 'node:test';import assert from 'node:assert/strict';import {matchServerAcquisition} from '../scripts/match-server-acquisition.js';
const e=(event,sequence,extra={})=>({schema:'craftle.server-event.v1',serverBootId:'boot',event,sequence,serverTick:100+sequence,unixTimeMs:2000+sequence,...extra});
test('matches coordinates and authoritative dropped-item UUID through pickup',()=>{
 const agent=[{type:'target_harvest_intent',decisionId:7,targetId:'plant:2,81,0',timestampMs:1900}];
 const server=[e('observer_boot',1),e('block_break_event',2,{x:2,y:81,z:0}),e('block_drops_event',3,{x:2,y:81,z:0,drops:[{entityUuid:'uuid-1'}]}),e('item_pickup_event',4,{itemEntityUuid:'uuid-1'}),e('item_consume_event',5)];
 const result=matchServerAcquisition(agent,server);assert.equal(result.completeAcquisitionCandidates,1);assert.equal(result.records[0].decisionId,7);
});
test('rejects ambiguous attribution and requires drop entity identity',()=>{
 const a=[{type:'target_harvest_intent',decisionId:1,targetId:'plant:2,81,0',timestampMs:1900},{type:'target_harvest_intent',decisionId:2,targetId:'plant:2,81,0',timestampMs:1910}];
 const r=matchServerAcquisition(a,[e('block_break_event',1,{x:2,y:81,z:0}),e('item_pickup_event',2,{itemEntityUuid:'unlinked'})]);
 assert.equal(r.completeAcquisitionCandidates,0);assert.equal(r.ambiguousBreaks,1);
 assert.throws(()=>matchServerAcquisition([], [e('observer_boot',1),e('observer_boot',1)]),/ordering/);
});

test('does not attribute another players break, drop or pickup',()=>{
 const a=[{agent:'Turesla',type:'target_harvest_intent',decisionId:9,targetId:'plant:2,81,0',timestampMs:1900}];
 const b=e('block_break_event',1,{x:2,y:81,z:0,playerName:'Other',playerUuid:'other'});
 const d=e('block_drops_event',2,{x:2,y:81,z:0,playerUuid:'other',drops:[{entityUuid:'d1'}]});
 const p=e('item_pickup_event',3,{playerUuid:'other',itemEntityUuid:'d1'});
 const mismatch=matchServerAcquisition(a,[b,d,p]);
 assert.equal(mismatch.singleCommandCandidates,0);
 assert.equal(mismatch.completeAcquisitionCandidates,0);
 const selfBreak={...b,playerName:'Turesla',playerUuid:'self'};
 assert.equal(matchServerAcquisition(a,[selfBreak,d,p]).completeAcquisitionCandidates,0);
 const selfDrop={...d,playerUuid:'self'};
 assert.equal(matchServerAcquisition(a,[selfBreak,selfDrop,p]).completeAcquisitionCandidates,0);
 assert.equal(matchServerAcquisition(a,[selfBreak,selfDrop,{...p,playerUuid:'self'}]).completeAcquisitionCandidates,1);
});
test('rejects multiple drop-event candidates from same location and tick window',()=>{
 const a=[{agent:'Turesla',type:'target_harvest_intent',decisionId:9,targetId:'plant:2,81,0',timestampMs:1900}];
 const rows=[e('block_break_event',1,{x:2,y:81,z:0}),e('block_drops_event',2,{x:2,y:81,z:0,drops:[{entityUuid:'a'}]}),e('block_drops_event',3,{x:2,y:81,z:0,drops:[{entityUuid:'b'}]}),e('item_pickup_event',4,{itemEntityUuid:'a'})];
 assert.equal(matchServerAcquisition(a,rows).completeAcquisitionCandidates,0);
});

test('requires post-tick inventory increase for verified acquisition, not merely pickup callback',()=>{
 const a=[{agent:'Turesla',type:'target_harvest_intent',decisionId:12,targetId:'plant:2,81,0',timestampMs:1900}];
 const rows=[
  e('block_break_event',1,{x:2,y:81,z:0,playerUuid:'self',playerName:'Turesla'}),
  e('block_drops_event',2,{x:2,y:81,z:0,playerUuid:'self',drops:[{entityUuid:'food-1'}]}),
  e('item_pickup_event',3,{playerUuid:'self',itemEntityUuid:'food-1',item:'minecraft:carrot'}),
 ];
 assert.equal(matchServerAcquisition(a,rows).completeAcquisitionCandidates,1);
 assert.equal(matchServerAcquisition(a,rows).verifiedAcquisitionCandidates,0);
 const observation=e('pickup_post_tick_inventory',4,{playerUuid:'self',itemEntityUuid:'food-1',item:'minecraft:carrot',beforeCount:0,afterCount:1});
 assert.equal(matchServerAcquisition(a,[...rows,observation]).verifiedAcquisitionCandidates,1);
 assert.equal(matchServerAcquisition(a,[...rows,{...observation,afterCount:0}]).verifiedAcquisitionCandidates,0);
 assert.equal(matchServerAcquisition(a,[...rows,{...observation,playerUuid:'other'}]).verifiedAcquisitionCandidates,0);
 assert.equal(matchServerAcquisition(a,[...rows,{...observation,itemEntityUuid:'wrong'}]).verifiedAcquisitionCandidates,0);
});

test('pickup event cannot precede the originating drop event even in same tick',()=>{
 const a=[{agent:'Turesla',type:'target_harvest_intent',decisionId:5,targetId:'plant:2,81,0',timestampMs:1900}];
 const b=e('block_break_event',1,{x:2,y:81,z:0,playerName:'Turesla',playerUuid:'self'});
 const p=e('item_pickup_event',2,{itemEntityUuid:'u',playerUuid:'self',item:'minecraft:carrot',serverTick:102});
 const d=e('block_drops_event',3,{x:2,y:81,z:0,playerUuid:'self',drops:[{entityUuid:'u'}],serverTick:102});
 const c=e('pickup_post_tick_inventory',4,{playerUuid:'self',itemEntityUuid:'u',item:'minecraft:carrot',beforeCount:0,afterCount:1});
 const r=matchServerAcquisition(a,[b,p,d,c]);
 assert.equal(r.completeAcquisitionCandidates,0);
 assert.equal(r.verifiedAcquisitionCandidates,0);
});

test('one decision must not receive two acquisitions for separate breaks',()=>{
 const a=[{type:'target_harvest_intent',decisionId:42,targetId:'plant:2,81,0',timestampMs:1900}];
 const rows=[
  e('block_break_event',1,{x:2,y:81,z:0}),
  e('block_drops_event',2,{x:2,y:81,z:0,drops:[{entityUuid:'u1'}]}),
  e('item_pickup_event',3,{itemEntityUuid:'u1',item:'minecraft:carrot'}),
  e('pickup_post_tick_inventory',4,{itemEntityUuid:'u1',item:'minecraft:carrot',beforeCount:0,afterCount:1}),
  e('block_break_event',5,{x:2,y:81,z:0}),
  e('block_drops_event',6,{x:2,y:81,z:0,drops:[{entityUuid:'u2'}]}),
  e('item_pickup_event',7,{itemEntityUuid:'u2',item:'minecraft:carrot'}),
  e('pickup_post_tick_inventory',8,{itemEntityUuid:'u2',item:'minecraft:carrot',beforeCount:1,afterCount:2})
 ];
 const r=matchServerAcquisition(a,rows);
 assert.equal(r.verifiedAcquisitionCandidates,0);
 assert.deepEqual(r.duplicateDecisionIds,[42]);
 assert.ok(r.records.every(x=>x.duplicateAssociation));
});

test('strict verification requires complete matching server actor identities',()=>{
 const agent=[{agent:'Turesla',type:'target_harvest_intent',decisionId:71,targetId:'plant:2,81,0',timestampMs:1900}];
 const rows=[
  e('block_break_event',1,{x:2,y:81,z:0,playerName:'Turesla',playerUuid:'self'}),
  e('block_drops_event',2,{x:2,y:81,z:0,playerUuid:'self',drops:[{entityUuid:'item-71'}]}),
  e('item_pickup_event',3,{playerUuid:'self',itemEntityUuid:'item-71',item:'minecraft:carrot'}),
  e('pickup_post_tick_inventory',4,{playerUuid:'self',itemEntityUuid:'item-71',item:'minecraft:carrot',beforeCount:0,afterCount:1})
 ];
 assert.equal(matchServerAcquisition(agent,rows).strictVerifiedAcquisitionCandidates,1);
 for(const index of [0,1,2,3]){
  const altered=rows.map((r,i)=>i===index?{...r,playerUuid:null}:r);
  assert.equal(matchServerAcquisition(agent,altered).strictVerifiedAcquisitionCandidates,0);
 }
});
