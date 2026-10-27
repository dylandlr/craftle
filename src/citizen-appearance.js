// Reproducible civilian appearance, independent of learning and reward systems.
import {createHash} from 'node:crypto';
const HAIR=['ink','brown','auburn','blond','silver','copper'];
const COATS=['moss','indigo','rust','slate','teal','ochre','plum'];
const ACCENTS=['cream','cyan','gold','coral','lavender'];
const SKINS=['light','tan','medium','deep','umber'];
function draw(seed){let n=Number.parseInt(createHash('sha256').update(seed).digest('hex').slice(0,8),16)>>>0;return ()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};}
export function generateCitizenAppearance({citizenId,worldSeed='craftle',generation=0,mode='random',appearanceSeed=null}={}){
 if(typeof citizenId!=='string'||!citizenId.trim())throw Error('Citizen ID required');
 if(!['random','fixed'].includes(mode))throw Error('Invalid appearance generation mode');
 const seed=appearanceSeed??createHash('sha256').update([worldSeed,citizenId,generation].join(':')).digest('hex').slice(0,16);
 const next=draw(String(seed));const choose=options=>options[Math.floor(next()*options.length)];
 const identity={schema:'craftle.citizen-appearance.v1',citizenId,generation,mode,seed:String(seed),model:choose(['classic','slim']),
  skinTone:choose(SKINS),hair:choose(HAIR),coat:choose(COATS),accent:choose(ACCENTS),
  markings:{freckles:next()<.28,scar:next()<.12,hood:next()<.42},cosmeticOnly:true};
 return Object.freeze({...identity,markings:Object.freeze(identity.markings)});
}
