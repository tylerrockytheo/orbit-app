import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const now=new Date();
const older='2024-02-01T10:00:00Z';
const posts=[
 {id:'older',title:'Dragon Ball retrospective',category:'Dragon Ball',source_name:'Anime channel',source_url:'https://www.youtube.com/watch?v=abcdefghijk',video_id:'abcdefghijk',published_at:older},
 {id:'today',title:'New funny gameplay',category:'Gaming',source_name:'Game creator',source_url:'https://www.youtube.com/watch?v=lmnopqrstuv',video_id:'lmnopqrstuv',published_at:now.toISOString()}
];
const listeners=new Map(), storage=new Map(),elements=new Map();
function el(id){
 if(!elements.has(id)) elements.set(id,{
  id,innerHTML:'',textContent:'',hidden:true,style:{},dataset:{},clientHeight:800,scrollTop:0,
  classList:{add(){},remove(){},toggle(){}},
  setAttribute(){},removeAttribute(){},querySelector(){return null},querySelectorAll(){return []},
  replaceChildren(){},insertAdjacentHTML(_,v){this.innerHTML+=v},scrollTo({top}){this.scrollTop=top}
 });
 return elements.get(id);
}
const document={
 body:{style:{},classList:{toggle(){}}},
 head:{appendChild(script){script.onerror?.()}},createElement(){return {}},
 getElementById:el,querySelector(){return null},querySelectorAll(){return []},
 addEventListener(name,callback){listeners.set(name,callback)}
};
const location={origin:'https://orbit.example',pathname:'/orbit/',href:'https://orbit.example/orbit/'};
const context={
 document,location,history:{replaceState(){}},
 window:{location,scrollTo(){},addEventListener(){}},navigator:{share:async()=>{},clipboard:{writeText:async()=>{}}},
 localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val)},
 fetch:async()=>({ok:true,json:async()=>({posts})}),
 URL,AbortController,Date,Math,JSON,console,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{},
 requestAnimationFrame:fn=>fn(),IntersectionObserver:class{observe(){}disconnect(){}}
};
new vm.Script(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8')).runInNewContext(context);
await new Promise(resolve=>setTimeout(resolve,20));
await listeners.get('click')({target:{closest(){return {dataset:{tab:'Reels'}}}}});
const markup=el('app').innerHTML;
assert.match(markup,/data-reel-index="0" data-reel-id="rss:today"/,'today clip must lead older high-priority videos');
assert.equal(storage.get('orbit_last_active_tab_v1'),'"Reels"','Reels tab should persist for a page reload');
await listeners.get('click')({target:{closest(){return {dataset:{reelsRefresh:''}}}}});
assert.ok(el('app').innerHTML.includes('reels-scroll')||el('app').innerHTML.includes('caught up'),'refresh stays in Reels');
assert.equal(storage.get('orbit_last_active_tab_v1'),'"Reels"');
assert.ok(!el('app').innerHTML.includes('For you</h1>'),'must not go to Home');
console.log('Freshness and Reels-refresh tests passed: today outranks stale and refresh stays in Reels');
