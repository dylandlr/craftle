import test from 'node:test';
import assert from 'node:assert/strict';
import {rewardV3} from '../src/target-reward-v3.js';
import {createTargetedController} from '../src/targeted-controller.js';
import {SURVIVAL_SKILLS,auditSurvivalActionSpace} from '../src/survival-action-contract-v2.js';
const obs=(patch={})=>({health:20,food:10,foodUnits:0,foodAvailable:false,foodPoints:0,
 hostileDistance:24,blocked:false,displacement:0,position:{x:0,y:70,z:0},targets:[],...patch});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9, 'expected '+a+' ≈ '+b);
test('v3 idle has a cost; movement alone has no positive shaping',()=>{
 near(rewardV3({previous:obs(),next:obs()}).total,-0.03);
 near(rewardV3({previous:obs(),next:obs({displacement:3})}).total,-0.03);
});
test('v3 at low hunger does not reward new grid discovery',()=>{
 near(rewardV3({previous:obs({food:8}),next:obs({food:8}),firstVisit:true}).total,-0.03);
 near(rewardV3({previous:obs(),next:obs(),firstVisit:true}).total,-0.005);
});
test('v3 prioritizes verified meals over novelty and caps inventory credit',()=>{
 const meal=rewardV3({previous:obs(),next:obs({food:16}),verifiedEat:true});
 const foodGain=rewardV3({previous:obs(),next:obs({foodUnits:10})});
 const exploration=rewardV3({previous:obs(),next:obs(),firstVisit:true});
 near(meal.total,1.97);near(foodGain.total,0.33);
 assert.ok(meal.total>10*exploration.total);
});
test('v3 penalizes injury and worsening hunger',()=>{
 near(rewardV3({previous:obs(),next:obs({health:19,food:9})}).total,-0.85);
});
test('real controller assigns verified meal +2 under v3 without affecting v2',()=>{
 for(const [version,expected] of [['v2',0.97],['v3',1.97]]){
  const events=[];const c=createTargetedController({mode:'scripted',rewardVersion:version,
   log:e=>events.push(e)});
  const first=obs({foodAvailable:true,foodUnits:1,foodPoints:2,exploreFeasible:false});
  const picked=c.choose(first);assert.equal(picked.skill,'eat');
  c.consumed(picked.decisionId,10,16);
  c.choose(obs({food:16}));
  near(events.find(e=>e.type==='target_transition').reward,expected);
  c.stop();
 }
});
test('action-space audit identifies all domains and refuses to call them executable',()=>{
 const r=auditSurvivalActionSpace();
 assert.equal(r.duplicateIds.length,0);
 assert.equal(r.fullyExecutable,false);
 for(const area of ['food','basicTools','stoneAge','overnight','traversal','sustainedSurvival']){
  assert.equal(r.capabilityChecks[area].missing.length,0);
  assert.ok(r.capabilityChecks[area].unwired.length>0);
 }
 assert.ok(SURVIVAL_SKILLS.some(x=>x.id==='craft_item'&&x.status==='unwired'));
});
