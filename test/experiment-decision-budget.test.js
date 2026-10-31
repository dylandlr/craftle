import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DecisionBudget} from '../src/experiment-decision-budget.js';
test('exactly N decisions allowed, no additional decisions',()=>{
 const b=new DecisionBudget(2);
 assert.equal(b.consume().accepted,true);
 assert.equal(b.consume().exhausted,true);
 assert.equal(b.consume().accepted,false);
 assert.deepEqual(b.snapshot(),{schema:'craftle.decision-budget.v1',limit:2,used:2,remaining:0,exhausted:true});
});
test('resume conserves count, validates corrupted snapshots',()=>{
 const b=new DecisionBudget(3);b.consume();
 const r=DecisionBudget.fromSnapshot(b.snapshot());
 assert.equal(r.remaining,2);
 assert.throws(()=>DecisionBudget.fromSnapshot({schema:'craftle.decision-budget.v1',limit:1,used:2}));
 assert.throws(()=>new DecisionBudget(0));
});
