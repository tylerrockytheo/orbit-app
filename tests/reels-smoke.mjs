// No dependencies or external network: smoke-test Orbit's Reel navigation and playback wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const examplePosts = [
  {id:'clip1',title:'Quick music production trick #shorts',category:'Music',source_url:'https://www.youtube.com/watch?v=abcdefghijk',source_name:'Music Creator',video_id:'abcdefghijk',image_url:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',published_at:'2026-10-09T12:00:00Z'},
  {id:'clip2',title:'Indie game VR gameplay #gaming',category:'Gaming',source_url:'https://www.youtube.com/watch?v=lmnopqrstuv',source_name:'Game Channel',video_id:'lmnopqrstuv',image_url:'https://i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg',published_at:'2026-10-09T12:01:00Z'},
  {id:'story',title:'A verified science article',category:'Science',source_url:'https://example.com/article',source_name:'Publisher',summary:'A sourced summary.',published_at:'2026-10-09T12:02:00Z'},
];
const listeners = new Map(),nodes=new Map(),storage=new Map(),soundCommands=[];
function node(id){
  if(!nodes.has(id)) nodes.set(id,{
    id,innerHTML:'',textContent:'',hidden:true,style:{},clientHeight:800,scrollTop:0,
    setAttribute(name,value){this[name]=value},removeAttribute(name){delete this[name]},
    classList:{toggle(){},add(){},remove(){}},
    querySelector(selector){
      if(selector==='iframe' && this.innerHTML.includes('class="reel-frame')){
        if(!this._frame || this._frameMarkup!==this.innerHTML){
          this._frameMarkup=this.innerHTML;
          this._frame={contentWindow:{postMessage(message){soundCommands.push(JSON.parse(message))}}};
        }
        return this._frame;
      }
      return null;
    },querySelectorAll(){return []},
    insertAdjacentHTML(position,html){this.innerHTML+=html},
    replaceChildren(){},scrollTo({top}){this.scrollTop=top}
  });
  return nodes.get(id);
}
const doc={
  body:{style:{},classList:{toggle(){},add(){},remove(){}}},
  getElementById:node,
  head:{appendChild(script){script.onerror?.()}},
  createElement(){return {}},
  querySelector(){return null},
  querySelectorAll(){return []},
  addEventListener(type,handler){listeners.set(type,handler)}
};
const loc={origin:'https://orbit.example',pathname:'/orbit/',href:'https://orbit.example/orbit/'};
const ctx={
  document:doc,location:loc,history:{replaceState(){}},
  window:{location:loc,scrollTo(){},addEventListener(){}},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val)},
  navigator:{share:async()=>{},clipboard:{writeText:async()=>{}}},
  requestAnimationFrame:cb=>cb(),
  IntersectionObserver:class {observe(){} disconnect(){}},
  fetch:async()=>({ok:true,json:async()=>({posts:examplePosts,generated_at:new Date().toISOString()})}),
  URL,AbortController,Date,console,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{},Math,JSON,
};
const code=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
new vm.Script(code,{filename:'app.js'}).runInNewContext(ctx);
await new Promise(resolve=>setTimeout(resolve,20));
assert.match(node('navigation').innerHTML,/data-tab="Reels"/);
assert.match(node('app').innerHTML,/class="reels-shelf"/);
assert.match(node('app').innerHTML,/Quick music production trick/);
function click(dataset){return listeners.get('click')({target:{closest(){return {dataset}}}})}
await click({tab:'Reels'});
assert.match(node('app').innerHTML,/id="reels-scroll"/);
assert.equal((node('app').innerHTML.match(/class="reel" /g)||[]).length,2);
assert.match(node('app').innerHTML,/data-reel-play="\d+"/);
assert.doesNotMatch(node('app').innerHTML,/\b\d+\s*\/\s*\d+\b/,'Reels should not display a fixed playlist count');
const reelHtml=node('app').innerHTML;
const clip1Match=reelHtml.match(/data-reel-index="(\d+)" data-reel-id="rss:clip1"/);
assert.ok(clip1Match,'music clip should be in the Reels list');
const musicIndex=Number(clip1Match[1]);
await click({reelPlay:String(musicIndex)});
assert.match(node('reel-media-'+musicIndex).innerHTML,/youtube-nocookie.com\/embed\/abcdefghijk/);
assert.match(node('app').innerHTML,/data-reels-audio-tap/);
const beforeMute=node('reel-media-'+musicIndex).innerHTML;
await click({reelsAudioTap:String(musicIndex)});
assert.equal(storage.get('orbit_reel_sound_v1'),'false');
assert.equal(node('reel-media-'+musicIndex).innerHTML,beforeMute,'mute must not reload or pause iframe');
assert.ok(soundCommands.some(c=>c.func==='mute'),'mute command must reach active YouTube iframe');
await click({reelsAudioTap:String(musicIndex)});
assert.equal(storage.get('orbit_reel_sound_v1'),'true');
assert.equal(node('reel-media-'+musicIndex).innerHTML,beforeMute,'unmute must not reload or pause iframe');
assert.ok(soundCommands.some(c=>c.func==='unMute'),'unmute command must reach active YouTube iframe');
await click({reelsSound:''});
assert.equal(storage.get('orbit_reel_sound_v1'),'false','header button shares the same sound state');
await click({reelsSound:''});
assert.equal(storage.get('orbit_reel_sound_v1'),'true');
// A like is private feedback; it must NOT also save a video.
const iframeBeforeLike=node('reel-media-'+musicIndex).innerHTML;
await click({like:'rss:clip1'});
assert.equal(node('reel-media-'+musicIndex).innerHTML,iframeBeforeLike,'liking must never restart the video being watched');
assert.ok(JSON.parse(storage.get('orbit_likes_v1'))['rss:clip1']);
assert.match(node('reels-status').textContent,/Updated for you/,'Like should refresh upcoming Reels immediately');
assert.deepEqual(JSON.parse(storage.get('orbit_bookmarks_v2')||'{}'),{});
await click({reelsNext:String(musicIndex)});
assert.equal(node('reels-scroll').scrollTop,(musicIndex+1)*800);
assert.match(node('reels-scroll').innerHTML,/data-reel-index=/,'Reels should append more videos instead of ending');
assert.match(node('reels-scroll').innerHTML,/Previously shown/,'after exhausting available videos, label replays rather than inventing fresh posts');
await click({save:'rss:clip1'});
assert.ok(JSON.parse(storage.get('orbit_bookmarks_v2'))['rss:clip1']);
await click({like:'rss:clip1'}); // unlike does not remove the bookmark
assert.equal(JSON.parse(storage.get('orbit_likes_v1'))['rss:clip1'],undefined);
assert.ok(JSON.parse(storage.get('orbit_bookmarks_v2'))['rss:clip1']);
await click({reelsClose:''});
assert.match(node('app').innerHTML,/class="reels-shelf"/);
assert.ok(!node('app').innerHTML.includes('reels-scroll'));
console.log('Orbit Reels smoke tests passed: private Likes, Save, Reels, next, full-screen audio tap mute/unmute without reload');
