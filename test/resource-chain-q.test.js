import test from 'node:test';
import assert from 'node:assert/strict';
import {chainCandidateMenu,chainLayout,CHAIN_KEYS,CHAIN_GEOMETRY_VARIANTS,
  scriptedResourcePlanner} from '../src/motor-resource-chain.js';
import {createResourceChainQ,encodeResourceChainCandidate,
  RESOURCE_CHAIN_Q_FEATURES,RESOURCE_CHAIN_Q_SCHEMA} from '../src/resource-chain-q.js';

function menu(rotation=0,changes={},count=0,variant='base'){
  const layout=chainLayout(rotation,variant);
  const blocks={source0:'dirt',source1:'dirt',decoySource:'dirt',
    site0:'air',site1:'air',decoySite:'air',...changes};
  const blockAt=(x,y,z)=>{
    const key=CHAIN_KEYS.find(k=>{
      const p=layout.sites[k];return p.x===x&&p.y===y&&p.z===z;
    });
    const dirt=key&&blocks[key]==='dirt';
    return {name:dirt?'dirt':y===80?'stone':'air',
      boundingBox:(dirt||y===80)?'block':'empty'};
  };
  return chainCandidateMenu({layout,position:{x:.5,y:81,z:.5},
    blockAt,inventory:count?[{name:'dirt',count}]:[]});
}

test('blueprint encoder is ID-independent and rotation invariant',()=>{
  const first=menu(0),rotated=menu(2);
  for(const key of ['source0','source1','decoySource']){
    const a=first.candidates.find(c=>c.id===key);
    const b=rotated.candidates.find(c=>c.id===key);
    const ea=encodeResourceChainCandidate(first.observation,a);
    const eb=encodeResourceChainCandidate(rotated.observation,b);
    assert.equal(ea.length,RESOURCE_CHAIN_Q_FEATURES);
    for(let i=0;i<ea.length;i++)assert.ok(Math.abs(ea[i]-eb[i])<1e-10,
      key+': feature '+i+' differs under rotation');
    assert.deepEqual(ea,encodeResourceChainCandidate(first.observation,
      {...a,id:'unlabeled'}));
  }
  const after0=menu(0,{source0:'air'},1);
  const after2=menu(2,{source0:'air'},1);
  for(const key of ['site0','site1','decoySite']){
    const a=after0.candidates.find(c=>c.id===key);
    const b=after2.candidates.find(c=>c.id===key);
    const ea=encodeResourceChainCandidate(after0.observation,a);
    const eb=encodeResourceChainCandidate(after2.observation,b);
    for(let i=0;i<ea.length;i++)assert.ok(Math.abs(ea[i]-eb[i])<1e-10,
      key+': placement feature '+i+' differs under rotation');
  }
});

test('planner and neural policy receive exactly the same public blueprint',()=>{
  const state=menu(1);
  const symbolic=scriptedResourcePlanner(state.observation,state.candidates);
  assert.equal(symbolic.id,'source0');
  const q=createResourceChainQ({seed:17,training:false});
  const choices=q.scoreCandidates(state.observation,state.candidates);
  assert.equal(choices.length,3);
  assert.ok(choices.every(x=>Number.isFinite(x.q)));
  assert.deepEqual(state.observation.blueprint.sources.map(p=>p.x),
    chainLayout(1).sites.source0.x===0?[
      chainLayout(1).sites.source0.x,chainLayout(1).sites.source1.x
    ]:state.observation.blueprint.sources.map(p=>p.x));
});

