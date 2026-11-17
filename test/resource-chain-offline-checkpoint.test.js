import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResourceChainOfflineCheckpoint,
  loadResourceChainOfflineCheckpoint
} from '../src/resource-chain-offline-checkpoint.js';
import {chainCandidateMenu,chainLayout,CHAIN_KEYS}
  from '../src/motor-resource-chain.js';

const fakeHashes={'src/resource-chain-q.js':'a'.repeat(64)};
const gen=mode=>buildResourceChainOfflineCheckpoint({
  mode,seed:17,episodes:200,sourceHashes:fakeHashes
});
function menu(rotation){
  const layout=chainLayout(rotation);
  const cells={source0:'dirt',source1:'dirt',decoySource:'dirt',
    site0:'air',site1:'air',decoySite:'air'};
  const blockAt=(x,y,z)=>{
    const key=CHAIN_KEYS.find(k=>{
      const p=layout.sites[k];return p.x===x&&p.y===y&&p.z===z;
    });
    const solid=y===80||key&&cells[key]==='dirt';
    return {name:solid?'dirt':'air',boundingBox:solid?'block':'empty'};
  };
  return chainCandidateMenu({layout,
    position:{x:.5,y:81,z:.5},blockAt,inventory:[]});
}

test('pretrained and untrained policies are never live-trainable',()=>{
  for(const mode of ['trained','untrained']){
    const checkpoint=gen(mode);
    const loaded=loadResourceChainOfflineCheckpoint(checkpoint,{
      requireSourceHashes:fakeHashes
    });
    assert.equal(loaded.policy.stats().training,false);
    assert.equal(loaded.metadata.liveEvidence,'NONE');
    assert.equal(loaded.metadata.training.liveLearningUpdates,0);
    assert.equal(loaded.metadata.training.plannerDemonstrations,0);
    assert.equal(loaded.metadata.validation.physicalLayouts,10);
    assert.equal(loaded.metadata.validation.heldout.length,10);
    const sample=menu(3);
    assert.ok(sample.candidates.length>0);
    assert.ok(sample.candidates.some(c=>c.id===
      loaded.policy.choose(sample.observation,sample.candidates).candidate.id));
    assert.throws(()=>loaded.policy.learnEpisode([]),/Frozen/);
    if(mode==='untrained'){
      assert.equal(loaded.metadata.model.updates,0);
    }else{
      assert.equal(loaded.metadata.model.updates,200*28);
    }
  }
});
test('checkpoint digest and source hashes reject tampering',()=>{
  const original=gen('untrained');
  const mutated=JSON.parse(JSON.stringify(original));
  mutated.payload.model.w[0][0]+=0.1;
  assert.throws(()=>loadResourceChainOfflineCheckpoint(mutated),/integrity/);
  assert.throws(()=>loadResourceChainOfflineCheckpoint(original,{
    requireSourceHashes:{'src/resource-chain-q.js':'b'.repeat(64)}
  }),/source hash/);
  assert.throws(()=>buildResourceChainOfflineCheckpoint({seed:-1}));
  assert.throws(()=>buildResourceChainOfflineCheckpoint({mode:'scripted'}));
});
test('a frozen checkpoint produces deterministic greedy choices and never updates',()=>{
  const loaded=loadResourceChainOfflineCheckpoint(gen('untrained'),{
    requireSourceHashes:fakeHashes
  });
  const state=menu(2);
  const a=loaded.policy.choose(state.observation,state.candidates);
  const b=loaded.policy.choose(state.observation,state.candidates);
  assert.equal(a.candidate.id,b.candidate.id);
  assert.equal(a.exploratory,false);
  assert.equal(loaded.policy.stats().updates,0);
});
