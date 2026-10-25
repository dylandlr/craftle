import fs from 'node:fs';import {summarizeFoodProvenance} from '../src/food-provenance-summary.js';
const events=fs.readFileSync(process.argv[2],'utf8').split('\n').filter(s=>s.startsWith('{"timestamp":')).map(s=>JSON.parse(s));
console.log(JSON.stringify(summarizeFoodProvenance(events),null,2));
