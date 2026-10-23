import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createOnlineVisualQLearner,visualState,intrinsicVisualReward} from '../src/online-visual-rl.js';
test('visual discretization sees RGB, rejects ungrounded frames',()=>{
 const a={source:'first_person_rgb',rgb:new Uint8Array(8*8*3).fill(0),width:8,height:8};
 assert.equal(visualState(a),'0000');
 assert.equal(visualState({...a,rgb:new Uint8Array(8*8*3).fill(255)}),'3333');
 assert.throws(()=>visualState({...a,source:'block_map'}),/RGB24/);
});
test('learning updates Q values, persists, and reloads without pretrained knowledge',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-rl-')),file=path.join(dir,'q.json');
 try{
  const a=createOnlineVisualQLearner({epsilon:0,alpha:1,gamma:0,random:()=>0,checkpoint:file});
  assert.equal(a.choose('0000').action,'forward');
  a.learn({state:'0000',index:2,reward:2,nextState:'3333'});
  assert.equal(a.choose('0000').action,'right');
  a.save();
  const b=createOnlineVisualQLearner({epsilon:0,checkpoint:file});
  assert.equal(b.choose('0000').action,'right');
  assert.ok(b.stats().states>0);
  assert.equal(b.stats().transitions,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('intrinsic reward favors novelty and motion, penalizes damage',()=>{
 assert.ok(intrinsicVisualReward({displacement:1,novelState:true})>intrinsicVisualReward({displacement:0}));
 assert.ok(intrinsicVisualReward({healthDelta:-2})<intrinsicVisualReward({}));
});

test('frozen checkpoint never trains, explores, or writes novel Q states',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-frozen-')),file=path.join(dir,'q.json');
 try{
  const a=createOnlineVisualQLearner({checkpoint:file,epsilon:0,alpha:1,gamma:0});
  a.learn({state:'0000',index:3,reward:3,nextState:'0000'});a.save();
  const frozen=createOnlineVisualQLearner({checkpoint:file,training:false,epsilon:1,random:()=>0});
  assert.equal(frozen.choose('0000').action,'jump');
  assert.equal(frozen.choose('3333').action,'forward');
  assert.equal(frozen.stats().states,1);
  assert.throws(()=>frozen.learn({state:'0000',index:0,reward:1,nextState:'0000'}),/Frozen/);
  assert.equal(frozen.stats().transitions,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Bellman bootstrap and terminal targets match tabular Q-learning equation',()=>{
 const q=createOnlineVisualQLearner({alpha:0.5,gamma:0.9,epsilon:0,random:()=>0});
 q.learn({state:'3333',index:2,reward:4,nextState:'3333',terminal:true}); // Q = 2
 const update=q.learn({state:'0000',index:1,reward:1,nextState:'3333'});
 assert.ok(Math.abs(update.tdValue-1.4)<1e-12); // 0+0.5*(1+0.9*2)
 const terminal=q.learn({state:'0000',index:1,reward:0,nextState:'3333',terminal:true});
 assert.ok(Math.abs(terminal.tdValue-0.7)<1e-12); // no bootstrap
});
test('greedy equal-value action ties do not always select forward',()=>{
 const first=createOnlineVisualQLearner({epsilon:0,random:()=>0});
 const last=createOnlineVisualQLearner({epsilon:0,random:()=>0.999});
 assert.equal(first.choose('0000').action,'forward');
 assert.equal(last.choose('0000').action,'look_right');
 const frozen=createOnlineVisualQLearner({epsilon:0,training:false,random:()=>0.999});
 assert.equal(frozen.choose('3333').action,'look_right');
 assert.equal(frozen.stats().states,0);
});
test('frozen learning attempts and invalid transitions never mutate state',()=>{
 const frozen=createOnlineVisualQLearner({training:false});
 assert.throws(()=>frozen.learn({state:'0000',index:0,reward:1,nextState:'0000'}),/Frozen/);
 assert.equal(frozen.stats().states,0);
 const learner=createOnlineVisualQLearner();
 assert.throws(()=>learner.learn({state:'bad',index:0,reward:1,nextState:'0000'}),/Invalid/);
 assert.equal(learner.stats().states,0);
});
test('malformed checkpoint is rejected instead of silently discarding states',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-corrupt-')),file=path.join(dir,'q.json');
 try{
  fs.writeFileSync(file,JSON.stringify({schemaVersion:1,actions:['forward','left','right','jump','look_left','look_right'],q:{wrong:[0,0,0,0,0,0]},transitions:0}));
  assert.throws(()=>createOnlineVisualQLearner({checkpoint:file}),/Invalid RL checkpoint state/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
