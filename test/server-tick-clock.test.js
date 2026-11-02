import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ServerTickClock} from '../src/server-tick-clock.js';
const s=(gameTime,worldId='world-a')=>({gameTime,worldId,observedAt:1000+gameTime,source:'server_query'});
test('server samples establish exact tick difference, not exact event tick',()=>{
 const c=new ServerTickClock(),a=c.observe(s(100)),b=c.observe(s(145));
 assert.deepEqual(c.interval(a,b),{startTick:100,endTick:145,duration:45,source:'sampled_server_clock',uncertainty:'events between samples cannot be assigned exact ticks'});
});
test('reject wall-clock inference and invalid time',()=>{
 const c=new ServerTickClock();assert.throws(()=>c.observe({...s(100),source:'estimated_wall_time'}));
 assert.throws(()=>c.observe(s(1.4)));
});
test('world changes and decreasing gameTime invalidate old intervals',()=>{
 const c=new ServerTickClock(),a=c.observe(s(100)),b=c.observe(s(110,'world-b'));
 assert.throws(()=>c.interval(a,b),/epoch mismatch/);
 const d=c.observe(s(1,'world-b'));assert.throws(()=>c.interval(b,d),/epoch mismatch/);
});
test('identical tick samples cannot imply positive option duration',()=>{
 const c=new ServerTickClock(),a=c.observe(s(100)),b=c.observe(s(100));
 assert.throws(()=>c.interval(a,b),/invalid server tick interval/);
});
