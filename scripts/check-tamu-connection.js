// Validate TAMU Chat Completions from the machine that actually has VPN access.
// Sends no Minecraft data, prints no secrets, and requires explicit opt-in.
const base=process.env.CRAFTLE_LLM_BASE_URL??'https://chat-api.tamu.ai/openai';
const key=process.env.TAMU_API_KEY??process.env.CRAFTLE_LLM_API_KEY;
const cookie=process.env.TAMU_CF_COOKIE;
if(!key){console.error('Missing TAMU_API_KEY');process.exit(2);}
const url=new URL(base.replace(/\/$/,'')+'/models');
if(url.protocol!=='https:'||url.hostname!=='chat-api.tamu.ai'){console.error('Refusing to send TAMU credentials to nonapproved endpoint');process.exit(2);}
const headers={Authorization:'Bearer '+key,...(cookie?{Cookie:cookie}:{})};
try{
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});
 console.log(JSON.stringify({endpointHost:url.hostname,httpStatus:response.status,reachable:true,authorized:response.ok},null,2));
 if(!response.ok)process.exitCode=1;
}catch(e){console.error(JSON.stringify({reachable:false,error:e.name==='TimeoutError'?'timeout':String(e.cause?.code??e.name)}));process.exitCode=1;}
