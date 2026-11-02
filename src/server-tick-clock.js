// Read-only server tick sample calibration. Reject ungrounded tick claims.
// A gameTime value is authoritative only when supplied by a Minecraft server
// response or a validated protocol observation, never derived from wall time.
import {randomUUID} from 'node:crypto';
export class ServerTickClock {
 constructor({collectorSessionId=randomUUID()}={}){
  if(typeof collectorSessionId!=='string'||!collectorSessionId.trim())throw Error('Invalid collector session ID');
  this.collectorSessionId=collectorSessionId;this.sequence=0;this.last=null;this.epoch=0;
 }
 observe({gameTime,observedAt,source,worldId}){
  if(!Number.isSafeInteger(gameTime)||gameTime<0||!Number.isFinite(observedAt)||typeof worldId!=='string'||!worldId.trim()||!['server_query','server_packet'].includes(source))throw Error('unverified server clock sample');
  if(this.last&&worldId!==this.last.worldId){this.epoch++;this.last=null;}
  if(this.last&&(gameTime<this.last.gameTime||observedAt<this.last.observedAt)){this.epoch++;this.last=null;}
  const sample={schema:'craftle.server-clock.v2',collectorSessionId:this.collectorSessionId,sampleSequence:++this.sequence,worldId,epoch:this.epoch,gameTime,observedAt,source};
  this.last=sample;return sample;
 }
 interval(start,end){
  if(!start||!end||start.worldId!==end.worldId||start.epoch!==end.epoch||!start.collectorSessionId||start.collectorSessionId!==end.collectorSessionId)throw Error('clock epoch mismatch');
  const duration=end.gameTime-start.gameTime;
  if(!Number.isSafeInteger(duration)||duration<1)throw Error('invalid server tick interval');
  return {startTick:start.gameTime,endTick:end.gameTime,duration,source:'sampled_server_clock',uncertainty:'events between samples cannot be assigned exact ticks'};
 }
}
