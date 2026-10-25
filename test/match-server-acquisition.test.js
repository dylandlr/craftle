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
 assert.throws(()=>matchServerAcquisition([], [e('observer_boot',2),e('observer_boot',1)]),/ordering/);
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
