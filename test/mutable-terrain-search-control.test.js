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

test('generic control is not hard-coded to search east',()=>{
 const west=createMutableTerrain({layout:'chasm',chasmDirection:'west',
  span:3,platformHeight:5,initialBlocks:5,maxSteps:20});
 const p=searchMutableTerrain(west,{depth:8,beamWidth:36,maxCandidates:150});
 assert.equal(p.solved,true,JSON.stringify({expanded:p.expanded,reason:p.reason}));
 const replay=west.fork();let success=false;
 for(const step of p.trace){
  const legal=replay.affordances().find(c=>c.operation===step.operation&&
   JSON.stringify(c.arguments)===JSON.stringify(step.args));
  assert.ok(legal);
  const out=replay.act(legal);assert.equal(out.ok,true);
  success||=out.reachedLowerGround;
 }
 assert.equal(success,true);
});

test('generic search finds and replays dig-plus-place on a blocked destination',()=>{
 const w=createMutableTerrain({layout:'chasm',goalObstructed:true,
  span:3,platformHeight:5,initialBlocks:6,maxSteps:30});
 const plan=searchMutableTerrain(w,{depth:8,beamWidth:36,maxCandidates:150});
 assert.equal(plan.solved,true,JSON.stringify({reason:plan.reason,expanded:plan.expanded}));
 const operations=plan.trace.map(a=>a.operation);
 assert.ok(operations.includes('dig'),'generic teacher must demonstrate excavation');
 assert.ok(operations.includes('place'),'generic teacher must demonstrate support placement');
 const replay=w.fork();
 let success=false;
 for(const step of plan.trace){
  const choice=replay.affordances().find(c=>c.operation===step.operation&&
   JSON.stringify(c.arguments)===JSON.stringify(step.args));
  assert.ok(choice,'Teacher proposed an illegal candidate');
  const result=replay.act(choice);
  assert.equal(result.ok,true);
  success ||=result.reachedLowerGround;
 }
 assert.equal(success,true);
 assert.deepEqual(w.snapshot().position,{x:0,y:5,z:0},
  'planning must not mutate the source environment');
});
