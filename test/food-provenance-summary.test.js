import test from 'node:test';import assert from 'node:assert/strict';import {summarizeFoodProvenance} from '../src/food-provenance-summary.js';
test('classify one temporal precursor without promoting it to causal proof',()=>{
 const r=summarizeFoodProvenance([{type:'target_harvest_intent',decisionId:2,timestampMs:1000},{type:'food_provenance_pickup_event',timestampMs:2500,entityId:7},{type:'food_provenance_inventory_delta',delta:3}]);
 assert.equal(r.temporallyAssociatedPickups,1);assert.equal(r.positiveInventoryDeltas,1);assert.match(r.examples[0].classification,/not_causal_proof/);
});
test('ambiguous and unassociated events are not credited',()=>{
 const r=summarizeFoodProvenance([{type:'target_attack_intent',decisionId:2,timestampMs:1000},{type:'target_harvest_intent',decisionId:3,timestampMs:1200},{type:'food_provenance_pickup_event',timestampMs:1400},{type:'food_provenance_pickup_event',timestampMs:9000}]);
 assert.equal(r.ambiguousPickups,1);assert.equal(r.unassociatedPickups,1);assert.equal(r.temporallyAssociatedPickups,0);
});

test('records observed crop state changes separately from pickups',()=>{
 const r=summarizeFoodProvenance([{type:'target_harvest_block_observation',changed:true},{type:'target_harvest_block_observation',changed:false}]);
 assert.equal(r.observedHarvestBlockChanges,1);assert.equal(r.unchangedHarvestBlocks,1);assert.equal(r.temporallyAssociatedPickups,0);
});
