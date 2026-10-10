// No dependencies or external network: smoke-test Orbit's Reel navigation and playback wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const examplePosts = [
  {id:'clip1',title:'Quick music production trick #shorts',category:'Music',source_url:'https://www.youtube.com/watch?v=abcdefghijk',source_name:'Music Creator',video_id:'abcdefghijk',image_url:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',published_at:'2026-10-09T12:00:00Z'},
  {id:'clip2',title:'Indie game VR gameplay #gaming',category:'Gaming',source_url:'https://www.youtube.com/watch?v=lmnopqrstuv',source_name:'Game Channel',video_id:'lmnopqrstuv',image_url:'https://i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg',published_at:'2026-10-09T12:01:00Z'},
  {id:'story',title:'A verified science article',category:'Science',source_url:'https://example.com/article',source_name:'Publisher',summary:'A sourced summary.',published_at:'2026-10-09T12:02:00Z'},
];
const listeners = new Map(),nodes=new Map(),storage=new Map();
function node(id){
  if(!nodes.has(id)) nodes.set(id,{
    id,innerHTML:'',textContent:'',hidden:true,style:{},clientHeight:800,scrollTop:0,
    classList:{toggle(){},add(){},remove(){}},
    querySelector(){return null},querySelectorAll(){return []},
    replaceChildren(){},scrollTo({top}){this.scrollTop=top}
  });
  return nodes.get(id);
}
const doc={
  body:{style:{},classList:{toggle(){},add(){},remove(){}}},
  getElementById:node,
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
  URL,AbortController,Date,console,setTimeout,clearTimeout,Math,JSON,
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
assert.match(node('app').innerHTML,/data-reel-play="rss:clip1"/);
const reelHtml=node('app').innerHTML;
const clip1Match=reelHtml.match(/data-reel-index="(\d+)" data-reel-id="rss:clip1"/);
assert.ok(clip1Match,'music clip should be in the Reels list');
const musicIndex=Number(clip1Match[1]);
await click({reelPlay:'rss:clip1'});
assert.match(node('reel-media-'+musicIndex).innerHTML,/youtube-nocookie.com\/embed\/abcdefghijk/);
// A like is private feedback; it must NOT also save a video.
await click({like:'rss:clip1'});
assert.ok(JSON.parse(storage.get('orbit_likes_v1'))['rss:clip1']);
assert.equal(storage.get('orbit_bookmarks_v2'),undefined);
await click({reelsNext:'0'});
assert.equal(node('reels-scroll').scrollTop,800);
await click({save:'rss:clip1'});
assert.ok(JSON.parse(storage.get('orbit_bookmarks_v2'))['rss:clip1']);
await click({like:'rss:clip1'}); // unlike does not remove the bookmark
assert.equal(JSON.parse(storage.get('orbit_likes_v1'))['rss:clip1'],undefined);
assert.ok(JSON.parse(storage.get('orbit_bookmarks_v2'))['rss:clip1']);
await click({reelsClose:''});
assert.match(node('app').innerHTML,/class="reels-shelf"/);
assert.ok(!node('app').innerHTML.includes('reels-scroll'));
console.log('Orbit Reels smoke tests passed: discovery, playback, private Like, unlike, independent Save, Next and exit');
