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

export function neuralTraceChat(event){
 const result=interpretNeuralTrace(event);
 if(!result||result.type==='invalid_trace')return null;
 const q=n=>Number.isFinite(n)?n.toFixed(2):'?';
 const selected=result.ranked.find(x=>x.action===result.selected);
 const alternative=result.ranked.find(x=>x.action!==result.selected);
 const selection=result.forced?'Only available action':event.neuralTrace.selectionReason==='epsilon_random'?'Epsilon exploration':'Highest eligible Q-value';
 const line1=[{text:'CRAFTLE ',color:'dark_aqua',bold:true},{text:'NEURAL ',color:'aqua',bold:true},{text:'#'+result.decisionId+' ',color:'gray'},
  {text:result.selected.replaceAll('_',' '),color:'white',bold:true},{text:'  '+selection,color:result.forced?'gold':event.neuralTrace.exploratory?'yellow':'green'}];
 const line2=[{text:'\n  ↳ ',color:'dark_gray'},{text:'Q '+q(selected?.value),color:'aqua'}];
 if(alternative)line2.push({text:'  vs  '+alternative.action.replaceAll('_',' ')+' '+q(alternative.value),color:'gray'});
 line2.push({text:'\n  ↳ ',color:'dark_gray'},{text:result.targets===0?'No targets observed':result.targets+' targets observed',color:'gray'});
 if(result.forced)line2.push({text:'; no other eligible actions',color:'gold'});
 if(result.blocked)line2.push({text:'; blocked input',color:'yellow'});
 return {text:'',extra:[...line1,...line2]};
}
