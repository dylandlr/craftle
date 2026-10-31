// Evidence ledger for observed interactions, not hardcoded Minecraft knowledge.
// Each outcome is attributed to the agent's own action and a verified observation.
const valid = x => typeof x === 'string' && x.length > 0 && x.length <= 128;
const key = (kind, name, action) => JSON.stringify([kind,name,action]);
export function createCuriosityEvidence({maxExamples=16}={}) {
 if(!Number.isInteger(maxExamples)||maxExamples<1)throw Error('Invalid example cap');
 const evidence = new Map();
 function record({kind,name,action,observedOutcome,decisionId,source='agent_observation',at=null}) {
  if(![kind,name,action,observedOutcome].every(valid)||!valid(String(decisionId??'')))
   throw Error('Missing or invalid evidence fields');
  if(source!=='agent_observation')throw Error('Curiosity evidence must originate from agent observation');
  const id=key(kind,name,action);
  let entry=evidence.get(id);
  if(!entry){entry={kind,name,action,total:0,counts:{},examples:[]};evidence.set(id,entry);}
  entry.total+=1;
  entry.counts[observedOutcome]=(entry.counts[observedOutcome]??0)+1;
  entry.examples.push({observedOutcome,decisionId,at});
  if(entry.examples.length>maxExamples)entry.examples.shift();
  return summary(kind,name,action);
 }
 function summary(kind,name,action){
  const entry=evidence.get(key(kind,name,action));
  if(!entry)return {known:false,total:0,outcomes:[],uncertainty:1};
  const outcomes=Object.entries(entry.counts).map(([outcome,count])=>({
   outcome,count,frequency:count/entry.total
  })).sort((a,b)=>b.count-a.count||a.outcome.localeCompare(b.outcome));
  const most=outcomes[0]?.frequency??0;
  return {known:true,kind,name,action,total:entry.total,outcomes,
   uncertainty:1-most,examples:structuredClone(entry.examples),
   interpretation:'empirical_frequency_not_causal_proof'};
 }
 function snapshot(){return {schema:'craftle.curiosity-evidence.v1',
  entries:[...evidence.values()].map(e=>structuredClone(e))};}
 return {record,summary,snapshot};
}
