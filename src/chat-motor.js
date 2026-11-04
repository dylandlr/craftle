// Explicit chat motor primitive. Can transmit a policy-supplied string but does
// not generate words, impersonate humans or silently run operator commands.
// Chat send is an ATTEMPT, not proof another player received the message.
export function createChatMotor(bot,{clock=Date.now,minIntervalMs=2500,
 maxLength=180,allowCommands=false,log=()=>{}}={}){
 let lastSent=-Infinity,serial=0;
 return {
  chat({text}={}){
   if(typeof text!=='string'||text.length===0||text.length>maxLength||
    /[\u0000-\u001f\u007f]/.test(text))
    return {ok:false,reason:'invalid_chat_text'};
   if(text.startsWith('/')&&!allowCommands)return {ok:false,reason:'command_not_permitted'};
   if(typeof bot?.chat!=='function')return {ok:false,reason:'chat_unavailable'};
   const now=clock();
   if(now-lastSent<minIntervalMs)return {ok:false,reason:'chat_rate_limited'};
   if(bot._client?.state&&bot._client.state!=='play')return {ok:false,reason:'client_not_in_play'};
   try{bot.chat(text);}catch(e){
    return {ok:false,reason:'chat_send_error',message:e.message};
   }
   lastSent=now;const attemptId=++serial;
   log({type:'chat_motor_attempt',attemptId,characterCount:text.length,
    generatedByThisModule:false,deliveryVerified:false});
   return {ok:true,attemptId,reason:'sent_unverified',deliveryVerified:false};
  }
 };
}
