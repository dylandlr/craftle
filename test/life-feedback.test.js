import test from 'node:test';
import assert from 'node:assert/strict';
import {createLifeFeedback} from '../src/life-feedback.js';

test('retains actual chat, death and respawn text in chronological order',()=>{
 const f=createLifeFeedback({limit:5});
 f.chat('You were slain by Zombie','system');
 f.death({message:'You Died!',health:0});
 f.respawn();
 f.chat('Welcome back','chat');
 const s=f.snapshot();
 assert.equal(s.deathCount,1);
 assert.equal(s.life,1);
 assert.deepEqual(s.entries.map(e=>e.kind),['minecraft_text','death_screen','respawn','minecraft_text']);
 assert.equal(s.entries[0].text,'You were slain by Zombie');
 assert.equal(s.entries[1].deathCount,1);
 assert.deepEqual(f.snapshot({after:2}).entries.map(e=>e.kind),['respawn','minecraft_text']);
});
test('feedback retention is bounded while sequence remains increasing',()=>{
 const f=createLifeFeedback({limit:2});
 f.chat('a');f.chat('b');f.chat('c');
 assert.deepEqual(f.snapshot().entries.map(x=>x.seq),[2,3]);
 assert.equal(f.snapshot().latestSeq,3);
 assert.throws(()=>createLifeFeedback({limit:0}),/limit/);
});
