import test from 'node:test';
import assert from 'node:assert/strict';
import {assessObserverSamples} from '../scripts/check-spectator-hud-gate.js';
function phase(present){
 return Array.from({length:24},(_,i)=>({
  sample:i,phase:present?'spectator':'baseline',
  responses:{
   list:'There are '+(present?2:1)+' of a max of 4 players online: Turesla'+(present?', dyl_is_here':''),
   'gamerule spectatorsGenerateChunks':'Gamerule spectatorsGenerateChunks is currently set to: false',
   'execute at Turesla if entity @e[type=minecraft:zombie,distance=..64]':'Test passed, count: '+(present?6:2)
  }
 }));
}
test('accepts valid observation phases without making an isolation claim',()=>{
 const result=assessObserverSamples({baseline:phase(false),spectator:phase(true)});
 assert.equal(result.conditionsValid,true);
 assert.equal(result.verdict,'observational_conditions_valid_causality_unverified');
 assert.equal(result.promotion.liveObserverOnPersistent,'blocked_pending_replicated_isolation_evidence');
 assert.equal(result.mobComparison[0].delta,4);
});
test('rejects contaminated baseline where the camera remains connected',()=>{
 const result=assessObserverSamples({baseline:phase(true),spectator:phase(true)});
 assert.equal(result.conditionsValid,false);
 assert.equal(result.verdict,'invalid_conditions');
 assert.equal(result.checks.find(c=>c.name==='baseline_player_presence').pass,false);
});
test('rejects chunk generation and incomplete samples',()=>{
 const baseline=phase(false).slice(0,23);
 const spectator=phase(true);spectator[0].responses['gamerule spectatorsGenerateChunks']='true';
 const result=assessObserverSamples({baseline,spectator});
 assert.equal(result.conditionsValid,false);
 assert.equal(result.checks.find(c=>c.name==='baseline_sample_count').pass,false);
 assert.equal(result.checks.find(c=>c.name==='spectator_spectatorsGenerateChunks_false').pass,false);
});
