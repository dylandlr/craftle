// Deterministic obstacle-aware navigation baseline. No LLM, no privileged world map.
// Looks at local blocks, walks toward a heading, jumps small obstructions, turns when stuck.
export function decideNavigation({forwardBlocked, groundAhead, displacement, tick, agentIndex}) {
  if (!Number.isFinite(displacement)) throw Error('displacement must be finite');
  const stuck = tick > 2 && displacement < 0.15;
  const unsafe = forwardBlocked || !groundAhead;
  const turn = stuck || unsafe;
  return {
    forward: !turn,
    jump: forwardBlocked && Boolean(groundAhead),
    yawDelta: turn ? (Math.PI * (0.5 + ((agentIndex + tick) % 3) / 4)) : 0,
    reason: stuck ? 'stuck_recovery' : !groundAhead ? 'unsafe_edge' : forwardBlocked ? 'obstacle' : 'explore_forward'
  };
}
