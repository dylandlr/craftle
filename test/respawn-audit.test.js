import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRespawnAudit} from '../src/respawn-audit.js';
test('records actual server-selected post-death coordinates',()=>{
 const events=[],audit=createRespawnAudit({log:e=>events.push(e)});
 audit.spawn({position:{x:0,y:64,z:0},dimension:'overworld'});
 audit.death({position:{x:100,y:62,z:100},dimension:'overworld'});
 const result=audit.spawn({position:{x:7,y:70,z:9},dimension:'overworld'});
 assert.equal(result.phase,'post_death');
 assert.deepEqual(result.position,{x:7,y:70,z:9});
 assert.deepEqual(result.priorDeath.position,{x:100,y:62,z:100});
 assert.equal(result.spawnSelection,'server_controlled');
 assert.equal(events.length,2);
});
test('non-death spawn is not mislabeled a respawn',()=>{
 const result=createRespawnAudit().spawn({position:null,dimension:'overworld'});
 assert.equal(result.phase,'initial_or_dimension_spawn');
 assert.equal(result.position,null);
});
