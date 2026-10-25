import fs from 'node:fs';
const file=process.argv[2];
if(!file)throw Error('Usage: node scripts/audit-v3-rewards.js <agent.log>');
const events=fs.readFileSync(file,'utf8').split('\n').filter(s=>s.startsWith('{"timestamp":')).map(s=>JSON.parse(s));
const certified=events.filter(e=>e.type==='deterministic_outcome'&&e.kind==='option_outcome'&&e.evidence==='verified_hunger_recovery');
const credits=events.filter(e=>e.type==='option_verified_reward');
const transitions=events.filter(e=>e.type==='option_transition');
const decisions=events.filter(e=>e.type==='option_decision');
const seen=new Set();
const errors=[];
for(const r of credits){
 const key=[r.optionId,r.sourceSequence].join(':');
 if(seen.has(key))errors.push('duplicate reward '+key);seen.add(key);
 const matches=certified.filter(e=>e.optionId===r.optionId&&e.sequence===r.sourceSequence);
 if(matches.length!==1)errors.push('reward without exactly one certified event '+key);
 if(!decisions.some(e=>e.action===r.action))errors.push('reward action not observed '+key);
}
const summary={schema:'craftle.v3-reward-audit.v1',certifiedRecoveries:certified.length,credits:credits.length,optionTransitions:transitions.length,neuralDecisions:decisions.length,uncreditedCertifiedRecoveries:certified.length-credits.length,errors,
 note:'Credits can be lower than certified events when policy is frozen, switched, or event arrives after an option interval. Successful causal training still requires matching transition timing and update verification.'};
console.log(JSON.stringify(summary,null,2));
if(errors.length)process.exitCode=1;
