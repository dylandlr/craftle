import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectLedge,isHazardAdjacent} from '../src/ledge-observation.js';
const air={name:'air',boundingBox:'empty'};
test('survey reports lava below a nearby ledge',()=>{
 const blocks=(x,y,z)=>x===1&&z===0&&y===66?{name:'lava',boundingBox:'empty'}:air;
 const result=inspectLedge({position:{x:0,y:69,z:0},blockAt:blocks});
 assert.equal(result.status,'hazard_nearby');
 assert.ok(result.hazardCells.some(c=>c.name==='lava'&&c.dy===-3));
});
test('recovery destination is rejected beside lava and unknown terrain',()=>{
 const blocks=(x,y,z)=>x===1&&z===0&&y===64?{name:'lava'}:air;
 assert.equal(isHazardAdjacent({x:0,y:65,z:0,blockAt:blocks}),true);
 assert.equal(isHazardAdjacent({x:0,y:65,z:0,blockAt:()=>null}),true);
 assert.equal(isHazardAdjacent({x:0,y:65,z:0,blockAt:()=>air}),false);
});
