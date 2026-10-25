import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildExperimentManifest} from '../scripts/experiment-manifest.js';
test('records exact provenance and hashes evidence, including optional video',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-provenance-'));
 try {
  for(const f of ['metrics.json','agent.log','view.mp4'])fs.writeFileSync(path.join(dir,f),f);
  const base={treatment:'frozen',worldSeed:'20261208',policySeed:17,commit:'a'.repeat(40),workflowRun:'100',seconds:180,commitmentSteps:4,
   metricsPath:path.join(dir,'metrics.json'),logPath:path.join(dir,'agent.log'),videoPath:path.join(dir,'view.mp4')};
  const a=buildExperimentManifest(base),b=buildExperimentManifest(base);
  assert.deepEqual(a,b);assert.equal(a.videoAvailable,true);
  assert.equal(a.evidence.video.length,64);
  assert.equal(buildExperimentManifest({...base,videoPath:path.join(dir,'missing.mp4')}).videoAvailable,false);
  assert.throws(()=>buildExperimentManifest({...base,commit:'unknown'}),/commit/i);
  assert.throws(()=>buildExperimentManifest({...base,metricsPath:'missing'}),/Missing required evidence/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
