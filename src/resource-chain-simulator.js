// Fast deterministic symbolic dynamics for scientific calibration ONLY.
// Simulated block and inventory changes are not Minecraft execution, evidence,
// observer proofs, agent movement or confirmed pickup events.
import {chainLayout,chainCandidateMenu,CHAIN_KEYS} from './motor-resource-chain.js';

export function syntheticEpisode(rotation,choose,{update=null,afterEpisode=null,
    variant='base'}={}){
  const layout=chainLayout(rotation,variant);
  const blocks={source0:'dirt',source1:'dirt',decoySource:'dirt',
    site0:'air',site1:'air',decoySite:'air'};
  let inventory=0;
  const choices=[];
  const transitions=[];
  const blockAt=(x,y,z)=>{
    const key=CHAIN_KEYS.find(k=>{
      const p=layout.sites[k];
      return x===p.x&&y===p.y&&z===p.z;
    });
    const solid=y===80||(key&&blocks[key]==='dirt');
    return {name:solid?'dirt':'air',boundingBox:solid?'block':'empty'};
  };
  for(let step=0;step<4;step++){
    const menu=chainCandidateMenu({
      layout,position:{x:.5,y:81,z:.5},blockAt,
      inventory:inventory?[{name:'dirt',count:inventory}]:[],
      health:20,food:20
    });
    if(menu.candidates.length===0)break;
    const selection=choose(menu,step,{blocks,inventory});
    const candidate=selection?.candidate??selection;
    if(!candidate||!menu.candidates.some(c=>c.id===candidate.id))
      throw Error('Synthetic sampler selected illegal action');
    const stateBefore={observation:menu.observation,
      candidates:menu.candidates,
      features:selection.features};
    if(candidate.operation==='dig'){
      if(blocks[candidate.id]!=='dirt')
        throw Error('Synthetic dig chose non-dirt');
      blocks[candidate.id]='air';inventory++;
    }else if(candidate.operation==='place'&&inventory>0){
      if(blocks[candidate.id]!=='air')
        throw Error('Synthetic placement was occupied');
      blocks[candidate.id]='dirt';inventory--;
    }else throw Error('Unsupported synthetic action');
    choices.push(candidate.id);
    const terminal=step===3;
    const complete=blocks.source0==='air'&&blocks.source1==='air'&&
      blocks.site0==='dirt'&&blocks.site1==='dirt'&&
      blocks.decoySource==='dirt'&&blocks.decoySite==='air'&&inventory===0;
    const next=terminal?null:chainCandidateMenu({
      layout,position:{x:.5,y:81,z:.5},blockAt,
      inventory:inventory?[{name:'dirt',count:inventory}]:[],
      health:20,food:20
    });
    const transition={
      ...stateBefore,candidate,terminal,
      reward:terminal?(complete?1:-1):0,
      nextObservation:next?.observation??{},
      nextCandidates:next?.candidates??[]
    };
    if(update)update(transition);
    if(afterEpisode)transitions.push(transition);
  }
  const success=blocks.source0==='air'&&blocks.source1==='air'&&
    blocks.site0==='dirt'&&blocks.site1==='dirt'&&
    blocks.decoySource==='dirt'&&blocks.decoySite==='air'&&inventory===0;
  if(afterEpisode&&transitions.length===4)afterEpisode(transitions);
  return {success,choices};
}
