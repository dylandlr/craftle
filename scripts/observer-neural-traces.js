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

const number=v=>typeof v==='number'&&Number.isFinite(v)?(Object.is(v,-0)?'0':Number(v.toPrecision(6)).toString()):String(v??'missing');
function page(label,lines,index,total){
 return {text:'',extra:[{text:'CRAFTLE ',color:'dark_aqua',bold:true},{text:'TRACE ',color:'aqua',bold:true},
 {text:label+' ['+(index+1)+'/'+total+']',color:'yellow'},
 {text:'\\n'+lines.join('\\n'),color:'gray'}]};
}
function chunks(entries,limit){const out=[];for(let i=0;i<entries.length;i+=limit)out.push(entries.slice(i,i+limit));return out;}
/** Complete numeric dump, ordered as logged, in Minecraft-sized chat pages.
 * Every feature, Q-value and hidden activation is included; unavailable fields
 * are explicit rather than silently omitted. Pages are observer-only. */
export function neuralTracePages(event){
 if(event?.type!=='decision_trace_v1'||!event.neuralTrace)return [];
 const t=event.neuralTrace,o=event.agentObservation??{};
 const names=Array.isArray(event.featureNames)?event.featureNames:[];
 const features=Array.isArray(event.features)?event.features:[];
 const actions=Array.isArray(event.actions)?event.actions:[];
 const q=Array.isArray(t.qValues)?t.qValues:[];
 const hidden=Array.isArray(t.hiddenActivations)?t.hiddenActivations:[];
 const eligible=new Set(t.eligibleIndices??[]);
 const rows=[
 ['Decision '+(event.decisionId??'?')+' | '+(event.timestamp??'no timestamp'),
  'Selected: '+(event.selection??actions[t.selectedIndex]??'unknown')+' | '+(t.selectionReason??'unknown'),
  'Epsilon: '+number(t.epsilon)+' | exploratory: '+String(t.exploratory),
  'Eligible: '+JSON.stringify(t.eligibleIndices??[])+' | greedy: '+JSON.stringify(t.greedyIndices??[]),
  'Selected Q: '+number(t.selectedQ)+' | best eligible Q: '+number(t.maxEligibleQ)],
 ...chunks([
  'health='+number(o.health)+' food='+number(o.food)+' foodAvailable='+String(o.foodAvailable),
  'foodUnits='+number(o.foodUnits)+' foodPoints='+number(o.foodPoints),
  'hostileDistance='+number(o.hostileDistance)+' blocked='+String(o.blocked),
  'displacement='+number(o.displacement)+' targets='+number(o.targets?.length),
  'position='+[o.position?.x,o.position?.y,o.position?.z].map(number).join(', '),
  'updates='+number(event.stats?.updates)+' replay='+number(event.stats?.replaySize)+' reward='+String(event.rewardVersion??'?')
 ],3),
 ...chunks(Array.from({length:Math.max(features.length,names.length)},(_,i)=>
  'F'+String(i).padStart(2,'0')+' '+(names[i]??'?')+'='+number(features[i])),5),
 ...chunks(Array.from({length:Math.max(actions.length,q.length)},(_,i)=>
  'Q'+String(i).padStart(2,'0')+' '+(actions[i]??'?')+'='+number(q[i])+
  (eligible.has(i)?' [allowed]':' [masked]')+(i===t.selectedIndex?' [SELECTED]':'')),4),
 ...chunks(hidden.map((v,i)=>'H'+String(i).padStart(2,'0')+'='+number(v)),6)
 ];
 const labels=['choice',...Array(chunks([1,2,3,4,5,6],3).length).fill('state'),
  ...Array(chunks(features.length>names.length?features:names,5).length).fill('features'),
  ...Array(chunks(actions.length>q.length?actions:q,4).length).fill('Q-values'),
  ...Array(chunks(hidden,6).length).fill('hidden')];
 return rows.map((lines,i)=>page('#'+(event.decisionId??'?')+' '+(labels[i]??'trace'),lines,i,rows.length));
}
