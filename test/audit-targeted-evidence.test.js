import test from 'node:test';import assert from 'node:assert/strict';import {auditTargetedEvidence} from '../scripts/audit-targeted-evidence.js';
const d={type:'target_decision',decisionId:1,skill:'harvest',action:'harvest_0',targetId:'plant:a'};
test('observation is not promoted into causal proof',()=>{
 const x=auditTargetedEvidence([d,{type:'target_action',decisionId:1,skill:'harvest',targetId:'plant:a'}, {type:'target_inventory_observed',decisionId:1,action:'harvest_0',previousFoodUnits:0,currentFoodUnits:2,deltaFoodUnits:2,evidence:'subsequent_observation_not_causal_proof'}]);
 assert.equal(x.foodInventoryIncreases,1);assert.equal(x.verifiedHungerRecoveries,0);assert.match(x.limitations,/correlations/);
});
test('rejects duplicate decisions and invented or mismatched outcomes',()=>{
 assert.throws(()=>auditTargetedEvidence([d,d]),/Duplicate/);
 assert.throws(()=>auditTargetedEvidence([d,{type:'target_verified_recovery',decisionId:1,beforeFood:16,afterFood:20}]),/Invalid verified/);
 assert.throws(()=>auditTargetedEvidence([d,{type:'target_action',decisionId:1,skill:'attack',targetId:'plant:a'}]),/does not match/);
});
