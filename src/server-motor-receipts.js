// Conservative matching of agent block-edit intentions to independent
// server-observed post-action states. This does not command Minecraft.
// Intent/callback alone is never a confirmed mutation. In particular, Paper
// BlockBreakEvent is observed *before* world mutation.
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const sameBlock=(a,b)=>a.world===b.world&&a.x===b.x&&a.y===b.y&&a.z===b.z;
const validPosition=e=>typeof e.world==='string'&&e.world.length>0&&
 [e.x,e.y,e.z].every(Number.isSafeInteger);
const opaqueItem=s=>typeof s==='string'&&s.length>0;
export function matchServerMotorReceipts(intents,events,{maxTickWindow=6}={}){
 if(!Array.isArray(intents)||!Array.isArray(events)||
  !integer(maxTickWindow)||maxTickWindow>100)
  throw Error('Invalid receipt matcher input');
 const stream=events.filter(e=>e.schema==='craftle.server-event.v1');
 for(let i=0;i<stream.length;i++){
  const e=stream[i];
  if(!opaqueItem(e.serverBootId)||!integer(e.sequence)||!integer(e.serverTick))
   throw Error('Server event missing authoritative ordering fields');
  if(i&&e.serverBootId===stream[i-1].serverBootId&&
   (e.sequence<=stream[i-1].sequence||e.serverTick<stream[i-1].serverTick))
   throw Error('Nonmonotonic server records');
 }
 const samples=stream.filter(e=>e.event==='block_state_post_tick'&&
  validPosition(e)&&opaqueItem(e.block));
 const outcomes=[];
 for(const intent of intents){
  if(!integer(intent.decisionId)||!['dig','place'].includes(intent.operation)||
   !validPosition(intent)||!opaqueItem(intent.playerUuid)||
   !opaqueItem(intent.serverBootId)||!integer(intent.notBeforeServerTick))
   throw Error('Invalid block edit intent');
  const candidates=samples.filter(e=>
   e.serverBootId===intent.serverBootId&&
   e.playerUuid===intent.playerUuid&&sameBlock(e,intent)&&
   e.serverTick>=intent.notBeforeServerTick&&
   e.serverTick<=intent.notBeforeServerTick+maxTickWindow);
  // A post-tick snapshot is server-origin but does not identify which agent
  // command caused a concurrent state change. Do not grant causal credit.
  const expected=intent.operation==='dig'?'minecraft:air':intent.itemBlockState;
  if(!opaqueItem(expected))throw Error('Placement needs expected block state');
  const matching=candidates.filter(s=>s.block===expected);
  const other=candidates.filter(s=>s.block!==expected);
  const prior=stream.filter(e=>e.event==='block_break_event'&&
   e.serverBootId===intent.serverBootId&&
   e.playerUuid===intent.playerUuid&&sameBlock(e,intent)&&
   e.serverTick>=intent.notBeforeServerTick&&
   e.serverTick<=intent.notBeforeServerTick+maxTickWindow);
  let status='unconfirmed';
  if(matching.length===1&&!other.length)status='observed_expected_state';
  if(matching.length>1||other.length&&matching.length)status='ambiguous_observations';
  if(!matching.length&&other.length)status='observed_different_state';
  outcomes.push({
   decisionId:intent.decisionId,operation:intent.operation,
   status,confirmedState:status==='observed_expected_state',
   // NO credit, even after observing the expected state: independent causal
   // attribution needs unambiguous actor-command binding.
   causallyAttributed:false,eligibleForReward:false,
   evidenceSequences:matching.map(e=>e.sequence),
   observedServerTicks:candidates.map(e=>e.serverTick),
   precedingBreakEventSequences:prior.map(e=>e.sequence)
  });
 }
 // Multiple intents aimed at the same block within overlapping windows
 // cannot inherit the same snapshot as distinct confirmations.
 const overlaps=new Map();
 for(let i=0;i<intents.length;i++){
  const intent=intents[i],out=outcomes[i];
  for(const seq of out.evidenceSequences){
   const key=intent.serverBootId+':'+seq;
   if(!overlaps.has(key))overlaps.set(key,[]);
   overlaps.get(key).push(i);
  }
 }
 for(const indices of overlaps.values())if(indices.length>1)
  for(const i of indices){
   outcomes[i].status='ambiguous_shared_observation';
   outcomes[i].confirmedState=false;
  }
 return {
  schema:'craftle.server-motor-receipts.v1',
  authoritativeEventsConsidered:stream.length,
  outcomes,confirmedStateObservations:outcomes.filter(x=>x.confirmedState).length,
  causallyAttributed:0,rewardEligible:0,
  limitation:'Post-tick block state confirms an observation, not a particular command. Server callbacks, timestamps and matching coordinates alone never prove causal motor attribution.'
 };
}
