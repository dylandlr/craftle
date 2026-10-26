import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('custom viewer build patches actual render loop, without Minecraft actions',()=>{
 const script=fs.readFileSync(path.resolve('scripts/patch-prismarine-browser.js'),'utf8');
 const docker=fs.readFileSync(path.resolve('deploy/persistent/agent.Dockerfile'),'utf8');
 assert.match(script,/renderer\.render\(viewer\.scene, viewer\.camera\)/);
 assert.match(script,/viewer\.camera\.position\.lerp/);
 assert.match(script,/craftleAuto/);
 assert.match(script,/EventSource/);
 assert.match(script,/craftleFallback = craftleChase\(pos,yaw\)/);
 assert.match(script,/CRAFTLE_VIEWER_CAMERA_BUILD/);
 assert.match(script,/streamFresh=\$\{fixed\?/);
 assert.match(docker,/CRAFTLE_VIEWER_CAMERA_BUILD/);
 assert.match(script,/activeShot=craftleShot/);
 assert.match(script,/socket\.on\('position'/);
 assert.doesNotMatch(script,/bot\.setControlState|bot\.look\(|bot\.attack\(/);
 assert.match(docker,/patch-prismarine-browser\.js/);
 assert.match(docker,/webpack --config webpack\.config\.js/);
 assert.match(docker,/CRAFTLE_CUSTOM_VIEWER=1/);
 assert.match(docker,/using stock Prismarine Viewer/);
 const compose=fs.readFileSync(path.resolve('deploy/persistent/compose.yml'),'utf8');
 assert.match(compose,/CRAFTLE_CUSTOM_VIEWER: '\\$\\{CRAFTLE_CUSTOM_VIEWER:-0\\}'/);
 assert.match(docker,/webpack@5 webpack-cli@6 process buffer assert/);
});
