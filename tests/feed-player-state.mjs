import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Controlled YouTube player mock. Confirms that buffering and blocked-autoplay
// paths display the first-party recovery UI without skipping provider ads.
const events=new Map(),elements=new Map(),players=[],timeouts=new Map();
let nextTimer=1;
function el(id){
 if(!elements.has(id)){
   const hintButton={textContent:'',disabled:false};
   const hint={hidden:false,querySelector(sel){return sel==='button'?hintButton:null},button:hintButton};
   elements.set(id,{
     id,innerHTML:'',textContent:'',hidden:true,clientHeight:780,scrollTop:0,style:{},dataset:{},
     hint,
     setAttribute(){},removeAttribute(){},replaceChildren(){},scrollTo(){},
     classList:{toggle(){},add(){},remove(){}},
     querySelector(sel){
       if(sel==='.feed-playback-hint')return this.innerHTML.includes('feed-playback-hint')?this.hint:null;
       if(sel==='iframe'&&this.innerHTML.includes('feed-autoplay-frame')){
         if(this.lastHtml!==this.innerHTML){this.lastHtml=this.innerHTML;this.frame={contentWindow:{postMessage(){}}}}
         return this.frame;
       }
       return null;
     },
     querySelectorAll(){return []}
   });
 }
 return elements.get(id);
}
const media=el('media-rss:clip');
class YouTubeMock{
 constructor(frame,options){this.events=options.events;this.frame=frame;this.muted=false;this.playing=false;players.push(this);
   Promise.resolve().then(()=>this.events.onReady({target:this}))}
 mute(){this.muted=true}
 unMute(){this.muted=false}
 setVolume(){}
 isMuted(){return this.muted}
 playVideo(){this.playing=true;this.events.onStateChange({data:1})}
 pauseVideo(){this.playing=false;this.events.onStateChange({data:2})}
 destroy(){this.destroyed=true}
}
const document={
 body:{style:{},classList:{toggle(){}}},head:{appendChild(){}},
 createElement(){return {}},getElementById:el,
 querySelector(sel){if(sel==='[data-feed-sound]')return {textContent:'',disabled:false,setAttribute(){}};return null},
 querySelectorAll(sel){if(sel==='.post .media-wrap[id^="media-"]'&&el('app').innerHTML.includes('media-rss:clip'))return [media];return []},
 addEventListener(type,handler){events.set(type,handler)}
};
const location={origin:'https://orbit.example',pathname:'/orbit/',href:'https://orbit.example/orbit/'};
const ctx={
 document,location,window:{YT:{Player:YouTubeMock},location,scrollTo(){},addEventListener(){}},
 history:{replaceState(){}},navigator:{share:async()=>{},clipboard:{writeText:async()=>{}}},
 localStorage:{getItem:()=>null,setItem(){}},fetch:async()=>({ok:true,json:async()=>({posts:[
  {id:'clip',title:'Official Game Trailer',category:'Gaming',source_name:'Creator',
   source_url:'https://www.youtube.com/watch?v=abcdefghijk',video_id:'abcdefghijk',published_at:new Date().toISOString()}
 ]})}),
 requestAnimationFrame:cb=>cb(),IntersectionObserver:class{constructor(fn){this.fn=fn;ctx.io=this}observe(){}disconnect(){}},
 URL,Date,Math,JSON,console,AbortController,
 setTimeout:(fn,ms)=>{const id=nextTimer++;timeouts.set(id,{fn,ms});return id},
 clearTimeout:id=>timeouts.delete(id),
 setInterval:()=>1,clearInterval:()=>{}
};
new vm.Script(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),{filename:'app.js'}).runInNewContext(ctx);
await Promise.resolve();await Promise.resolve();
ctx.io.fn([{target:media,isIntersecting:true,intersectionRatio:.95}]);
await Promise.resolve();await Promise.resolve();
assert.ok(players.length===1,'feed must attach one player');
const player=players[0];
assert.equal(player.playing,true,'ready player should start autoplay');
assert.equal(media.hint.hidden,true,'playing hides loading badge');
const previous=media.innerHTML;
ctx.io.fn([{target:media,isIntersecting:false,intersectionRatio:0}]);
assert.equal(player.playing,false,'offscreen player must pause');
assert.equal(media.innerHTML,previous,'offscreen should not destroy iframe');
ctx.io.fn([{target:media,isIntersecting:true,intersectionRatio:.90}]);
assert.equal(player.playing,true,'scrolling back resumes player');
assert.equal(players.length,1,'scrolling back must not initialise a second iframe/player');
player.events.onStateChange({data:3});
const watchdog=[...timeouts.values()].find(t=>t.ms===9000);
assert.ok(watchdog,'buffering starts a recovery timer');
watchdog.fn();
assert.equal(media.hint.hidden,false,'stuck buffering must show recovery');
assert.match(media.hint.button.textContent,/retry/i);
player.events.onStateChange({data:1});
assert.equal(media.hint.hidden,true,'player recovers and hides fallback');
player.events.onAutoplayBlocked();
assert.equal(media.hint.hidden,false,'blocked autoplay exposes recovery control');
console.log('Feed player state tests passed: muted autoplay, scroll resume, buffering recovery, and provider autoplay block');
