import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const eventHandlers=new Map(),nodes=new Map(),ioInstances=[],playerCommands=[];
function node(id){
 if(!nodes.has(id))nodes.set(id,{
   id,innerHTML:'',textContent:'',hidden:true,value:'',style:{},dataset:{},clientHeight:700,scrollTop:0,
   classList:{values:new Set(),toggle(name,force){if(force??!this.values.has(name))this.values.add(name);else this.values.delete(name)},add(name){this.values.add(name)},remove(name){this.values.delete(name)},contains(name){return this.values.has(name)}},
   setAttribute(){},removeAttribute(){},replaceChildren(){},
   querySelector(tag){if(tag==='iframe'&&this.innerHTML.includes('class="video-frame'))return {src:'stub',contentWindow:{postMessage(message){playerCommands.push(JSON.parse(message))}}};return null},
   querySelectorAll(){return []},scrollTo(){}
 });
 return nodes.get(id);
}
const videoHolder=node('media-rss:clip1');
const secondVideoHolder=node('media-rss:clip3');
const doc={
 body:{style:{},classList:{toggle(){}}},
 head:{appendChild(script){script.onerror?.()}},createElement(){return {}},
 getElementById:node,
 querySelector(){return null},
 querySelectorAll(selector){
   if(selector==='.post .media-wrap[id^="media-"]'&&node('app').innerHTML.includes('id="media-rss:clip1"'))return [videoHolder,secondVideoHolder];
   return [];
 },
 addEventListener(name,fn){eventHandlers.set(name,fn)}
};
class IO{
 constructor(callback){this.callback=callback;this.targets=[];ioInstances.push(this)}
 observe(target){this.targets.push(target)}
 disconnect(){this.targets=[]}
 unobserve(){}
}
const location={origin:'https://orbit.example',pathname:'/orbit/',href:'https://orbit.example/orbit/'};
const context={
 document:doc,location,window:{location,scrollTo(){},addEventListener(){}},
 history:{replaceState(){}},navigator:{share:async()=>{},clipboard:{writeText:async()=>{}}},
 localStorage:{getItem:()=>null,setItem(){}},
 fetch:async()=>({ok:true,json:async()=>({posts:[
  {id:'clip1',title:'Official Film Trailer',category:'Entertainment',source_name:'Creator',source_url:'https://www.youtube.com/watch?v=abcdefghijk',video_id:'abcdefghijk',published_at:'2026-10-10T00:00:00Z'},
  {id:'clip2',title:'Funny reaction #shorts',category:'Comedy',source_name:'Comic Creator',source_url:'https://www.youtube.com/watch?v=lmnopqrstuv',video_id:'lmnopqrstuv',published_at:'2026-10-10T00:00:01Z'},
  {id:'clip3',title:'Official Documentary Trailer',category:'Entertainment',source_name:'Doc Creator',source_url:'https://www.youtube.com/watch?v=1234567890a',video_id:'1234567890a',published_at:'2026-10-10T00:00:02Z'}
 ]})}),
 URL,AbortController,Date,console,Math,JSON,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{},requestAnimationFrame:fn=>fn(),IntersectionObserver:IO
};
new vm.Script(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8')).runInNewContext(context);
await new Promise(resolve=>setTimeout(resolve,30));
assert.match(node('app').innerHTML,/id="media-rss:clip1"/);
assert.doesNotMatch(node('app').innerHTML,/data-post="rss:clip2"/,'shorts should not duplicate regular-feed posts');
assert.match(node('app').innerHTML,/data-open-reels="rss:clip2"/,'shorts should be discoverable through Reels shelf');
const observer=ioInstances.at(-1);
assert.ok(observer.targets.includes(videoHolder),'autoplay observes video in normal feed');
observer.callback([{target:videoHolder,isIntersecting:true,intersectionRatio:.9}]);
assert.match(videoHolder.innerHTML,/autoplay=1/);
assert.match(videoHolder.innerHTML,/mute=1/,'auto play must start muted');
assert.match(videoHolder.innerHTML,/data-feed-sound/);
assert.match(videoHolder.innerHTML,/data-feed-fullscreen/,'main feed should expose Orbit fullscreen');
assert.match(videoHolder.innerHTML,/fs=0/,'disable YouTube embedded fullscreen');
assert.doesNotMatch(videoHolder.innerHTML,/allowfullscreen/,'the provider cannot take over fullscreen');
const style=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(style,/\.feed-sound\{position:absolute;left:10px/,'sound chip should not block right-side Skip Ad');
await eventHandlers.get('click')({target:{closest(){return {dataset:{feedFullscreen:'rss:clip1'}}}}});
assert.ok(videoHolder.classList.contains('feed-immersive-fullscreen'),'Orbit fallback fullscreen covers viewport');
await eventHandlers.get('click')({target:{closest(){return {dataset:{feedFullscreen:'rss:clip1'}}}}});
assert.ok(!videoHolder.classList.contains('feed-immersive-fullscreen'),'fullscreen button exits without reloading');

const beforeSound=videoHolder.innerHTML;
await eventHandlers.get('click')({target:{closest(){return {dataset:{feedSound:'rss:clip1'}}}}});
await eventHandlers.get('click')({target:{closest(){return {dataset:{feedSound:'rss:clip1'}}}}});
assert.equal(videoHolder.innerHTML,beforeSound,'sound taps should not reload inline player');
assert.equal(playerCommands.filter(m=>m.func==='unMute').length,2,'second tap should RETRY an unconfirmed unmute, not mute');
assert.equal(playerCommands.filter(m=>m.func==='mute').length,0,'do not mute when audio was never confirmed');

observer.callback([{target:videoHolder,isIntersecting:false,intersectionRatio:0}]);
assert.match(videoHolder.innerHTML,/video-frame/,'offscreen video iframe remains in DOM to avoid replaying advertisements');
assert.ok(playerCommands.some(m=>m.func==='pauseVideo'),'offscreen player must be paused');
observer.callback([{target:videoHolder,isIntersecting:true,intersectionRatio:.92}]);
assert.equal(videoHolder.innerHTML,beforeSound,'returning to the same clip must not replace the iframe');
assert.ok(playerCommands.some(m=>m.func==='playVideo'),'previous player resumes on re-entry');
observer.callback([{target:videoHolder,isIntersecting:false,intersectionRatio:0},{target:secondVideoHolder,isIntersecting:true,intersectionRatio:.91}]);
assert.equal(videoHolder.innerHTML,beforeSound,'switching video should park and cache the previous iframe');
assert.match(secondVideoHolder.innerHTML,/video-frame/,'the next clip autoplays');
assert.ok(playerCommands.filter(m=>m.func==='pauseVideo').length>=2,'previous player is paused before the next player starts');
assert.match(secondVideoHolder.innerHTML,/mute=0/,'once user requested audio, later clips attempt sound when permitted');
const parkedHtml=videoHolder.innerHTML;
observer.callback([{target:secondVideoHolder,isIntersecting:false,intersectionRatio:0},{target:videoHolder,isIntersecting:true,intersectionRatio:.94}]);
assert.equal(videoHolder.innerHTML,parkedHtml,'scrolling back uses the same iframe, not a fresh embed');
assert.ok(playerCommands.filter(m=>m.func==='playVideo').length>=2,'backscroll resumes the existing player');

console.log('Feed autoplay tests passed: ad-safe sound, main feed fullscreen, cached video switching and backscroll resume');
