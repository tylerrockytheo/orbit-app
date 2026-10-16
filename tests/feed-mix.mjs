import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/\}\)\(\);\s*$/, 'globalThis.feedTest={selection,card};})();');
const now=new Date().toISOString();
const videos=Array.from({length:100},(_,i)=>({id:'v'+i,title:'Official gaming trailer '+i,category:i%2?'Gaming':'Entertainment',source_name:'IGN · YouTube',source_url:'https://www.youtube.com/watch?v='+String(i).padStart(11,'0'),video_id:String(i).padStart(11,'0'),published_at:now}));
const stories=Array.from({length:36},(_,i)=>({id:'s'+i,title:'Website story '+i,category:['Gaming','Music','Travel'][i%3],source_name:['PC Gamer','Music Magazine','Travel Journal'][i%3],source_url:'https://publisher'+i%3+'.example/story/'+i,summary:'A genuine publisher description explaining the story and its main point. This is an article, with an original source link.',summary_status:'publisher_excerpt',published_at:now}));
async function boot(responses,mix='balanced',muted=[]){
 const nodes=new Map(),handlers=new Map(),calls=[];
 const noop=()=>{};
 const el=id=>{if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',hidden:true,style:{},classList:{toggle:noop},querySelector:()=>null,querySelectorAll:()=>[]});return nodes.get(id)};
 const likes=Object.fromEntries(Array.from({length:80},(_,i)=>['like'+i,{category:i%2?'Gaming':'Entertainment',source_name:'IGN · YouTube',title:'Official gaming trailer',liked_at:now}]));
 const saved={'orbit_likes_v1':likes,'orbit_muted_topics_v2':muted};
 const loc={href:'https://orbit.example/',origin:'https://orbit.example',pathname:'/'};
 const context={document:{body:{style:{},classList:{toggle:noop}},getElementById:el,querySelectorAll:()=>[],addEventListener:(t,f)=>handlers.set(t,f)},window:{scrollTo:noop,addEventListener:noop,OrbitDiscovery:{mixMode:()=>mix}},location:loc,localStorage:{getItem:k=>JSON.stringify(saved[k]??null),setItem:noop},fetch:async url=>{calls.push(url);const posts=responses(url);if(posts===null)throw Error('Unavailable');return {ok:true,json:async()=>({posts,generated_at:now})}},requestAnimationFrame:noop,console,URL,Date,Math,JSON,AbortController,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:noop};
 vm.createContext(context);new vm.Script(source).runInContext(context);await new Promise(r=>setTimeout(r,30));
 return {api:context.feedTest,nodes,calls,click:dataset=>handlers.get('click')({target:{closest:()=>({dataset})}})};
}
const mixed=await boot(()=>[...videos,...stories]);
const chosen=mixed.api.selection();
assert.ok(chosen.slice(0,12).filter(p=>p.media_type==='article').length>=8,'balanced Home must include website stories despite strong historical video Likes');
assert.equal(chosen[0].media_type,'article','Home starts with a website summary');
assert.equal(new Set(chosen.map(p=>p.id)).size,chosen.length,'no repeated posts to pad the mix');
let run=0;for(const p of chosen.slice(0,45)){run=p.media_type==='video'?run+1:0;assert.ok(run<=1,'balanced Home cannot become a run of videos while stories are available')}
assert.match(mixed.nodes.get('app').innerHTML,/post--article/);assert.match(mixed.nodes.get('app').innerHTML,/A genuine publisher description/);assert.match(mixed.nodes.get('app').innerHTML,/Read article/);
await mixed.click({homeFormat:'Stories'});assert.ok(mixed.api.selection().every(p=>p.media_type==='article'),'Stories filter excludes videos');
await mixed.click({homeFormat:'Videos'});assert.ok(mixed.api.selection().every(p=>p.media_type==='video'),'Videos filter excludes articles');
const watch=await boot(()=>[...videos,...stories],'watch');assert.equal(watch.api.selection().slice(0,12).filter(p=>p.media_type==='article').length,4,'more-video preference still keeps website posts visible');
const fallback=await boot(url=>String(url).includes('./data/')?videos:stories);assert.ok(fallback.api.selection().some(p=>p.media_type==='article'),'non-empty video-only response must not suppress an available article source');assert.ok(fallback.api.selection().some(p=>p.media_type==='video'),'enrichment preserves videos');
const onlyVideos=await boot(()=>videos);assert.equal(onlyVideos.api.selection().length,100,'video-only outage keeps content usable without fake stories');
const hidden=await boot(()=>[...videos,...stories],'balanced',['Music']);assert.ok(hidden.api.selection().every(p=>p.category!=='Music'),'format balancing respects hidden topics');
const duplicates=await boot(()=>[...stories,{...stories[0],id:'duplicate',source_url:stories[0].source_url+'?utm_source=second-feed'}]);assert.equal(duplicates.api.selection().filter(p=>p.title==='Website story 0').length,1,'same story from multiple feeds appears once');
const unsafe=mixed.api.card({...chosen[0],title:'<script>bad</script>',summary:'<img onerror=bad()>',source_name:'<iframe>'});assert.doesNotMatch(unsafe,/<script>|<iframe>|<img onerror/,'publisher text must be escaped');
console.log('Feed mix tests passed: inline summaries, video-heavy history, format controls, fallback enrichment, missing stories, hidden topics and deduplication');
