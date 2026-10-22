import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('dashboard reports no completed trials and escapes untrusted labels',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'craftle-ui-'));
 try{
  const data=path.join(tmp,'results.json'),html=path.join(tmp,'index.html');
  fs.writeFileSync(data,JSON.stringify({totalPlanned:45,completed:0,missing:['x'],invalid:[],rows:[],paired:[],comparisons:[],limitations:['No <script> injection']}));
  execFileSync('node',['scripts/render-factorial-dashboard.js',data,html]);
  const rendered=fs.readFileSync(html,'utf8');
  assert.match(rendered,/No completed trials/);
  assert.match(rendered,/&lt;script&gt;/);
  assert.doesNotMatch(rendered,/<script> injection/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
