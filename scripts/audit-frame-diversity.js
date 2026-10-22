#!/usr/bin/env node
// Detect repeated first-person visual input, not just increasing frame IDs.
import fs from 'node:fs';
const [filename,minUnique='3',minFraction='0.2']=process.argv.slice(2);
if(!filename)throw Error('Usage: node scripts/audit-frame-diversity.js dataset/decisions.jsonl [minUnique] [minFraction]');
const rows=fs.readFileSync(filename,'utf8').split(/\r?\n/).flatMap(s=>{try{return [JSON.parse(s)]}catch{return []}});
const signatures=rows.map(x=>x.sha256);
const unique=new Set(signatures).size;
const fraction=rows.length?unique/rows.length:0;
let longestRun=0,currentRun=0,previous=null;
for(const signature of signatures){currentRun=signature===previous?currentRun+1:1;previous=signature;longestRun=Math.max(longestRun,currentRun);}
const report={samples:rows.length,uniqueFrames:unique,diversityFraction:Number(fraction.toFixed(3)),longestIdenticalRun:longestRun,pass:unique>=Number(minUnique)&&fraction>=Number(minFraction)};
console.log(JSON.stringify(report,null,2));
if(!report.pass)process.exit(1);
