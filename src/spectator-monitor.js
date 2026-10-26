import http from 'node:http';
import net from 'node:net';
import {readAgentTelemetry} from './spectator-telemetry.js';
import {smoothDirectorPose} from './spectator-director.js';

export function cameraReachable({host='127.0.0.1',port=3000,timeoutMs=700}={}){
  return new Promise(resolve=>{
    const socket=net.connect({host,port});
    const finish=ok=>{socket.destroy();resolve(ok);};
    socket.once('connect',()=>finish(true));
    socket.once('error',()=>finish(false));
    socket.setTimeout(timeoutMs,()=>finish(false));
  });
}

export function spectatorHtml(){
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Craftle · Spectator Monitor</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,Arial;background:#10151d;color:#eff5fc}
*{box-sizing:border-box}body{margin:0}header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#17202c;border-bottom:1px solid #314052}
h1{font-size:17px;margin:0}small{color:#a9b7c8}main{max-width:1600px;margin:0 auto;padding:16px}.viewport{position:relative;background:#080c12;aspect-ratio:16/9;border:1px solid #35465c;border-radius:12px;overflow:hidden}
iframe{display:block;width:100%;height:100%;border:0}.viewport[data-camera-mode='auto'] iframe{pointer-events:none}.viewport[data-camera-mode='manual'] iframe{pointer-events:auto}.camera-shield{position:absolute;inset:0;z-index:2;pointer-events:none}.viewport[data-camera-mode='manual'] .camera-shield{display:none}#offline{position:absolute;inset:0;display:none;place-content:center;text-align:center;background:#10151dee;pointer-events:none}
.controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:14px 0}button,a{background:#27394e;color:#f0f7ff;border:1px solid #547397;border-radius:8px;padding:10px 14px;font:inherit;text-decoration:none;cursor:pointer}button:hover,a:hover{background:#334e6b}button:focus-visible,a:focus-visible{outline:2px solid #9bc7ff} .status{margin-left:auto;font-size:13px;color:#bed0df}
.inspector{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;padding:14px;background:#17202c;border:1px solid #314052;border-radius:10px}.metric{display:flex;flex-direction:column;gap:4px;font-size:14px}.metric strong{font-weight:600}.metric small{font-size:12px}.note{color:#b0c0ce;font-size:13px;line-height:1.5}.green{color:#7be1ae}.amber{color:#e7c17a}
</style></head><body><header><div><h1>Craftle · Spectator Monitor</h1><small>Watch-only by default · observer commands never control the learning agent</small></div><small id="mode">AUTO VIEW</small></header>
<main><section class="viewport" id="viewport" data-camera-mode="auto" aria-label="Live Minecraft spectator viewer">
<iframe id="viewer" title="Live third-person Prismarine Viewer" src="http://127.0.0.1:3000/" allowfullscreen></iframe>
<div class="camera-shield" id="camera-shield" aria-hidden="true"></div>\n<div id="offline"><h2>Waiting for camera</h2><p>Agent session is reconnecting. The monitor remains available.</p></div></section>
<div class="controls">
<button id="take-camera" type="button">Take Camera · WASD</button>\n<button id="return-auto" type="button" disabled>↺ Return to Auto</button>
<a href="http://127.0.0.1:3000/" target="_blank" rel="noopener noreferrer">Open raw camera ↗</a>
<span class="status" id="status" role="status" aria-live="polite">Checking camera…</span>
</div>
<section class="inspector" aria-label="Agent inspector">
<div class="metric"><small>Agent</small><strong id="agent-name">Waiting for telemetry</strong></div>
<div class="metric"><small>Health / Hunger</small><strong id="vitals">—</strong></div>
<div class="metric"><small>Position</small><strong id="position">—</strong></div>
<div class="metric"><small>Recent action</small><strong id="last-action">—</strong></div>
<div class="metric"><small>Latest event</small><strong id="last-event">—</strong></div>
<div class="metric"><small>Telemetry</small><strong id="freshness">Not connected</strong></div>\n<div class="metric"><small>Motion / desired framing</small><strong id="shot">—</strong></div>\n<div class="metric"><small>Drone distance / height</small><strong id="drone-pose">—</strong></div>\n<div class="metric"><small>Recent particles / sounds</small><strong id="effect">—</strong></div>
</section>
<p class="note" id="camera-help">Auto mode: spectator camera is watch-only. Take Camera enables the viewer’s built-in free navigation. WASD move, Space up, Shift down, drag mouse to orbit.</p>\n<p class="note">This page watches the current Prismarine Viewer camera. Return to Auto reloads the viewer's default follow camera; it does not alter AI movement, training or checkpoints. The current camera is still attached to each agent session: actual sound playback, particles, avatar animation and applying drone camera poses to Prismarine Viewer are not implemented yet. The inspector shows observed effects and a desired camera shot, not rendered effects.</p>
</main><script>
const frame=document.getElementById('viewer'),offline=document.getElementById('offline'),status=document.getElementById('status');
const viewport=document.getElementById('viewport'),take=document.getElementById('take-camera');
const back=document.getElementById('return-auto'),mode=document.getElementById('mode');
const help=document.getElementById('camera-help');
let connected=null,manual=false;
function resetCamera(){frame.src='http://127.0.0.1:3000/?camera_reset='+Date.now();}
function setManual(enabled){
 manual=enabled;
 viewport.dataset.cameraMode=manual?'manual':'auto';
 mode.textContent=manual?'MANUAL CAMERA':'AUTO VIEW';
 take.disabled=manual;
 back.disabled=!manual;
 help.textContent=manual?'Manual mode: click inside the viewer to focus its controls. Escape returns to Auto.':'Auto mode: the existing Prismarine camera follows the agent. Camera controls are watch-only.';
 if(manual)frame.focus();else{take.focus();resetCamera();}
}
take.addEventListener('click',()=>setManual(true));
back.addEventListener('click',()=>setManual(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&manual)setManual(false);});
async function check(){
 try{
  const response=await fetch('/api/status',{cache:'no-store'});
  if(!response.ok)throw Error('monitor status unavailable');
  const data=await response.json();
  const online=!!data.cameraReachable;
  if(connected===false&&online)resetCamera();\n  if(!online&&manual)setManual(false);
  connected=online;offline.style.display=online?'none':'grid';
  status.textContent=online?'● Camera server connected':'● Camera offline / reconnecting';
  status.className='status '+(online?'green':'amber');
 }catch{status.textContent='Monitor connection interrupted';status.className='status amber';}
}
async function inspect(){
 try{
  const response=await fetch('/api/agent',{cache:'no-store'});
  if(!response.ok)throw Error('telemetry unavailable');
  const data=await response.json(),a=data.agent;
  const put=(id,value)=>{document.getElementById(id).textContent=String(value);};
  if(!a){put('agent-name','Waiting for telemetry');put('freshness','Unavailable');return;}
  put('agent-name',a.name+' ('+a.id+')');
  put('vitals',(a.health??'—')+' HP / '+(a.food??'—')+' food');
  put('position',a.position?[a.position.x,a.position.y,a.position.z].map(n=>n.toFixed(1)).join(', '):'—');
  put('last-action',a.lastAction?.action??a.lastAction?.type??'—');
  put('last-event',a.lastEvent?.type??'—');
  put('shot',a.shot?a.shot.animation+' · '+a.shot.zoomIntent+' zoom':'—');\n  put('drone-pose',a.shot?a.shot.distance.toFixed(1)+' blocks back · '+a.shot.height.toFixed(1)+' up':'—');
  const effect=a.effects?.[a.effects.length-1];
  put('effect',effect?effect.kind+(effect.name?' · '+effect.name:''):'—');
  put('freshness',a.stale?'Stale / session gap':'Live · '+new Date(a.lastObservedAt).toLocaleTimeString());
 }catch{document.getElementById('freshness').textContent='Unavailable';}
}
check();inspect();setInterval(check,3000);setInterval(inspect,2000);
</script></body></html>`;
}

export function startSpectatorMonitor({port=3001,host='0.0.0.0',cameraHost='127.0.0.1',cameraPort=3000,telemetryRoot=null}={}){
  const page=spectatorHtml();
  let lastPose=null,lastObservedAt=null;
  const server=http.createServer(async(req,res)=>{
    const route=(req.url??'/').split('?')[0];
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'; frame-src http://127.0.0.1:3000; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'");
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    if(route==='/api/director'){
      let agent=null;
      if(telemetryRoot)try{agent=readAgentTelemetry(telemetryRoot).agent;}catch{}
      // Only a fresh motion report can steer the camera. Never let stale telemetry make it drift.
      const valid=Boolean(agent&&!agent.stale&&agent.motion&&agent.shot);
      if(valid&&agent.motion.timestamp!==lastObservedAt){
        lastPose=smoothDirectorPose(lastPose,agent.shot,0.22);
        lastObservedAt=agent.motion.timestamp;
      }
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({schema:'craftle.director-pose.v1',available:valid,
        camera:valid?lastPose?.camera:null,target:valid?lastPose?.target:null,
        distance:valid?agent.shot.distance:null,animation:valid?agent.shot.animation:null,
        zoomIntent:valid?agent.shot.zoomIntent:null,agentId:valid?agent.id:null,
        observedAt:valid?agent.motion.timestamp:null,renderApplied:false,
        control:'read_only',time:new Date().toISOString()}));
    }else if(route==='/api/agent'){
      let data={available:false,agent:null};
      if(telemetryRoot)try{data=readAgentTelemetry(telemetryRoot);}catch{}
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({schema:'craftle.spectator-agent.v1',...data}));
    }else if(route==='/api/status'){
      const reachable=await cameraReachable({host:cameraHost,port:cameraPort});
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({schema:'craftle.spectator-status.v1',cameraReachable:reachable,controlMode:'watch_only',time:new Date().toISOString()}));
    }else if(route==='/'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(page);
    }else{res.writeHead(404);res.end('Not found');}
  });
  server.listen(port,host);
  return server;
}
