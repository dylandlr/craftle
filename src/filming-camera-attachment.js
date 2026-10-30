// Keep camera attachment stable. Reassert only for actual lifecycle changes,
// optionally using a heartbeat for troubleshooting.
export function shouldAttachCamera({pending,lastAttach=0,now=Date.now(),heartbeatMs=0}){
 if(pending)return {attach:true,reason:'pending'};
 if(Number.isFinite(heartbeatMs)&&heartbeatMs>0&&now-lastAttach>=heartbeatMs)
  return {attach:true,reason:'optional_heartbeat'};
 return {attach:false,reason:'stable_attachment'};
}
