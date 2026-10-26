// Patch the installed Prismarine Viewer browser entry before building its webpack bundle.
// Fails closed if upstream source changes. The Mineflayer server and the stock
// viewer remain available if the optional custom bundle cannot be built.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('node_modules/prismarine-viewer');
const entry=path.join(root,'lib/index.js');
let source=fs.readFileSync(entry,'utf8');
const renderLine='  renderer.render(viewer.scene, viewer.camera)';
const afterViewer='const viewer = new Viewer(renderer)';
if(!source.includes(renderLine)||!source.includes(afterViewer))
  throw Error('Unsupported Prismarine Viewer browser entry; camera patch not applied');
const fixed=process.env.CRAFTLE_VIEWER_CAMERA_BUILD==='fixed';
const injected=`
// Craftle read-only chase camera. Never emits socket actions or Mineflayer commands.
let craftleShot = null;
let craftleFallback = null;
let craftleLastAt = 0;
let craftleAuto = true;
let craftleFrames = 0;
let craftleLastReport = 0;
let craftleSource = 'none';
function craftleChase(pos,yaw) {
  if(!pos || ![pos.x,pos.y,pos.z,yaw].every(Number.isFinite))return null;
  const back=6,elevation=3.6;
  return {camera:{x:pos.x+Math.sin(yaw)*back,y:pos.y+1.1+elevation,z:pos.z+Math.cos(yaw)*back},
    target:{x:pos.x,y:pos.y+1.1,z:pos.z}};
}
if (!${fixed}) { /* director stream disabled for fixed chase builds */ }
const craftleStream = ${fixed} ? null : new EventSource('http://127.0.0.1:3001/api/director/stream');
craftleStream?.addEventListener('director', event => {
  try {
    const shot = JSON.parse(event.data);
    const pt = v => v && ['x','y','z'].every(k => Number.isFinite(v[k]));
    if (shot.available && pt(shot.camera) && pt(shot.target) &&
        Number.isFinite(Date.parse(shot.observedAt))) {
      craftleShot = shot; craftleLastAt = Date.parse(shot.observedAt);
    } else craftleShot = null;
  } catch {}
});
window.addEventListener('message', event => {
  if(event.origin !== 'http://127.0.0.1:3001' || event.source !== window.parent)return;
  if(event.data?.type === 'craftle-camera-mode')
    craftleAuto = event.data.mode !== 'manual';
});
`;
source=source.replace(afterViewer,afterViewer+'\n'+injected);
const positionHook="  socket.on('position', ({ pos, addMesh, yaw, pitch }) => {";
if(!source.includes(positionHook))throw Error('Viewer position handler changed; fallback not installed');
source=source.replace(positionHook,positionHook+"\n    craftleFallback = craftleChase(pos,yaw);");
source=source.replace(renderLine,`  const streamFresh=${fixed?'false':'craftleShot && Date.now()-craftleLastAt<10000'};
  const activeShot=streamFresh ? craftleShot : craftleFallback;
  craftleSource=streamFresh?'director':craftleFallback?'viewer-socket':'none';
  if (craftleAuto && activeShot) {
    if(controls){controls.enabled=false;}
    const p=activeShot.camera,t=activeShot.target;
    viewer.camera.position.lerp(new THREE.Vector3(p.x,p.y,p.z),0.12);
    viewer.camera.lookAt(t.x,t.y,t.z);
  }else if(controls)controls.enabled=true;
  craftleFrames++;
  if(Date.now()-craftleLastReport>1000){
    craftleLastReport=Date.now();
    window.parent.postMessage({type:'craftle-renderer-status',version:2,
      source:craftleSource,auto:craftleAuto,frames:craftleFrames,
      applied:Boolean(craftleAuto&&activeShot),
      camera:{x:viewer.camera.position.x,y:viewer.camera.position.y,z:viewer.camera.position.z}},
      'http://127.0.0.1:3001');
  }
`+renderLine);
fs.writeFileSync(entry,source);
console.log('Craftle camera injected into Prismarine Viewer browser entry');
