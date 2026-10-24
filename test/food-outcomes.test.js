import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {attachFoodOutcomes} from '../src/food-outcomes.js';
test('observed damage only attributes to self when the server supplies matching source',()=>{
 const bot=new EventEmitter();bot.entity={id:1};const events=[];const detach=attachFoodOutcomes(bot,(type,data)=>events.push({type,...data}));
 bot.emit('entityHurt',{id:2,name:'sheep'});bot.emit('entityHurt',{id:2,name:'sheep'},{id:1});
 assert.deepEqual(events.map(e=>e.attribution),['unknown','self']);detach();
});
test('entity death alone never establishes a kill by this agent',()=>{
 const bot=new EventEmitter();const events=[];const detach=attachFoodOutcomes(bot,(type,data)=>events.push({type,...data}));
 bot.emit('entityDead',{id:2,name:'cow'});assert.equal(events[0].attribution,'unknown');detach();
});
test('pickup records only this bot and listeners detach cleanly',()=>{
 const bot=new EventEmitter();bot.entity={id:1};const events=[];const detach=attachFoodOutcomes(bot,(type,data)=>events.push({type,...data}));
 const drop={id:3,getDroppedItem:()=>({name:'mutton',count:2})};
 bot.emit('playerCollect',{id:9},drop);bot.emit('playerCollect',{id:1},drop);
 assert.equal(events.length,1);assert.equal(events[0].item,'mutton');assert.equal(events[0].count,2);
 detach();detach();for(const e of ['entityHurt','entityDead','playerCollect'])assert.equal(bot.listenerCount(e),0);
});
