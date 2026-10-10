import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const eventHandlers=new Map(),nodes=new Map(),ioInstances=[];
function node(id){
 if(!nodes.has(id))nodes.set(id,{
   id,innerHTML:'',textContent:'',hidden:true,value:'',style:{},dataset:{},clientHeight:700,scrollTop:0,
   classList:{toggle(){},add(){},remove(){}},
   setAttribute(){},removeAttribute(){},replaceChildren(){},
   querySelector(tag){if(tag==='iframe'&&this.innerHTML.includes('class="video-frame"'))return {src:'stub'};return null},
   querySelectorAll(){return []},scrollTo(){}
 });
 return nodes.get(id);
}
const videoHolder=node('media-rss:clip1');
const doc={
 body:{style:{},classList:{toggle(){}}},
 head:{appendChild(script){script.onerror?.()}},createElement(){return {}},
 getElementById:node,
 querySelector(){return null},
 querySelectorAll(selector){
   if(selector==='.post .media-wrap[id^="media-"]'&&node('app').innerHTML.includes('id="media-rss:clip1"'))return [videoHolder];
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
  {id:'clip2',title:'Funny reaction #shorts',category:'Comedy',source_name:'Comic Creator',source_url:'https://www.youtube.com/watch?v=lmnopqrstuv',video_id:'lmnopqrstuv',published_at:'2026-10-10T00:00:01Z'}
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
observer.callback([{target:videoHolder,isIntersecting:false,intersectionRatio:0}]);
assert.doesNotMatch(videoHolder.innerHTML,/video-frame/,'offscreen video must stop');
assert.match(videoHolder.innerHTML,/data-play="rss:clip1"/,'offscreen cover restored');
console.log('Feed autoplay smoke tests passed: start muted in viewport, stop on scroll away');
