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
// Belief memory is evidence-tagged. Self-reports never become verified observations.
export function createCognition({cognition}){
 validateCognition(cognition);
 const visits=new Map(),hypotheses=new Map();
 let lastCell=null,step=0;
 return {
  observe({position=null}={}){
    step++;
    if(cognition.cognitiveMap&&position&&Number.isFinite(position.x)&&Number.isFinite(position.z)){
      const cell=`${Math.floor(position.x/8)},${Math.floor(position.z/8)}`;
      visits.set(cell,(visits.get(cell)??0)+1);
      lastCell=cell;
      if(visits.size>128)visits.delete(visits.keys().next().value);
    }
    const pieces=[];
    if(cognition.cognitiveMap){
      const [cx,cz]=lastCell?.split(',').map(Number)??[0,0];
      const neighbors=lastCell?[[cx+1,cz],[cx-1,cz],[cx,cz+1],[cx,cz-1]]
        .map(([x,z])=>({cell:`${x},${z}`,visits:visits.get(`${x},${z}`)??0}))
        .sort((a,b)=>a.visits-b.visits):[];
      pieces.push('Egocentric exploration grid (8-block cells, self-position only; no terrain knowledge): '+JSON.stringify({current:lastCell,visited:[...visits].slice(-12),leastVisitedAdjacent:neighbors.slice(0,2)}));
    }
    if(cognition.knowledgeGraph)pieces.push('Unverified hypotheses recalled from your earlier reflections: '+JSON.stringify([...hypotheses.values()].slice(-8)));
    return pieces.join('\n');
  },
  reflect({belief='',memory=''}={}){
    if(!cognition.knowledgeGraph)return;
    for(const statement of [belief,memory]){
      if(typeof statement!=='string'||!statement.trim())continue;
      const key=statement.trim().slice(0,180);
      const previous=hypotheses.get(key);
      hypotheses.set(key,{statement:key,source:'agent_self_report',verified:false,mentions:(previous?.mentions??0)+1,lastStep:step});
      if(hypotheses.size>32)hypotheses.delete(hypotheses.keys().next().value);
    }
  },
  fovealImage(frame){return cognition.foveatedVision?centerCropJpeg(frame):null;},
  summary(){return {visitedCells:visits.size,unverifiedHypotheses:hypotheses.size};}
 };
}
