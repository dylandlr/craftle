// Read-only server tick sample calibration. Reject ungrounded tick claims.
// A gameTime value is authoritative only when supplied by a Minecraft server
// response or a validated protocol observation, never derived from wall time.
export class ServerTickClock {
 constructor(){this.last=null;this.epoch=0;}
 observe({gameTime,observedAt,source,worldId}){
  if(!Number.isSafeInteger(gameTime)||gameTime<0||!Number.isFinite(observedAt)||!worldId||!['server_query','server_packet'].includes(source))throw Error('unverified server clock sample');
  if(this.last&&worldId!==this.last.worldId){this.epoch++;this.last=null;}
  if(this.last&&gameTime<this.last.gameTime){this.epoch++;this.last=null;}
  const sample={schema:'craftle.server-clock.v1',worldId,epoch:this.epoch,gameTime,observedAt,source};
  this.last=sample;return sample;
 }
 interval(start,end){
  if(!start||!end||start.worldId!==end.worldId||start.epoch!==end.epoch)throw Error('clock epoch mismatch');
  const duration=end.gameTime-start.gameTime;
  if(!Number.isSafeInteger(duration)||duration<1)throw Error('invalid server tick interval');
  return {startTick:start.gameTime,endTick:end.gameTime,duration,source:'sampled_server_clock',uncertainty:'events between samples cannot be assigned exact ticks'};
 }
}
