import test from 'node:test';
import assert from 'node:assert/strict';
import {createTargetedController} from '../src/targeted-controller.js';
import {TARGET_ACTIONS,encodeTargets} from '../src/target-opportunities.js';
const observation=(overrides={})=>({
 health:20,food:10,foodAvailable:false,foodUnits:0,foodPoints:0,
 hostileDistance:24,blocked:false,displacement:0,
 position:{x:0,y:70,z:0},targets:[],...overrides
});
function transition({version='v2',initial=observation(),next=observation(),eat=false}={}){
 const events=[];
 const ctrl=createTargetedController({mode:'scripted',rewardVersion:version,log:e=>events.push(e)});
 const choice=ctrl.choose(initial);
 if(eat)assert.equal(ctrl.consumed(choice.decisionId,initial.food,next.food),true);
 ctrl.choose(next);
 ctrl.stop();
 return {choice,events,transition:events.find(e=>e.type==='target_transition')};
}
test('v2 grants +0.12 for one new grid cell plus 3 blocks movement, net of time cost',()=>{
 const x=transition({initial:observation(),next:observation({
  position:{x:9,y:70,z:0},displacement:3})});
 assert.equal(x.choice.skill,'explore');
 assert.ok(Math.abs(x.transition.reward-0.12)<1e-9);
});
test('v1 gives no novelty shaping for identical movement',()=>{
 const x=transition({version:'v1',next:observation({
  position:{x:9,y:70,z:0},displacement:3})});
 assert.ok(Math.abs(x.transition.reward+0.03)<1e-9);
});
test('v2 inventory gain shaping caps at +0.45, including action cost',()=>{
 const x=transition({next:observation({
  foodAvailable:true,foodUnits:10,foodPoints:20})});
 assert.ok(Math.abs(x.transition.reward-0.42)<1e-9);
});
test('verified consumption credit arrives on the subsequent observation',()=>{
 const initial=observation({foodAvailable:true,foodUnits:1,foodPoints:2,exploreFeasible:false});
 const next=observation({food:16,foodAvailable:false,foodUnits:0});
 const x=transition({initial,next,eat:true});
 assert.equal(x.choice.skill,'eat');
 assert.ok(Math.abs(x.transition.reward-0.97)<1e-9);
});
test('death assigns -5 terminal reward to pending decision',()=>{
 const events=[];const ctrl=createTargetedController({mode:'scripted',rewardVersion:'v2',log:e=>events.push(e)});
 ctrl.choose(observation());ctrl.terminal();
 assert.equal(events.find(e=>e.type==='target_terminal').reward,-5);
});
test('missing action capabilities cannot be unlocked by reward tuning',()=>{
 for(const name of ['mine','craft','place','descend'])assert.equal(
  TARGET_ACTIONS.some(action=>action.startsWith(name)),false);
 const {mask}=encodeTargets(observation());
 assert.deepEqual(TARGET_ACTIONS.filter((_,i)=>mask[i]),['explore']);
});
