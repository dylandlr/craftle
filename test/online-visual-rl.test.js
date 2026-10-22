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
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('intrinsic reward favors novelty and motion, penalizes damage',()=>{
 assert.ok(intrinsicVisualReward({displacement:1,novelState:true})>intrinsicVisualReward({displacement:0}));
 assert.ok(intrinsicVisualReward({healthDelta:-2})<intrinsicVisualReward({}));
});
