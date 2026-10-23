// Persistent, bounded Minecraft textual feedback across death and respawn.
// Text comes from actual Mineflayer chat/system messages; death-screen metadata
// is represented separately, since Mineflayer does not provide a rendered GUI.
export function classifyDeathCause(messages=[]){
 const text=messages.join(' ').toLowerCase();
 if(/lava|burned to death|burnt to a crisp|went up in flames|fire/.test(text))return 'fire_lava';
 if(/drown|underwater/.test(text))return 'drowning';
 if(/fell|fall|hit the ground too hard/.test(text))return 'fall';
 if(/slain by|shot by|blown up by|killed by|was stung|withered away/.test(text))return 'combat';
 if(/starv/.test(text))return 'starvation';
 if(/suffocat|wall/.test(text))return 'suffocation';
 if(/void/.test(text))return 'void';
 return 'unknown';
}
export function createLifeFeedback({limit=128}={}){
 if(!Number.isInteger(limit)||limit<1||limit>10000)throw Error('Invalid feedback retention limit');
 const entries=[];
 let life=0,deathCount=0;let latestCause='unknown';
 const append=(kind,text,meta={})=>{
  const entry=Object.freeze({seq:entries.length?entries[entries.length-1].seq+1:1,life,kind,text:String(text).slice(0,2048),...meta});
  entries.push(entry);
  if(entries.length>limit)entries.shift();
  return entry;
 };
 return Object.freeze({
  chat:(text,position='chat')=>append('minecraft_text',text,{position:String(position)}),
  death:(details={})=>{
   const recent=entries.filter(x=>x.kind==='minecraft_text'&&x.life===life).slice(-8).map(x=>x.text);
   latestCause=classifyDeathCause(recent);
   deathCount++;
   return append('death_screen',details.message??'You Died!',{deathCount,cause:latestCause,position:details.position??null,health:details.health??null});
  },
  respawn:()=>{life++;return append('respawn','Respawned',{deathCount});},
  snapshot:({after=0,max=32}={})=>Object.freeze({life,deathCount,latestDeathCause:latestCause,latestSeq:entries.at(-1)?.seq??0,entries:entries.filter(x=>x.seq>after).slice(-Math.max(1,Math.min(max,limit)))}),
 });
}
