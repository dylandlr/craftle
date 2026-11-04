import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotorQPolicy,encodeMotorCandidate,MOTOR_FEATURE_COUNT} from '../src/motor-q-policy.js';
const state={health:1,food:12,inventory:[{name:'dirt',count:4}],
 position:{x:1.5,y:80,z:2.5},stalls:200};
const dig={operation:'dig',arguments:{position:{x:2,y:79,z:2}},executable:true,
 evidence:{source:'observed_block',block:'stone'}};
const place={operation:'place',arguments:{reference:{x:1,y:79,z:2},
 itemName:'dirt',face:{x:0,y:-1,z:0}},executable:true,
 evidence:{source:'observed_empty_destination_and_inventory',
 destination:{x:1,y:78,z:2}}};
test('variable candidate encoding is finite and action-specific',()=>{
 const a=encodeMotorCandidate(state,dig),b=encodeMotorCandidate(state,place);
 assert.equal(a.length,MOTOR_FEATURE_COUNT);
 assert.notDeepEqual(a,b);
});
test('policy chooses only bound executable operations',()=>{
 const policy=createMotorQPolicy({seed:3,epsilon:1});
 for(let i=0;i<25;i++){
  const result=policy.choose(state,[{...dig,executable:false},place]);
  assert.equal(result.candidate.operation,'place');
 }
});
test('training updates candidate score and creates a compatible checkpoint',()=>{
 const policy=createMotorQPolicy({seed:5,epsilon:0});
 const selected=policy.choose(state,[dig,place]);
 const before=selected.estimatedQ;
 for(let i=0;i<80;i++)policy.observe({features:selected.features,reward:1,
  nextObservation:state,nextCandidates:[dig,place],terminal:true});
 const resumed=createMotorQPolicy({seed:100,epsilon:0,training:false,snapshot:policy.snapshot()});
 assert.equal(policy.stats().updates,80);
 assert.ok(resumed.choose(state,[selected.candidate]).estimatedQ>before);
 assert.throws(()=>resumed.observe({features:selected.features,reward:1}),/frozen/);
});
test('no executable options report an explicit unavailable state',()=>{
 const policy=createMotorQPolicy();
 assert.equal(policy.choose(state,[{...dig,executable:false}]).reason,'no_executable_candidate');
});
test('tampered model weights are rejected',()=>{
 const p=createMotorQPolicy(),snapshot=p.snapshot();
 snapshot.w[0][0]=Infinity;
 assert.throws(()=>createMotorQPolicy({snapshot}),/Incompatible/);
});

test('candidate scores encode goal direction and observed footing',()=>{
 const base={...state,goal:{x:4,y:80,z:2},
  blockAt:(x,y,z)=>y===79&&x===2?{name:'stone',boundingBox:'block'}:
   {name:'air',boundingBox:'empty'}};
 const east={operation:'move',arguments:{dx:1,dy:0,dz:0},
  executable:true,evidence:{source:'motor_direction'}};
 const west={operation:'move',arguments:{dx:-1,dy:0,dz:0},
  executable:true,evidence:{source:'motor_direction'}};
 assert.notDeepEqual(encodeMotorCandidate(base,east),encodeMotorCandidate(base,west));
 const reversed={...base,goal:{x:-4,y:80,z:2}};
 assert.notDeepEqual(encodeMotorCandidate(base,east),encodeMotorCandidate(reversed,east));
});

