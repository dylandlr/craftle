import test from 'node:test';import assert from 'node:assert/strict';import {auditServerAcquisition} from '../scripts/audit-server-acquisition.js';
const base={schema:'craftle.server-event.v1',serverBootId:'boot',serverTick:10};
test('match server drop entity UUID with later pickup while preserving decision uncertainty',()=>{
 const d={...base,sequence:1,event:'block_drops_event',world:'minecraft:overworld',drops:[{entityUuid:'uuid-1',item:'minecraft:carrot',count:3}]};
 const p={...base,sequence:2,serverTick:11,event:'item_pickup_event',world:'minecraft:overworld',itemEntityUuid:'uuid-1',item:'minecraft:carrot',count:2,playerUuid:'player'};
 const a=auditServerAcquisition([d,p],[]);
 assert.equal(a.matchedServerDropPickups,1);assert.equal(a.pickups[0].agentDecisionId,null);
});
test('rejects impossible event order and other-world matching',()=>{
 const d={...base,sequence:2,event:'block_drops_event',world:'minecraft:overworld',drops:[{entityUuid:'i',item:'minecraft:carrot',count:1}]};
 const p={...base,sequence:3,serverTick:11,event:'item_pickup_event',world:'minecraft:nether',itemEntityUuid:'i',item:'minecraft:carrot',count:1};
 assert.equal(auditServerAcquisition([d,p],[]).unmatchedServerPickups,1);
 assert.throws(()=>auditServerAcquisition([p,d],[]),/Nonmonotonic/);
});
