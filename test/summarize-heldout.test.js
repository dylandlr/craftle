import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeHeldout} from '../scripts/summarize-heldout.js';
const group=(seed,frozen,random,scripted)=>({seed,pairedEligible:true,results:[['frozen',frozen],['random',random],['scripted',scripted]].map(([t,v])=>({treatment:t,meals:v[0],deaths:v[1],cells:v[2]}))});
test('paired held-out comparison reports differences without claiming generalization',()=>{
 const summary=summarizeHeldout([group('a',[1,0,11],[0,0,10],[2,0,15]),group('b',[0,0,5],[0,1,9],[1,0,10])]);
 assert.deepEqual(summary.winTieLoss.meals.random,{wins:1,ties:1,losses:0});
 assert.deepEqual(summary.winTieLoss.cells.random,{wins:1,ties:0,losses:1});
 assert.equal(summary.seedCount,2);
 assert.match(summary.verdict,/no claim of generalization/);
});
test('cannot summarize incomplete pairs',()=>assert.throws(()=>summarizeHeldout([{seed:'a',pairedEligible:false,results:[]}])));
