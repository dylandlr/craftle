import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCandidateMenus} from '../src/motor-counterfactual-audit.js';
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import {createMotorQPolicy} from '../src/motor-q-policy.js';
test('candidate menu changes alone do not imply learned value changes',()=>{
 const blocked=[{id:'move:x',operation:'move',q:1},
  {id:'dig:obstacle',operation:'dig',q:2}];
 const clear=[{id:'move:x',operation:'move',q:1}];
 const out=compareCandidateMenus(blocked,clear);
 assert.equal(out.fullMenuBlocked,'dig');
 assert.equal(out.fullMenuClear,'move');
 assert.equal(out.sharedMenuSwitch,false);
 assert.equal(out.changedSharedScores,0);
 assert.deepEqual(out.onlyBlockedOperations,['dig']);
});
test('identical candidate menu can produce a genuine Q-based switch',()=>{
 const blocked=[{id:'move:x',operation:'move',q:0},
  {id:'wait',operation:'wait',q:1}];
 const clear=[{id:'move:x',operation:'move',q:2},
  {id:'wait',operation:'wait',q:1}];
 const out=compareCandidateMenus(blocked,clear);
 assert.equal(out.onlyBlockedCount,0);
 assert.equal(out.onlyClearCount,0);
 assert.equal(out.sharedMenuSwitch,true);
 assert.equal(out.changedSharedScores,1);
});
test('real obstacle intervention has overlapping but nonidentical candidate menus',()=>{
 const w=createMutableTerrain({layout:'chasm',goalObstructed:true,
  platformHeight:5,span:3});
 const advance=()=>w.affordances().find(c=>c.operation==='move'&&
  c.arguments.dx===1);
 assert.equal(w.act(advance()).ok,true);
 const place=w.affordances().find(c=>c.operation==='place'&&
  c.evidence.destination.x===2&&c.evidence.destination.y===4&&
  c.evidence.destination.z===0);
 assert.equal(w.act(place).ok,true);
 assert.equal(w.act(advance()).ok,true);
 const blocked=w.fork(),clear=w.fork(),g=w.snapshot().goal;
 clear.world.delete([g.x,g.y,g.z].join(','));
 const policy=createMotorQPolicy({training:false});
 const out=compareCandidateMenus(
  policy.scoreCandidates(blocked.observe(),blocked.affordances()),
  policy.scoreCandidates(clear.observe(),clear.affordances()));
 assert.ok(out.sharedCount>0);
 assert.ok(out.onlyBlockedCount+out.onlyClearCount>0);
 assert.equal(blocked.snapshot().position.x,clear.snapshot().position.x);
});
