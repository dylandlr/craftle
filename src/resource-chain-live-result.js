// Interpret only already-verified terminal world outcomes for a completed
// four-action Minecraft resource-chain episode. A valid failed construction is
// a scientific trial, NOT a runtime exception. Never grants RL updates.
export function classifyResourceChainLiveTrial({
  policyMode,taskResult,evidence
}={}){
  if(!['scripted','trained','untrained'].includes(policyMode)||
    !Array.isArray(evidence)||evidence.length!==4||
    evidence.some(e=>!e||e.gateEligible!==true||
      e.trainingRewardEligible!==false||
      e.scriptedActionVerified!==true||
      !['dig','place'].includes(e.operation))||
    taskResult?.terminal!==true||
    ![-1,1].includes(taskResult.reward)||
    taskResult.success!==(taskResult.reward===1))
    throw Error('Invalid completed live chain evidence or terminal reward');
  const digs=evidence.filter(e=>e.operation==='dig').length;
  const placements=evidence.filter(e=>e.operation==='place').length;
  if(policyMode==='scripted'&&(!taskResult.success||digs!==2||
    placements!==2))
    throw Error('Scripted smoke failed its required four-action acceptance test');
  return {
    complete:true,success:taskResult.success,
    terminalReward:taskResult.reward,verifiedActions:4,
    verifiedDigActions:digs,verifiedPlaceActions:placements,
    learnedPolicyUpdates:0,taskResult
  };
}
