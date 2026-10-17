import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../interest-engine.js',import.meta.url),'utf8');
function harness(fetcher){const storage=new Map(),calls=[],renders=[];const window={OrbitFeed:{discovered:p=>renders.push(structuredClone(p))}};const ctx=vm.createContext({window,URL,URLSearchParams,AbortController,Date,setTimeout:()=>1,clearTimeout:()=>{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:async(u,o)=>{calls.push({url:new URL(u),options:o});return fetcher(u,o)}});new vm.Script(code).runInContext(ctx);return{api:window.OrbitInterestEngine,storage,calls,renders}}
const page={pageid:123,title:'Ceramic',fullurl:'https://en.wikipedia.org/wiki/Ceramic',extract:'A ceramic is a material made from inorganic, non-metallic substances, typically shaped and hardened by heat.',index:1};
const ok=()=>({ok:true,json:async()=>({query:{pages:{123:page,999:{...page,pageid:999,title:'Disambiguation',pageprops:{disambiguation:''}},666:{...page,pageid:666,fullurl:'javascript:alert(1)'}}}})});
const app=harness(ok);
await app.api.load(['ceramics','CERAMICS','jazz guitar']);assert.equal(app.calls.length,2,'case-insensitive query deduplication');assert.equal(app.calls[0].url.hostname,'en.wikipedia.org');assert.equal(app.calls[0].url.searchParams.get('gsrsearch'),'ceramics');assert.equal(app.calls[0].options.credentials,'omit');assert.equal(app.calls[0].options.referrerPolicy,'no-referrer');
const found=app.renders.at(-1);assert.equal(found.length,1,'canonical article deduplication and disambiguation filtering');assert.deepEqual(found[0].interest_queries,['ceramics','jazz guitar']);assert.equal(found[0].published_at,null,'background reads cannot pretend to be fresh news');assert.equal(found[0].summary_status,'reference_excerpt');assert.equal(found[0].source_name,'Wikipedia');
await app.api.load(['ceramics']);assert.equal(app.calls.length,2,'cache avoids repeat requests');await app.api.retry();assert.equal(app.calls.length,3,'explicit retry bypasses cache');
await app.api.load([]);assert.equal(app.renders.at(-1).length,0,'removed interests remove discovered posts');
const broken=harness(async()=>{throw Error('Offline')});await broken.api.load(['ceramics']);assert.equal(broken.api.states()[0].status,'unavailable');assert.equal(broken.renders.at(-1).length,0);
const empty=harness(()=>({ok:true,json:async()=>({query:{pages:{}}})}));await empty.api.load(['Unknownxyz']);assert.equal(empty.api.states()[0].status,'empty','no matches is distinct from network failure');
let release;const race=harness(()=>new Promise(r=>{release=r}));const old=race.api.load(['old interest']);await Promise.resolve();await race.api.load([]);release(ok());await old;assert.equal(race.renders.at(-1).length,0,'stale requests cannot restore removed interests');
assert.equal(app.api.queryList(['x','https://example.com','  Ceramic  ','ceramic']).length,1);
console.log('Interest discovery passed: external query construction, cache, provenance, safe links, deduplication, empty/failure states and stale request isolation.');
