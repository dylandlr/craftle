import test from 'node:test';
import assert from 'node:assert/strict';
import {createRewardV2} from '../src/reward-v2.js';
import {intrinsicVisualReward} from '../src/online-visual-rl.js';
test('v1 baseline reward remains unchanged',()=>{
 assert.ok(Math.abs(intrinsicVisualReward({displacement:1,novelState:true})-0.68)<1e-12);
});
test('v2 only rewards fresh spatial cells, not jumping in place',()=>{
 const r=createRewardV2({cellSize:4});
 const a=r.observe({position:{x:1,z:1}});
 const b=r.observe({position:{x:1,z:1}});
 const c=r.observe({position:{x:5,z:1}});
 assert.equal(a.newCell,true);
 assert.equal(b.newCell,false);
 assert.ok(b.reward<0);
 assert.equal(c.newCell,true);
 assert.equal(r.stats().visitedCells,2);
 r.resetLife();
 assert.equal(r.observe({position:{x:1,z:1}}).newCell,false);
});
test('v2 penalizes damage and rejects corrupt measurements',()=>{
 const r=createRewardV2();
 const a=r.observe({position:{x:0,z:0},healthDelta:-2});
 assert.ok(a.terms.damage<0);
 assert.throws(()=>r.observe({position:{x:NaN,z:0}}),/Invalid/);
});
