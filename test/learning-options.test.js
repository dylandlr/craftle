import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLearningOptionController} from '../src/learning-options.js';
const observation={health:20,food:20,foodAvailable:false,hostileDistance:Infinity,inventoryCount:0,blocked:false,displacement:0,position:{x:0,z:0}};
test('commitment credits discounted interval rewards once at the option boundary',()=>{
 const events=[],p=createLearningOptionController({mode:'training',seed:7,commitmentSteps:3,log:e=>events.push(e)});
 const action=p.choose(observation);
 for(let i=1;i<=2;i++){
  assert.equal(p.choose({...observation,position:{x:i*4,z:0}}),action);
  assert.equal(p.stats().updates,0);
 }
 p.choose({...observation,position:{x:12,z:0}});
 assert.equal(p.stats().updates,4);
 const transitions=events.filter(e=>e.type==='option_transition');
 assert.equal(transitions.length,1);assert.equal(transitions[0].steps,3);
 assert.ok(Math.abs(transitions[0].reward-0.18*(1+0.95+0.95**2))<1e-10);
});
test('blocked paths and threat changes release commitment without forcing a scripted action',()=>{
 for(const interruption of [{blocked:true},{hostileDistance:4}]){
  const events=[],p=createLearningOptionController({mode:'random',commitmentSteps:8,log:e=>events.push(e)});
  p.choose(observation);p.choose({...observation,...interruption});
  assert.equal(events.filter(e=>e.type==='option_decision').length,2);
  assert.equal(events.filter(e=>e.type==='option_transition').length,1);
 }
});
test('death includes accrued reward once and clears commitment for the next life',()=>{
 const events=[],p=createLearningOptionController({commitmentSteps:4,log:e=>events.push(e)});
 p.choose(observation);p.choose({...observation,position:{x:4,z:0}});
 p.terminal();p.terminal();
 assert.equal(p.stats().updates,4);
 assert.ok(Math.abs(events.find(e=>e.type==='option_terminal').reward-(0.18-5*0.95))<1e-10);
 p.choose(observation);assert.equal(p.stats().updates,4);
});
test('commitment configuration is bounded and invalidated food releases eating',()=>{
 assert.throws(()=>createLearningOptionController({commitmentSteps:0}),/commitment/);
 const events=[],p=createLearningOptionController({mode:'scripted',commitmentSteps:8,log:e=>events.push(e)});
 assert.equal(p.choose({...observation,food:16,foodAvailable:true}),'eat');
 assert.equal(p.choose(observation),'forage');
 assert.equal(events.find(e=>e.type==='option_transition').reason,'invalid');
});
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
