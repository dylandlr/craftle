import test from 'node:test';
import assert from 'node:assert/strict';
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import {searchMutableTerrain} from '../src/mutable-terrain-search-control.js';
test('fork preserves state but edits do not leak to parent',()=>{
 const w=createMutableTerrain({layout:'chasm',span:3,platformHeight:5});
 const f=w.fork();
 const p=f.affordances().find(c=>c.operation==='place');
 assert.ok(p);
 const r=f.act(p);
 assert.equal(r.ok,true);
 const q=r.change;
 assert.equal(f.blockAt(q.x,q.y,q.z).name,'dirt');
 assert.equal(w.blockAt(q.x,q.y,q.z).name,'air');
});
test('generic legal-action search can find successful chasm actions without a macro',()=>{
 const w=createMutableTerrain({layout:'chasm',span:3,platformHeight:5,
  initialBlocks:5,maxSteps:20});
 const out=searchMutableTerrain(w,{depth:8,beamWidth:36,maxCandidates:150});
 assert.equal(out.solved,true,JSON.stringify({reason:out.reason,expanded:out.expanded}));
 assert.ok(out.trace.some(e=>e.operation==='place'));
 assert.ok(out.trace.some(e=>e.operation==='move'));
 assert.equal(out.trace.some(e=>/bridge|staircase/.test(e.operation)),false);
 // Independently replay the discovered legal actions to verify outcome.
 const replay=w.fork();let reached=false;
 for(const step of out.trace){
  const c=replay.affordances().find(candidate=>candidate.operation===step.operation&&
   JSON.stringify(candidate.arguments)===JSON.stringify(step.args));
  assert.ok(c,'Every proposed action must still be executable');
  const r=replay.act(c);assert.equal(r.ok,true);
  reached ||=r.reachedLowerGround;
 }
 assert.equal(reached,true);
});
