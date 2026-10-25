import test from 'node:test';
import assert from 'node:assert/strict';
import {spectatorHtml,startSpectatorMonitor} from '../src/spectator-monitor.js';

test('spectator monitor serves watch-only UI and does not expose agent controls',async()=>{
  const server=startSpectatorMonitor({host:'127.0.0.1',port:0,cameraPort:1});
  await new Promise(resolve=>server.once('listening',resolve));
  const address='http://127.0.0.1:'+server.address().port;
  try{
    const page=await fetch(address);
    assert.equal(page.status,200);
    const html=await page.text();
    assert.match(html,/Return to Auto/);
    assert.match(html,/iframe/);
    assert.match(html,/watch-only/i);
    const status=await fetch(address+'/api/status');
    assert.equal(status.status,200);
    const data=await status.json();
    assert.equal(data.controlMode,'watch_only');
    assert.equal(data.cameraReachable,false);
    const other=await fetch(address+'/api/control',{method:'POST'});
    assert.equal(other.status,405);
    assert.equal((await fetch(address+'/invalid')).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
