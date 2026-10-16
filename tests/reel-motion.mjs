import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/* Simulate flick up/down through YouTube Reels with a controllable player.
   Positions must survive caching, trim/destroy, and re-entering a prior Reel. */
const clips=[
  {id:'a',title:'Fast guitar trick #shorts',category:'Music',source_name:'Music Maker',video_id:'abcdefghijk'},
  {id:'b',title:'Funny gaming #shorts',category:'Gaming',source_name:'Gamer',video_id:'lmnopqrstuv'},
  {id:'c',title:'Animal prank #shorts',category:'Animals',source_name:'Pets',video_id:'ZYXWVUTSRQP'}
].map((p,i)=>({...p,source_url:'https://www.youtube.com/watch?v='+p.video_id,published_at:'2026-10-16T00:00:00Z'}));
const listeners=new Map(),nodes=new Map(),players=[],storage=new Map(),cards=new Map();
const noop=()=>{};
function classList(){const set=new Set();return {add:v=>set.add(v),remove:v=>set.delete(v),toggle:(v,on)=>{if(on)set.add(v);else set.delete(v)},contains:v=>set.has(v)}}
function card(index){
 if(!cards.has(index))cards.set(index,{
   dataset:{reelIndex:String(index)},attrs:new Set(),classList:classList(),
   setAttribute(name){this.attrs.add(name)},removeAttribute(name){this.attrs.delete(name)},
   querySelector(){return null},remove(){this.removed=true}
 });
 return cards.get(index);
}
function node(id){
 if(!nodes.has(id)){
  const value={
    id,innerHTML:'',textContent:'',disabled:false,hidden:false,style:{},scrollTop:0,clientHeight:800,
    classList:classList(),setAttribute(){},removeAttribute(){},replaceChildren(){},remove(){},
    querySelector(selector){
      if(selector==='iframe'&&this.innerHTML.includes('class="reel-frame')){
        if(this.frameMarkup!==this.innerHTML){this.frameMarkup=this.innerHTML;this.frame={contentWindow:{postMessage(){}}}}
        return this.frame;
      }
      if(id==='reels-scroll'&&selector.startsWith('[data-reel-index=')){
        const m=selector.match(/"(\d+)"/);return m?card(Number(m[1])):null;
      }
      return null;
    },
    querySelectorAll(selector){
      if(id==='reels-scroll'&&selector==='.reel')return [0,1,2].map(card);
      return [];
    },
    insertAdjacentHTML(_where,html){this.innerHTML+=html},
    scrollTo({top}){this.scrollTop=top}
  };
  nodes.set(id,value);
 }
 return nodes.get(id);
}
const doc={
 body:{style:{},classList:classList()},head:{appendChild(){}},
 fullscreenElement:null,
 createElement(){return {}},createTextNode(text){return {textContent:String(text)}},
 getElementById:node,
 querySelector(selector){
   if(selector==='.reels-view')return {classList:classList()};
   const m=selector.match(/\.reel\[data-reel-index="(\d+)"\]/);
   return m?card(Number(m[1])):null;
 },
 querySelectorAll(selector){
   if(selector==='.reel')return [0,1,2].map(card);
   if(selector==='.reel[data-playing]')return [0,1,2].map(card).filter(c=>c.attrs.has('data-playing'));
   return [];
 },
 addEventListener(type,listener){
   const group=listeners.get(type)||[];group.push(listener);listeners.set(type,group)
 }
};
function fire(type,event){
 for(const listener of listeners.get(type)||[])listener(event)
}
class Player {
 constructor(frame,options){
   this.frame=frame;this.events=options.events;this.time=0;this.muted=true;this.paused=true;
   players.push(this);Promise.resolve().then(()=>this.events.onReady({target:this}));
 }
 getCurrentTime(){return this.time}
 getDuration(){return 60}
 getPlayerState(){return this.paused?2:1}
 isMuted(){return this.muted}
 playVideo(){this.paused=false;this.events.onStateChange({data:1,target:this})}
 pauseVideo(){this.paused=true;this.events.onStateChange({data:2,target:this})}
 mute(){this.muted=true}
 unMute(){this.muted=false}
 setVolume(){}
 seekTo(seconds){this.time=seconds;this.seekCount=(this.seekCount||0)+1}
 destroy(){this.destroyed=true}
}
const location={origin:'https://orbit.example',href:'https://orbit.example/orbit-app/',pathname:'/orbit-app/'};
const sandbox={
 document:doc,location,window:{YT:{Player},location,scrollTo(){},addEventListener(){}},
 history:{replaceState(){}},navigator:{connection:{saveData:true},share:async()=>{},clipboard:{writeText:async()=>{}}},
 localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
 fetch:async()=>({ok:true,json:async()=>({posts:clips})}),
 requestAnimationFrame:fn=>fn(),IntersectionObserver:class{observe(){}disconnect(){}unobserve(){}},
 URL,Date,Math,JSON,console,AbortController,
 setTimeout,clearTimeout,setInterval:()=>1,clearInterval:noop
};
const script=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8')
 .replace(/\}\)\(\);\s*$/, 'globalThis.__motion={reelJump,rememberReelTime,savedReelTime,active:()=>reelActiveIndex,positions:()=>reelResumePositions,players:()=>reelYoutubePlayers,clip:index=>reelItems()[index]};})();');
