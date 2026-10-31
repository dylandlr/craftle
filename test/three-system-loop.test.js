import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ThreeSystemLoop} from '../src/three-system-loop.js';
test('A, B, C share completed evidence while objective persists',()=>{
 const learned=[],loop=new ThreeSystemLoop({valueLearner:{observe:t=>learned.push(t)},chooseAction:()=> 'inspect'});
 loop.goals.propose({id:'tree',objective:'investigate unknown tree'});
 const first=loop.start('tree',{observation:{x:0},tick:10});
 assert.equal(first.action,'inspect');
 assert.throws(()=>loop.start('tree',{observation:{x:1},tick:11}));
 const outcome=loop.observe({tick:30,result:'verified_success',observation:{x:1},reward:1,evidence:{kind:'block',name:'oak_log',action:'inspect',evidenceSource:'agent_observation'}});
 assert.equal(outcome.goal.state,'active');
 assert.equal(outcome.goal.progress.length,1);
 assert.equal(outcome.transition.elapsedTicks,20);
 assert.equal(learned.length,1);
 assert.equal(loop.knowledge.query('block','oak_log','inspect').observations,1);
});
test('tabled goal resumes without erasing knowledge',()=>{
 const loop=new ThreeSystemLoop({valueLearner:{observe:()=>{}},chooseAction:()=> 'explore'});
 loop.goals.propose({id:'cave',objective:'investigate cave'});
 loop.start('cave',{observation:{},tick:0,maxTicks:10});
 loop.observe({tick:10,result:'timed_out',observation:{},reward:-0.1,goalDisposition:'tabled',reason:'cannot reach',resumeWhen:'new route observed'});
 assert.equal(loop.goals.goal('cave').state,'tabled');
 assert.equal(loop.snapshot().activeEpisode,false);
 loop.start('cave',{observation:{newRoute:true},tick:30});
 assert.equal(loop.goals.goal('cave').state,'active');
});
