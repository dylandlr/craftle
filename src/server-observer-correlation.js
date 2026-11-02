/** Conservative association: server observations are not causal proof of agent options. */
export function correlateServerEvent(event, decision, acknowledgment=null) {
 if(!event || event.schema!=='craftle.server-event.v1' || !Number.isSafeInteger(event.tickIndex) || !event.serverRunId)
  return {status:'invalid_server_event'};
 if(!decision?.runId || !decision?.optionId || !decision?.playerUuid)
  return {status:'missing_identity',serverRunId:event.serverRunId,tickIndex:event.tickIndex};
 if(event.playerUuid!==decision.playerUuid) return {status:'different_player'};
 if(!acknowledgment || acknowledgment.runId!==decision.runId ||
    acknowledgment.optionId!==decision.optionId ||
    acknowledgment.serverRunId!==event.serverRunId ||
    acknowledgment.playerUuid!==event.playerUuid ||
    !Number.isSafeInteger(acknowledgment.serverTick))
  return {status:'temporal_association_only',reason:'no_authoritative_option_start_ack'};
 if(event.tickIndex<acknowledgment.serverTick) return {status:'precedes_option_start'};
 return {status:'temporally_within_option',startTick:acknowledgment.serverTick,eventTick:event.tickIndex,
   elapsedTicks:event.tickIndex-acknowledgment.serverTick,
   causalProof:false,reason:'synchronized identities/ticks do not prove action caused world-state change'};
}
