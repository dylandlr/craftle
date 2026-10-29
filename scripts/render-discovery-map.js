// Render an agent-owned discovery JSON into a standalone, offline HTML map.
// Usage: node scripts/render-discovery-map.js INPUT.json OUTPUT.html
import fs from 'node:fs';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/render-discovery-map.js INPUT.json OUTPUT.html');
const data=JSON.parse(fs.readFileSync(input,'utf8'));
if(data.schema!=='craftle.discovery-memory.v1')throw Error('Unsupported discovery schema');
const json=JSON.stringify(data).replace(/</g,'\\u003c');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Craftle discoveries</title>
<style>body{background:#101820;color:#e7e9e9;font:14px system-ui;margin:24px}
header{display:flex;align-items:center;gap:20px;flex-wrap:wrap}button,select{background:#263543;color:white;border:1px solid #54717c;border-radius:5px;padding:7px}
canvas{width:min(100%,1000px);height:680px;border:1px solid #415462;background:#17252b;image-rendering:pixelated}
aside{max-width:1000px;color:#aebfc7}ul{max-height:190px;overflow:auto}</style>
<header><h1>Craftle · discovered world</h1><label>Dimension <select id="dim"></select></label>
<label><input type="checkbox" id="landmarks" checked> Landmarks</label></header>
<p id="summary"></p><canvas id="map" width="1000" height="680"></canvas>
<aside><p>Only places seen by this agent. Dark areas are unknown, not empty. Hover tiles for coordinates; landmark markers are gold.</p>
<ul id="items"></ul></aside>
<script type="application/json" id="memory">${json}</script><script>
const data=JSON.parse(document.getElementById('memory').textContent),canvas=document.getElementById('map'),ctx=canvas.getContext('2d');
const select=document.getElementById('dim'),items=document.getElementById('items'),summary=document.getElementById('summary');
const dimensions=[...new Set(Object.values(data.cells).map(x=>x.dimension))];
for(const d of dimensions){const o=document.createElement('option');o.value=o.textContent=d;select.appendChild(o)}
let scale=25,minX=0,minZ=0,visible=[],markers=[];
function draw(){
const dim=select.value;visible=Object.values(data.cells).filter(c=>c.dimension===dim);
markers=Object.values(data.landmarks).filter(l=>l.dimension===dim);
ctx.fillStyle='#17252b';ctx.fillRect(0,0,1000,680);
if(!visible.length)return;
const xs=visible.map(c=>c.x),zs=visible.map(c=>c.z),x0=Math.min(...xs)-1,x1=Math.max(...xs)+1,z0=Math.min(...zs)-1,z1=Math.max(...zs)+1;
scale=Math.min(32,960/(x1-x0+1),640/(z1-z0+1));
minX=x0;minZ=z0;
for(const c of visible){
const x=20+(c.x-x0)*scale,y=20+(c.z-z0)*scale;
ctx.fillStyle=c.visits>5?'#357e72':'#4f8f8a';ctx.fillRect(x,y,scale-1,scale-1);
}
if(document.getElementById('landmarks').checked){
for(const m of markers){
const x=20+(m.position.x/data.cellSize-x0+.5)*scale;
const y=20+(m.position.z/data.cellSize-z0+.5)*scale;
ctx.fillStyle='#ffd166';ctx.beginPath();ctx.arc(x,y,Math.max(3,scale*.17),0,Math.PI*2);ctx.fill();
}
}
summary.textContent=data.agentId+' · '+dim+' · '+visible.length+' visited cells · '+markers.length+' observed landmarks · '+data.cellSize+' blocks/cell';
items.replaceChildren();for(const m of markers.slice(0,150)){
const li=document.createElement('li');li.textContent=m.name+' ('+Math.floor(m.position.x)+', '+Math.floor(m.position.y)+', '+Math.floor(m.position.z)+')';items.appendChild(li)}
}
canvas.addEventListener('mousemove',e=>{
const rect=canvas.getBoundingClientRect(),x=e.offsetX*canvas.width/rect.width,y=e.offsetY*canvas.height/rect.height;
const cx=Math.floor((x-20)/scale+minX),cz=Math.floor((y-20)/scale+minZ);
canvas.title='Cell '+cx+', '+cz+' · blocks '+cx*data.cellSize+', '+cz*data.cellSize;
});
select.addEventListener('change',draw);document.getElementById('landmarks').addEventListener('change',draw);draw();
</script></html>`;
fs.writeFileSync(output,html);
console.log('Wrote '+output);
