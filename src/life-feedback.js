// Persistent, bounded Minecraft textual feedback across death and respawn.
// Text comes from actual Mineflayer chat/system messages; death-screen metadata
// is represented separately, since Mineflayer does not provide a rendered GUI.
export function createLifeFeedback({limit=128}={}){
 if(!Number.isInteger(limit)||limit<1||limit>10000)throw Error('Invalid feedback retention limit');
 const entries=[];
 let life=0,deathCount=0;
 const append=(kind,text,meta={})=>{
  const entry=Object.freeze({seq:entries.length?entries[entries.length-1].seq+1:1,life,kind,text:String(text).slice(0,2048),...meta});
  entries.push(entry);
  if(entries.length>limit)entries.shift();
  return entry;
 };
 return Object.freeze({
  chat:(text,position='chat')=>append('minecraft_text',text,{position:String(position)}),
  death:(details={})=>{deathCount++;return append('death_screen',details.message??'You Died!',{deathCount,position:details.position??null,health:details.health??null});},
  respawn:()=>{life++;return append('respawn','Respawned',{deathCount});},
  snapshot:({after=0,max=32}={})=>Object.freeze({life,deathCount,latestSeq:entries.at(-1)?.seq??0,entries:entries.filter(x=>x.seq>after).slice(-Math.max(1,Math.min(max,limit)))}),
 });
}
