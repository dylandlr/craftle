#!/usr/bin/env node
// Validate image-linked decisions, without treating logs as proof of learning.
import fs from 'node:fs';
const [filename,minString='3']=process.argv.slice(2);
if(!filename)throw Error('Usage: node scripts/verify-visual-decisions.js <log> [minimum]');
const min=Number(minString);
const records=fs.readFileSync(filename,'utf8').split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}}).filter(x=>x.type==='visual_decision');
const frames=new Set(records.map(x=>x.frameId));
const fingerprints=new Set(records.map(x=>x.frameSha256));
const valid=records.every(x=>x.observationSource==='first_person_rgb'&&Number.isSafeInteger(x.frameId)&&x.frameId>=0&&/^[a-f0-9]{64}$/.test(x.frameSha256)&&typeof x.action==='string');
const report={decisions:records.length,uniqueFrameIds:frames.size,uniqueFrameFingerprints:fingerprints.size,minimum:min,valid,pass:valid&&records.length>=min&&frames.size>=min};
console.log(JSON.stringify(report,null,2));
if(!report.pass)process.exit(1);
