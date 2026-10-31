import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createThreeSystemDqnAdapter,makeTargetedDqn} from '../src/three-system-dqn-adapter.js';
import {ThreeSystemLoop} from '../src/three-system-loop.js';
import {TARGET_ACTIONS,encodeTargets} from '../src/target-opportunities.js';
const observation=()=>({health:20,food:20,foodAvailable:false,foodUnits:0,foodPoints:0,
 hostileDistance:24,blocked:false,displacement:0,position:{x:0,y:65,z:0},targets:[]});
test('real DQN receives one 44x15 time-aware transition after episode settlement',()=>{
 const network=makeTargetedDqn({random:()=>0.5,epsilon:0});
 const adapter=createThreeSystemDqnAdapter({learner:network});
 const loop=new ThreeSystemLoop({valueLearner:adapter,chooseAction:adapter.chooseAction});
 loop.goals.propose({id:'explore-1',objective:'explore local area'});
 const initial=observation(),selected=loop.start('explore-1',{observation:initial,tick:10});
 assert.equal(selected.action,'explore');
 assert.equal(encodeTargets(initial).features.length,44);
 assert.equal(TARGET_ACTIONS.length,15);
 assert.equal(adapter.pending,true);
 assert.throws(()=>loop.start('explore-1',{observation:initial,tick:11}));
 const result=loop.observe({tick:82,result:'no_observable_change',observation:initial,reward:-0.03});
 assert.equal(result.transition.elapsedTicks,72);
 assert.equal(adapter.pending,false);
 assert.equal(network.stats().replaySize,1);
 const state=network.snapshot().trainingState.replay[0];
 assert.equal(state.steps,2);
 assert.equal(state.terminal,false);
 assert.equal(state.nextMask.length,15);
});
test('interrupted episode bootstraps; true death is terminal',()=>{
 const samples=[];
 const learner={choose:()=>({index:1}),observe:t=>samples.push(t)};
 const adapter=createThreeSystemDqnAdapter({learner});
 const initial=observation();
 adapter.chooseAction({observation:initial});
 adapter.observe({option:'explore',elapsedTicks:12,reward:0,result:'interrupted',nextState:initial,evidence:null});
 assert.equal(samples[0].terminal,false);
 assert.equal(samples[0].steps,1);
 adapter.chooseAction({observation:initial});
 adapter.observe({option:'explore',elapsedTicks:36,reward:-5,result:'verified_failure',
  nextState:null,evidence:{episodeTerminal:true}});
 assert.equal(samples[1].terminal,true);
 assert.equal(samples[1].nextState,undefined);
});
test('rejects masked choice and unfinished action',()=>{
 const initial=observation();
 const adapter=createThreeSystemDqnAdapter({learner:{choose:()=>({index:0}),observe:()=>{}}});
 assert.throws(()=>adapter.chooseAction({observation:initial}),/masked/);
 const valid=createThreeSystemDqnAdapter({learner:{choose:()=>({index:1}),observe:()=>{}}});
 valid.chooseAction({observation:initial});
 assert.throws(()=>valid.chooseAction({observation:initial}),/Unsettled/);
});
