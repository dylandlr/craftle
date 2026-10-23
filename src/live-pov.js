// Live headless POV source: Prismarine Viewer TCP JPEG frames -> RGB24.
// No Mineflayer world, chunks, blocks or entities cross this boundary.
import net from 'node:net';
import {createRequire} from 'node:module';
import {makeVisualObservation} from './vision-observation.js';
const require=createRequire(import.meta.url);
export class JpegFrameParser {
  constructor(onFrame,{maxBytes=8*1024*1024}={}){this.onFrame=onFrame;this.maxBytes=maxBytes;this.buffer=Buffer.alloc(0);}
  push(chunk){
    this.buffer=Buffer.concat([this.buffer,chunk]);
    while(this.buffer.length>=4){
      const length=this.buffer.readUInt32LE(0);
      if(length===0||length>this.maxBytes)throw Error('Invalid JPEG frame length');
      if(this.buffer.length<4+length)break;
      const jpeg=this.buffer.subarray(4,4+length);
      this.buffer=this.buffer.subarray(4+length);
      this.onFrame(jpeg);
    }
  }
}
export async function startLiveObservationServer({onObservation,onJpeg,width=84,height=84,port=0}={}){
  if(typeof onObservation!=='function')throw Error('onObservation required');
  const {default: jpeg}=await import('jpeg-js');
  let frameId=0,dropped=0;
  const server=net.createServer(socket=>{
    const parser=new JpegFrameParser(buffer=>{
      try{
        const image=jpeg.decode(buffer,{useTArray:true,formatAsRGBA:true});
        const rgb=new Uint8Array(image.width*image.height*3);
        for(let src=0,dst=0;dst<rgb.length;src+=4,dst+=3){rgb[dst]=image.data[src];rgb[dst+1]=image.data[src+1];rgb[dst+2]=image.data[src+2];}
        // RGB pixel size is the renderer size; requested dimensions verified, no implicit resize.
        if(image.width!==width||image.height!==height)throw Error('Renderer dimensions mismatch');
        const observation=makeVisualObservation({rgb,width,height,frameId:frameId++,capturedAt:new Date().toISOString()});
        if(onJpeg)onJpeg(buffer,observation);
        Promise.resolve(onObservation(observation)).catch(e=>socket.emit('error',e));
      }catch(e){socket.emit('error',e);}
    });
    socket.on('data',chunk=>{try{parser.push(chunk);}catch(e){socket.destroy(e);}});
    socket.on('error',()=>{dropped++;});
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {host:'127.0.0.1',port:server.address().port,stats:()=>({frames:frameId,errors:dropped}),close:()=>new Promise(resolve=>server.close(resolve))};
}
