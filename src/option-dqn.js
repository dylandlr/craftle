// Small non-LLM DQN over declared, scripted assisted survival options.
export const OPTIONS=Object.freeze(['eat','forage','explore','retreat']);
export function createOptionDQN({random=Math.random,epsilon=0.3,alpha=0.002,gamma=0.95,training=true,snapshot=null,inputs=7,options=OPTIONS,schema='craftle.options.dqn.v1'}={}){
 if(!Number.isInteger(inputs)||inputs<1||!Array.isArray(options)||!options.length||new Set(options).size!==options.length)throw Error('Invalid network contract');
 const hidden=16,outputs=options.length;
 const fresh=()=>Array.from({length:hidden},()=>Array.from({length:inputs+1},()=> (random()-0.5)*0.1));
 let w=fresh(),v=Array.from({length:outputs},()=>Array.from({length:hidden+1},()=> (random()-0.5)*0.1)),updates=0;
 if(snapshot){
  if(snapshot.schema!==schema||JSON.stringify(snapshot.options)!==JSON.stringify(options))throw Error('Incompatible option policy');
  w=snapshot.w;v=snapshot.v;updates=snapshot.updates;
  if(w.length!==hidden||v.length!==outputs||w.some(r=>r.length!==inputs+1||!r.every(Number.isFinite))||v.some(r=>r.length!==hidden+1||!r.every(Number.isFinite)))throw Error('Invalid policy weights');
 }
 let tw=w.map(r=>r.slice()),tv=v.map(r=>r.slice());const replay=[];
 const validate=x=>{if(!Array.isArray(x)||x.length!==inputs||!x.every(Number.isFinite))throw Error('Invalid option observation');};
 const forward=(x,a=w,b=v)=>{const h=a.map(row=>Math.tanh(row[inputs]+x.reduce((sum,value,i)=>sum+value*row[i],0)));return {h,q:b.map(row=>row[hidden]+h.reduce((sum,value,i)=>sum+value*row[i],0))};};
 const eligible=mask=>{const ids=mask.flatMap((yes,i)=>yes?[i]:[]);if(mask.length!==outputs||!ids.length)throw Error('Invalid action mask');return ids;};
 const sample=n=>Math.floor(random()*n);
 return {
  choose(x,mask){validate(x);const ids=eligible(mask),q=forward(x).q;const best=Math.max(...ids.map(i=>q[i]));const ties=ids.filter(i=>q[i]===best);const index=training&&random()<epsilon?ids[sample(ids.length)]:ties[sample(ties.length)];return {index,action:options[index]};},
  observe(t){
   if(!training)throw Error('Frozen option policy cannot train');
   validate(t.state);if(!Number.isInteger(t.index)||t.index<0||t.index>=outputs||!Number.isFinite(t.reward))throw Error('Invalid option transition');
   if(t.steps!==undefined&&(!Number.isInteger(t.steps)||t.steps<0))throw Error('Invalid option duration');
   if(!t.terminal){validate(t.nextState);eligible(t.nextMask);}
   replay.push(structuredClone(t));if(replay.length>512)replay.shift();
   for(let n=0;n<4;n++){
    const e=replay[sample(replay.length)],f=forward(e.state);
    const future=e.terminal?0:Math.max(...eligible(e.nextMask).map(i=>forward(e.nextState,tw,tv).q[i]));
    const error=Math.max(-5,Math.min(5,e.reward+Math.pow(gamma,e.steps??1)*future-f.q[e.index]));
    const old=v[e.index].slice();
    for(let j=0;j<hidden;j++){
     v[e.index][j]+=alpha*error*f.h[j];
     const grad=error*old[j]*(1-f.h[j]*f.h[j]);
     for(let i=0;i<inputs;i++)w[j][i]+=alpha*grad*e.state[i];
     w[j][inputs]+=alpha*grad;
    }
    v[e.index][hidden]+=alpha*error;updates++;
    if(updates%100===0){tw=w.map(r=>r.slice());tv=v.map(r=>r.slice());}
   }
  },
  snapshot:()=>structuredClone({schema,options,w,v,updates}),
  stats:()=>({updates,replaySize:replay.length,training})
 };
}
