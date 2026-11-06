/* Device-local Japanese speech, cancellable pacing between tokens. */
(function(root){'use strict';
let generation=0,gapTimer=null,watchdog=null,current=null,finish=null;
function voices(){return root.speechSynthesis?root.speechSynthesis.getVoices().filter(v=>v.localService&&v.lang.toLowerCase().startsWith('ja')):[];}
function stop(){generation++;clearTimeout(gapTimer);clearTimeout(watchdog);current=null;root.speechSynthesis?.cancel();const fn=finish;finish=null;fn?.('stopped');}
function play(parts,settings,callbacks={}){stop();const available=voices(),voice=available.find(v=>v.voiceURI===settings.voiceURI)||available[0];if(!settings.voice||!root.speechSynthesis||!voice||!parts.length){callbacks.onDone?.('unavailable');return false;}const texts=parts.map(String).filter(Boolean);if(!texts.length){callbacks.onDone?.('empty');return false;}const gen=generation,rate=settings.rate??.7,pitch=settings.voiceStyle==='clear'?1:1.15,gap=settings.gapMs??650;finish=callbacks.onDone;
function done(reason){if(gen!==generation)return;generation++;clearTimeout(watchdog);clearTimeout(gapTimer);current=null;const fn=finish;finish=null;fn?.(reason);}
function next(i){if(gen!==generation)return;const u=new root.SpeechSynthesisUtterance(texts[i]);let ended=false;current=u;u.lang='ja-JP';u.voice=voice;u.rate=rate;u.pitch=pitch;u.volume=1;callbacks.onIndex?.(i);u.onend=()=>{if(gen!==generation||ended)return;ended=true;clearTimeout(watchdog);if(i+1<texts.length)gapTimer=setTimeout(()=>next(i+1),gap);else done('ended');};u.onerror=e=>{if(gen!==generation||ended)return;ended=true;done('error');if(!['canceled','interrupted'].includes(e.error))callbacks.onError?.(e.error);};watchdog=setTimeout(()=>{if(gen!==generation)return;stop();callbacks.onError?.('timeout');},120000);try{root.speechSynthesis.speak(u);}catch(e){done('error');callbacks.onError?.('unavailable');}}
next(0);return true;}
root.MomoSpeech={voices,stop,play};
})(typeof window!=='undefined'?window:globalThis);
