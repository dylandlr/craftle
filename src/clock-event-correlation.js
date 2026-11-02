// Correlate event wall timestamp with bounding server clock responses.
// This produces bounds, never a fabricated authoritative event tick.
export function bracketEvent(event, samples){
 const time=Date.parse(event?.timestamp??'');
 if(!Number.isFinite(time))return {status:'invalid_event_timestamp'};
 const sorted=samples.filter(s=>Number.isSafeInteger(s.gameTime)&&Number.isFinite(s.requestedAt)&&Number.isFinite(s.completedAt)&&s.requestedAt<=s.completedAt&&typeof s.worldId==='string')
   .sort((a,b)=>a.requestedAt-b.requestedAt);
 // A sample's tick was observed somewhere between request and response.
 // Only a completed prior query and an unstarted later query provide
 // conservative event-time bounds without synchronized packet instrumentation.
 const before=sorted.filter(s=>s.completedAt<=time).at(-1);
 const after=sorted.find(s=>s.requestedAt>=time);
 if(!before||!after)return {status:'unbounded',eventTime:time};
 if(before.worldId!==after.worldId||before.epoch!==after.epoch||before.gameTime>after.gameTime)
  return {status:'clock_discontinuity',eventTime:time};
 return {status:'bracketed',eventTime:time,worldId:before.worldId,epoch:before.epoch,
  minTick:before.gameTime,maxTick:after.gameTime,tickWidth:after.gameTime-before.gameTime,
  beforeSampleCompletedAt:before.completedAt,afterSampleRequestedAt:after.requestedAt,
  precision:'interval_only'};
}
export function relateDecisionEvents(decision,events){
 // Correlation only; events without IDs cannot be used as verified outcomes.
 const matched=events.filter(e=>e.decisionId===decision.decisionId&&e.agent_id===decision.agent_id);
 return {decisionId:decision.decisionId,agentId:decision.agent_id,
  events:matched.map(e=>({type:e.type,timestamp:e.timestamp,reason:e.reason??e.status??null})),
  evidence:'id_association_not_causal_proof'};
}
