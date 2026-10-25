import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeOptionBehavior} from '../scripts/report-option-behavior.js';
test('attempted hunting is never reported as a completed meal',()=>{
 const r=summarizeOptionBehavior([{type:'option_decision',action:'forage'},{type:'survival_reference_hunt'},{type:'option_transition',reason:'horizon'},{type:'option_continued'}]);
 assert.equal(r.hunts,1);assert.equal(r.observedMeals,0);assert.equal(r.actualFoodGains,0);
 assert.equal(r.actionCounts.forage,1);assert.equal(r.transitionReasons.horizon,1);
});
test('meals and recovery require separate explicit events',()=>{
 const r=summarizeOptionBehavior([{type:'survival_reference_consumed'},{type:'survival_reference_hunger_recovered'},{type:'survival_reference_death'}]);
 assert.equal(r.observedMeals,1);assert.equal(r.actualFoodGains,1);assert.equal(r.deaths,1);
});
