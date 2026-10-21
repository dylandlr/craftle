import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('eight experiment configurations',()=>{const c=JSON.parse(fs.readFileSync('config.json','utf8'));assert.equal(c.agents.length,8);assert.equal(new Set(c.agents.map(a=>JSON.stringify(a.cognition))).size,8);assert.equal(new Set(c.agents.map(a=>a.name)).size,8)});
