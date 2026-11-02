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

test('collector restart gets distinct identity even with the same world and epoch',()=>{
 const first=new ServerTickClock(),second=new ServerTickClock();
 const a=first.observe(s(100)),b=second.observe(s(110));
 assert.notEqual(a.collectorSessionId,b.collectorSessionId);
 assert.equal(a.epoch,b.epoch);
 assert.throws(()=>first.interval(a,b),/epoch mismatch/);
 assert.equal(first.observe(s(120)).sampleSequence,2);
});

test('wall-clock rollback advances epoch even when gameTime increases',()=>{
 const clock=new ServerTickClock(),a=clock.observe(s(100));
 const b=clock.observe({...s(110),observedAt:1});
 assert.equal(b.epoch,a.epoch+1);
 assert.throws(()=>clock.interval(a,b),/epoch mismatch/);
});
