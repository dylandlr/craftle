import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NavigationDeadlockMonitor} from '../src/navigation-deadlock-monitor.js';
const p=(x=0)=>({x,y:64,z:0});
test('persistent blocked movement is flagged with evidence, not assumed collision',()=>{
 const m=new NavigationDeadlockMonitor({cooldownTicks:100});
 let r;
 for(const tick of [0,20,40,60])r=m.sample({tick,position:p(0.01),goalId:'g1',moving:true,frontBlock:'dirt'});
 assert.equal(r.deadlocked,true);assert.equal(r.frontBlock,'dirt');assert.match(r.attribution,/not_proven/);
 assert.equal(m.sample({tick:80,position:p(0.01),goalId:'g1',moving:true}).deadlocked,false);
});
test('legitimate waiting or intentional stationary work never counts as navigation deadlock',()=>{
 const m=new NavigationDeadlockMonitor();
 for(const tick of [0,20,40,60])assert.equal(m.sample({tick,position:p(),goalId:'g1',moving:false}).deadlocked,false);
 for(const tick of [80,100,120,140])assert.equal(m.sample({tick,position:p(),goalId:'dig',moving:true,mode:'interaction'}).deadlocked,false);
});
test('goal changes clear the stall window',()=>{
 const m=new NavigationDeadlockMonitor();
 for(const tick of [0,20,40])m.sample({tick,position:p(),goalId:'g1',moving:true});
 const r=m.sample({tick:60,position:p(),goalId:'g2',moving:true});
 assert.equal(r.reason,'insufficient_samples');
});
test('motion beyond displacement threshold clears deadlock condition',()=>{
 const m=new NavigationDeadlockMonitor();
 let r;for(const [i,tick] of [0,20,40,60].entries())r=m.sample({tick,position:p(i),goalId:'g1',moving:true});
 assert.equal(r.deadlocked,false);
});
