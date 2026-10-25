import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export function summarizeHeldout(groups){
 if(!Array.isArray(groups)||!groups.length||groups.some(g=>!g.pairedEligible))throw Error('Invalid paired held-out experiment');
 const measures=['meals','deaths','cells'];
 const perSeed=groups.map(g=>{
  const rows=Object.fromEntries(g.results.map(r=>[r.treatment,r]));
  if(!rows.frozen||!rows.random||!rows.scripted)throw Error('Missing controls');
  const deltas=Object.fromEntries(['random','scripted'].map(t=>[t,Object.fromEntries(measures.map(m=>[m,rows.frozen[m]-rows[t][m]]))]));
  return {seed:g.seed,measures:Object.fromEntries(['frozen','random','scripted'].map(t=>[t,Object.fromEntries(measures.map(m=>[m,rows[t][m]]))])),frozenMinus:deltas};
 });
 const counts={};
 for(const metric of ['meals','cells']){
  counts[metric]={};
  for(const comparator of ['random','scripted']){
   const deltas=perSeed.map(s=>s.frozenMinus[comparator][metric]);
   counts[metric][comparator]={wins:deltas.filter(d=>d>0).length,ties:deltas.filter(d=>d===0).length,losses:deltas.filter(d=>d<0).length};
  }
 }
 return {schema:'craftle.heldout-evaluation.v1',seedCount:groups.length,perSeed,winTieLoss:counts,
 verdict:'Descriptive only; no claim of generalization or learned competence from two seeds. Frozen policy uses scripted-assisted options.'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(summarizeHeldout(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),null,2));
}
