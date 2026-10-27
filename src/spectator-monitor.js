import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {readAgentTelemetry} from './spectator-telemetry.js';
import {smoothDirectorPose} from './spectator-director.js';
import {readEventAnnotations} from './spectator-annotations.js';
import {readObservatoryEvents} from './spectator-observatory-data.js';
import {readHudState} from './spectator-hud-state.js';

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
.events{margin-top:14px;border:1px solid #314052;border-radius:10px;background:#17202c;padding:12px}.events ul{padding:0;list-style:none;margin:8px 0;max-height:260px;overflow:auto}.events li{padding:7px 5px;border-top:1px solid #314052;font-size:13px}.events time{color:#a9b7c8;margin-right:8px}.inspector{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;padding:14px;background:#17202c;border:1px solid #314052;border-radius:10px}.metric{display:flex;flex-direction:column;gap:4px;font-size:14px}.metric strong{font-weight:600}.metric small{font-size:12px}.note{color:#b0c0ce;font-size:13px;line-height:1.5}.obs-frame{height:1100px;max-height:85vh;border:1px solid #35465c;border-radius:12px;width:100%;background:#10151d}.green{color:#7be1ae}.amber{color:#e7c17a}
</style></head><body><header><div><h1>Craftle · Spectator Monitor</h1><small>Watch-only by default · observer commands never control the learning agent</small></div><small id="mode">AUTO VIEW</small></header>
<main><section class="viewport" id="viewport" data-camera-mode="auto" aria-label="Live Minecraft spectator viewer">
<iframe id="viewer" title="Live third-person Prismarine Viewer" src="about:blank" allowfullscreen></iframe>
<div class="camera-shield" id="camera-shield" aria-hidden="true"></div>
<div id="offline"><h2>Waiting for camera</h2><p>Agent session is reconnecting. The monitor remains available.</p></div></section>
<div class="controls">
<button id="take-camera" type="button">Take Camera · WASD</button>
<button id="return-auto" type="button" disabled>↺ Return to Auto</button>
<a id="raw-camera" href="#" target="_blank" rel="noopener noreferrer">Open raw camera ↗</a>
<span class="status" id="status" role="status" aria-live="polite">Checking camera…</span>
</div>
<section class="inspector" aria-label="Agent inspector">
<div class="metric"><small>Agent</small><strong id="agent-name">Waiting for telemetry</strong></div>
<div class="metric"><small>Health / Hunger</small><strong id="vitals">—</strong></div>
<div class="metric"><small>Position</small><strong id="position">—</strong></div>
<div class="metric"><small>Recent action</small><strong id="last-action">—</strong></div>
<div class="metric"><small>Latest event</small><strong id="last-event">—</strong></div>
<div class="metric"><small>Telemetry</small><strong id="freshness">Not connected</strong></div>
<div class="metric"><small>Camera renderer</small><strong id="renderer-status">Not reporting</strong></div>
<div class="metric"><small>Motion / desired framing</small><strong id="shot">—</strong></div>
<div class="metric"><small>Drone distance / height</small><strong id="drone-pose">—</strong></div>
<div class="metric"><small>Recent particles / sounds</small><strong id="effect">—</strong></div>
</section>
<section aria-label="All agent research views"><h2>Agent Observatory · All 18 diagnostic views</h2><p class="note">The local interactive workspace is available below; load a filming agent log in its file picker. It does not control Turesla.</p><iframe class="obs-frame" title="Craftle Agent Observatory" src="/observatory"></iframe></section>\n<section class="events" aria-label="Observed gameplay events"><strong>Live action annotations · read-only</strong><ul id="event-list"><li>Waiting for agent events…</li></ul></section>
<p class="note" id="camera-help">Auto mode: spectator camera is watch-only. Take Camera enables the viewer’s built-in free navigation. WASD move, Space up, Shift down, drag mouse to orbit.</p>
<p class="note">This page watches the current Prismarine Viewer camera. Return to Auto reloads the viewer's default follow camera; it does not alter AI movement, training or checkpoints. The current camera is still attached to each agent session: actual sound playback, particles, avatar animation and applying drone camera poses to Prismarine Viewer are not implemented yet. The inspector shows observed effects and a desired camera shot, not rendered effects.</p>
</main><script>
const frame=document.getElementById('viewer'),offline=document.getElementById('offline'),status=document.getElementById('status');
const viewerOrigin='http://127.0.0.1:'+(window.location.port==='3011'?'3010':'3000');
frame.src=viewerOrigin+'/';document.getElementById('raw-camera').href=viewerOrigin+'/';
const viewport=document.getElementById('viewport'),take=document.getElementById('take-camera');
const back=document.getElementById('return-auto'),mode=document.getElementById('mode');
const help=document.getElementById('camera-help');
let connected=null,manual=false,lastRendererReport=0;
window.addEventListener('message',event=>{
 if(event.origin!==viewerOrigin||event.source!==frame.contentWindow||event.data?.type!=='craftle-renderer-status')return;
 lastRendererReport=Date.now();
 const d=event.data;
 document.getElementById('renderer-status').textContent=d.applied?'Applying '+d.source+' · frame '+d.frames:d.auto?'Waiting for position · frame '+d.frames:'Manual camera';
});
function resetCamera(){
 // Never reload a live WebGL iframe for camera handoff: reloading destroys its
 // canvas, socket subscription and chunk meshes, which can leave it black.
 frame.contentWindow?.postMessage({type:'craftle-camera-mode',mode:'auto'},viewerOrigin);
}
function setManual(enabled){
 manual=enabled;
 viewport.dataset.cameraMode=manual?'manual':'auto';
 mode.textContent=manual?'MANUAL CAMERA':'AUTO VIEW';
 take.disabled=manual;
 back.disabled=!manual;
 help.textContent=manual?'Manual mode: click inside the viewer to focus its controls. Escape returns to Auto.':'Auto mode: the existing Prismarine camera follows the agent. Camera controls are watch-only.';
 frame.contentWindow?.postMessage({type:'craftle-camera-mode',mode:manual?'manual':'auto'},'http://127.0.0.1:3000');
 if(manual)frame.focus();else take.focus();
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
  // The viewer owns its reconnection. Do not reload its canvas on status transitions.
  if(!online&&manual)setManual(false);
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
  put('shot',a.shot?a.shot.animation+' · '+a.shot.zoomIntent+' zoom':'—');
  put('drone-pose',a.shot?a.shot.distance.toFixed(1)+' blocks back · '+a.shot.height.toFixed(1)+' up':'—');
  const effect=a.effects?.[a.effects.length-1];
  put('effect',effect?effect.kind+(effect.name?' · '+effect.name:''):'—');
  if(Date.now()-lastRendererReport>4000)put('renderer-status','No renderer report — check refresh or bundle');
  put('freshness',a.stale?'Stale / session gap':'Live · '+new Date(a.lastObservedAt).toLocaleTimeString());
 }catch{document.getElementById('freshness').textContent='Unavailable';}
}
async function annotations(){
 try{
  const res=await fetch('/api/annotations',{cache:'no-store'});
  if(!res.ok)return;
  const data=await res.json(),list=document.getElementById('event-list');
  list.replaceChildren();
  for(const e of data.events.slice(-18).reverse()){
   const li=document.createElement('li'),time=document.createElement('time');
   time.textContent=new Date(e.time).toLocaleTimeString();li.appendChild(time);
   const position=e.position?' @ '+[e.position.x,e.position.y,e.position.z].map(x=>x.toFixed(1)).join(', '):'';
   li.appendChild(document.createTextNode(e.symbol+' '+e.label+(e.action?' · '+e.action:'')+(e.targetId?' · '+e.targetId:'')+position));
   list.appendChild(li);
  }
  if(!list.children.length){const li=document.createElement('li');li.textContent='No observed actions yet';list.appendChild(li);}
 }catch{}
}
check();inspect();annotations();setInterval(check,3000);setInterval(inspect,2000);setInterval(annotations,1500);
</script></body></html>`;
}

export function startSpectatorMonitor({port=3001,host='0.0.0.0',cameraHost='127.0.0.1',cameraPort=3000,telemetryRoot=null}={}){
  const page=spectatorHtml();
  let lastPose=null,lastObservedAt=null;
  const subscribers=new Set();
  let lastEmitted=null;
  function directorPayload(){
    let agent=null;
    if(telemetryRoot)try{agent=readAgentTelemetry(telemetryRoot).agent;}catch{}
    const valid=Boolean(agent&&!agent.stale&&agent.motion&&agent.shot);
    if(valid&&agent.motion.timestamp!==lastObservedAt){
      lastPose=smoothDirectorPose(lastPose,agent.shot,0.22);
      lastObservedAt=agent.motion.timestamp;
    }
    return {schema:'craftle.director-pose.v1',available:valid,
      camera:valid?lastPose?.camera:null,target:valid?lastPose?.target:null,
      distance:valid?agent.shot.distance:null,animation:valid?agent.shot.animation:null,
      zoomIntent:valid?agent.shot.zoomIntent:null,agentId:valid?agent.id:null,
      observedAt:valid?agent.motion.timestamp:null,renderApplied:false,
      control:'read_only',time:new Date().toISOString()};
  }
  const streamTimer=setInterval(()=>{
    if(!subscribers.size)return;
    const state=directorPayload();
    const fingerprint=JSON.stringify([state.available,state.observedAt,state.camera,state.target]);
    if(fingerprint===lastEmitted)return;
    lastEmitted=fingerprint;
    const payload='event: director\ndata: '+JSON.stringify(state)+'\n\n';
    for(const res of subscribers){
      if(res.destroyed||res.writableLength>65536){subscribers.delete(res);res.end();continue;}
      res.write(payload);
    }
  },200);
  const server=http.createServer(async(req,res)=>{
    const route=(req.url??'/').split('?')[0];
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'; frame-src 'self' http://127.0.0.1:3000 http://127.0.0.1:3010; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'");
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    if(route==='/api/director/stream'){
      res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:3000');
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8',
        'Connection':'keep-alive','X-Accel-Buffering':'no'});
      res.write('retry: 1500\n\n');
      res.write('event: director\ndata: '+JSON.stringify(directorPayload())+'\n\n');
      subscribers.add(res);
      req.on('close',()=>subscribers.delete(res));
    }else if(route==='/api/director'){
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify(directorPayload()));
    }else if(route==='/api/agent'){
      let data={available:false,agent:null};
      if(telemetryRoot)try{data=readAgentTelemetry(telemetryRoot);}catch{}
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({schema:'craftle.spectator-agent.v1',...data}));
    }else if(route==='/api/citizens/agent_001/skin.png'){
      const skin=telemetryRoot?path.join(telemetryRoot,'citizens','agent_001.png'):null;
      try{const png=fs.readFileSync(skin);res.writeHead(200,{'Content-Type':'image/png'});res.end(png);}
      catch{res.writeHead(404);res.end('Citizen skin unavailable');}
    }else if(route==='/api/citizens/agent_001'){
      let appearance=null;
      if(telemetryRoot)try{appearance=JSON.parse(fs.readFileSync(path.join(telemetryRoot,'citizens','agent_001.json'),'utf8'));}catch{}
      res.writeHead(appearance?200:404,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({schema:'craftle.citizen-public.v1',id:'agent_001',name:'Turesla',
        appearance,skinUrl:appearance?'/api/citizens/agent_001/skin.png':null,
        skinAppliedInClient:false,cosmeticOnly:true}));
    }else if(route==='/api/hud/state'){
      const state=telemetryRoot?readHudState(telemetryRoot):{schema:'craftle.native-hud.v1',readOnly:true,source:'unavailable',timestamp:null};
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify(state));
    }else if(route==='/api/observatory/events'){
      const events=telemetryRoot?readObservatoryEvents(telemetryRoot):[];
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({schema:'craftle.observatory-events.v1',source:'agent_jsonl_recent_window',
        readOnly:true,events}));
    }else if(route==='/api/density'){
      let latest=null,reason='no_density_events_in_recent_log';
      if(!telemetryRoot)reason='telemetry_root_missing';
      if(telemetryRoot){
        try{
          const name=path.join(telemetryRoot,'continuous','agent.log');
          const fd=fs.openSync(name,'r');
          try{
            const size=fs.fstatSync(fd).size,length=Math.min(size,512*1024);
            const buf=Buffer.alloc(length);fs.readSync(fd,buf,0,length,size-length);
            const data=buf.toString('utf8');
            for(const line of data.split('\\n').reverse()){
              if(!line.startsWith('{"timestamp":'))continue;
              try{
                const e=JSON.parse(line);
                if(e.type==='spectator_density_audit'){
                  latest={timestamp:e.timestamp,occupancyRatio:Number.isFinite(e.occupancyRatio)?e.occupancyRatio:null,
                    known:e.nearbyBlocksKnown,occupied:e.nearbyOccupied,leaves:e.nearbyLeaves,
                    cameraRecommendation:e.cameraRecommendation,cameraApplied:false,source:'mineflayer_block_cache'};
                  reason=latest.occupancyRatio===null?'no_loaded_blocks_for_density':'ok';
                  break;
                }
              }catch{}
            }
          }finally{fs.closeSync(fd);}
        }catch(error){reason='density_log_unreadable';}
      }
      const ageMs=latest?Date.now()-Date.parse(latest.timestamp):null;
      if(latest&&Number.isFinite(ageMs)&&ageMs>10000)reason='density_sample_stale';
      const available=!!latest&&Number.isFinite(latest.occupancyRatio)&&Number.isFinite(ageMs)&&ageMs>=-30000&&ageMs<=10000;
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({schema:'craftle.filming-density.v1',available,density:latest,ageMs,reason,readOnly:true}));
    }else if(route==='/api/annotations'){
      const events=telemetryRoot?readEventAnnotations(telemetryRoot):[];
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({schema:'craftle.spectator-annotations.v1',events,source:'agent_observed_not_authoritative_server_log'}));
    }else if(route==='/observatory'){
      // This is the bundled read-only local diagnostics workstation.
      try{const html=fs.readFileSync(new URL('../tools/craftle-observatory.html',import.meta.url),'utf8');
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);}
      catch{res.writeHead(503);res.end('Observatory asset unavailable');}
    }else if(route==='/api/status'){
      const reachable=await cameraReachable({host:cameraHost,port:cameraPort});
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({schema:'craftle.spectator-status.v1',cameraReachable:reachable,controlMode:'watch_only',time:new Date().toISOString()}));
    }else if(route==='/'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(page);
    }else{res.writeHead(404);res.end('Not found');}
  });
  server.on('close',()=>{clearInterval(streamTimer);for(const res of subscribers)res.end();subscribers.clear();});
  server.listen(port,host);
  return server;
}
