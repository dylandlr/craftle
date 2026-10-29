// Observer-only frame cache. Never exposes commands or writes to policy state.
import {JpegFrameParser} from './live-pov.js';
export function createObserverPovFrameCache({maxBytes=2*1024*1024,maxAgeMs=3000}={}){
 let current=null,nextId=0;
 const ingest=(jpeg,now=Date.now())=>{
  if(!Buffer.isBuffer(jpeg)||jpeg.length<4||jpeg.length>maxBytes||
     jpeg[0]!==0xff||jpeg[1]!==0xd8||jpeg[jpeg.length-2]!==0xff||jpeg[jpeg.length-1]!==0xd9)return false;
  current={bytes:Buffer.from(jpeg),id:nextId++,at:now};return true;
 };
 const get=(now=Date.now())=>current&&now>=current.at&&now-current.at<=maxAgeMs?current:null;
 const status=(now=Date.now())=>{const frame=get(now);return {schema:'craftle.observer-pov.v1',readOnly:true,available:!!frame,frameId:frame?.id??null,ageMs:frame?now-frame.at:null,source:frame?'tcp_jpeg_frame':'unavailable'};};
 const parser=()=>new JpegFrameParser(jpeg=>{ingest(jpeg);},{maxBytes});
 return {ingest,get,status,parser};
}
