import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const events=new Map(),nodes=new Map(),actions=[],tags=new Map();
function fake(id){
 if(!nodes.has(id))nodes.set(id,{
   id,innerHTML:'',textContent:'',style:{},dataset:{},
   hidden:false,value:'',disabled:false,clientHeight:800,scrollTop:0,
   classList:{add(){},remove(){},toggle(){}},
   setAttribute(){},removeAttribute(){},replaceChildren(...content){this.textContent=content.map(x=>x.textContent||'').join('')},
   querySelector(sel){
     if(sel==='iframe'&&this.innerHTML.includes('class="reel-frame')){
       if(this._previous!==this.innerHTML){this._previous=this.innerHTML;this._frame={contentWindow:{postMessage(){}}}}
       return this._frame;
     }
     return null
   },querySelectorAll(){return []},scrollTo({top}){this.scrollTop=top}
 });return nodes.get(id)
}
const reelClasses=new Set(),slider={
 dataset:{reelSeek:'0'},value:'0',disabled:true,
 matches(sel){return sel==='[data-reel-seek]'},
 closest(){return article}
};
const played={replaceChildren(...x){this.value=x[0]?.textContent}};
const duration={replaceChildren(...x){this.value=x[0]?.textContent}};
const article={
 dataset:{reelIndex:'0'},
 setAttribute(){},removeAttribute(){},
 classList:{toggle(name,on){if(on)reelClasses.add(name);else reelClasses.delete(name)}},
 querySelector(sel){
   if(sel==='[data-reel-seek]')return slider;
   if(sel==='[data-played-time]')return played;
   if(sel==='[data-duration-time]')return duration;
   return null
 }
};
const document={
 body:{style:{},classList:{toggle(){}}},head:{appendChild(){}},createElement(){return {}},
 createTextNode(text){return {textContent:String(text)}},
 getElementById:fake,
 querySelector(sel){if(sel.includes('data-reel-index="0"'))return article;return null},
 querySelectorAll(sel){if(sel==='.reel')return [article];return []},
 addEventListener(type,callback){events.set(type,callback)}
};
class PlayerMock{
 constructor(frame,config){
   this.frame=frame;this.muted=false;this.playing=true;
   Promise.resolve().then(()=>config.events.onReady({target:this}));
 }
 getCurrentTime(){return 30}
 getDuration(){return 120}
 getPlayerState(){return this.playing?1:2}
 isMuted(){return this.muted}
 seekTo(seconds,allowed){actions.push({type:'seek',seconds,allowed})}
 mute(){this.muted=true;actions.push({type:'mute'})}
 unMute(){this.muted=false;actions.push({type:'unmute'})}
 pauseVideo(){this.playing=false;actions.push({type:'pause'})}
 playVideo(){this.playing=true;actions.push({type:'play'})}
 setVolume(value){actions.push({type:'volume',value})}
}
const location={origin:'https://orbit.example',pathname:'/orbit/',href:'https://orbit.example/orbit/'};
const localStorage={getItem:()=>null,setItem(){}};
const ctx={
 document,location,history:{replaceState(){}},window:{location,YT:{Player:PlayerMock},scrollTo(){},addEventListener(){}},
 navigator:{share:async()=>{},clipboard:{writeText:async()=>{}}},localStorage,
 requestAnimationFrame:fn=>fn(),IntersectionObserver:class{observe(){}disconnect(){}},
 fetch:async()=>({ok:true,json:async()=>({posts:[{
   id:'one',title:'Funny video #shorts',category:'Comedy',source_name:'Creator',
   source_url:'https://www.youtube.com/watch?v=abcdefghijk',video_id:'abcdefghijk'
 }]})}),
 URL,AbortController,Date,Math,JSON,console,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{}
};
new vm.Script(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8')).runInNewContext(ctx);
await new Promise(r=>setTimeout(r,25));
const click=(dataset)=>events.get('click')({target:{closest(){return {dataset}}}});
await click({tab:'Reels'});
assert.match(fake('app').innerHTML,/data-reel-seek/);
await click({reelPlay:'0'});
await new Promise(r=>setTimeout(r,5));
assert.equal(slider.disabled,false,'timeline enables when video duration is available');
assert.equal(slider.value,'250','timeline displays current progress');
slider.value='500';
await events.get('input')({target:slider});
await events.get('change')({target:slider});
assert.ok(actions.some(x=>x.type==='seek'&&x.seconds===60&&x.allowed===true));
await click({reelsAudioTap:'0'});
assert.ok(actions.some(x=>x.type==='pause'),'sound-on tap should pause playing video');
await click({reelsAudioTap:'0'});
assert.ok(actions.some(x=>x.type==='play'),'second tap should resume');
await click({reelsSound:''});
assert.equal(actions.at(-1).type,'mute','only speaker should mute');
const pauseCount=actions.filter(x=>x.type==='pause').length;
await click({reelsAudioTap:'0'});
assert.equal(actions.filter(x=>x.type==='pause').length,pauseCount,'muted tap must not pause');
assert.ok(actions.some(x=>x.type==='unmute'),'muted tap should unmute');
await click({playerControls:''});
assert.ok(reelClasses.has('native-controls'),'native player mode should expose YouTube skip-ad controls');
await click({playerControls:''});
assert.ok(!reelClasses.has('native-controls'),'native controls should be dismissible');
await click({reelsClose:''});
console.log('Seek smoke tests passed: YouTube timeline seeks 50%, official controls toggle without ad bypass');
