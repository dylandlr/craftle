import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotorQPolicy,MOTOR_FEATURE_COUNT} from '../src/motor-q-policy.js';
import {chainLayout,chainTasks,assertChainSplitDisjoint,chainSnapshotFromProbes,
  validateInitialChainSnapshot,chainCandidateMenu,scriptedResourcePlanner,
  chainFinalOutcome,chainActionTarget,validateChainBlueprint,
  CHAIN_KEYS,CHAIN_SCHEMA} from '../src/motor-resource-chain.js';

const layout=chainLayout(0);
const identity={serverBootId:'boot1',playerUuid:'user1',world:'minecraft:overworld'};
const initialBlocks={source0:'minecraft:dirt',source1:'minecraft:dirt',
  site0:'minecraft:air',site1:'minecraft:air',
  decoySource:'minecraft:dirt',decoySite:'minecraft:air'};
const completedBlocks={source0:'minecraft:air',source1:'minecraft:air',
  site0:'minecraft:dirt',site1:'minecraft:dirt',
  decoySource:'minecraft:dirt',decoySite:'minecraft:air'};

function probeSet(blocks,inventory,sequenceStart,override={}){
  return CHAIN_KEYS.map((key,i)=>({
    schema:'craftle.server-event.v1',event:'acceptance_probe',
    phase:'read_only_console_probe',
    probeId:'p'+sequenceStart+'-'+key,
    ...identity,...layout.sites[key],
    block:blocks[key],onlinePlayers:1,
    inventory:inventory.map(x=>({item:'minecraft:'+x.name,count:x.count})),
    sequence:sequenceStart+i,serverTick:sequenceStart+i,
    ...override
  }));
}
function snapshot(blocks,inventory=[],sequenceStart=1,overrides={}){
  return chainSnapshotFromProbes(layout,probeSet(blocks,inventory,sequenceStart,overrides));
}
function proofs(){
  return [
    {decisionKey:'d1',evidenceKey:'b:6',eventSequence:8,
      operation:'dig',targetKey:'source0',gateEligible:true},
    {decisionKey:'d2',evidenceKey:'b:12',eventSequence:16,
      operation:'dig',targetKey:'source1',gateEligible:true},
    {decisionKey:'d3',evidenceKey:'b:18',eventSequence:24,
      operation:'place',targetKey:'site0',gateEligible:true},
    {decisionKey:'d4',evidenceKey:'b:24',eventSequence:32,
      operation:'place',targetKey:'site1',gateEligible:true}
  ];
}
function observedContext(rot=0,blocks=initialBlocks,inventory=[]){
  const configured=chainLayout(rot);
  const blockAt=(x,y,z)=>{
    const matching=CHAIN_KEYS.find(k=>{
      const t=configured.sites[k];return x===t.x&&y===t.y&&z===t.z;
    });
    const isDirt=matching&&blocks[matching]==='minecraft:dirt';
    const solid=y===80||isDirt;
    return {name:isDirt?'dirt':solid?'stone':'air',
      boundingBox:solid?'block':'empty'};
  };
  return {
    layout:configured,position:{x:.5,y:81,z:.5},
    blockAt,inventory,health:20,food:20
  };
}

test('task geometry and train/test worlds are disjoint and deterministic',()=>{
  assert.equal(layout.schema,CHAIN_SCHEMA);
  assert.deepEqual(assertChainSplitDisjoint(),{train:2,heldout:2});
  const keys=new Set(CHAIN_KEYS.map(k=>
    JSON.stringify(layout.sites[k])));
  assert.equal(keys.size,6);
  assert.deepEqual(chainTasks(8,{seed:17,split:'train'}),
    chainTasks(8,{seed:17,split:'train'}));
  assert.equal(chainTasks(8,{seed:17,split:'heldout'})
    .filter(x=>x.rotation===2).length,4);
  assert.throws(()=>chainTasks(7));
  assert.throws(()=>chainTasks(8,{split:'unknown'}));
  assert.throws(()=>chainLayout(4));
});

test('starts empty-handed and exposes ONLY the three observed digs (including distractor)',()=>{
  const init=snapshot(initialBlocks,[],1);
  assert.equal(validateInitialChainSnapshot(init),true);
  const menu=chainCandidateMenu(observedContext());
  assert.deepEqual(menu.candidates.map(c=>c.id),['source0','source1','decoySource']);
  assert.ok(menu.candidates.every(c=>c.operation==='dig'));
  assert.equal(scriptedResourcePlanner(menu.observation,menu.candidates).id,'source0');
  const policy=createMotorQPolicy({seed:17,training:false});
  assert.equal(policy.scoreCandidates(menu.observation,menu.candidates).length,3);
});

