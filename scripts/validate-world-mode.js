#!/usr/bin/env node
// A renderer batch must never silently determine the scientific world topology.
import fs from 'node:fs';
const [expectedMode,configPath='config.json']=process.argv.slice(2);
if(!['shared','isolated'].includes(expectedMode)){
 console.error('Usage: node scripts/validate-world-mode.js <shared|isolated> [config.json]');
 process.exit(2);
}
const c=JSON.parse(fs.readFileSync(configPath,'utf8'));
if(c.experiment?.worldMode!==expectedMode){
 console.error(`Experiment requests worldMode=${c.experiment?.worldMode??'UNSPECIFIED'}, but this workflow requires ${expectedMode}. Aborting; recording configuration cannot override world topology.`);
 process.exit(1);
}
if(!Array.isArray(c.agents)||c.agents.length<1)throw Error('No agents configured');
console.log(`Verified experiment topology: ${expectedMode}, ${c.agents.length} configured agents; POV layout=${c.recording?.layout??'unspecified'}`);