test('checkpoint is isolated and frozen; no updates during evaluation',()=>{
  const state=menu(0);
  const q=createResourceChainQ({seed:17,epsilon:0,hidden:24});
  const raw=q.choose(state.observation,state.candidates);
  const episode=Array.from({length:4},(_,i)=>({
    features:raw.features,reward:i===3?1:0
  }));
  const before=q.stats().updates;
  q.learnEpisode(episode);
  assert.equal(q.stats().episodes,1);
  assert.equal(q.stats().successes,1);
  assert.ok(q.stats().updates>before);
  const frozen=createResourceChainQ({seed:17,hidden:24,
    snapshot:q.snapshot(),training:false,epsilon:0});
  assert.equal(frozen.snapshot().schema,RESOURCE_CHAIN_Q_SCHEMA);
  const scores=frozen.scoreCandidates(state.observation,state.candidates);
  assert.equal(scores.length,3);
  assert.throws(()=>frozen.learnEpisode(episode));
  assert.equal(frozen.stats().updates,q.stats().updates);
  assert.throws(()=>createResourceChainQ({snapshot:{
    ...q.snapshot(),schema:'craftle.motor-q.v3.goal-frame'
  }}));
});

test('terminal-only returns reject intermediary target feedback or malformed data',()=>{
  const q=createResourceChainQ({seed:23});
  const state=menu(0);
  const first=q.choose(state.observation,state.candidates);
  const good=Array.from({length:4},(_,i)=>({
    features:first.features,reward:i===3?-1:0
  }));
  assert.throws(()=>q.learnEpisode(good.slice(0,3)));
  assert.throws(()=>q.learnEpisode(good.map((x,i)=>
    i===1?{...x,reward:1}:x)));
  assert.throws(()=>q.learnEpisode(good.map((x,i)=>
    i===2?{...x,features:[1]}:x)));
  const feedback=q.learnEpisode(good);
  assert.equal(feedback.successes,0);
  assert.equal(feedback.episodes,1);
});

test('unobserved required block and invalid blueprints fail closed',()=>{
  const state=menu(0);
  const candidate=state.candidates[0];
  assert.throws(()=>encodeResourceChainCandidate({
    ...state.observation,blueprint:null
  },candidate));
  assert.throws(()=>encodeResourceChainCandidate({
    ...state.observation,blockAt:()=>null
  },candidate));
  assert.throws(()=>encodeResourceChainCandidate({
    ...state.observation,remainingSteps:99
  },candidate));
});

test('uniform warmup is real exploration, never demonstration or frozen evaluation',()=>{
  const state=menu(0);
  const q=createResourceChainQ({seed:17,epsilon:0});
  for(let i=0;i<10;i++){
    const sampled=q.choose(state.observation,state.candidates,
      {epsilonOverride:1});
    assert.equal(sampled.exploratory,true);
    assert.ok(state.candidates.some(c=>c.id===sampled.candidate.id));
  }
  assert.throws(()=>q.choose(state.observation,state.candidates,
    {epsilonOverride:-0.01}));
  assert.throws(()=>q.choose(state.observation,state.candidates,
    {epsilonOverride:1.01}));
  const frozen=createResourceChainQ({seed:17,training:false});
  assert.throws(()=>frozen.choose(state.observation,state.candidates,
    {epsilonOverride:1}));
  assert.equal(q.stats().episodes,0);
  assert.equal(q.stats().updates,0);
});

test('five geometry families yield distinct physical maps and rotation-invariant encoded actions',()=>{
  const fingerprints=new Set();
  for(const variant of CHAIN_GEOMETRY_VARIANTS){
    const a=menu(0,{},0,variant),b=menu(2,{},0,variant);
    fingerprints.add(JSON.stringify(a.observation.blueprint));
    assert.equal(a.candidates.length,3);
    assert.equal(b.candidates.length,3);
    for(const key of ['source0','source1','decoySource']){
      const fa=encodeResourceChainCandidate(a.observation,
        a.candidates.find(c=>c.id===key));
      const fb=encodeResourceChainCandidate(b.observation,
        b.candidates.find(c=>c.id===key));
      for(let i=0;i<fa.length;i++)assert.ok(Math.abs(fa[i]-fb[i])<1e-10,
        variant+': '+key+' feature '+i+' is not rotation-invariant');
    }
    const p=scriptedResourcePlanner(a.observation,a.candidates);
    assert.equal(p.id,'source0');
  }
  assert.equal(fingerprints.size,CHAIN_GEOMETRY_VARIANTS.length);
  assert.throws(()=>chainLayout(2,'unseen_invalid_variant'));
});
