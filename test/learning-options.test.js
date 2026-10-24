import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLearningOptionController} from '../src/learning-options.js';
const observation={health:20,food:20,foodAvailable:false,hostileDistance:Infinity,inventoryCount:0,blocked:false,displacement:0,position:{x:0,z:0}};
test('terminal death trains exactly once and learned weights reload across lives',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-options-'));
 try{
  const checkpoint=path.join(directory,'policy.json'),events=[];
  const controller=createLearningOptionController({checkpoint,log:e=>events.push(e)});
  controller.choose(observation);controller.terminal();controller.terminal();
  assert.equal(controller.stats().updates,4);
  assert.equal(events.filter(e=>e.type==='option_terminal').length,1);
  const restored=createLearningOptionController({checkpoint});
  assert.equal(restored.stats().updates,4);
  restored.choose(observation);
  assert.equal(restored.stats().updates,4);
  controller.stop();restored.stop();
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('frozen option evaluation neither trains nor modifies checkpoint',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-options-'));
 try{
  const checkpoint=path.join(directory,'policy.json');
  const trainer=createLearningOptionController({checkpoint});trainer.choose(observation);trainer.stop();
  const before=fs.readFileSync(checkpoint,'utf8');
  const evaluator=createLearningOptionController({checkpoint,training:false});
  evaluator.choose(observation);evaluator.choose({...observation,position:{x:8,z:0}});
  evaluator.terminal();evaluator.stop();
  assert.equal(evaluator.stats().updates,0);assert.equal(fs.readFileSync(checkpoint,'utf8'),before);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('random and scripted controls neither load nor overwrite a supplied checkpoint',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-options-'));
 try{
  const checkpoint=path.join(directory,'policy.json');fs.writeFileSync(checkpoint,'reference sentinel');
  for(const mode of ['random','scripted']){
   const p=createLearningOptionController({checkpoint,mode,seed:42});
   for(let i=0;i<20;i++)assert.notEqual(p.choose(observation),'eat');
   p.terminal();p.stop();assert.equal(p.stats().updates,0);
  }
  assert.equal(fs.readFileSync(checkpoint,'utf8'),'reference sentinel');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('random policy is reproducible and frozen policy requires actual weights',()=>{
 const a=createLearningOptionController({mode:'random',seed:7}),b=createLearningOptionController({mode:'random',seed:7});
 assert.deepEqual(Array.from({length:20},()=>a.choose(observation)),Array.from({length:20},()=>b.choose(observation)));
 assert.throws(()=>createLearningOptionController({mode:'frozen'}),/checkpoint/);
});
