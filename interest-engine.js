/* Public article discovery; no accounts, AI keys or hidden uploads. */
(()=>{'use strict';
const CACHE='orbit_interest_articles_v1',TTL=86400000;
let generation=0,entries=[],states=[],lastQueries=[];
const key=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const clean=s=>String(s||'').normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
function queryList(values){const seen=new Set();return(Array.isArray(values)?values:[]).filter(v=>typeof v==='string').map(clean).filter(v=>v.length>=2&&!/^https?:\/\//i.test(v)&&!seen.has(key(v))&&seen.add(key(v))).slice(0,32)}
function cache(){try{const v=JSON.parse(localStorage.getItem(CACHE));return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {}}}
function saveCache(data){try{localStorage.setItem(CACHE,JSON.stringify(Object.fromEntries(Object.entries(data).sort((a,b)=>(b[1]?.at||0)-(a[1]?.at||0)).slice(0,32))))}catch{}}
function extractPages(body,query){
 if(body?.error)throw Error('Search unavailable');
 return Object.values(body?.query?.pages||{}).filter(p=>p?.pageid>0&&typeof p.title==='string'&&typeof p.extract==='string'&&p.extract.trim().length>=45&&!Object.hasOwn(p.pageprops||{},'disambiguation')).sort((a,b)=>(a.index||0)-(b.index||0)).slice(0,3).flatMap(p=>{
  let u;try{u=new URL(p.fullurl);if(u.protocol!=='https:'||u.hostname!=='en.wikipedia.org'||!u.pathname.startsWith('/wiki/'))return []}catch{return []}
  const summary=p.extract.replace(/\s+/g,' ').trim();
  return [{id:'wiki-'+p.pageid,title:p.title.slice(0,230),source_url:u.href,source_name:'Wikipedia',category:'Knowledge',media_type:'article',summary:summary.length>430?summary.slice(0,420).replace(/\s+\S*$/,'')+'…':summary,summary_status:'reference_excerpt',published_at:null,image_url:null,interest_queries:[query]}];
 });
}
async function search(query,signal){const u=new URL('https://en.wikipedia.org/w/api.php');u.search=new URLSearchParams({action:'query',generator:'search',gsrsearch:query,gsrnamespace:'0',gsrlimit:'5',prop:'extracts|info|pageprops',exintro:'1',explaintext:'1',exsentences:'3',exlimit:'max',inprop:'url',redirects:'1',format:'json',origin:'*'});const r=await fetch(u.href,{signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('Search unavailable');return extractPages(await r.json(),query)}
function publish(){window.OrbitFeed?.discovered?.(entries)}
async function load(values,force=false){
 const run=++generation,queries=queryList(values);lastQueries=queries;entries=[];states=queries.map(query=>({query,status:'loading',count:0}));publish();if(!queries.length)return;const stored=cache();let cursor=0;
 async function next(){while(cursor<queries.length&&run===generation){const index=cursor++,query=queries[index],k=key(query);let found=[],status='ready';try{const hit=stored[k];if(!force&&hit&&Date.now()-hit.at<TTL&&Array.isArray(hit.posts))found=hit.posts.map(p=>({...p,interest_queries:[query]}));else{const c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);try{found=await search(query,c.signal)}finally{clearTimeout(timer)}stored[k]={at:Date.now(),posts:found};saveCache(stored)}if(!found.length)status='empty'}catch{status='unavailable'}if(run!==generation)return;states[index]={query,status,count:found.length};const merged=new Map(entries.map(p=>[p.source_url,p]));for(const p of found){const old=merged.get(p.source_url);if(old)old.interest_queries=[...new Set([...old.interest_queries,query])];else merged.set(p.source_url,p)}entries=[...merged.values()];publish()}}
 await Promise.all([next(),next()]);
}
window.OrbitInterestEngine={load,retry:()=>load(lastQueries,true),states:()=>states.map(s=>({...s})),normalise:clean,key,queryList};
})();
