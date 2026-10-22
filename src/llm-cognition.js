// Cognitive augmentations are observable interventions, not claims of emergent intelligence.
import jpeg from 'jpeg-js';
import {validateCognition} from './cognition-config.js';
export function centerCropJpeg(frame){
 const side=Math.max(2,Math.floor(Math.min(frame.width,frame.height)/2));
 const left=Math.floor((frame.width-side)/2),top=Math.floor((frame.height-side)/2);
 const rgba=Buffer.alloc(side*side*4);
 for(let y=0;y<side;y++)for(let x=0;x<side;x++){
   const src=((y+top)*frame.width+(x+left))*3,dst=(y*side+x)*4;
   rgba[dst]=frame.rgb[src];rgba[dst+1]=frame.rgb[src+1];rgba[dst+2]=frame.rgb[src+2];rgba[dst+3]=255;
 }
 return jpeg.encode({data:rgba,width:side,height:side},75).data;
}
export function createCognition({cognition}){
 validateCognition(cognition);
 const visits=new Map(),claims=[];
 return {
  observe({position=null}={}){
    if(cognition.cognitiveMap&&position&&Number.isFinite(position.x)&&Number.isFinite(position.z)){
      const cell=`${Math.floor(position.x/8)},${Math.floor(position.z/8)}`;
      visits.set(cell,(visits.get(cell)??0)+1);
      if(visits.size>128)visits.delete(visits.keys().next().value);
    }
    const pieces=[];
    if(cognition.cognitiveMap)pieces.push('Egocentric exploration grid (8-block cells, derived from your own position; not a terrain map): '+JSON.stringify([...visits].slice(-12)));
    if(cognition.knowledgeGraph)pieces.push('Unverified hypotheses recalled from your earlier reflections: '+JSON.stringify(claims.slice(-8)));
    return pieces.join('\n');
  },
  reflect({belief='',memory=''}={}){
    if(!cognition.knowledgeGraph)return;
    // Store quoted hypotheses only; no fabricated verified facts or symbolic triples.
    const statement=[belief,memory].filter(Boolean).join(' / ').slice(0,180);
    if(statement&&!claims.includes(statement))claims.push(statement);
    if(claims.length>32)claims.shift();
  },
  fovealImage(frame){return cognition.foveatedVision?centerCropJpeg(frame):null;},
  summary(){return {visitedCells:visits.size,unverifiedHypotheses:claims.length};}
 };
}
