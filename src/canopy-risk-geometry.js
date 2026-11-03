// Only offer a risky fall when the Minecraft block cache verifies an adjacent
// landing and an unobstructed vertical shaft. No remote world oracle/teleport.
export function findObservedFall({position,samples,blockAt,maxDrop=12}={}){
 if(!position||!Array.isArray(samples)||typeof blockAt!=='function')return null;
 const footY=Math.floor(position.y);
 const empty=b=>b?.boundingBox==='empty';
 const solid=b=>b?.boundingBox==='block';
 const candidates=[];
 for(const s of samples){
  if(!Number.isFinite(s.x)||!Number.isFinite(s.y)||!Number.isFinite(s.z))continue;
  const dx=s.x-Math.floor(position.x),dz=s.z-Math.floor(position.z);
  if(Math.abs(dx)+Math.abs(dz)!==1)continue;
  const drop=footY-s.y;
  if(drop<2||drop>maxDrop||s.feetClear!==true||s.headClear!==true)continue;
  const floor=blockAt(s.x,s.y-1,s.z);
  if(!solid(floor)||floor.name.includes('leaves')||/lava|fire|magma|cactus|campfire/.test(floor.name))continue;
  let clear=true;
  for(let y=s.y;y<=footY+1;y++){
   if(!empty(blockAt(s.x,y,s.z))){clear=false;break;}
  }
  if(!clear)continue;
  candidates.push({x:s.x,y:s.y,z:s.z,drop,ground:floor.name});
 }
 candidates.sort((a,b)=>a.drop-b.drop||Math.hypot(a.x+.5-position.x,a.z+.5-position.z)-Math.hypot(b.x+.5-position.x,b.z+.5-position.z));
 return candidates[0]??null;
}
export function canopyBlockSnapshot({position,blockAt,radius=5,below=10,above=3}={}){
 if(!position||typeof blockAt!=='function')return null;
 const o={x:Math.floor(position.x),y:Math.floor(position.y),z:Math.floor(position.z)};
 const layers=[];
 for(let y=o.y+above;y>=o.y-below;y--){
  const cells=[];
  for(let z=o.z-radius;z<=o.z+radius;z++){
   let row='';
   for(let x=o.x-radius;x<=o.x+radius;x++){
    const b=blockAt(x,y,z);
    row+=!b?'?':b.name.includes('leaves')?'L':b.name.endsWith('_log')?'T':
     b.name==='air'?'·':b.name.includes('water')?'~':b.boundingBox==='block'?'#':' ';
   }
   cells.push(row);
  }
  layers.push({y,rows:cells});
 }
 return {origin:o,legend:{'?':'unknown','L':'leaves','T':'logs','·':'air','#':'solid other','~':'water'},radius,layers};
}
