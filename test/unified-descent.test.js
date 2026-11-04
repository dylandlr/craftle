import test from 'node:test';
import assert from 'node:assert/strict';
import {planDescent} from '../src/unified-descent.js';
const air={name:'air',boundingBox:'empty'},stone={name:'stone',boundingBox:'block'},
 water={name:'water',boundingBox:'empty'},lava={name:'lava',boundingBox:'empty'};
const origin={x:0.5,y:75,z:0.5};
const blocks=(entries,defaultBlock=air)=> (x,y,z)=>entries[[x,y,z].join(',')]??defaultBlock;
const fixture=(targetY=73,ground=stone,under=stone)=>blocks({
 '0,74,0':under,['1,'+targetY+',0']:ground
});
test('one HP on any solid substrate gets verified one-block step',()=>{
 for(const name of ['oak_log','oak_leaves','stone','dirt','cobblestone']){
  const plan=planDescent({position:origin,health:1,blockAt:fixture(73,stone,{name,boundingBox:'block'})});
  assert.equal(plan.selected?.kind,'step_down',name);
  assert.equal(plan.selected?.expectedDamage,0);
 }
});
test('critical health rejects dangerous falls',()=>{
 const plan=planDescent({position:origin,health:1,blockAt:fixture(68),allowRisk:true});
 assert.equal(plan.selected,null);
 assert.ok(plan.rejections.unsafeFall>0);
});
test('water landing requires observed bottom and distinguishes actuator',()=>{
 const a=blocks({'0,74,0':stone,'1,70,0':stone,'1,71,0':water});
 const plan=planDescent({position:origin,health:1,blockAt:a});
 assert.equal(plan.selected?.kind,'water_drop');
 assert.equal(plan.selected?.requires,'water_descent_executor');
});
test('unknown blocks never become fall destinations',()=>{
 const at=(x,y,z)=>x===0&&y===74&&z===0?stone:null;
 const p=planDescent({position:origin,health:1,blockAt:at});
 assert.equal(p.selected,null);
 assert.ok(p.rejections.unknown>0);
});
test('lava and hazards must not become safe landing blocks',()=>{
 const a=blocks({'0,74,0':stone,'1,73,0':lava});
 const p=planDescent({position:origin,health:20,blockAt:a});
 assert.notEqual(p.selected?.x,1);
});
test('hard failures can be excluded without incorrectly marking a skill completed',()=>{
 const a=fixture();
 const first=planDescent({position:origin,health:1,blockAt:a});
 assert.ok(first.selected);
 const second=planDescent({position:origin,health:1,blockAt:a,failed:new Set([first.selected.key])});
 assert.ok(second.rejections.failed>0);
 assert.notEqual(second.selected?.key,first.selected.key);
});
test('ordinary risky fall is prohibited without explicitly allowing risk',()=>{
 const at=fixture(69);
 const safe=planDescent({position:origin,health:20,blockAt:at});
 const risk=planDescent({position:origin,health:20,blockAt:at,allowRisk:true});
 assert.equal(safe.selected,null);
 assert.equal(risk.selected?.kind,'risky_drop');
 assert.ok(risk.selected.expectedDamage>0);
});
