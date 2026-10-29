import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createDiscoveryMemory} from '../src/discovery-memory.js';
const p={x:0,y:65,z:0};
test('new cells and landmarks are observed once, with no inferred distant terrain',()=>{
 const events=[];
 const m=createDiscoveryMemory({worldId:'seed-a',log:e=>events.push(e)});
 const blockAt=(x,y,z)=>x===2&&y===64&&z===0?{name:'chest'}:null;
 m.sample({position:p,blockAt});m.sample({position:p,blockAt});
 assert.equal(events.filter(x=>x.type==='discovery_new_cell').length,1);
 assert.equal(events.filter(x=>x.type==='discovery_landmark').length,1);
 assert.equal(Object.keys(m.snapshot().cells).length,1);
 assert.equal(m.novelty({x:30,z:0}),5);
 assert.ok(m.novelty({x:0,z:0})<5);
});
test('negative coordinates and dimensions are separate cells',()=>{
 const m=createDiscoveryMemory();
 m.sample({position:{x:-1,y:65,z:-1},dimension:'overworld',blockAt:()=>null});
 m.sample({position:{x:-1,y:65,z:-1},dimension:'the_nether',blockAt:()=>null});
 assert.deepEqual(Object.keys(m.snapshot().cells).sort(),['overworld:-1,-1','the_nether:-1,-1']);
});
test('saved memory survives restart only in matching world scope',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'craftle-map-')),file=path.join(dir,'a.json');
 try{
  const m=createDiscoveryMemory({file,agentId:'a',worldId:'seed-1'});
  m.sample({position:p,blockAt:()=>null});assert.equal(m.save(true),true);
  const restored=createDiscoveryMemory({file,agentId:'a',worldId:'seed-1'});
  assert.equal(Object.keys(restored.snapshot().cells).length,1);
  const different=createDiscoveryMemory({file,agentId:'a',worldId:'seed-2'});
  assert.equal(Object.keys(different.snapshot().cells).length,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('unknown blocks produce no fabricated landmark',()=>{
 const m=createDiscoveryMemory();
 m.sample({position:p,blockAt:()=>null});
 assert.equal(Object.keys(m.snapshot().landmarks).length,0);
});
