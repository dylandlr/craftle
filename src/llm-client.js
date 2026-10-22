// OpenAI-compatible multimodal chat endpoint. No credentials in logs or code.
export function createVisionClient({apiKey=process.env.CRAFTLE_LLM_API_KEY,model=process.env.CRAFTLE_LLM_MODEL,baseUrl=process.env.CRAFTLE_LLM_BASE_URL??'https://api.openai.com/v1',fetchImpl=fetch,cfCookie=process.env.TAMU_CF_COOKIE,timeoutMs=Number(process.env.CRAFTLE_LLM_TIMEOUT_MS??30000)}={}){
 if(!apiKey||!model)throw Error('Set CRAFTLE_LLM_API_KEY and CRAFTLE_LLM_MODEL');
 const url=new URL(baseUrl.replace(/\/$/,'')+'/chat/completions');
 if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))throw Error('LLM endpoint must use HTTPS (or loopback HTTP)');
 if(!Number.isFinite(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw Error('Invalid LLM timeout');
 return async ({system,observation,history=[],signal})=>{
   const timeout=AbortSignal.timeout(timeoutMs);
   const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
   const response=await fetchImpl(url,{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',...(cfCookie?{Cookie:cfCookie}:{})},signal:requestSignal,body:JSON.stringify({model,temperature:0.4,max_tokens:250,messages:[{role:'system',content:system},...history.slice(-6),{role:'user',content:[{type:'text',text:observation.text},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+observation.jpeg.toString('base64')}}]}]})});
   if(!response.ok)throw Error('LLM HTTP '+response.status);
   const result=await response.json();
   const text=result.choices?.[0]?.message?.content;
   if(typeof text!=='string')throw Error('Missing LLM text response');
   return text;
 };
}
