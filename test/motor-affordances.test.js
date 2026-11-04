import test from 'node:test';
import assert from 'node:assert/strict';
import {enumerateMotorAffordances} from '../src/motor-affordances.js';
import {createChatMotor} from '../src/chat-motor.js';
const air={name:'air',boundingBox:'empty'},stone={name:'stone',boundingBox:'block'};
const position={x:0.5,y:65,z:0.5};
const ground=(x,y,z)=>y===64?stone:air;
test('motor choices expose individual dig and place, not fixed bridge recipes',()=>{
 const result=enumerateMotorAffordances({position,blockAt:ground,
  inventory:[{name:'cobblestone',count:4,placeable:true}],
  executors:{dig:()=>{},place:()=>{},move:()=>{}}});
 assert.ok(result.candidates.some(c=>c.operation==='dig'&&c.executable));
 assert.ok(result.candidates.some(c=>c.operation==='place'&&c.executable));
 assert.ok(result.candidates.some(c=>c.operation==='move'&&c.executable));
 assert.equal(result.candidates.some(c=>/bridge|pillar|stairs|dig_down/.test(c.operation)),false);
});
test('unknown destination and no held placeable inventory means no placement',()=>{
 const blockAt=(x,y,z)=>x===0&&y===64&&z===0?stone:null;
 const r=enumerateMotorAffordances({position,blockAt,inventory:[{name:'cobblestone',count:0,placeable:true}],
  executors:{place:()=>{}}});
 assert.equal(r.candidates.filter(c=>c.operation==='place').length,0);
});
test('available depends on actual executor instead of nominal ability',()=>{
 const r=enumerateMotorAffordances({position,blockAt:ground});
 assert.ok(r.candidates.length);
 assert.equal(r.executableCandidates,0);
});
test('chat affordance is conditional and does not generate text',()=>{
 const a=enumerateMotorAffordances({position,chatAvailable:true,executors:{chat:()=>{}}});
 assert.equal(a.candidates.find(c=>c.operation==='chat')?.arguments.textSource,'separate_language_policy');
 assert.equal(enumerateMotorAffordances({position}).candidates.some(c=>c.operation==='chat'),false);
});
test('chat output transmits provided text, rejects commands and rate limits',()=>{
 const messages=[],bot={chat:s=>messages.push(s),_client:{state:'play'}};
 let time=10000;
 const motor=createChatMotor(bot,{clock:()=>time});
 assert.equal(motor.chat({text:'/op player'}).reason,'command_not_permitted');
 assert.equal(motor.chat({text:'hello world'}).reason,'sent_unverified');
 assert.equal(motor.chat({text:'again'}).reason,'chat_rate_limited');
 time+=3000;
 assert.equal(motor.chat({text:'again'}).ok,true);
 assert.deepEqual(messages,['hello world','again']);
});
