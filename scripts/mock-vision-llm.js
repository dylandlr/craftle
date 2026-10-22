// Deterministic OpenAI-compatible multimodal test server. NEVER use for research results.
import http from 'node:http';
const port=Number(process.env.CRAFTLE_MOCK_PORT??18765);
let n=0;
const actions=['look_left','forward','mine','look_right','forward','craft','equip','idle'];
const server=http.createServer((req,res)=>{
 if(req.method!=='POST'||req.url!=='/v1/chat/completions'){res.writeHead(404);res.end();return;}
 let body='';
 req.on('data',chunk=>{body+=chunk;if(body.length>4000000)req.destroy();});
 req.on('end',()=>{
  try{
   const data=JSON.parse(body);
   const image=data.messages?.at(-1)?.content?.find(x=>x.type==='image_url')?.image_url?.url;
   if(!image?.startsWith('data:image/jpeg;base64,'))throw Error('First-person image missing');
   const action=actions[n++%actions.length];
   const decision={goal:'diagnostic exploration',belief:'camera frame received',plan:'exercise bounded action',action,target:action==='craft'?'oak_planks':action==='equip'?'wooden_pickaxe':null,memory:'diagnostic only'};
   res.writeHead(200,{'Content-Type':'application/json'});
   res.end(JSON.stringify({choices:[{message:{role:'assistant',content:JSON.stringify(decision)}}]}));
  }catch(error){res.writeHead(400);res.end(JSON.stringify({error:error.message}));}
 });
});
server.listen(port,'127.0.0.1',()=>console.log('MOCK_LLM_READY '+port));
