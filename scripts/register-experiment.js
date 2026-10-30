// Offline run registry: manifests and summaries are immutable run artifacts.
// No changes to agent runtime, policy, rewards, or saved checkpoints.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.argv[2],manifestFile=process.argv[3],reportFile=process.argv[4];
if(!root||!manifestFile||!reportFile)throw Error('Usage: node scripts/register-experiment.js OUTPUT_ROOT MANIFEST.json REPORT.json');
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));
const required=['runId','agentId','worldSeed','minecraftVersion','instinctProfile','policy','observationSchema','actionSchema','rewardVersion','trainingSeed','checkpointSha256'];
for(const field of required)if(manifest[field]===undefined||manifest[field]===null||manifest[field]==='')throw Error('Manifest missing '+field);
if(!/^[a-zA-Z0-9_-]{1,100}$/.test(manifest.runId))throw Error('Unsafe runId');
if(!Number.isInteger(manifest.trainingSeed))throw Error('trainingSeed must be integer');
if(report.schema!=='craftle.survival-progress-report.v1')throw Error('Expected survival progress report');
const dir=path.resolve(root,manifest.runId);
fs.mkdirSync(dir,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const stored={schema:'craftle.experiment-run.v1',createdAt:new Date().toISOString(),configuration:manifest,
 metrics:{decisions:report.decisions,actions:report.actions,deaths:report.verified?.deaths??null,
  successfulEats:report.verified?.eatEvents??null,observedInventoryGain:report.verified?.observedInventoryGain??null,
  discoveredCells:report.discoveredCells??null,meanReward:report.learning?.meanReward??null,
  transitions:report.learning?.transitions??null},
 sourceReportSha256:sha(fs.readFileSync(reportFile)),sourceManifestSha256:sha(fs.readFileSync(manifestFile)),
 evidenceCaveat:report.caveat??null};
const dest=path.join(dir,'run.json');
fs.writeFileSync(dest,JSON.stringify(stored,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({saved:dest,runId:manifest.runId,metrics:stored.metrics},null,2));
