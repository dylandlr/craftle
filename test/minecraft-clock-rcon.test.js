import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseGameTime} from '../src/minecraft-clock-rcon.js';
test('parse bare integer gametime',()=>assert.equal(parseGameTime('123456'),123456));
test('parse vanilla conversational gametime response',()=>assert.equal(parseGameTime('The time is 98765'),98765));
test('reject an invalid, missing or unsafe gametime',()=>{assert.throws(()=>parseGameTime(''));assert.throws(()=>parseGameTime('not a clock'));assert.throws(()=>parseGameTime('9999999999999999'))});