test('inventory and post-dig observations gate the PLACE affordances',()=>{
  const blocks={...initialBlocks,source0:'minecraft:air'};
  const menu=chainCandidateMenu(observedContext(0,blocks,[{name:'dirt',count:1}]));
  assert.deepEqual(menu.candidates.map(c=>c.id),
    ['source1','decoySource','site0','site1','decoySite']);
  const partial=snapshot(blocks,[{name:'dirt',count:1}],8);
  assert.equal(scriptedResourcePlanner(menu.observation,menu.candidates).id,'site0');
  const consumed={...blocks,site0:'minecraft:dirt'};
  const empty=chainCandidateMenu(observedContext(0,consumed,[]));
  assert.deepEqual(empty.candidates.map(c=>c.id),['source1','decoySource']);
  assert.ok(!empty.candidates.some(c=>c.operation==='place'));
});

test('delayed final-state reward is zero after verified partial progress',()=>{
  const start=snapshot(initialBlocks,[],1);
  const afterDig=snapshot({...initialBlocks,source0:'minecraft:air'},
    [{name:'dirt',count:1}],10);
  const partial=chainFinalOutcome({
    initial:start,final:afterDig,proofs:proofs().slice(0,1)
  });
  assert.deepEqual(partial,{terminal:false,reward:0,success:false,
    reason:'awaiting_complete_verified_construction'});
});

test('final verified world state credits full four-action trajectory',()=>{
  const result=chainFinalOutcome({
    initial:snapshot(initialBlocks,[],1),
    final:snapshot(completedBlocks,[],33),
    proofs:proofs()
  });
  assert.deepEqual(result,{terminal:true,reward:1,success:true,
    reason:'final_blocks_and_proofs_verified'});
});

test('correct final world alone cannot reward missing or unverified action proof',()=>{
  const initial=snapshot(initialBlocks,[],1);
  const completed=snapshot(completedBlocks,[],33);
  assert.equal(chainFinalOutcome({initial,final:completed,
    proofs:proofs().slice(0,3)}).reward,0);
  const p=proofs();
  p[1].gateEligible=false;
  assert.throws(()=>chainFinalOutcome({initial,final:completed,proofs:p}));
  const q=proofs();
  q[1].evidenceKey=q[0].evidenceKey;
  assert.throws(()=>chainFinalOutcome({initial,final:completed,proofs:q}));
  const w=proofs();
  w[0].targetKey='site0';
  assert.throws(()=>chainFinalOutcome({initial,final:completed,proofs:w}));
});

test('wrong final construction or item conservation fails terminal success',()=>{
  const initial=snapshot(initialBlocks,[],1);
  const wrong=snapshot({...completedBlocks,site1:'minecraft:air'},[],33);
  assert.equal(chainFinalOutcome({initial,final:wrong,proofs:proofs()}).reward,-1);
  const inventory=snapshot(completedBlocks,[{name:'dirt',count:1}],33);
  assert.equal(chainFinalOutcome({initial,final:inventory,proofs:proofs()}).reward,-1);
});

test('fail closed on non-atomic probes, stale samples or actor changes',()=>{
  const original=probeSet(initialBlocks,[],1);
  original[0].inventory=[{item:'minecraft:dirt',count:1}];
  assert.throws(()=>chainSnapshotFromProbes(layout,original));
  const fake=probeSet(initialBlocks,[],1);
  fake[0].phase='client_reported_post_state';
  assert.throws(()=>chainSnapshotFromProbes(layout,fake));
  const init=snapshot(initialBlocks,[],1);
  const wrongActor=snapshot(completedBlocks,[],33,{playerUuid:'other'});
  assert.throws(()=>chainFinalOutcome({initial:init,final:wrongActor,proofs:proofs()}));
  const stale=snapshot(completedBlocks,[],31);
  assert.throws(()=>chainFinalOutcome({initial:init,final:stale,proofs:proofs()}));
});

