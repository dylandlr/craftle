import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldReplaceNavigationGoal} from '../src/navigation-goal-control.js';
const current={key:'retreat',x:0,y:65,z:0,at:1000};
test('retreat preserves an active route when DQN proposes a different destination',()=>{
 const r=shouldReplaceNavigationGoal({current,requested:{key:'retreat',x:12,y:65,z:9},now:2000,stalls:0});
 assert.equal(r.replace,false);assert.equal(r.reason,'active_goal_in_progress');
});
test('short stationary intervals do not thrash active pathfinder goals',()=>{
 assert.equal(shouldReplaceNavigationGoal({current,requested:{key:'retreat'},now:4500,stalls:100}).replace,false);
 assert.equal(shouldReplaceNavigationGoal({current,requested:{key:'retreat'},now:6000,stalls:100}).reason,'movement_stalled');
});
test('expired goal and changed objective require replanning',()=>{
 assert.equal(shouldReplaceNavigationGoal({current,requested:{key:'retreat'},now:16000}).reason,'goal_expired');
 assert.equal(shouldReplaceNavigationGoal({current,requested:{key:'explore'},now:2000}).reason,'objective_changed');
 assert.equal(shouldReplaceNavigationGoal({current:null,requested:{key:'explore'},now:2000}).replace,true);
});
