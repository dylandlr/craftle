import fs from 'node:fs';
import path from 'node:path';

export function recordingOptions(env = process.env) {
  const enabled = env.CRAFTLE_RECORD_POV === '1';
  const frames = Number(env.CRAFTLE_RECORD_FRAMES ?? 180);
  const size = Number(env.CRAFTLE_RECORD_SIZE ?? 512);
  if (!Number.isInteger(frames) || frames < 1 || frames > 20000) throw Error('CRAFTLE_RECORD_FRAMES must be 1..20000');
  if (!Number.isInteger(size) || size < 128 || size > 1920) throw Error('CRAFTLE_RECORD_SIZE must be 128..1920');
  return {enabled,frames,width:size,height:size,directory:path.resolve(env.CRAFTLE_RECORD_DIRECTORY ?? 'recordings/pov')};
}
export function safeVideoName(name) { return String(name).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,48) || 'agent'; }
let cachedHeadless;
export async function prepareRecorder() {
  if(!cachedHeadless){
    await import('node-canvas-webgl');
    const lib=await import('prismarine-viewer');
    cachedHeadless=lib.headless || lib.default?.headless;
    if(!cachedHeadless)throw Error('Prismarine Viewer headless API missing');
  }
  return cachedHeadless;
}
export async function attachRecorder(bot,profile,options=recordingOptions(),record=()=>{}) {
  if(!options.enabled) return null;
  fs.mkdirSync(options.directory,{recursive:true});
  const output=path.join(options.directory,`${safeVideoName(profile.id)}.mp4`);
  try {
    const headless=await prepareRecorder();
    headless(bot,{output,frames:options.frames,width:options.width,height:options.height});
    record(profile.name,'pov_capture_started',{output,frames:options.frames,width:options.width,height:options.height,source:'prismarine-viewer-headless'});
    return output;
  }catch(error){
    record(profile.name,'pov_capture_failed',{message:error.message});
    throw error;
  }
}
