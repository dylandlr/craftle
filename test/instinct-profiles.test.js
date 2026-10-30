import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeInstinctProfile,validateInstinctTreatment} from '../src/instinct-profiles.js';
test('tabula rasa has no inherited facts and pickaxe profile differs',()=>{
 const blank=makeInstinctProfile('tabula_rasa'),pick=makeInstinctProfile('pickaxe');
 assert.deepEqual(blank.facts,[]);
 assert.ok(pick.facts.includes('pickaxe_recipe_known'));
 assert.ok(!makeInstinctProfile('crafting').facts.includes('pickaxe_recipe_known'));
});
test('all instinct profiles remain declarative and immutable',()=>{
 const s=makeInstinctProfile('survival');
 assert.equal(Object.isFrozen(s),true);
 assert.equal(Object.isFrozen(s.facts),true);
 assert.ok(!s.goals.includes('obtain_pickaxe'));
});
test('treatment records exact policy origin and declares integration status',()=>{
 const t=validateInstinctTreatment({profile:'survival_pickaxe',seed:17,
  observationSchema:'craftle.target-observation.v1',actionSchema:'craftle.targeted.dqn.v1',
  policyCheckpoint:'frozen/pre-curiosity/model.json'});
 assert.equal(t.implementationStatus,'contract_only_not_connected_to_learning_policy');
 assert.equal(t.profile.id,'survival_pickaxe');
 assert.throws(()=>validateInstinctTreatment({profile:'unknown',seed:1,observationSchema:'a',actionSchema:'b',policyCheckpoint:'c'}));
});