test('goal-aligned features are invariant under cardinal rotation of goal, terrain and action',()=>{
 const source=(goal,dx,dz)=>({
  health:20,food:20,stalls:0,
  position:{x:0,y:5,z:0},goal:{x:goal[0],y:5,z:goal[1]},
  inventory:[{name:'dirt',count:6}],
  blockAt:(x,y,z)=>({name:y===4&&x===0&&z===0?'dirt':'air',
   boundingBox:y===4&&x===0&&z===0?'block':'empty'})
 });
 const cases=[
  {goal:[3,0],dx:1,dz:0},
  {goal:[-3,0],dx:-1,dz:0},
  {goal:[0,-3],dx:0,dz:-1},
  {goal:[0,3],dx:0,dz:1}
 ];
 const featureVectors=cases.map(({goal,dx,dz})=>
  encodeMotorCandidate(source(goal,dx,dz),{
   operation:'move',arguments:{dx,dy:0,dz},executable:true,
   evidence:{source:'motor_direction'}
  }));
 for(const f of featureVectors.slice(1))
  for(let i=0;i<f.length;i++)assert.ok(Math.abs(f[i]-featureVectors[0][i])<1e-9,
   'rotated movement feature '+i+' differs');
});
test('sideways movement remains distinct from goal-directed movement',()=>{
 const base={...state,goal:{x:4,y:80,z:2}};
 const move=(dx,dz)=>({operation:'move',arguments:{dx,dy:0,dz},
  executable:true,evidence:{source:'motor_direction'}});
 assert.notDeepEqual(encodeMotorCandidate(base,move(1,0)),
  encodeMotorCandidate(base,move(0,1)));
});

test('rotated generic placement candidates share goal-relative features',()=>{
 const directions=[
  {name:'east',dx:1,dz:0},
  {name:'west',dx:-1,dz:0},
  {name:'north',dx:0,dz:-1},
  {name:'south',dx:0,dz:1}
 ];
 const rows=directions.map(({name,dx,dz})=>{
  const w=createMutableTerrain({layout:'chasm',chasmDirection:name,
   span:3,platformHeight:5,initialBlocks:5});
  const advance=w.affordances().find(c=>c.operation==='move'&&
   c.arguments.dx===dx&&c.arguments.dz===dz);
  assert.equal(w.act(advance).ok,true);
  const c=w.affordances().find(c=>c.operation==='place'&&
   c.evidence.destination.x===dx*2&&c.evidence.destination.z===dz*2&&
   c.evidence.destination.y===4);
  assert.ok(c,name+' must permit a physically legal placement');
  return encodeMotorCandidate(w.observe(),c);
 });
 for(const row of rows.slice(1))
  for(let i=0;i<row.length;i++)assert.ok(Math.abs(row[i]-rows[0][i])<1e-9,
   'rotated placement feature '+i+' differs');
});

test('candidate Q audit is read-only and matches frozen greedy decision',()=>{
 const world=createMutableTerrain({layout:'chasm',span:3,platformHeight:5});
 const policy=createMotorQPolicy({epsilon:0,training:false});
 const candidates=world.affordances(),before=policy.snapshot();
 const scores=policy.scoreCandidates(world.observe(),candidates);
 assert.equal(scores.length,candidates.length);
 assert.ok(scores.every(s=>Number.isFinite(s.q)));
 const max=scores.reduce((best,row)=>!best||row.q>best.q?row:best,null);
 const chosen=policy.choose(world.observe(),candidates);
 assert.equal(chosen.candidate.id,max.id);
 assert.deepEqual(policy.snapshot(),before);
});
test('a one-cell obstruction intervention preserves agent state and goal',()=>{
 const world=createMutableTerrain({layout:'chasm',span:3,platformHeight:5,
  goalObstructed:true});
 const move=()=>world.affordances().find(c=>c.operation==='move'&&c.arguments.dx===1);
 assert.equal(world.act(move()).ok,true);
 const place=world.affordances().find(c=>c.operation==='place'&&
  c.evidence.destination.x===2&&c.evidence.destination.y===4&&
  c.evidence.destination.z===0);
 assert.equal(world.act(place).ok,true);
 assert.equal(world.act(move()).ok,true);
 const blocked=world.fork(),clear=world.fork(),goal=blocked.snapshot().goal;
 clear.world.delete([goal.x,goal.y,goal.z].join(','));
 assert.equal(blocked.blockAt(goal.x,goal.y,goal.z).name,'stone');
 assert.equal(clear.blockAt(goal.x,goal.y,goal.z).name,'air');
 assert.deepEqual(blocked.snapshot(),clear.snapshot());
 const policy=createMotorQPolicy({training:false});
 assert.ok(policy.scoreCandidates(blocked.observe(),blocked.affordances()).length);
 assert.ok(policy.scoreCandidates(clear.observe(),clear.affordances()).length);
});
