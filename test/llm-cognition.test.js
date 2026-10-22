import test from 'node:test';
import assert from 'node:assert/strict';
import {cognitionFor,describeCognition} from '../src/cognition-config.js';
import {createCognition} from '../src/llm-cognition.js';
import {makeVisualObservation} from '../src/vision-observation.js';
test('eight unique combinations and a replicated ninth baseline',()=>{
 const keys=new Set(Array.from({length:8},(_,i)=>JSON.stringify(cognitionFor(i))));
 assert.equal(keys.size,8);
 assert.deepEqual(cognitionFor(0),cognitionFor(8));
 assert.equal(describeCognition(cognitionFor(0)),'baseline');
});
test('foveal augmentation is a valid central JPEG',()=>{
 const treatment=createCognition({cognition:cognitionFor(1)});
 const frame=makeVisualObservation({rgb:new Uint8Array(8*8*3).fill(120),width:8,height:8,frameId:1,capturedAt:'2026-10-22T00:00:00Z'});
 const jpeg=treatment.fovealImage(frame);
 assert.equal(jpeg[0],0xff);assert.equal(jpeg[1],0xd8);
 assert.equal(treatment.observe({position:{x:1,z:1}}),'');
});
test('self-motion grid and hypothesis recall stay distinct from verified observations',()=>{
 const treatment=createCognition({cognition:cognitionFor(6)});
 const memory=treatment.observe({position:{x:16,z:-1}});
 assert.match(memory,/2,-1/);
 treatment.reflect({belief:'Possibly sand ahead',memory:'Turning helped'});
 assert.match(treatment.observe({position:{x:16,z:-1}}),/Possibly sand ahead/);
 assert.equal(treatment.summary().visitedCells,1);
 assert.equal(treatment.summary().unverifiedHypotheses,2);
 assert.match(treatment.observe({position:{x:16,z:-1}}),/leastVisitedAdjacent/);
 assert.match(treatment.observe({position:{x:16,z:-1}}),/agent_self_report/);
 assert.match(treatment.observe({position:{x:16,z:-1}}),/\"verified\":false/);
});
