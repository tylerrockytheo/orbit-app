import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const posts=[{id:'yt1',title:'Fun challenge #shorts',category:'Comedy',source_url:'https://www.youtube.com/watch?v=abcdefghijk',source_name:'Creator',video_id:'abcdefghijk',published_at:'2026-10-10T00:00:00Z'}];
const listeners=new Map(),storage=new Map(),nodes=new Map();
function el(id){
 if(!nodes.has(id))nodes.set(id,{
   id,innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,style:{},clientHeight:750,scrollTop:0,dataset:{},
   classList:{add(){},remove(){},toggle(){},contains(){return false}},
   setAttribute(){},removeAttribute(){},replaceChildren(){},scrollTo({top}){this.scrollTop=top},
   querySelector(selector){
     if(selector==='iframe'&&this.innerHTML.includes('class="reel-frame')){
       if(this.lastMarkup!==this.innerHTML){this.lastMarkup=this.innerHTML;this.frame={contentWindow:{postMessage(){}}}}
       return this.frame;
     }return null;
   },querySelectorAll(){return []},insertAdjacentHTML(_,html){this.innerHTML+=html}
 });return nodes.get(id)
}
const document={
 body:{style:{},classList:{toggle(){}}},
 getElementById:el,querySelector(){return null},querySelectorAll(){return []},
 head:{appendChild(script){script.onerror?.()}},createElement(){return {}},
 addEventListener(type,handler){listeners.set(type,handler)}
};
const location={origin:'https://orbit.example',pathname:'/orbit/',href:'https://orbit.example/orbit/'};
const context={document,location,window:{location,scrollTo(){},addEventListener(){}},history:{replaceState(){}},
 navigator:{share:async()=>{},clipboard:{writeText:async()=>{}}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val)},
 fetch:async()=>({ok:true,json:async()=>({posts})}),requestAnimationFrame:cb=>cb(),
 IntersectionObserver:class{observe(){}disconnect(){}},URL,AbortController,Date,Math,JSON,console,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{}};
new vm.Script(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),{filename:'app.js'}).runInNewContext(context);
await new Promise(resolve=>setTimeout(resolve,25));
const click=(dataset={},id='')=>listeners.get('click')({target:{closest(){return {dataset,id}}}});
await click({tab:'You'});
assert.match(el('app').innerHTML,/Add public clips from other apps/);
const clips=[
 ['https://www.tiktok.com/@scout2015/video/6718335390845095173','Comedy','local:tiktok:6718335390845095173'],
 ['https://www.instagram.com/reel/CAabcDE_123/','Entertainment','local:instagram:CAabcDE_123'],
 ['https://www.facebook.com/reel/123456789012345','Entertainment','local:facebook:123456789012345']
];
for(const [url,topic] of clips){
 el('clip-url').value=url;el('clip-topic').value=topic;el('clip-title').value='';
 await click({},'add-clip');
}
assert.equal(JSON.parse(storage.get('orbit_imported_clips_v1')).length,3);
el('clip-url').value='https://untrusted.test/video/123';
await click({},'add-clip');
assert.equal(JSON.parse(storage.get('orbit_imported_clips_v1')).length,3,'unsupported hosts must be rejected');
await click({tab:'Reels'});
const html=el('app').innerHTML;
for(const [, , id] of clips)assert.ok(html.includes('data-reel-id="'+id+'"'),id+' must be in Reels');
assert.match(html,/data-reel-seek/);assert.match(html,/data-player-controls/);
function index(id){
 const needle='data-reel-id="'+id+'"',at=html.indexOf(needle);assert.ok(at>=0,id+' absent');
 const start=html.lastIndexOf('data-reel-index="',at)+17;
 return Number(html.slice(start,html.indexOf('"',start)));
}
const ti=index(clips[0][2]);await click({reelPlay:String(ti)});
assert.match(el('reel-media-'+ti).innerHTML,/tiktok.com\/player\/v1\/6718335390845095173/);
const ig=index(clips[1][2]);await click({reelPlay:String(ig)});
assert.match(el('reel-media-'+ig).innerHTML,/instagram.com\/reel\/CAabcDE_123\/embed/);
const fb=index(clips[2][2]);await click({reelPlay:String(fb)});
assert.match(el('reel-media-'+fb).innerHTML,/facebook.com\/plugins\/video.php/);
await click({playerControls:''});await click({playerControls:''});
await click({reelsClose:''});
assert.ok(!el('app').innerHTML.includes('id="reels-scroll"'));
console.log('Provider smoke tests passed: public import, three embeds, domain validation and native controls');
