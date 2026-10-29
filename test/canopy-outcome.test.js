import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanopyOutcomeTracker} from '../src/canopy-outcome.js';
test('canopy episode starts once and only observed nonleaf footing closes it',()=>{
 let now=1000;const tracker=createCanopyOutcomeTracker({clock:()=>now,timeoutMs:10000});
 const sample=(y,underfoot,life=0)=>tracker.sample({position:{x:0,y,z:0},underfoot,life,health:10,food:8});
 assert.equal(sample(76,'birch_leaves')[0].type,'canopy_episode_started');
 assert.deepEqual(sample(75,'birch_leaves'),[]);
 now=12000;
 assert.equal(sample(74,'birch_leaves')[0].type,'canopy_episode_still_trapped');
 now=13000;
 const exited=sample(72,'grass_block');
 assert.equal(exited[0].type,'canopy_episode_exited');
 assert.equal(exited[0].verticalDescent,4);
 assert.equal(exited[0].evidence,'observed_nonleaf_footing_not_survival_success');
 assert.deepEqual(sample(72,'grass_block'),[]);
});
test('life changes censor unobserved escape and unknown footing does not invent a result',()=>{
 let now=0;const tracker=createCanopyOutcomeTracker({clock:()=>now});
 const position={x:0,y:75,z:0};
 tracker.sample({position,underfoot:'oak_leaves',life:1});
 assert.deepEqual(tracker.sample({position,underfoot:null,life:1}),[]);
 now=100;
 const events=tracker.sample({position,underfoot:'stone',life:2});
 assert.equal(events.length,1);
 assert.equal(events[0].type,'canopy_episode_censored');
 assert.equal(events[0].reason,'life_changed');
});
