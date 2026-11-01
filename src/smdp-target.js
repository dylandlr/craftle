/** Pure semi-Markov Bellman target; does not mutate the active DQN. */
export function discountedReturn(rewards,gamma){
 if(!Array.isArray(rewards)||!rewards.length||rewards.some(r=>!Number.isFinite(r)))throw Error('rewards must be non-empty finite numeric array');
 if(!(Number.isFinite(gamma)&&gamma>0&&gamma<=1))throw Error('gamma must be in (0,1]');
 return rewards.reduce((sum,r,j)=>sum+gamma**j*r,0);
}
export function smdpTarget({rewards,gamma,nextQ=[],nextMask=[],termination='continuing'}){
 const R=discountedReturn(rewards,gamma),k=rewards.length;
 if(!['continuing','environment_terminal','option_interrupted'].includes(termination))throw Error('unknown termination');
 if(termination==='environment_terminal')return {target:R,discountedReward:R,bootstrapped:false,discount:0,duration:k};
 if(!Array.isArray(nextQ)||!Array.isArray(nextMask)||nextQ.length!==nextMask.length||!nextMask.some(Boolean)||nextQ.some(q=>!Number.isFinite(q))||nextMask.some(m=>typeof m!=='boolean'))throw Error('nonterminal transition requires finite nextQ and nonempty boolean nextMask; invoke recovery supervisor instead');
 const best=Math.max(...nextQ.filter((q,i)=>nextMask[i])),discount=gamma**k;
 return {target:R+discount*best,discountedReward:R,bootstrapped:true,discount,duration:k,maxEligibleQ:best};
}
export function potentialShaping({gamma,duration,phiBefore,phiAfter,environmentTerminal=false}){
 if(!Number.isInteger(duration)||duration<1||!Number.isFinite(phiBefore)||!Number.isFinite(phiAfter)||!(Number.isFinite(gamma)&&gamma>0&&gamma<=1))throw Error('invalid potential shaping inputs');
 return gamma**duration*(environmentTerminal?0:phiAfter)-phiBefore;
}
export function gammaFromHalfLifeSeconds(seconds,ticksPerSecond=20){
 if(!(seconds>0&&Number.isFinite(seconds)&&ticksPerSecond>0&&Number.isFinite(ticksPerSecond)))throw Error('invalid half-life');
 return 2**(-1/(seconds*ticksPerSecond));
}
