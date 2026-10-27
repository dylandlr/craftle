#!/usr/bin/env node
// Standard 64x64 Minecraft skin PNGs, deterministically generated per citizen.
// Cosmetic identity only. Does not modify the gameplay policy or server data.
import fs from 'node:fs';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import {generateCitizenAppearance} from '../src/citizen-appearance.js';
const palettes={
 skin:{light:'#edc4a5',tan:'#cd9d79',medium:'#ad795e',deep:'#82533d',umber:'#603d31'},
 hair:{ink:'#20252f',brown:'#564136',auburn:'#7b4434',blond:'#c8a875',silver:'#a8b1ba',copper:'#b56943'},
 coat:{moss:'#44765f',indigo:'#4b5689',rust:'#985849',slate:'#516570',teal:'#237c82',ochre:'#a08148',plum:'#735578'},
 accent:{cream:'#e9dfbe',cyan:'#7cd5e7',gold:'#f0c66d',coral:'#ef9c8f',lavender:'#b6a0dc'}
};
const rgba=(hex,alpha=255)=>[...hex.replace('#','').match(/../g).map(n=>parseInt(n,16)),alpha];
function crc32(buf){let crc=0xffffffff;for(const b of buf){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function png(data){const raw=Buffer.alloc(64*(64*4+1));for(let y=0;y<64;y++){raw[y*(64*4+1)]=0;data.copy(raw,y*(64*4+1)+1,y*64*4,(y+1)*64*4);}
 const header=Buffer.alloc(13);header.writeUInt32BE(64,0);header.writeUInt32BE(64,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
export function makeSkin(identity){
 const data=Buffer.alloc(64*64*4);
 const paint=(x,y,w,h,c)=>{const v=rgba(c);for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){if(xx<0||xx>=64||yy<0||yy>=64)continue;data.set(v,(yy*64+xx)*4);}};
 const skin=palettes.skin[identity.skinTone],hair=palettes.hair[identity.hair],coat=palettes.coat[identity.coat],trim=palettes.accent[identity.accent];
 const pants='#303b46',boot='#242b31',eyes='#263442';
 // Standard Minecraft 64x64 UV body regions. Head: top/bottom, R/L, front/back.
 paint(8,0,8,8,hair);paint(16,0,8,8,hair);
 paint(0,8,32,8,skin);paint(8,8,8,8,skin);
 paint(8,8,8,3,hair);paint(0,8,8,3,hair);paint(16,8,8,3,hair);paint(24,8,8,3,hair);
 paint(10,12,2,1,eyes);paint(14,12,2,1,eyes);
 // Torso top / front / back / side
 paint(16,16,8,4,coat);paint(20,20,8,12,coat);paint(32,20,8,12,coat);paint(16,20,4,12,coat);paint(28,20,4,12,coat);
 paint(23,20,2,12,trim);paint(22,21,1,1,'#e4e4d9');
 // Right arm geometry
 paint(44,16,4,4,coat);paint(44,20,4,12,coat);paint(40,20,4,12,coat);paint(48,20,4,12,coat);paint(52,20,4,12,coat);
 paint(44,29,4,3,skin);paint(40,29,4,3,skin);paint(48,29,4,3,skin);paint(52,29,4,3,skin);
 // Left arm, lower-half UV
 paint(36,48,4,4,coat);paint(36,52,4,12,coat);paint(32,52,4,12,coat);paint(40,52,4,12,coat);paint(44,52,4,12,coat);
 paint(36,61,4,3,skin);paint(32,61,4,3,skin);paint(40,61,4,3,skin);paint(44,61,4,3,skin);
 // Right leg
 paint(4,16,4,4,pants);for(const x of [0,4,8,12])paint(x,20,4,12,pants);
 paint(4,29,4,3,boot);paint(0,29,4,3,boot);paint(8,29,4,3,boot);paint(12,29,4,3,boot);
 // Left leg
 paint(20,48,4,4,pants);for(const x of [16,20,24,28])paint(x,52,4,12,pants);
 for(const x of [16,20,24,28])paint(x,61,4,3,boot);
 if(identity.markings.freckles){paint(9,13,1,1,'#bc8066');paint(16,13,1,1,'#bc8066');}
 if(identity.markings.scar)paint(15,11,1,3,trim);
 if(identity.markings.hood){paint(40,8,8,8,coat);paint(48,8,8,8,coat);paint(32,8,8,8,coat);paint(56,8,8,8,coat);}
 return png(data);
}
function main(){const args=process.argv.slice(2),get=(f,d)=>args.includes(f)?args[args.indexOf(f)+1]:d;
 const ids=get('--ids','Turesla').split(',').map(x=>x.trim()).filter(Boolean);
 const dir=path.resolve(get('--output','recordings/citizens'));
 fs.mkdirSync(dir,{recursive:true});const people=[];
 for(const id of ids){if(!/^[a-zA-Z0-9_-]{1,32}$/.test(id))throw Error('Unsafe citizen ID');
 const profile=generateCitizenAppearance({citizenId:id,worldSeed:get('--world-seed','craftle')});
 fs.writeFileSync(path.join(dir,id+'.png'),makeSkin(profile));
 fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify(profile,null,2)+'\n');
 people.push({id,skin:path.join(dir,id+'.png'),appearance:path.join(dir,id+'.json')});
 }
 console.log(JSON.stringify({schema:'craftle.generated-citizen-skins.v1',count:people.length,citizens:people},null,2));
}
if(import.meta.url===new URL('file://'+path.resolve(process.argv[1]??'' )).href)main();