const context=vm.createContext(sandbox);
new vm.Script(script,{filename:'app.js'}).runInContext(context);
await new Promise(resolve=>setTimeout(resolve,30));
const click=async dataset=>{for(const fn of listeners.get('click')||[])await fn({target:{closest:()=>({dataset})}})};
await click({tab:'Reels'});
await new Promise(resolve=>setTimeout(resolve,5));
assert.equal(context.__motion.active(),0,'first Reel automatically activates');
assert.equal(players.length,1,'only one YouTube player loads initially');
const first=players[0];
const firstKey='youtube:'+context.__motion.clip(0).video_id;
first.time=19.4;
const swipeTarget={closest:selector=>selector==='#reels-scroll'?node('reels-scroll'):null};
function touch(type,y,which='touches'){
  const e={target:swipeTarget,touches:[{clientX:160,clientY:y}],changedTouches:[{clientX:160,clientY:y}],
    preventDefault(){this.prevented=true}};
  fire(type,e);return e;
}
touch('touchstart',640);
const move=touch('touchmove',375);
assert.equal(move.prevented,true,'Reels vertical movement must override native browser bounce');
assert.ok(node('reels-scroll').scrollTop>0,'Reels follows the finger immediately');
touch('touchend',360);
await new Promise(resolve=>setTimeout(resolve,5));
assert.equal(context.__motion.active(),1,'one upward flick advances exactly one Reel');
assert.equal(first.paused,true,'previous Reel pauses immediately');
assert.equal(first.destroyed,undefined,'previous Reel stays cached');
assert.ok(context.__motion.positions()[firstKey]?.time>=19,
  'previous video playback position is saved');
assert.ok(storage.get('orbit_reel_positions_v1')?.includes(firstKey),'resume metadata should be stored under actual video ID');
const firstIframe=node('reel-media-0').innerHTML;
const beforePlayers=players.length;
touch('touchstart',250);
touch('touchmove',510);
touch('touchend',540);
await new Promise(resolve=>setTimeout(resolve,5));
assert.equal(context.__motion.active(),0,'downward swipe returns directly to preceding Reel');
assert.equal(node('reel-media-0').innerHTML,firstIframe,'cached iframe is reused rather than reloaded');
assert.equal(players.length,beforePlayers,'returning should not create a new YouTube player');
assert.equal(first.time,19.4,'cached video position is unchanged');
assert.equal(first.paused,false,'cached player resumes');
assert.equal(node('reels-scroll').scrollTop,0,'snap ends exactly at first card');
assert.ok(fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8').includes('scroll-snap-type:none!important'),
 'native mandatory scroll snap must be disabled inside Reels');
console.log('Reel motion tests passed: finger-following flicks, one-card navigation, cached iframe and saved playback time');
