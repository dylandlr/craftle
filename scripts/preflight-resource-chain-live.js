// READ-ONLY audit against an existing completed Minecraft four-target run.
// Identifies whether the installed local observer emits the server inventory
// and independent probe fields required by multi-step reward verification.
// Never creates a server, changes evidence, or claims a new live evaluation.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runId=process.argv[2];
if(process.argv.length!==3||!/^four-target-[0-9]{14}$/.test(runId??''))
  throw Error('Usage: node scripts/preflight-resource-chain-live.js four-target-YYYYMMDDHHMMSS');
const dir=path.join(root,'recordings/live-motor-four-target',runId);
const manifestPath=path.join(dir,'manifest.json');
const summaryPath=path.join(dir,'summary.json');
const eventPath=path.join(dir,'server-events.jsonl');
for(const file of [manifestPath,summaryPath,eventPath])
  if(!fs.existsSync(file))throw Error('Missing prior-run evidence: '+file);
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const summary=JSON.parse(fs.readFileSync(summaryPath,'utf8'));
if(manifest.runId!==runId||summary.runId!==runId||
   summary.complete!==true||summary.schema!=='craftle.live-four-target-result.v1')
  throw Error('Cannot audit an incomplete or mismatched live run');
const rows=fs.readFileSync(eventPath,'utf8').split(/\r?\n/)
  .filter(Boolean).map((line,i)=>{
    try{return JSON.parse(line);}catch{
      throw Error('Corrupt server event JSON at line '+(i+1));
    }
  });
const probes=rows.filter(e=>e.event==='acceptance_probe');
const picks=rows.filter(e=>e.event==='item_pickup_event');
const drops=rows.filter(e=>e.event==='block_drops_event');
const blockEvent=rows.filter(e=>e.event==='block_break_event'||
  e.event==='block_place_event');
const phaseCounts=Object.fromEntries([...new Set(probes.map(p=>p.phase))]
  .map(p=>[p??'(missing)',probes.filter(e=>e.phase===p).length]));
const sample=probes[0]??{};
const serverInventoryProbes=probes.filter(e=>Array.isArray(e.inventory));
const inventoryRowsValid=serverInventoryProbes.every(e=>e.inventory.every(i=>
  typeof i?.item==='string'&&Number.isSafeInteger(i.count)&&i.count>=0));
const probeShapeReady=probes.length>0&&probes.every(e=>
  e.phase==='read_only_console_probe'&&
  Number.isSafeInteger(e.sequence)&&Number.isSafeInteger(e.serverTick)&&
  e.serverBootId&&e.playerUuid&&e.world&&
  Number.isSafeInteger(e.x)&&Number.isSafeInteger(e.y)&&
  Number.isSafeInteger(e.z)&&typeof e.block==='string'&&
  typeof e.probeId==='string'&&e.onlinePlayers===1);
const result={
  schema:'craftle.resource-chain-live-preflight.v1',
  runId,source:'READ_ONLY_PRIOR_LIVE_SERVER_EVENTS',
  sourceEventCount:rows.length,serverProbes:probes.length,
  observerProbePhases:phaseCounts,
  readOnlyProbeContract:probeShapeReady,
  serverInventorySamplesWithinProbes:serverInventoryProbes.length,
  allProbeInventoryPresent:serverInventoryProbes.length===probes.length&&
    probes.length>0,inventoryRowContract:inventoryRowsValid,
  observedBlockActions:blockEvent.length,
  observedBlockDrops:drops.length,
  observedItemPickups:picks.length,
  requiredForFourStepLive:{
    authoritativePerTargetReadout:probeShapeReady,
    authoritativeInventoryAtAllTargetReads:
      serverInventoryProbes.length===probes.length&&
      probes.length>0&&inventoryRowsValid,
    realDropAndPickupEvents: picks.length>0&&drops.length>0,
    localExecutorPresent:fs.existsSync(path.join(root,'src/motor-acceptance.js')),
    localRewardGatePresent:
      fs.existsSync(path.join(root,'src/verified-motor-reward-gate.js'))
  },
  limitations:[
    'Prior single-action experiment events cannot prove four-step inventory pickup or delayed reward.',
    'Existing plugin source may differ from the compiled local observer JAR; this audit uses actual recorded event fields.',
    'Check item pickup by independent server event and post-pickup inventory readout before any live RL update.'
  ]
};
console.log(JSON.stringify(result,null,2));
