import fs from 'node:fs';
import path from 'node:path';
import {generateCitizenAppearance} from './citizen-appearance.js';

const SAFE=/^[a-zA-Z0-9_-]{1,32}$/;
export function validateCitizenRoster(input){
 if(!Array.isArray(input)||input.length<1||input.length>128)throw Error('Citizen roster must have 1..128 entries');
 const ids=new Set(),names=new Set();
 return input.map(entry=>{
  const id=entry?.id,name=entry?.name;
  if(typeof id!=='string'||!SAFE.test(id)||typeof name!=='string'||!SAFE.test(name))throw Error('Invalid citizen identity');
  if(ids.has(id)||names.has(name.toLowerCase()))throw Error('Duplicate citizen id or username');
  ids.add(id);names.add(name.toLowerCase());return {id,name};
 });
}
export function provisionCitizenRoster(root,roster,{worldSeed='craftle',renderSkin}={}){
 const citizens=validateCitizenRoster(roster);
 const folder=path.join(root,'citizens');fs.mkdirSync(folder,{recursive:true});
 const publicEntries=[];
 for(const {id,name} of citizens){
  const file=path.join(folder,id+'.json'),skinFile=path.join(folder,id+'.png');
  let appearance;
  if(fs.existsSync(file)){
   appearance=JSON.parse(fs.readFileSync(file,'utf8'));
   if(appearance.citizenId!==id||appearance.schema!=='craftle.citizen-appearance.v1')throw Error('Invalid saved citizen appearance '+id);
  }else{
   appearance=generateCitizenAppearance({citizenId:id,worldSeed});
   fs.writeFileSync(file,JSON.stringify(appearance,null,2)+'\n',{flag:'wx'});
  }
  if(!fs.existsSync(skinFile)&&renderSkin)fs.writeFileSync(skinFile,renderSkin(appearance),{flag:'wx'});
  publicEntries.push({id,name,model:appearance.model,skinUrl:'/api/citizens/'+id+'/skin.png'});
 }
 const manifest={schema:'craftle.citizens.v1',citizens:publicEntries};
 fs.writeFileSync(path.join(folder,'registry.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
export function readCitizenRoster(root){
 try{
  const data=JSON.parse(fs.readFileSync(path.join(root,'citizens','registry.json'),'utf8'));
  if(data.schema!=='craftle.citizens.v1')return [];
  return validateCitizenRoster(data.citizens);
 }catch{return [];}
}
