import test from 'node:test';
import assert from 'node:assert/strict';
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import {createMotorQPolicy,encodeMotorCandidate} from '../src/motor-q-policy.js';
const choose=(world,operation,predicate=()=>true)=>world.affordances().find(c=>c.operation===operation&&predicate(c));
test('terrain is mutable from atomic block edits, with no predefined bridge macro',()=>{
 const w=createMutableTerrain({platformHeight:5,span:5});
 const dig=choose(w,'dig',c=>c.arguments.position.y===4);
 assert.ok(dig);
 const before=w.blockAt(dig.arguments.position.x,dig.arguments.position.y,dig.arguments.position.z);
 assert.equal(before.name,'dirt');
 const out=w.act(dig);
 assert.equal(out.ok,true);
 assert.equal(w.blockAt(dig.arguments.position.x,dig.arguments.position.y,dig.arguments.position.z).name,'air');
 assert.equal(w.affordances().some(c=>c.operation==='build_bridge'),false);
});
test('placing consumes material and mutates an observed empty cell',()=>{
 const w=createMutableTerrain({initialBlocks:3});
 const item=choose(w,'place');
 assert.ok(item);
 const result=w.act(item);
 assert.equal(result.ok,true);
 assert.equal(w.snapshot().inventory[0].count,2);
 const q=result.change;
 assert.equal(w.blockAt(q.x,q.y,q.z).name,'dirt');
});
test('fall damage and terminal conditions are physics outcomes, not action-name bonuses',()=>{
 const w=createMutableTerrain({platformHeight:6,span:3});
 const first=choose(w,'move',c=>c.arguments.dx===1);
 assert.equal(w.act(first).ok,true);
 const second=choose(w,'move',c=>c.arguments.dx===1);
 const out=w.act(second);
 assert.equal(out.ok,true);
 assert.ok(out.fall>0);
 assert.ok(out.damage>0);
 assert.equal(out.healthAfter,20-out.damage);
});
test('policy differentiates opposite movement directions in features',()=>{
 const w=createMutableTerrain();
 const moves=w.affordances().filter(c=>c.operation==='move');
 const a=moves.find(c=>c.arguments.dx===1);
 const b=moves.find(c=>c.arguments.dx===-1);
 assert.notDeepEqual(encodeMotorCandidate(w.observe(),a),
  encodeMotorCandidate(w.observe(),b));
 const policy=createMotorQPolicy({epsilon:0});
 assert.ok(moves.includes(policy.choose(w.observe(),moves).candidate));
});
test('unimplemented motor executor cannot be counted as available',()=>{
 const w=createMutableTerrain();
 const candidates=w.affordances({move:()=>{}});
 assert.ok(candidates.length);
 assert.equal(candidates.some(c=>c.operation==='dig'||c.operation==='place'),false);
});

test('chasm makes direct crossing fatal instead of granting free descent',()=>{
 const w=createMutableTerrain({layout:'chasm',span:3,platformHeight:5,initialBlocks:5});
 const east=()=>choose(w,'move',c=>c.arguments.dx===1);
 w.act(east());
 const out=w.act(east());
 assert.equal(out.voidDeath,true);
 assert.equal(out.done,true);
 assert.equal(out.reachedLowerGround,false);
});
test('atomic placements can modify an otherwise lethal chasm without a bridge action',()=>{
 const w=createMutableTerrain({layout:'chasm',span:3,platformHeight:5,initialBlocks:5});
 const east=()=>choose(w,'move',c=>c.arguments.dx===1);
 w.act(east());
 const place=choose(w,'place',c=>c.evidence.destination.x===2&&
  c.evidence.destination.y===4&&c.evidence.destination.z===0);
 assert.ok(place,'one-block extension must be a legal generic placement');
 const out=w.act(place);
 assert.equal(out.ok,true);
 assert.equal(w.blockAt(2,4,0).name,'dirt');
 const move=w.act(east());
 assert.equal(move.ok,true);
 assert.equal(move.fall,0);
 assert.equal(move.after.x,2);
});

