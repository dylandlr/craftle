import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('animation-only viewer patch preserves stock camera and changes only visual limb motion',()=>{
 const script=fs.readFileSync('scripts/patch-prismarine-animations.js','utf8');
 const docker=fs.readFileSync('deploy/persistent/agent.Dockerfile','utf8');
 const compose=fs.readFileSync('deploy/persistent/compose.yml','utf8');
 assert.match(script,/getObjectByName\(name\)/);
 assert.match(script,/leftArm\.rotation\.x/);
 assert.match(script,/rightLeg\.rotation\.x/);
 assert.match(script,/craftleAnimateBot\(\)/);
 assert.doesNotMatch(script,/viewer\.camera\.position|EventSource|bot\.setControlState/);
 assert.match(docker,/CRAFTLE_ANIMATED_VIEWER/);
 assert.match(compose,/CRAFTLE_ANIMATED_VIEWER: '\$\{CRAFTLE_ANIMATED_VIEWER:-0\}'/);
});
