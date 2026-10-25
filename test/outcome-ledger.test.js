import test from 'node:test';
import assert from 'node:assert/strict';
import {createOutcomeLedger} from '../src/outcome-ledger.js';
test('attempt, death and pickup are not treated as a successful meal or confirmed causal chain',()=>{
 const events=[],l=createOutcomeLedger({emit:x=>events.push(x)});
 l.begin('forage');
 l.observe('survival_reference_hunt',{entityId:3});
 l.observe('survival_reference_food_death_observed',{entityId:3,attribution:'unknown'});
 l.observe('survival_reference_item_pickup_observed',{entityId:9,item:'mutton'});
 assert.deepEqual(events.filter(e=>e.kind==='option_outcome').map(e=>e.evidence),['attempt_only','unattributed_death','inventory_pickup_observed_not_source_proven']);
 assert.equal(events.some(e=>e.evidence==='verified_hunger_recovery'),false);
});
test('duplicate evidence is deterministic, death clears attribution, and recovery requires hunger increase',()=>{
 const events=[],l=createOutcomeLedger({emit:x=>events.push(x)});
 const id=l.begin('eat');
 l.observe('survival_reference_consumed',{beforeFood:18,afterFood:20});
 l.observe('survival_reference_consumed',{beforeFood:18,afterFood:20});
 assert.equal(events.filter(e=>e.evidence==='verified_hunger_recovery').length,1);
 l.death();assert.equal(l.snapshot().active,null);
 l.observe('survival_reference_consumed',{beforeFood:0,afterFood:20});
 assert.equal(events.filter(e=>e.evidence==='verified_hunger_recovery').length,1);
 l.begin('eat');assert.notEqual(l.snapshot().active.id,id);
 l.observe('survival_reference_consumed',{beforeFood:20,afterFood:20});
 assert.equal(events.at(-1).evidence,'consumption_without_verified_recovery');
});