test('Q policy can bootstrap a ZERO-reward intermediate action',()=>{
  const current=chainCandidateMenu(observedContext());
  const future=chainCandidateMenu(observedContext(0,
    {...initialBlocks,source0:'minecraft:air'},
    [{name:'dirt',count:1}]));
  const learner=createMotorQPolicy({seed:17,epsilon:0,alpha:0.05});
  const chosen=learner.choose(current.observation,current.candidates);
  assert.equal(chosen.features.length,MOTOR_FEATURE_COUNT);
  learner.observe({features:chosen.features,reward:0,terminal:false,
    nextObservation:future.observation,nextCandidates:future.candidates});
  assert.equal(learner.snapshot().updates,1);
  const next=learner.choose(future.observation,future.candidates);
  learner.observe({features:next.features,reward:1,terminal:true});
  assert.equal(learner.snapshot().updates,2);
  const frozen=createMotorQPolicy({snapshot:learner.snapshot(),
    hidden:24,training:false});
  assert.equal(frozen.stats().updates,2);
});

test('four legal actions that include a distractor FAIL the terminal task',()=>{
  const start=snapshot(initialBlocks,[],1);
  // One distractor was mined and the required source1 is still present.
  const wrongWorld={...initialBlocks,source0:'minecraft:air',
    decoySource:'minecraft:air',site0:'minecraft:dirt',
    site1:'minecraft:dirt'};
  const p=proofs();
  p[1].targetKey='decoySource';
  assert.deepEqual(chainFinalOutcome({
    initial:start,final:snapshot(wrongWorld,[],33),proofs:p
  }),{terminal:true,reward:-1,success:false,
    reason:'budget_exhausted_without_final_state'});
  // Or both required sources were mined but the wrong placement site was filled.
  const misplaced={...completedBlocks,site1:'minecraft:air',
    decoySite:'minecraft:dirt'};
  const q=proofs();
  q[3].targetKey='decoySite';
  assert.equal(chainFinalOutcome({
    initial:start,final:snapshot(misplaced,[],33),proofs:q
  }).reward,-1);
});

test('scripted planner avoids valid distractors with public construction blueprint',()=>{
  const start=snapshot(initialBlocks,[],1);
  const first=chainCandidateMenu(observedContext());
  assert.equal(first.candidates.length,3);
  assert.equal(scriptedResourcePlanner(first.observation,first.candidates).id,'source0');
  const postDig={...initialBlocks,source0:'minecraft:air'};
  const next=chainCandidateMenu(observedContext(0,postDig,
    [{name:'dirt',count:1}]));
  assert.equal(next.candidates.length,5);
  assert.equal(scriptedResourcePlanner(next.observation,next.candidates).id,'site0');
});

test('planner uses only candidate operation geometry and the public blueprint',()=>{
  const menu=chainCandidateMenu(observedContext());
  const blueprint=validateChainBlueprint(menu.observation);
  assert.equal(blueprint.sources.length,2);
  assert.equal(blueprint.sites.length,2);
  const aliases=menu.candidates.map((c,i)=>({...c,id:'opaque-'+i}));
  assert.equal(scriptedResourcePlanner(menu.observation,aliases).id,'opaque-0');
  assert.deepEqual(chainActionTarget(aliases[0]),layout.sites.source0);
  assert.throws(()=>scriptedResourcePlanner({...menu.observation,
    blueprint:null},menu.candidates));
  assert.throws(()=>chainActionTarget({executable:true,
    operation:'place',arguments:{reference:{x:0,y:80,z:0},
    face:{x:0,y:2,z:0}}}));
});

test('public blueprint and action geometry rotate, and the planner remains equivariant',()=>{
  for(const rot of [0,1,2,3]){
    const menu=chainCandidateMenu(observedContext(rot));
    const first=scriptedResourcePlanner(menu.observation,menu.candidates);
    assert.equal(first.id,'source0');
    assert.deepEqual(chainActionTarget(first),chainLayout(rot).sites.source0);
    const postDig={...initialBlocks,source0:'minecraft:air'};
    const after=chainCandidateMenu(observedContext(rot,postDig,
      [{name:'dirt',count:1}]));
    const next=scriptedResourcePlanner(after.observation,after.candidates);
    assert.equal(next.id,'site0');
    assert.deepEqual(chainActionTarget(next),chainLayout(rot).sites.site0);
  }
});

test('completed visible structure is not credited if any required mutation lacks proof',()=>{
  const initial=snapshot(initialBlocks,[],1);
  const completed=snapshot(completedBlocks,[],33);
  const p=proofs();
  p[1].targetKey='decoySource'; // required source1 mutation has no proof
  assert.deepEqual(chainFinalOutcome({
    initial,final:completed,proofs:p
  }),{terminal:true,reward:-1,success:false,
    reason:'budget_exhausted_without_final_state'});
  const q=proofs();
  q[3].targetKey='decoySite'; // required site1 mutation has no proof
  assert.equal(chainFinalOutcome({
    initial,final:completed,proofs:q
  }).success,false);
});
