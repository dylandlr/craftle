import test from 'node:test';
import assert from 'node:assert/strict';
import {createProgressTracker} from '../src/llm-progress.js';
test('three failed movement effects produce actionable stalled signal',()=>{
 const t=createProgressTracker();
 let result;
 for(let i=0;i<3;i++)result=t.observe({goal:'explore',action:'forward',effect:{moved:false}});
 assert.equal(result.movementStalled,true);
 assert.equal(result.consecutiveFailedMoves,3);
 assert.match(result.recommendation,/Reconsider/);
 result=t.observe({goal:'explore',action:'forward',effect:{moved:true}});
 assert.equal(result.movementStalled,false);
 assert.equal(result.consecutiveFailedMoves,0);
});
test('goal revisions are counted separately from command success',()=>{
 const t=createProgressTracker();
 t.observe({goal:'explore',action:'idle',effect:{moved:false}});
 const result=t.observe({goal:'seek shelter',action:'look_left',effect:{moved:false}});
 assert.equal(result.goalChanged,true);
 assert.deepEqual(t.summary().goals,['explore','seek shelter']);
});
