import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {findObservedFall,canopyBlockSnapshot} from '../src/canopy-risk-geometry.js';
import {createCanopyRiskLearner} from '../src/canopy-risk-learner.js';
const air={name:'air',boundingBox:'empty'};
const leaves={name:'birch_leaves',boundingBox:'block'};
const grass={name:'grass_block',boundingBox:'block'};
const geometry=(x,y,z)=>x===0&&z===0&&y===74?leaves:x===1&&z===0&&y===69?grass:y>=70&&y<=78?air:null;
test('offers fully verified adjacent fall even at 1 HP; no safety masking',()=>{
 const candidate=findObservedFall({position:{x:0.5,y:75,z:0.5},
  samples:[{x:1,y:70,z:0,drop:5,feetClear:true,headClear:true}],blockAt:geometry});
 assert.deepEqual(candidate,{x:1,y:70,z:0,drop:5,ground:'grass_block'});
});
test('does not offer unobserved or blocked shaft as a risky fall',()=>{
 const samples=[{x:1,y:70,z:0,drop:5,feetClear:true,headClear:true}];
 assert.equal(findObservedFall({position:{x:0.5,y:75,z:0.5},samples,
  blockAt:(x,y,z)=>x===1&&z===0&&y===74?leaves:geometry(x,y,z)}),null);
 assert.equal(findObservedFall({position:{x:0.5,y:75,z:0.5},samples,
  blockAt:()=>null}),null);
});
test('snapshot exposes real cached blocks and unknowns without modifying world',()=>{
 const snapshot=canopyBlockSnapshot({position:{x:0.5,y:75,z:0.5},blockAt:geometry,radius:1,below:6,above:0});
 assert.equal(snapshot.layers[1].rows[1][1],'L');
 assert.equal(snapshot.layers.at(-1).rows[1][2],'#');
});
test('separate risk learner records death and learns avoidance',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-risk-'));
 try{
  const file=path.join(dir,'risk.json');
  const learner=createCanopyRiskLearner({file,epsilon:1,random:()=>0.2});
  // epsilon coin 0.2 -> explore; second 0.2 -> attempt
  const d=learner.choose({health:1,drop:5,position:{x:0,y:75,z:0}});
  assert.equal(d.action,'attempt');
  learner.finish({outcome:'death'});
  assert.equal(learner.values()['critical:medium'].attempt,-1);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).schema,'craftle.canopy-risk.v1');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
