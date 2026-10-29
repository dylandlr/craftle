import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
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
    assert.match(html,/Take Camera/);
    assert.match(html,/data-camera-mode="auto"/);
    assert.match(html,/setManual\(true\)/);
    assert.match(html,/frame\.focus\(\)/);
    assert.match(html,/setManual\(false\)/);
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

test('embedded spectator script boots and Return to Auto resets view without bot actions',()=>{
 const html=spectatorHtml();
 const script=html.split('<script>')[1]?.split('</script>')[0];
 assert.ok(script,'embedded browser script should exist');
 new vm.Script(script);
 const nodes=new Map(),handlers=new Map();
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{dataset:{},className:'',textContent:'',src:'',disabled:false,style:{},
    focus(){},addEventListener(type,fn){handlers.set(id+':'+type,fn);}});
  return nodes.get(id);
 };
 const document={getElementById:node,addEventListener(type,fn){handlers.set('document:'+type,fn);}};
 node('viewer').contentWindow={postMessage(data,origin){assert.equal(origin,'http://127.0.0.1:3000');handlers.set('cameraMode',data.mode);}};
 const window={location:{port:'3001'},addEventListener(type,fn){handlers.set('window:'+type,fn);}};
 const timers=[];
 const sandbox={document,window,Date,console,setInterval:fn=>timers.push(fn),fetch:async url=>({
   ok:true,json:async()=>url==='/api/status'?{cameraReachable:true}:{agent:null}
 })};
 vm.runInNewContext(script,sandbox);
 assert.equal(node('viewport').dataset.cameraMode,'auto');
 handlers.get('take-camera:click')();
 assert.equal(node('viewport').dataset.cameraMode,'manual');
 assert.equal(node('return-auto').disabled,false);
 handlers.get('return-auto:click')();
 assert.equal(node('viewport').dataset.cameraMode,'auto');
 assert.equal(handlers.get('cameraMode'),'auto');
 assert.equal(node('viewer').src,'http://127.0.0.1:3000/','Return to Auto must not recreate the WebGL iframe');
 assert.equal((html.match(/frame\.src\s*=/g)??[]).length,1,'The viewer iframe should be initialized only once');
 assert.ok(timers.length>=2);
});
