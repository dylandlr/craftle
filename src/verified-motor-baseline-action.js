// Server-bound action verification for explicitly NON-TRAINING scripted/frozen
// baseline. Based on the same independent binding -> actor event -> linked
// post-tick observation evidence used by Craftle's private reward gate.
// The existing training-reward gate is NOT modified, reused with false
// metadata, or bypassed. This module NEVER authorizes network updates.
// It is a controlled server-event proof, not packet-exclusive causality.
const validId=x=>typeof x==='string'&&x.length>0;
const tick=x=>Number.isSafeInteger(x)&&x>=0;
const sameTarget=(a,b)=>a.world===b.world&&a.x===b.x&&
  a.y===b.y&&a.z===b.z;
const reject=reason=>({
  actionVerified:false,trainingRewardEligible:false,
  rewardEligible:false,reason
});

export function verifyMotorBaselineActionEvidence({
  run,decision,events
}={}){
  // Strict role separation: only a scripted planner or frozen neural policy
  // may receive an observational action receipt. No training run is eligible.
  const scripted=run?.assistance==='scripted_planner'&&
    run?.policy==='scripted_nonlearning_smoke';
  const frozen=run?.assistance==='frozen_offline_neural'&&
    run?.policy==='frozen_neural_evaluation';
  if(run?.schema!=='craftle.motor-learning-manifest.v1'||
    !validId(run.runId)||run.learningEnabled!==false||
    run.trainingEligible!==false||run.isolated!==true||
    !(scripted||frozen))
    return reject('not_scripted_baseline');

  if(!validId(decision?.id)||!validId(decision.runId)||
    decision.runId!==run.runId||!validId(decision.playerUuid)||
    !validId(decision.serverBootId)||
    !validId(decision.world)||
    ![decision.x,decision.y,decision.z].every(Number.isSafeInteger)||
    !['dig','place'].includes(decision.operation)||
    !Array.isArray(events))
    return reject('invalid_decision');

  const bindings=events.filter(e=>
    e?.event==='motor_action_binding'&&
    e.decisionId===decision.id);
  if(bindings.length!==1)return reject('missing_or_ambiguous_binding');
  const binding=bindings[0];
  const matching=e=>e?.experimentId===run.runId&&
    e.serverBootId===decision.serverBootId&&
    e.playerUuid===decision.playerUuid&&
    sameTarget(e,decision);
  if(!matching(binding)||binding.operation!==decision.operation||
    binding.phase!=='server_bound_intent'||
    binding.onlinePlayers!==1||
    !tick(binding.serverTick)||!tick(binding.sequence))
    return reject('invalid_server_binding');
  if(decision.operation==='dig'&&
    (!validId(binding.beforeBlock)||
      binding.beforeBlock==='minecraft:air'))
    return reject('invalid_initial_block');
  if(decision.operation==='place'&&
    binding.beforeBlock!=='minecraft:air')
    return reject('invalid_initial_block');

  // An explicit cancellation or freshness invalidation cannot be credited,
  // including when a matching world mutation occurs later.
  if(events.some(e=>e?.decisionId===decision.id&&
    e.serverBootId===decision.serverBootId&&
    ['motor_binding_cancelled','motor_binding_invalidated'].includes(e.event)))
    return reject('binding_revoked');

  const actorType=decision.operation==='dig'?
    'block_break_event':'block_place_event';
  const actors=events.filter(e=>
    ['block_break_event','block_place_event'].includes(e?.event)&&
    matching(e)&&tick(e.serverTick)&&
    e.serverTick>=binding.serverTick&&
    e.serverTick<=binding.serverTick+100);
  if(actors.length!==1)
    return reject('missing_or_ambiguous_actor_event');
  const actor=actors[0];
  if(actor.event!==actorType||
    actor.boundDecisionId!==decision.id||
    actor.phase!=='event_before_world_mutation'||
    !tick(actor.sequence)||actor.sequence<=binding.sequence)
    return reject('unbound_actor_event');

  const expected=decision.operation==='dig'?
    'minecraft:air':decision.placedBlock;
  if(!validId(expected))return reject('missing_expected_block');
  const posts=events.filter(e=>
    e?.event==='block_state_post_tick'&&
    matching(e)&&e.sourceEventSequence===actor.sequence);
  if(posts.length!==1)
    return reject('missing_or_ambiguous_post_state');
  const post=posts[0];
  const exactNextTick=tick(post.serverTick)&&
    post.serverTick===actor.serverTick+1;
  const orderedSameTick=tick(post.serverTick)&&
    post.serverTick===actor.serverTick&&
    tick(actor.monotonicNsSinceBoot)&&
    tick(post.monotonicNsSinceBoot)&&
    post.monotonicNsSinceBoot>actor.monotonicNsSinceBoot;
  if(post.block!==expected||post.sourceEvent!==actorType||
    post.phase!=='scheduled_next_tick_read_only'||
    !(exactNextTick||orderedSameTick)||
    !tick(post.sequence)||post.sequence<=actor.sequence)
    return reject('unverified_post_state');
  const steps=post.serverTick-binding.serverTick;
  if(!tick(steps)||steps<1)return reject('invalid_duration');

  return {
    actionVerified:true,trainingRewardEligible:false,
    rewardEligible:false,
    evidenceKey:decision.serverBootId+':'+actor.sequence,
    decisionKey:run.runId+':'+decision.id,
    eventSequence:actor.sequence,
    steps,serverTick:post.serverTick,
    reason:scripted?'server_bound_scripted_action_and_post_state':
      'server_bound_frozen_neural_action_and_post_state',
    limitation:'Server binding and observer post-state verify this controlled action; do not interpret as packet-exclusive causality or eligibility for RL updates.'
  };
}
