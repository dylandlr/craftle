// One-time compatibility patch for the Paper observer's tick sampling.
// Download and run as a file. Refuses unknown source, backs up, tests, and rolls back.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const root = process.cwd();
const gatePath = path.join(root,'src/verified-motor-reward-gate.js');
const testPath = path.join(root,'test/verified-motor-reward-gate.test.js');
const marker='craftle.same-tick-monotonic-proof.v1';
if (!fs.existsSync(gatePath) || !fs.existsSync(testPath)) {
  console.error('Missing local gate or test. Run inside the Craftle checkout.');
  process.exit(1);
}
const origGate = fs.readFileSync(gatePath,'utf8');
const origTest = fs.readFileSync(testPath,'utf8');
if (origGate.includes(marker) && origTest.includes(marker)) {
  console.log('ALREADY_PATCHED: no changes made');
  process.exit(0);
}
if (origGate.includes(marker) !== origTest.includes(marker)) {
  throw Error('Partial prior patch detected: refusing to overwrite');
}
const backup = fs.mkdtempSync(path.join(os.tmpdir(),'craftle-post-tick-'));
fs.writeFileSync(path.join(backup,'verified-motor-reward-gate.js'),origGate);
fs.writeFileSync(path.join(backup,'verified-motor-reward-gate.test.js'),origTest);
const eol = text => text.includes('\r\n')?'\r\n':'\n';
const unified = text => text.replace(/\r\n/g,'\n');
const oldGate=unified(origGate);
const oldTest=unified(origTest);
const anchor='post.serverTick !== actor.serverTick + 1 ||';
if (oldGate.split(anchor).length !== 2)
  throw Error('Expected unique post-tick validation clause not found; backups at '+backup);
const replacement=[
'// '+marker+': Paper can record the scheduled sample with the same',
'     // Bukkit tick number. In that case, require independent server monotonic',
'     // ordering as well as the existing phase/source/sequence/block checks.',
'     !(',
'       post.serverTick === actor.serverTick + 1 ||',
'       (post.serverTick === actor.serverTick &&',
'        Number.isSafeInteger(actor.monotonicNsSinceBoot) &&',
'        Number.isSafeInteger(post.monotonicNsSinceBoot) &&',
'        post.monotonicNsSinceBoot > actor.monotonicNsSinceBoot)',
'     ) ||'
].join('\n');
const nextGate=oldGate.replace(anchor,replacement);
const newTests=[
'',
'test(\''+marker+': equal tick with later server monotonic time is valid\',()=>{',
'  const f=fixture();',
'  const actor=f.events.find(e=>e.event===\'block_break_event\'||e.event===\'block_place_event\');',
'  const post=f.events.find(e=>e.event===\'block_state_post_tick\');',
'  assert.ok(actor&&post);',
'  actor.monotonicNsSinceBoot=1000000;',
'  post.monotonicNsSinceBoot=1000001;',
'  post.serverTick=actor.serverTick;',
'  assert.equal(verifyMotorRewardEvidence(f).eligible,true);',
'});',
'',
'test(\''+marker+': equal tick without monotonic ordering fails closed\',()=>{',
'  const f=fixture();',
'  const actor=f.events.find(e=>e.event===\'block_break_event\'||e.event===\'block_place_event\');',
'  const post=f.events.find(e=>e.event===\'block_state_post_tick\');',
'  assert.ok(actor&&post);',
'  actor.monotonicNsSinceBoot=1000000;',
'  post.monotonicNsSinceBoot=999999;',
'  post.serverTick=actor.serverTick;',
'  assert.equal(verifyMotorRewardEvidence(f).reason,\'unverified_post_state\');',
'  delete post.monotonicNsSinceBoot;',
'  assert.equal(verifyMotorRewardEvidence(f).reason,\'unverified_post_state\');',
'});',
'',
'test(\''+marker+': unexpected two-tick post delay is rejected\',()=>{',
'  const f=fixture();',
'  const actor=f.events.find(e=>e.event===\'block_break_event\'||e.event===\'block_place_event\');',
'  const post=f.events.find(e=>e.event===\'block_state_post_tick\');',
'  assert.ok(actor&&post);',
'  post.serverTick=actor.serverTick+2;',
'  assert.equal(verifyMotorRewardEvidence(f).reason,\'unverified_post_state\');',
'});',
''
].join('\n');
const nextTest=oldTest+newTests;
let modified=false;
try {
  fs.writeFileSync(gatePath,nextGate.replace(/\n/g,eol(origGate)));
  fs.writeFileSync(testPath,nextTest.replace(/\n/g,eol(origTest)));
  modified=true;
  console.log('BACKUP '+backup);
  execFileSync(process.execPath,['--check',gatePath],{stdio:'inherit'});
  execFileSync(process.execPath,['--check',testPath],{stdio:'inherit'});
  execFileSync(process.execPath,['--test',testPath,
    path.join(root,'test/durable-motor-learning.test.js'),
    path.join(root,'test/motor-q-policy.test.js')],{
    cwd:root,stdio:'inherit',timeout:120000
  });
  console.log('PATCH_AND_TESTS_PASSED: live training was not started');
} catch(error) {
  if(modified){
    fs.writeFileSync(gatePath,origGate);
    fs.writeFileSync(testPath,origTest);
    console.error('PATCH_ROLLED_BACK: original source and tests restored');
  }
  console.error('BACKUP '+backup);
  process.exitCode=1;
}
