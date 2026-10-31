import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLearningProgress} from '../src/curiosity-learning-progress.js';
test('prediction must precede observed outcome and no cold-start reward',()=>{
 const m=createLearningProgress();
 assert.throws(()=>m.observe({kind:'block',name:'stone',action:'hit',decisionId:'1',outcome:'unchanged'}));
 m.predict({kind:'block',name:'stone',action:'hit',decisionId:'1'});
 const r=m.observe({kind:'block',name:'stone',action:'hit',decisionId:'1',outcome:'unchanged'});
 assert.equal(r.reward,0);assert.equal(r.policyApplied,false);
 assert.throws(()=>m.observe({kind:'block',name:'stone',action:'hit',decisionId:'1',outcome:'unchanged'}));
});
test('constant outcome does not generate unbounded novelty reward',()=>{
 const m=createLearningProgress({window:6,maximumReward:0.25});
 const values=[];
 for(let i=0;i<30;i++){const a={kind:'block',name:'stone',action:'hit',decisionId:String(i)};m.predict(a);values.push(m.observe({...a,outcome:'unchanged'}).reward);}
 assert.ok(values.every(v=>v>=0&&v<=0.25));
 assert.equal(values[0],0);
 assert.ok(values.at(-1)<0.1);
});
