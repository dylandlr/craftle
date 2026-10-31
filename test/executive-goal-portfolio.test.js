import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GoalPortfolio} from '../src/executive-goal-portfolio.js';
test('table and resume without losing progress',()=>{
 const p=new GoalPortfolio();p.propose({id:'cave',objective:'investigate cave'});
 p.activate('cave');p.noteProgress('cave',{description:'entrance found',evidence:{source:'agent_observation'}});
 p.transition('cave','tabled',{reason:'hazard',resumeWhen:'risk decreased'});
 assert.equal(p.goal('cave').progress.length,1);
 assert.equal(p.goal('cave').resumeWhen,'risk decreased');
 p.activate('cave',{reason:'risk decreased'});
 assert.equal(p.goal('cave').progress[0].description,'entrance found');
});
test('only one active goal and dependency checks',()=>{
 const p=new GoalPortfolio();
 p.propose({id:'a',objective:'learn movement'});p.propose({id:'b',objective:'investigate area',dependencies:['a']});
 assert.throws(()=>p.activate('b'));
 p.activate('a');assert.throws(()=>p.activate('b'));
 p.transition('a','completed',{reason:'observed success'});
 p.activate('b');assert.equal(p.activeId,'b');
});
test('restore state preserves tabled goals and rejects conflicting actives',()=>{
 const p=new GoalPortfolio();p.propose({id:'a',objective:'observe terrain'});p.activate('a');
 p.transition('a','blocked',{reason:'not visible',resumeWhen:'terrain observed'});
 const restored=GoalPortfolio.restore(p.snapshot());
 assert.equal(restored.goal('a').state,'blocked');
 assert.throws(()=>GoalPortfolio.restore({...p.snapshot(),activeId:'a'}));
});
test('tabling requires a reason and resumption condition',()=>{
 const p=new GoalPortfolio();p.propose({id:'a',objective:'collect materials'});p.activate('a');
 assert.throws(()=>p.transition('a','tabled',{reason:'need resources'}));
 assert.equal(p.activeId,'a');
});
