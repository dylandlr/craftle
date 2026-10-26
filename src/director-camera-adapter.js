// This adapter must execute in the SAME JavaScript realm as Prismarine Viewer's
// Viewer instance. The stock viewer iframe does not expose that object.
export function createDirectorCameraAdapter(viewer,{smoothing=0.18}={}){
 if(!viewer?.camera?.position?.set||typeof viewer.camera.lookAt!=='function')
   throw Error('A Prismarine Viewer instance with a Three.js camera is required');
 const camera=viewer.camera;
 let mode='auto',latest=null,lastObservedAt=null;
 const finitePoint=p=>p&&['x','y','z'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]));
 const accept=state=>{
  if(!state||state.schema!=='craftle.director-pose.v1'||!state.available||
      !finitePoint(state.camera)||!finitePoint(state.target)||
      typeof state.observedAt!=='string'||!Number.isFinite(Date.parse(state.observedAt)))return false;
  latest={camera:{...state.camera},target:{...state.target},observedAt:state.observedAt};
  return true;
 };
 const tick=(now=Date.now())=>{
  if(mode!=='auto'||!latest||now-Date.parse(latest.observedAt)>10000)return false;
  const blend=Math.max(0,Math.min(1,smoothing));
  if(lastObservedAt===null||camera.position.x===undefined){
   camera.position.set(latest.camera.x,latest.camera.y,latest.camera.z);
  }else{
   camera.position.set(
    camera.position.x+(latest.camera.x-camera.position.x)*blend,
    camera.position.y+(latest.camera.y-camera.position.y)*blend,
    camera.position.z+(latest.camera.z-camera.position.z)*blend);
  }
  camera.lookAt(latest.target.x,latest.target.y,latest.target.z);
  lastObservedAt=latest.observedAt;
  return true;
 };
 const setMode=next=>{if(next!=='auto'&&next!=='manual')throw Error('Invalid camera mode');mode=next;};
 return {accept,tick,setMode,getMode:()=>mode,getLatest:()=>latest};
}

// EventSource is deliberately read-only; this never sends a command to Mineflayer.
export function connectDirectorStream(adapter,{url='/api/director/stream',EventSourceClass=globalThis.EventSource}={}){
 if(!EventSourceClass)throw Error('EventSource unavailable');
 const stream=new EventSourceClass(url);
 const listener=event=>{
  try{adapter.accept(JSON.parse(event.data));}catch{}
 };
 stream.addEventListener('director',listener);
 return ()=>{stream.removeEventListener?.('director',listener);stream.close();};
}
