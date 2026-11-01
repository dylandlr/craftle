// Observer only: describe recorded neural choice without claiming psychological intent.
export function interpretNeuralTrace(event){
 if(event?.type!=='decision_trace_v1')return null;
 const t=event.neuralTrace,actions=event.actions;
 if(!t||!Array.isArray(t.qValues)||!Array.isArray(actions)||t.qValues.length!==actions.length)return null;
 const eligible=Array.isArray(t.eligibleIndices)?t.eligibleIndices.filter(i=>Number.isInteger(i)&&i>=0&&i<actions.length):[];
 const chosen=t.selectedIndex;
 if(!eligible.includes(chosen))return {type:'invalid_trace',decisionId:event.decisionId,reason:'selected action not eligible'};
 const ranked=eligible.map(i=>({action:actions[i],value:t.qValues[i]})).sort((a,b)=>b.value-a.value);
 const selection=t.selectionReason==='epsilon_random'?'epsilon exploration':t.selectionReason==='greedy_max_q'?'highest eligible estimated value':'undocumented selection mechanism';
 const forced=eligible.length===1;
 return {type:'neural_choice_explanation',decisionId:event.decisionId,selected:actions[chosen],
  selection:forced?'only available action ('+selection+')':selection,
  forced,ranked,blocked:Boolean(event.agentObservation?.blocked),targets:event.agentObservation?.targets?.length??null,
  note:forced?'Action mask left no alternative.':'Q-values are return estimates, not success probabilities.'};
}
export function neuralTraceText(x){
 if(!x)return null;
 if(x.type==='invalid_trace')return 'Invalid neural trace: '+x.reason;
 const ranking=x.ranked.map(a=>a.action+'='+a.value.toFixed(3)).join(', ');
 return 'Decision #'+x.decisionId+': '+x.selected+'; '+x.selection+'. Eligible Q-values: '+ranking+
  '. Targets: '+(x.targets??'unknown')+'. Blocked input: '+x.blocked+'. '+x.note;
}
