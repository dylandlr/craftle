// Small online visual Q-learning baseline: intentionally untrained at startup.
// Uses coarse RGB appearance only, previous action, and externally measured
// self-displacement reward. No privileged block-state observations or LLM.
import fs from 'node:fs';
import path from 'node:path';
export const RL_ACTIONS=Object.freeze(['forward','left','right','jump','look_left','look_right']);
export function visualState(frame){
  if(!frame||frame.source!=='first_person_rgb'||!(frame.rgb instanceof Uint8Array)||frame.rgb.length!==frame.width*frame.height*3)throw Error('RGB24 required');
  const regions=[0,0,0,0],counts=[0,0,0,0];
  for(let y=0;y<frame.height;y+=4)for(let x=0;x<frame.width;x+=4){
    const i=(y*frame.width+x)*3,k=(y>=frame.height/2?2:0)+(x>=frame.width/2?1:0);
    regions[k]+=frame.rgb[i]*0.299+frame.rgb[i+1]*0.587+frame.rgb[i+2]*0.114;counts[k]++;
  }
  return regions.map((sum,i)=>Math.min(3,Math.floor(sum/Math.max(1,counts[i])/64))).join('');
}
export function createOnlineVisualQLearner({epsilon=0.3,alpha=0.2,gamma=0.9,random=Math.random,checkpoint=null,training=true}={}){
  if([epsilon,alpha,gamma].some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('Invalid learning hyperparameters');
  const q=new Map();
  let transitions=0;
  if(checkpoint&&fs.existsSync(checkpoint)){
    const saved=JSON.parse(fs.readFileSync(checkpoint,'utf8'));
    if(saved.schemaVersion!==1||JSON.stringify(saved.actions)!==JSON.stringify(RL_ACTIONS))throw Error('Incompatible RL checkpoint');
    transitions=Number.isSafeInteger(saved.transitions)&&saved.transitions>=0?saved.transitions:0;
    if(!saved.q||typeof saved.q!=='object'||Array.isArray(saved.q))throw Error('Invalid RL checkpoint Q-table');
    for(const [state,values] of Object.entries(saved.q)){
      if(!/^[0-3]{4}$/.test(state)||!Array.isArray(values)||values.length!==RL_ACTIONS.length||!values.every(Number.isFinite))
        throw Error('Invalid RL checkpoint state: '+state);
      q.set(state,values);
    }
  }
  const scores=s=>{if(!q.has(s))q.set(s,RL_ACTIONS.map(()=>0));return q.get(s);};
  const sampleIndex=n=>{
    const value=random();
    if(!Number.isFinite(value)||value<0||value>=1)throw Error('Random source must return [0,1)');
    return Math.floor(value*n);
  };
  return {
    choose(state){
      if(!/^[0-3]{4}$/.test(state))throw Error('Invalid visual state');
      const values=training?scores(state):(q.get(state)??RL_ACTIONS.map(()=>0));
      let index;
      if(training&&random()<epsilon)index=sampleIndex(RL_ACTIONS.length);
      else {const best=Math.max(...values);const ties=values.flatMap((x,i)=>x===best?[i]:[]);index=ties[sampleIndex(ties.length)];}
      return {state,action:RL_ACTIONS[index],index};
    },
    learn({state,index,reward,nextState,terminal=false}){
      if(!training)throw Error('Frozen policy cannot learn');
      if(!/^[0-3]{4}$/.test(state)||(!terminal&&!/^[0-3]{4}$/.test(nextState))||
          !Number.isFinite(reward)||!Number.isInteger(index)||index<0||index>=RL_ACTIONS.length)
        throw Error('Invalid RL transition');
      const values=scores(state),future=terminal?0:Math.max(...scores(nextState));
      values[index]+=alpha*(reward+gamma*future-values[index]);transitions++;
      return {tdValue:values[index],transitions};
    },
    save(filename=checkpoint){
      if(!filename)throw Error('Checkpoint destination required');
      fs.mkdirSync(path.dirname(filename),{recursive:true});
      const qValues=Object.fromEntries(q);
      const temp=filename+'.tmp';
      fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,actions:RL_ACTIONS,q:qValues,transitions},null,2));
      fs.renameSync(temp,filename);
    },
    stats:()=>({states:q.size,transitions})
  };
}
export function intrinsicVisualReward({displacement=0,healthDelta=0,novelState=false}={}){
  return Math.min(1,Math.max(0,displacement))*0.5+(novelState?0.2:0)+Math.min(0,healthDelta)*0.5-0.02;
}
