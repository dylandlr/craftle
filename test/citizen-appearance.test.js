import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateCitizenAppearance} from '../src/citizen-appearance.js';
test('same citizen in same world keeps stable cosmetic identity',()=>{
 const a=generateCitizenAppearance({citizenId:'Turesla',worldSeed:'world-1'});
 assert.deepEqual(generateCitizenAppearance({citizenId:'Turesla',worldSeed:'world-1'}),a);
 assert.equal(a.mode,'random');assert.equal(a.cosmeticOnly,true);
});
test('different seeds or citizens produce independent deterministic seeds',()=>{
 const a=generateCitizenAppearance({citizenId:'Turesla',worldSeed:'1'});
 const b=generateCitizenAppearance({citizenId:'Citizen2',worldSeed:'1'});
 const c=generateCitizenAppearance({citizenId:'Turesla',worldSeed:'2'});
 assert.notEqual(a.seed,b.seed);assert.notEqual(a.seed,c.seed);
});
test('invalid IDs rejected',()=>assert.throws(()=>generateCitizenAppearance({citizenId:''}),/Citizen ID/));
