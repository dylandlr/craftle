import test from 'node:test';
import assert from 'node:assert/strict';
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import {checkFreshMotorDecision,executeFreshMotorDecision} from '../src/motor-freshness-guard.js';

function nearBarrier(){
 const w=createMutableTerrain({layout:'chasm',goalObstructed:true,
  platformHeight:5,span:3});
 const advance=()=>w.affordances().find(c=>c.operation==='move'&&c.arguments.dx===1);
 assert.equal(w.act(advance()).ok,true);
 const place=w.affordances().find(c=>c.operation==='place'&&
  c.evidence.destination.x===2&&c.evidence.destination.y===4&&
  c.evidence.destination.z===0);
 assert.equal(w.act(place).ok,true);
 assert.equal(w.act(advance()).ok,true);
 return w;
}
test('fresh dig executes with a confirmed block change',()=>{
 const w=nearBarrier(),goal=w.snapshot().goal;
 const dig=w.affordances().find(c=>c.operation==='dig'&&
  c.arguments.position.x===goal.x&&
  c.arguments.position.y===goal.y&&c.arguments.position.z===goal.z);
 assert.ok(dig);
 const out=executeFreshMotorDecision(w,dig);
 assert.equal(out.approved,true);
 assert.equal(out.executed,true);
 assert.equal(out.confirmed,true);
 assert.deepEqual(out.result.change,{...goal,before:'stone',after:'air'});
 assert.equal(w.blockAt(goal.x,goal.y,goal.z).name,'air');
});
test('stale dig is rejected without consuming a simulator step',()=>{
 const w=nearBarrier(),goal=w.snapshot().goal;
 const dig=w.affordances().find(c=>c.operation==='dig'&&
  c.arguments.position.x===goal.x&&
  c.arguments.position.y===goal.y&&c.arguments.position.z===goal.z);
 assert.ok(dig);
 w.world.delete([goal.x,goal.y,goal.z].join(','));
 const before=w.snapshot();
 const out=executeFreshMotorDecision(w,dig);
 assert.equal(out.approved,false);
 assert.equal(out.reason,'candidate_no_longer_available');
 assert.equal(out.executed,false);
 assert.equal(out.result,null);
 assert.deepEqual(w.snapshot(),before);
});
test('stale placement is rejected after reference block disappears',()=>{
 const w=createMutableTerrain({layout:'chasm',span:3,platformHeight:5});
 const advance=w.affordances().find(c=>c.operation==='move'&&c.arguments.dx===1);
 assert.equal(w.act(advance).ok,true);
 const place=w.affordances().find(c=>c.operation==='place'&&
  c.evidence.destination.x===2&&c.evidence.destination.y===4&&
  c.evidence.destination.z===0);
 assert.ok(place);
 const r=place.arguments.reference;
 w.world.delete([r.x,r.y,r.z].join(','));
 const before=w.snapshot();
 const out=executeFreshMotorDecision(w,place);
 assert.equal(out.approved,false);
 assert.equal(out.executed,false);
 assert.deepEqual(w.snapshot(),before);
});
test('position drift invalidates an earlier decision',()=>{
 const w=nearBarrier(),state=w.snapshot();
 const candidate=w.affordances().find(c=>c.operation==='dig');
 assert.ok(candidate);
 const move=w.affordances().find(c=>c.operation==='move'&&c.arguments.dx===-1);
 assert.equal(w.act(move).ok,true);
 const out=checkFreshMotorDecision(w,candidate,{expectedState:state});
 assert.equal(out.approved,false);
 assert.equal(out.reason,'position_changed');
});
test('freshness guard never invents a new action when stale selection fails',()=>{
 const w=nearBarrier(),goal=w.snapshot().goal;
 const old=w.affordances().find(c=>c.operation==='dig'&&
  c.arguments.position.x===goal.x&&c.arguments.position.y===goal.y);
 assert.ok(old);
 w.world.delete([goal.x,goal.y,goal.z].join(','));
 const result=executeFreshMotorDecision(w,old);
 assert.equal(result.candidate,null);
 assert.equal(result.confirmed,undefined);
 assert.equal(w.snapshot().position.x,2);
});
