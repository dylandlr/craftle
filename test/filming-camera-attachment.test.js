import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldAttachCamera} from '../src/filming-camera-attachment.js';
test('stable camera is not repeatedly reattached',()=>{
 assert.deepEqual(shouldAttachCamera({pending:false,lastAttach:1000,now:999999,heartbeatMs:0}),{attach:false,reason:'stable_attachment'});
});
test('reconnect or respawn triggers attach',()=>{
 assert.equal(shouldAttachCamera({pending:true,lastAttach:1000,now:1001}).attach,true);
});
test('optional configured heartbeat is honored',()=>{
 assert.equal(shouldAttachCamera({pending:false,lastAttach:1000,now:5000,heartbeatMs:3000}).attach,true);
});
