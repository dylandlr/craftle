import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOptionControlReport,compareOptionControls} from '../scripts/report-option-controls.js';
const reports=()=>['scripted','random','frozen'].map(treatment=>({schema:'craftle.option-controls.v1',contract:'structured7-assisted4-v1',seed:'1',treatment,initialPosition:{x:0,y:64,z:0},seconds:180}));
test('paired comparison excludes spawn or duration mismatches rather than silently pairing',()=>{
 const r=reports();assert.equal(compareOptionControls(r)[0].pairedEligible,true);
 r[1].initialPosition.x=1;assert.equal(compareOptionControls(r)[0].pairedEligible,false);
 assert.throws(()=>compareOptionControls(r.slice(1)),/Missing/);
});
test('control report rejects learning and mislabeled actions',()=>{
 const e=[{type:'spawn',position:{x:0,y:64,z:0}},{type:'option_decision',mode:'random'},{type:'option_transition',updates:0},{type:'option_transition',updates:1}];
 const m={completed:true,runtimeErrors:[],observedSeconds:180};
 assert.throws(()=>buildOptionControlReport(e,m,{treatment:'random',seed:'1'}),/counter/);
 e[3].updates=0;assert.equal(buildOptionControlReport(e,m,{treatment:'random',seed:'1'}).treatment,'random');
 assert.throws(()=>buildOptionControlReport(e,m,{treatment:'frozen',seed:'1'}),/mismatched/);
});