test('feasibility witness reaches held-out goal using generic legal actions',()=>{
 const w=createMutableTerrain({layout:'chasm',span:3,platformHeight:5,initialBlocks:5,maxSteps:20});
 const east=()=>choose(w,'move',c=>c.arguments.dx===1);
 assert.equal(w.act(east()).ok,true);
 const placement=choose(w,'place',c=>c.evidence.destination.x===2&&
  c.evidence.destination.y===4&&c.evidence.destination.z===0);
 assert.ok(placement);
 assert.equal(w.act(placement).ok,true);
 assert.equal(w.act(east()).ok,true);
 const finish=w.act(east());
 assert.equal(finish.reachedLowerGround,true);
 assert.equal(finish.done,true);
 assert.equal(w.snapshot().health,20);
});
test('observation provides task destination but no construction recipe',()=>{
 const w=createMutableTerrain({layout:'chasm',span:3,platformHeight:5});
 const obs=w.observe();
 assert.deepEqual(obs.goal,{x:3,y:5,z:0});
 assert.equal(obs.bridgePlan,undefined);
});

test('rotated chasm is a physical rotation, not a positive-X shortcut',()=>{
 const dirs={east:{x:3,z:0,dx:1,dz:0},west:{x:-3,z:0,dx:-1,dz:0},
  north:{x:0,z:-3,dx:0,dz:-1},south:{x:0,z:3,dx:0,dz:1}};
 for(const [direction,g] of Object.entries(dirs)){
  const w=createMutableTerrain({layout:'chasm',chasmDirection:direction,
   span:3,platformHeight:5,initialBlocks:5});
  assert.deepEqual(w.observe().goal,{x:g.x,y:5,z:g.z});
  assert.equal(w.blockAt(g.x,4,g.z).name,'stone');
  const advance=()=>choose(w,'move',a=>a.arguments.dx===g.dx&&a.arguments.dz===g.dz);
  assert.equal(w.act(advance()).ok,true);
  const gap={x:g.dx*2,y:4,z:g.dz*2};
  const target=choose(w,'place',a=>Object.entries(gap).every(([k,v])=>
   a.evidence.destination[k]===v));
  assert.ok(target,'generic placement must exist for '+direction);
  assert.equal(w.act(target).ok,true);
  assert.equal(w.act(advance()).ok,true);
  const outcome=w.act(advance());
  assert.equal(outcome.reachedLowerGround,true,direction);
  assert.equal(w.snapshot().health,20,direction);
 }
});
test('fork preserves rotated direction and rejects incompatible snapshots',()=>{
 const w=createMutableTerrain({layout:'chasm',chasmDirection:'north',span:3});
 assert.deepEqual(w.fork().observe().goal,w.observe().goal);
 assert.throws(()=>createMutableTerrain({layout:'chasm',chasmDirection:'south',
  span:3,restore:w.exportState()}),/Incompatible/);
});

test('rotated worlds never offer placements with out-of-reach reference blocks',()=>{
 for(const direction of ['east','west','north','south']){
  const w=createMutableTerrain({layout:'chasm',chasmDirection:direction,
   span:3,platformHeight:5,initialBlocks:5});
  const g=w.observe().goal,dx=Math.sign(g.x),dz=Math.sign(g.z);
  const move=w.affordances().find(a=>a.operation==='move'&&
   a.arguments.dx===dx&&a.arguments.dz===dz);
  assert.equal(w.act(move).ok,true);
  const p=w.snapshot().position;
  for(const candidate of w.affordances().filter(a=>a.operation==='place')){
   const ref=candidate.arguments.reference,dest=candidate.evidence.destination;
   for(const q of [ref,dest])
    assert.ok(Math.max(Math.abs(q.x-p.x),Math.abs(q.y-p.y),
      Math.abs(q.z-p.z))<=1,
     JSON.stringify({direction,position:p,invalid:candidate.arguments}));
  }
 }
});
