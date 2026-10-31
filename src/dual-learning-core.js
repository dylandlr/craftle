// Pure orchestration: option-value updates and evidence accumulation stay separate.
const allowed=new Set(['verified_success','verified_failure','no_observable_change','unknown','interrupted','timed_out']);
const valid=x=>typeof x==='string'&&x.length>0&&x.length<=128;
export class AffordanceEvidence {
 constructor({maxExamples=32}={}){if(!Number.isInteger(maxExamples)||maxExamples<1)throw Error('Invalid cap');this.maxExamples=maxExamples;this.records=new Map();}
 record({kind,name,action,result,decisionId,evidenceSource,details=null}){
  if(![kind,name,action].every(valid)||!valid(String(decisionId??''))||!allowed.has(result))throw Error('Invalid evidence');
  if(evidenceSource!=='agent_observation')throw Error('Only agent observation allowed');
  const id=JSON.stringify([kind,name,action]);
  const r=this.records.get(id)??{kind,name,action,count:0,results:{},examples:[]};
  r.count++;r.results[result]=(r.results[result]??0)+1;
  r.examples.push({decisionId,result,details:structuredClone(details)});
  if(r.examples.length>this.maxExamples)r.examples.shift();
  this.records.set(id,r);return this.query(kind,name,action);
 }
 query(kind,name,action){
  const r=this.records.get(JSON.stringify([kind,name,action]));
  if(!r)return {observations:0,outcomeFrequencies:{},confidence:'unobserved'};
  return {observations:r.count,outcomeFrequencies:Object.fromEntries(Object.entries(r.results).map(([k,n])=>[k,n/r.count])),confidence:r.count<3?'insufficient':'empirical_only'};
 }
 snapshot(){return structuredClone({schema:'craftle.affordance-evidence.v1',records:[...this.records.values()]});}
}
export class OptionEpisode {
 constructor({id,option,observation,tick,maxTicks=400,gammaPerTick=0.999}){
  if(!valid(String(id??''))||!valid(option)||!Number.isSafeInteger(tick)||tick<0||!Number.isSafeInteger(maxTicks)||maxTicks<1||!Number.isFinite(gammaPerTick)||gammaPerTick<=0||gammaPerTick>1)throw Error('Invalid episode');
  Object.assign(this,{id,option,startTick:tick,maxTicks,gammaPerTick,initialObservation:structuredClone(observation),status:'active'});
 }
 due(tick){if(!Number.isSafeInteger(tick)||tick<this.startTick)throw Error('Invalid tick');return this.status==='active'&&tick-this.startTick>=this.maxTicks;}
 finish({tick,result,finalObservation,reward,evidence=null}){
  if(this.status!=='active')throw Error('Episode already finished');
  if(!allowed.has(result)||!Number.isSafeInteger(tick)||tick<this.startTick||!Number.isFinite(reward))throw Error('Invalid outcome');
  const elapsedTicks=tick-this.startTick;
  if(elapsedTicks>this.maxTicks&&!['timed_out','interrupted'].includes(result))throw Error('Beyond deadline');
  this.status=result;
  return Object.freeze({schema:'craftle.option-transition.v1',id:this.id,option:this.option,startTick:this.startTick,endTick:tick,elapsedTicks,discount:this.gammaPerTick**elapsedTicks,state:structuredClone(this.initialObservation),nextState:structuredClone(finalObservation),reward,result,truncated:['interrupted','timed_out','unknown'].includes(result),evidence:structuredClone(evidence)});
 }
}
export class DualLearningCoordinator {
 constructor({valueLearner,knowledge=new AffordanceEvidence(),onTransition=()=>{}}){
  if(typeof valueLearner?.observe!=='function')throw Error('Missing learner.observe');
  Object.assign(this,{valueLearner,knowledge,onTransition,active:null});
 }
 begin(spec){if(this.active)throw Error('Active option must resolve first');this.active=new OptionEpisode(spec);return this.active;}
 settle(outcome){
  if(!this.active)throw Error('No active option');
  const episode=this.active,t=episode.finish(outcome),e=outcome.evidence;
  if(e?.evidenceSource==='agent_observation')this.knowledge.record({kind:e.kind,name:e.name,action:e.action,result:t.result,decisionId:episode.id,evidenceSource:e.evidenceSource,details:e.details});
  this.valueLearner.observe(t);this.active=null;this.onTransition(t);return t;
 }
}
