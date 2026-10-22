import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLlmAgent,parseAgentDecision} from '../src/llm-agent.js';
import {createVisionClient} from '../src/llm-client.js';
import {makeVisualObservation} from '../src/vision-observation.js';
const frame=()=>makeVisualObservation({rgb:new Uint8Array(4*4*3).fill(120),width:4,height:4,frameId:0,capturedAt:new Date().toISOString()});
const answer=JSON.stringify({goal:'explore',belief:'possible sand',plan:'walk to learn',action:'forward',memory:'turn when stuck'});
test('rejects invalid model output and actions',()=>{assert.throws(()=>parseAgentDecision('hello'),/JSON/);assert.throws(()=>parseAgentDecision(answer.replace('forward','op')),/action/);});
test('converts RGB to multimodal prompt and persists memory',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-llm-'));
 try{
  let seen;
  const a=createLlmAgent({infer:async req=>{seen=req;return answer;},memoryFile:path.join(dir,'memory.json'),maxSteps:1});
  assert.equal((await a.decide(frame(),{health:20})).action,'forward');
  assert.ok(seen.observation.jpeg.subarray(0,2).equals(Buffer.from([255,216])));
  assert.match(seen.observation.text,/health=20/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'memory.json'))).memories,['turn when stuck']);
  await assert.rejects(()=>a.decide(frame()),/budget/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('LLM client authenticates and sends image without exposing key',async()=>{
 let sent;const client=createVisionClient({apiKey:'test-only',model:'test-model',fetchImpl:async (url,opts)=>{sent={url:String(url),opts};return {ok:true,json:async()=>({choices:[{message:{content:answer}}]})};}});
 assert.equal(await client({system:'system',observation:{text:'scene',jpeg:Buffer.from([1,2])}}),answer);
 assert.equal(sent.opts.headers.Authorization,'Bearer test-only');
 assert.match(sent.opts.body,/data:image\/jpeg;base64/);
});
