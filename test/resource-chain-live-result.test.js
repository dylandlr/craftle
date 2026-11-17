import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyResourceChainLiveTrial}
  from '../src/resource-chain-live-result.js';
const proofs=[
  {operation:'dig',gateEligible:true,
    trainingRewardEligible:false,scriptedActionVerified:true},
  {operation:'place',gateEligible:true,
    trainingRewardEligible:false,scriptedActionVerified:true},
  {operation:'dig',gateEligible:true,
    trainingRewardEligible:false,scriptedActionVerified:true},
  {operation:'place',gateEligible:true,
    trainingRewardEligible:false,scriptedActionVerified:true}
];
const good={terminal:true,reward:1,success:true,
  reason:'final_blocks_and_proofs_verified'};
const bad={terminal:true,reward:-1,success:false,
  reason:'budget_exhausted_without_final_state'};
test('scripted baseline accepts only verified successful final construction',()=>{
  const x=classifyResourceChainLiveTrial({
    policyMode:'scripted',taskResult:good,evidence:proofs
  });
  assert.equal(x.complete,true);
  assert.equal(x.success,true);
  assert.equal(x.terminalReward,1);
  assert.equal(x.learnedPolicyUpdates,0);
  assert.throws(()=>classifyResourceChainLiveTrial({
    policyMode:'scripted',taskResult:bad,evidence:proofs
  }),/Scripted smoke failed/);
});
test('valid failed neural construction counts as complete terminal -1',()=>{
  const wrong=[proofs[0],proofs[2],proofs[0],proofs[0]];
  const x=classifyResourceChainLiveTrial({
    policyMode:'untrained',taskResult:bad,evidence:wrong
  });
  assert.equal(x.complete,true);
  assert.equal(x.success,false);
  assert.equal(x.terminalReward,-1);
  assert.equal(x.verifiedDigActions,4);
  assert.equal(x.verifiedPlaceActions,0);
});
test('frozen trained and untrained outcomes use identical verification contract',()=>{
  for(const policyMode of ['trained','untrained']){
    for(const taskResult of [good,bad]){
      const x=classifyResourceChainLiveTrial({
        policyMode,taskResult,evidence:proofs
      });
      assert.equal(x.complete,true);
      assert.equal(x.success,taskResult.success);
    }
  }
});
test('missing proofs, unverified actions or training eligibility fail closed',()=>{
  assert.throws(()=>classifyResourceChainLiveTrial({
    policyMode:'trained',taskResult:good,evidence:proofs.slice(0,3)
  }));
  for(const field of [
    {gateEligible:false},{trainingRewardEligible:true},
    {scriptedActionVerified:false},{operation:'teleport'}
  ]){
    const altered=proofs.map((p,i)=>i===2?{...p,...field}:p);
    assert.throws(()=>classifyResourceChainLiveTrial({
      policyMode:'trained',taskResult:bad,evidence:altered
    }));
  }
  assert.throws(()=>classifyResourceChainLiveTrial({
    policyMode:'trained',taskResult:{...good,reward:-1},
    evidence:proofs
  }));
});
