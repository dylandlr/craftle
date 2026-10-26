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
const injected=`
// Craftle read-only chase camera. Never emits socket actions or Mineflayer commands.
let craftleShot = null;
let craftleLastAt = 0;
let craftleAuto = true;
const craftleStream = new EventSource('http://127.0.0.1:3001/api/director/stream');
craftleStream.addEventListener('director', event => {
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
source=source.replace(renderLine,`  if (craftleAuto && craftleShot && Date.now()-craftleLastAt<10000) {
    if(controls)controls.enabled=false;
    const p=craftleShot.camera,t=craftleShot.target;
    viewer.camera.position.lerp(new THREE.Vector3(p.x,p.y,p.z),0.20);
    viewer.camera.lookAt(t.x,t.y,t.z);
  }else if(controls)controls.enabled=true;
`+renderLine);
fs.writeFileSync(entry,source);
console.log('Craftle camera injected into Prismarine Viewer browser entry');
