/* Orbit V0.4 — private, media-first feed. No accounts, likes or public profiles. */
(()=>{'use strict';
const API='https://orbit-api.tyler-r-theo.workers.dev/feed';
const STATIC='./data/feed.json';
const RAW='https://raw.githubusercontent.com/tylerrockytheo/orbit-app/main/data/feed.json';
const DEFAULT_TOPICS=['Dragon Ball','Anime','AI & Tech','Gaming','Music','Fitness','Travel','World','Science','Business','Entertainment','Discover'];
const DEFAULT_WEIGHTS={'Dragon Ball':19,'Anime':11,'AI & Tech':19,'Gaming':13,'Music':13,'Fitness':10,'Travel':9,'World':8,'Science':10,'Business':12,'Entertainment':8,'Discover':8};
const icons={Reels:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m10 8 6 4-6 4z" fill="currentColor" stroke="none"/>',Home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',World:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-6 6-6 12 0 18m0-18c6 6 6 12 0 18"/>',Explore:'<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.7 4.9-4.9 2.7 2.7-4.9z"/>',Saved:'<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21l-7-4-7 4z"/>',You:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',Search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',More:'<circle cx="4" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="20" cy="12" r="1"/>',Share:'<path d="M12 16V3m0 0-4 4m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',Play:'<path d="m8 5 12 7-12 7z"/>',Close:'<path d="m5 5 14 14M19 5 5 19"/>'};
const svg=(name)=>'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+(icons[name]||icons.Explore)+'</svg>';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeLink=(s)=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
const imageLink=(s)=>{const u=safeLink(s);return u&&u.startsWith('https://')?u:null};
const store=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
let weights=read('orbit_weights_v2',DEFAULT_WEIGHTS),muted=new Set(read('orbit_muted_topics_v2',[])),bookmarks=read('orbit_bookmarks_v2',{}),tentative=new Set(read('orbit_tentative_v2',[]));
let reelsReturnTab='Home', reelActiveIndex=-1, reelsStarted=false, reelsObserver=null, requestedReel=null;
let tab='Home',filter='All',posts=[],loading=true,feedStatus='',updatedAt='',importCandidates=[],searchTerm='';
const app=document.getElementById('app'),nav=document.getElementById('navigation'),overlay=document.getElementById('overlay');
let toastTimer;
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2600)}
function persist(){store('orbit_weights_v2',weights);store('orbit_muted_topics_v2',[...muted]);store('orbit_bookmarks_v2',bookmarks);store('orbit_tentative_v2',[...tentative])}
function validPost(p){return p&&typeof p.title==='string'&&typeof p.source_url==='string'&&safeLink(p.source_url)&&typeof p.category==='string'&&p.id!==undefined}
function normalise(p,source){if(!validPost(p))return null;const category=String(p.category||'Discover');const id=String(p.id);const videoId=/^[A-Za-z0-9_-]{11}$/.test(p.video_id||'')?p.video_id:null;return {id:source+':'+id,title:String(p.title).slice(0,230),category,summary:typeof p.summary==='string'?p.summary.slice(0,440):null,summary_status:String(p.summary_status||'unavailable'),source_url:safeLink(p.source_url),source_name:String(p.source_name||new URL(p.source_url).hostname).slice(0,90),published_at:p.published_at||null,image_url:imageLink(p.image_url)|| (videoId?'https://i.ytimg.com/vi/'+videoId+'/hqdefault.jpg':null),media_type:videoId?'video':'article',video_id:videoId,topics:[category]}}
function date(s){if(!s)return 'Recent';const d=new Date(s);if(isNaN(d))return 'Recent';return d.toLocaleDateString(undefined,{day:'numeric',month:'short'})}
const elapsed=(s)=>{const t=s?new Date(s).getTime():0;const h=(Date.now()-t)/3600000;return !t||h<0?'Recent':h<1?'Just now':h<24?Math.floor(h)+'h ago':date(s)};
function interestScore(p){let n=+(weights[p.category]||0);const low=p.title.toLowerCase();if(/dragon ball|goku|vegeta/i.test(low))n+=+(weights['Dragon Ball']||0)+12;if(/anime|manga/i.test(low))n+=+(weights.Anime||0);if(/\bai\b|robot|openai|google deepmind|machine learning|gemini|\bllm\b/i.test(low))n+=+(weights['AI & Tech']||0)*.45;if(/fitness|muscle|training|bodybuild/i.test(low))n+=+(weights.Fitness||0);if(bookmarks[p.id])n+=4;return n}
function mix(items){const byCategory=new Map();for(const item of items){const group=byCategory.get(item.category)||[];group.push(item);byCategory.set(item.category,group)}for(const group of byCategory.values())group.sort((a,b)=>interestScore(b)-interestScore(a)||new Date(b.published_at||0)-new Date(a.published_at||0));const result=[];let last='';while(result.length<items.length){const groups=[...byCategory].filter(([,arr])=>arr.length);if(!groups.length)break;groups.sort((a,b)=>{const na=interestScore(a[1][0])+(a[1][0].media_type==='video'?3:0)-(a[0]===last?22:0)-result.filter(p=>p.category===a[0]).length*2;const nb=interestScore(b[1][0])+(b[1][0].media_type==='video'?3:0)-(b[0]===last?22:0)-result.filter(p=>p.category===b[0]).length*2;return nb-na});const selected=groups[0];result.push(selected[1].shift());last=selected[0]}return result}
function selection(){let items=posts.filter(p=>!muted.has(p.category));if(tab==='Saved')return Object.values(bookmarks).sort((a,b)=>new Date(b.saved_at)-new Date(a.saved_at));if(tab==='World')items=items.filter(p=>['World','Science','Health','Health & Science','Business','Politics','AI & Tech','Technology'].includes(p.category));if(tab==='Explore'){if(filter==='Videos')items=items.filter(p=>p.media_type==='video');else if(filter!=='All')items=items.filter(p=>p.category===filter);return items.sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0))}if(tab==='Search')return items.filter(p=>(p.title+' '+(p.summary||'')+' '+p.category).toLowerCase().includes(searchTerm.toLowerCase()));return mix(items)}
function imageCard(p){const img=p.image_url?'<img class="post-img" loading="lazy" src="'+escape(p.image_url)+'" alt="" onerror="this.closest(\'.media-wrap\').style.display=\'none\'">':'';if(p.video_id)return '<div class="media-wrap" id="media-'+escape(p.id)+'"><button type="button" class="video-cover" data-play="'+escape(p.id)+'" aria-label="Play video: '+escape(p.title)+'">'+img+'<span class="play-icon">'+svg('Play')+'</span></button></div>';return img?'<div class="media-wrap">'+img+'</div>':''}
const storyThemes={
  'Dragon Ball':'sunset','Anime':'sunset','Gaming':'violet','Music':'plum',
  'AI & Tech':'electric','AI':'electric','Technology':'electric',
  'World':'ocean','Politics':'ocean','Science':'aqua','Health':'aqua',
  'Health & Science':'aqua','Business':'navy','Travel':'tropical',
  'Fitness':'forest','Entertainment':'coral','Discover':'indigo'
};
function storyArtwork(p){
  const theme=storyThemes[p.category]||'indigo';
  return '<div class="story-art story-art--'+theme+'">'
    +'<span class="story-art__orbit" aria-hidden="true"></span>'
    +'<div class="story-art__content">'
    +'<div class="story-art__topic"><span class="story-art__spark" aria-hidden="true">✦</span>'+escape(p.category)+'</div>'
    +'<h2>'+escape(p.title)+'</h2>'
    +'<div class="story-art__finish" aria-hidden="true"><span></span><i></i></div>'
    +'</div></div>';
}
function card(p){
  const graphic=!p.image_url&&!p.video_id;
  const excerpt=p.summary?'<p>'+escape(p.summary)+'</p>':(p.video_id?'':'<p class="missing">Source description unavailable — read the original for details.</p>');
  const saved=!!bookmarks[p.id];
  return '<article class="post'+(graphic?' post--graphic':'')+'" data-post="'+escape(p.id)+'">'
    +'<div class="post-meta"><div class="source-avatar">'+escape(p.source_name.charAt(0).toUpperCase())+'</div>'
    +'<div class="source-meta"><span class="source-name">'+escape(p.source_name)+'</span>'
    +'<div class="source-subline">'+escape(p.category)+' · '+escape(elapsed(p.published_at))+(p.media_type==='video'?' · Video':'')+'</div></div>'
    +'<button type="button" class="dots" data-options="'+escape(p.id)+'" aria-label="Post options">'+svg('More')+'</button></div>'
    +(graphic?storyArtwork(p):'')
    +'<div class="post-copy">'+(graphic?'':'<h2>'+escape(p.title)+'</h2>')+excerpt+'</div>'
    +(graphic?'':imageCard(p))
    +'<div class="post-footer"><span>'+(p.summary_status==='publisher_excerpt'?'Publisher excerpt':p.summary_status==='publisher_description'?'Publisher description':p.summary_status==='curated_from_official'?'Official source brief':'Original source')+'</span>'
    +'<a class="source-link" href="'+escape(p.source_url)+'" target="_blank" rel="noopener noreferrer">'+(p.video_id?'Watch on YouTube':'Read source')+' ↗</a></div>'
    +'<div class="action-row"><button type="button" data-save="'+escape(p.id)+'" class="'+(saved?'active':'')+'">'+svg('Saved')+(saved?'Saved':'Save')+'</button>'
    +'<button type="button" data-share="'+escape(p.id)+'">'+svg('Share')+'Share</button>'
    +'<button type="button" data-options="'+escape(p.id)+'">'+svg('More')+'Options</button></div></article>';
}
function empty(title,msg){return '<div class="empty"><h2>'+escape(title)+'</h2><p>'+escape(msg)+'</p></div>'}

/* Reels: a private, vertically swiped video feed using real creator videos.
   Playback is initiated by a tap; subsequent clips try muted autoplay.
   YouTube's own embedding permissions and mobile autoplay rules still apply. */
function reelItems(){
  const candidates=posts.filter(p=>p.video_id&&!muted.has(p.category));
  if(!candidates.length)return [];
  const shortHint=p=>/(?:#shorts?\b|#reels?\b|#(?:spiderman|marvel|gaming|anime|music|vr|fitness|dragonball)\b)/i.test(p.title);
  const sorted=mix(candidates);
  // Soft boost for clip-like titles, without claiming their duration is verified.
  const top=sorted.filter(p=>shortHint(p));
  const rest=sorted.filter(p=>!shortHint(p));
  return mix(top).concat(mix(rest));
}
function reelShelf(){
  const clips=reelItems().slice(0,9);
  if(!clips.length)return '';
  return '<section class="reels-shelf" aria-label="Video discoveries">'
    +'<div class="reels-shelf__head"><div><h2>Reels for you</h2><p>Videos picked for your interests</p></div>'
    +'<button type="button" class="reels-shelf__all" data-open-reels>See all →</button></div>'
    +'<div class="reels-shelf__scroller">'+clips.map(p=>'<button type="button" class="reels-tile" data-open-reels="'+escape(p.id)+'" aria-label="Watch '+escape(p.title)+'">'
    +'<img src="'+escape(p.image_url||'https://i.ytimg.com/vi/'+p.video_id+'/hqdefault.jpg')+'" alt="" loading="lazy">'
    +'<span class="reels-tile__play">'+svg('Play')+'</span>'
    +'<span class="reels-tile__shade"><b>'+escape(p.title)+'</b><small>'+escape(p.category)+'</small></span></button>').join('')
    +'</div></section>';
}
function reelPoster(p){
  return '<button type="button" class="reel-poster" data-reel-play="'+escape(p.id)+'" aria-label="Play '+escape(p.title)+'">'
    +'<img src="'+escape(p.image_url||'https://i.ytimg.com/vi/'+p.video_id+'/hqdefault.jpg')+'" alt="" loading="lazy">'
    +'<span class="reel-poster__play">'+svg('Play')+'</span></button>';
}
function reelView(){
  const clips=reelItems();
  if(!clips.length)return '<div class="reels-empty"><button type="button" data-reels-close>← Back</button><h2>No videos yet</h2><p>Refresh Home later for new clips and creator videos.</p></div>';
  return '<section class="reels-view" aria-label="Swipe through videos">'
    +'<div class="reels-top"><button type="button" class="reels-exit" data-reels-close aria-label="Close reels">'+svg('Close')+'</button><b>Reels <span>For you</span></b><span class="reels-count" id="reels-count">1 / '+clips.length+'</span></div>'
    +'<div class="reels-scroll" id="reels-scroll" aria-label="Scroll up for the next video">'
    +clips.map((p,i)=>'<article class="reel" data-reel-index="'+i+'" data-reel-id="'+escape(p.id)+'" aria-label="Video '+(i+1)+': '+escape(p.title)+'">'
    +'<div class="reel-media" id="reel-media-'+i+'">'+reelPoster(p)+'</div>'
    +'<div class="reel-shade" aria-hidden="true"></div>'
    +'<div class="reel-caption"><div class="reel-tag">'+escape(p.category)+' · YouTube</div>'
    +'<strong class="reel-creator">'+escape(p.source_name)+'</strong>'
    +'<h2>'+escape(p.title)+'</h2>'
    +'<a href="'+escape(p.source_url)+'" target="_blank" rel="noopener noreferrer">Watch original ↗</a></div>'
    +'<div class="reel-actions">'
    +'<button type="button" data-save="'+escape(p.id)+'" class="'+(bookmarks[p.id]?'active':'')+'" aria-label="'+(bookmarks[p.id]?'Remove saved video':'Save video')+'">'+svg('Saved')+'<span>'+(bookmarks[p.id]?'Saved':'Save')+'</span></button>'
    +'<button type="button" data-share="'+escape(p.id)+'" aria-label="Share video">'+svg('Share')+'<span>Share</span></button>'
    +'<button type="button" data-options="'+escape(p.id)+'" aria-label="More options">'+svg('More')+'<span>Options</span></button>'
    +'<button type="button" data-reels-next="'+i+'" aria-label="Next video">↓<span>Next</span></button>'
    +'</div></article>').join('')
    +'</div></section>';
}
function resetReelPlayer(index){
  const p=reelItems()[index];
  const media=document.getElementById('reel-media-'+index);
  if(p&&media&&media.querySelector('iframe'))media.innerHTML=reelPoster(p);
}
function startReel(id,mutedPlayback=false){
  const clips=reelItems(),index=clips.findIndex(p=>p.id===id);
  if(index<0||tab!=='Reels')return;
  const p=clips[index];
  const media=document.getElementById('reel-media-'+index);
  if(!media||media.querySelector('iframe'))return;
  const origin=encodeURIComponent(location.origin);
  media.innerHTML='<iframe class="reel-frame" src="https://www.youtube-nocookie.com/embed/'+p.video_id+'?autoplay=1&playsinline=1&rel=0&enablejsapi=1&mute='+(mutedPlayback?'1':'0')+'&origin='+origin+'" title="'+escape(p.title)+'" loading="eager" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
  reelsStarted=true;
}
function setActiveReel(index){
  const clips=reelItems();
  if(index<0||index>=clips.length||index===reelActiveIndex)return;
  const previous=reelActiveIndex;
  reelActiveIndex=index;
  if(previous>=0)resetReelPlayer(previous);  // removes iframe so sound cannot continue
  document.getElementById('reels-count')?.replaceChildren(document.createTextNode((index+1)+' / '+clips.length));
  if(reelsStarted)startReel(clips[index].id,true);
}
function mountReels(){
  if(reelsObserver){reelsObserver.disconnect();reelsObserver=null}
  const scroll=document.getElementById('reels-scroll');
  if(!scroll)return;
  const cards=[...scroll.querySelectorAll('.reel')];
  if(!cards.length)return;
  reelActiveIndex=-1;
  reelsObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.isIntersecting&&entry.intersectionRatio>=.65)setActiveReel(Number(entry.target.dataset.reelIndex));
    }
  },{root:scroll,threshold:[0,.65,.9]});
  cards.forEach(card=>reelsObserver.observe(card));
  const target=requestedReel?clipsIndex(requestedReel):0;
  requestedReel=null;
  if(target>0)scroll.scrollTop=target*scroll.clientHeight;
  setActiveReel(Math.max(target,0));
}
function clipsIndex(id){return reelItems().findIndex(p=>p.id===id)}
function stopReels(){
  if(reelsObserver){reelsObserver.disconnect();reelsObserver=null}
  document.querySelectorAll('.reel-frame').forEach(f=>f.remove());
  reelsStarted=false;
  reelActiveIndex=-1;
}
function reelJump(index){
  const scroller=document.getElementById('reels-scroll');
  if(!scroller)return;
  const target=Math.max(0,Math.min(reelItems().length-1,index));
  scroller.scrollTo({top:target*scroller.clientHeight,behavior:'smooth'});
  if(target===reelActiveIndex&&target===reelItems().length-1)toast('You’re all caught up');
}
function updateReelSave(id){
  document.querySelectorAll('.reel-actions button[data-save]').forEach(b=>{
    if(b.dataset.save!==id)return;
    b.classList.toggle('active',!!bookmarks[id]);
    b.innerHTML=svg('Saved')+'<span>'+(bookmarks[id]?'Saved':'Save')+'</span>';
    b.setAttribute('aria-label',bookmarks[id]?'Remove saved video':'Save video');
  });
}

function render(){nav.innerHTML=['Home','World','Explore','Saved','You'].map(t=>'<button type="button" data-tab="'+t+'" '+(t===tab?'aria-current="page"':'')+'>'+svg(t)+'<span>'+t+'</span></button>').join('');document.getElementById('search-btn').innerHTML=svg('Search');document.getElementById('settings-btn').innerHTML=svg('You');
if(tab==='You'){app.innerHTML=profile();return}
if(tab==='Search'){app.innerHTML='<section class="section-head"><h1>Search Orbit</h1></section><div class="panel"><input id="search-input" type="search" placeholder="Search stories and videos" value="'+escape(searchTerm)+'" autocomplete="off" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:9px;background:var(--subtle);color:var(--text)"></div><div id="results">'+cardsOrEmpty(selection())+'</div>';return}
const titles={Home:'For you',World:'World & beyond',Explore:'Explore',Saved:'Saved'};const filters=['All','Videos','Dragon Ball','Anime','Gaming','Music','AI & Tech','Travel','Entertainment','Science','World','Business','Discover'];
const head='<div class="section-head"><div><h1>'+titles[tab]+'</h1><div class="small">'+(feedStatus||'Your internet, your way')+'</div></div><button type="button" class="refresh" id="refresh-feed">↻ Refresh</button></div>';
const pills=tab==='Explore'?'<div class="filters">'+filters.map(t=>'<button class="pill" type="button" data-filter="'+t+'" aria-pressed="'+String(t===filter)+'">'+t+'</button>').join('')+'</div>':'';
app.innerHTML=head+pills+(loading?'<div class="loading">Loading recent posts and videos…</div>':cardsOrEmpty(selection()));}
function cardsOrEmpty(items){if(!items.length)return empty(tab==='Saved'?'No saved posts yet':'Nothing to show here',tab==='Saved'?'Save a story or video to keep it here.':'Try another topic, or refresh to check for new stories.');return items.slice(0,75).map(card).join('')}
function profile(){return '<div class="section-head"><div><h1>Your feed</h1><div class="small">Private preferences · saved on this device</div></div></div><section class="panel"><h2>What interests you?</h2><p>Adjust how much Orbit prioritises each topic. These settings stay on your device.</p>'+DEFAULT_TOPICS.map(t=>'<label class="range-row"><span>'+escape(t)+'</span><b id="val-'+slug(t)+'">'+(weights[t]||0)+'</b><input aria-label="Priority for '+escape(t)+'" data-weight="'+escape(t)+'" type="range" min="0" max="25" value="'+(weights[t]||0)+'"></label>').join('')+'<div class="inline-actions" style="margin-top:12px"><button class="secondary-btn" id="reset-interests">Reset preferences</button></div></section><section class="panel"><h2>Import interests from your AI</h2><p>Copy this prompt into ChatGPT, Claude or Gemini. Paste the answer below and review the topics before saving. No conversation history is uploaded to Orbit.</p><button class="secondary-btn" id="copy-prompt">Copy AI profile prompt</button><h3>Paste AI response</h3><textarea id="profile-text" placeholder="Paste your AI interest profile here…"></textarea><div class="inline-actions" style="margin-top:10px"><button class="primary-btn" id="review-profile">Review interests</button></div><div id="import-preview"></div></section><section class="panel"><h2>Hidden topics</h2><p>Hidden topics do not appear in your feed.</p><div class="interests">'+([...muted].length?[...muted].map(t=>'<button data-unmute="'+escape(t)+'">'+escape(t)+' ×</button>').join(''):'<span class="small">None hidden</span>')+'</div>'+(tentative.size?'<h3>Maybe later</h3><p>'+escape([...tentative].join(', '))+'</p>':'')+'</section>'}
const AI_PROMPT='I am setting up a private personalised feed. Using only what you actually know from our conversations and available memory, list my established interests in a Markdown table with columns Interest, Strength (High/Medium/Low), and Details. Separately list possible discoveries (not confirmed interests) and any explicitly stated content exclusions. Do not include personal identifiers, private relationships, health conditions, finances, political affiliations, or other sensitive information. Distinguish genuine known preferences from one-off questions and do not invent memories.';
const TOPIC_TERMS={'Dragon Ball':/dragon ball|goku|vegeta/i,Anime:/\banime\b|\bmanga\b|solo leveling/i,'AI & Tech':/artificial intelligence|\bAI\b|machine learning|robots?|technology|computer vision|multimodal/i,Gaming:/\bgam(e|ing|es)\b|unity|unreal|video games/i,Music:/music|songwrit|recording|\bband\b|audio production/i,Fitness:/fitness|bodybuild|hypertrophy|strength train|physique/i,Travel:/travel|tourism|destinations?|thailand/i,World:/world events|international affairs|global news|current affairs|political news/i,Science:/science|space|physics|astronomy|research/i,Business:/entrepren|startup|business|saas|sales|marketing/i,Entertainment:/marvel|mcu|superhero|movies|pop culture|film|television/i,Discover:/discover|curiosity|new experiences|hobbies/i};
function parseProfile(raw){let text=String(raw||'').slice(0,45000);if(!text.trim())return [];
const marker=text.search(/(?:^|\n)#{1,5}\s*(?:1[.\)]?\s*)?(?:main interests|interests &|primary interests)/im);if(marker>=0){text=text.slice(marker);const next=text.search(/\n#{1,5}\s*(?:2[.\)]|specific franchises|content consumption|potential discoveries|suggested discoveries)/im);if(next>0)text=text.slice(0,next)}
const found=new Map();for(const line of text.split('\n')){if(!line.trim()||/^\s*\|?[-: ]+\|/.test(line))continue;const cols=line.split('|').map(x=>x.trim()).filter(Boolean);const label=cols.length>=2?cols[0]:line;const strength=cols.slice(1,3).join(' ');const weight=/\bhigh\b/i.test(strength)?20:/\bmedium\b/i.test(strength)?13:/\blow\b/i.test(strength)?6:10;
for(const [topic,re] of Object.entries(TOPIC_TERMS)){if(re.test(label)){const prior=found.get(topic);if(!prior||prior.weight<weight)found.set(topic,{topic,weight,source:label.slice(0,80)})}}
}return [...found.values()].sort((a,b)=>b.weight-a.weight)}
function showPreview(){const input=document.getElementById('profile-text');if(!input)return;importCandidates=parseProfile(input.value);const out=document.getElementById('import-preview');if(!importCandidates.length){out.innerHTML='<p>No supported topics found. Check that the AI response includes an interests table.</p>';return}out.innerHTML='<h3>Review before importing</h3><p>Nothing changes until you approve.</p>'+importCandidates.map((p,i)=>'<div class="review-row"><label><input type="checkbox" data-import="'+i+'" checked><span>'+escape(p.topic)+'</span></label><span>'+p.weight+'/25</span></div>').join('')+'<button class="primary-btn" id="approve-import" style="margin-top:12px">Approve selected topics</button>'}
function openOverlay(contents){overlay.hidden=false;overlay.innerHTML='<div class="overlay-head"><span>orbit.</span><button type="button" class="overlay-close" data-close aria-label="Close">'+svg('Close')+'</button></div><div class="overlay-inner">'+contents+'</div>';document.body.style.overflow='hidden'}
function closeOverlay(){overlay.hidden=true;overlay.innerHTML='';document.body.style.overflow='';if(new URL(location.href).searchParams.has('post')){const url=new URL(location.href);url.searchParams.delete('post');history.replaceState(null,'',url.pathname+url.search+url.hash)}}
function item(id){return posts.find(p=>p.id===id)||bookmarks[id]||null}
function sharedPost(id){const p=item(id);if(!p){openOverlay(empty('This post is not available','It may have been removed or moved out of Orbit’s current feed.'));return}openOverlay(card({...p,shared:true})+'<div class="feedback"><h3>Want more like this?</h3><p class="small">Opening a shared post never changes your feed. Only your answer can affect recommendations.</p><div class="feedback-actions"><button class="primary-btn" data-shared-answer="yes" data-topic="'+escape(p.category)+'">Yes</button><button class="secondary-btn" data-shared-answer="no" data-topic="'+escape(p.category)+'">No</button><button class="secondary-btn" data-shared-answer="maybe" data-topic="'+escape(p.category)+'">Maybe</button></div></div><div class="guest-promo"><b>Your internet, your way.</b><p>Orbit is a private personalised feed. You can browse this post without an account. App Store downloads are not available during this web preview.</p><button class="secondary-btn" data-close>Explore Orbit</button></div>')}
async function sharePost(p){const url=new URL(location.origin+location.pathname);url.searchParams.set('post',p.id);const value=url.href;try{if(navigator.share)await navigator.share({title:p.title,url:value});else if(navigator.clipboard){await navigator.clipboard.writeText(value);toast('Post link copied')}else window.prompt('Copy this post link',value)}catch(e){if(e.name!=='AbortError')toast('Unable to share right now')}}
function openOptions(p){openOverlay('<section class="panel"><h2>'+escape(p.category)+'</h2><p>Control your own recommendations. Hiding this topic does not affect anyone else.</p><div class="inline-actions"><button class="secondary-btn" data-hide-topic="'+escape(p.category)+'">Show less of '+escape(p.category)+'</button><button class="secondary-btn" data-close>Cancel</button></div></section>')}
function playing(id){const p=item(id);if(!p||!p.video_id)return;const el=document.getElementById('media-'+CSS.escape(id));if(!el)return;el.innerHTML='<iframe class="video-frame" src="https://www.youtube-nocookie.com/embed/'+p.video_id+'?autoplay=1&rel=0" title="'+escape(p.title)+'" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe><div class="video-warning">Video hosted by YouTube. If playback is restricted, use “Watch on YouTube”.</div>'}
async function fetchJson(url,ms=11000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);try{const r=await fetch(url,{signal:controller.signal,cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);const body=await r.json();if(!Array.isArray(body.posts))throw new Error('Invalid feed');return body}finally{clearTimeout(timer)}}
async function fetchFeed(force=false){loading=true;render();let data=null,origin='';const cacheBuster='?v='+Math.floor(Date.now()/(force?60000:3600000));
for(const [url,source] of [[RAW+cacheBuster,'GitHub'],[STATIC+cacheBuster,'GitHub Pages'],[API,'Cloudflare']]){try{const result=await fetchJson(url);if(result.posts.length){data=result;origin=source;break}}catch(e){console.info('Feed source unavailable',source,e.message)}}
if(data){const prefix=origin==='Cloudflare'?'cf':'rss';posts=data.posts.map(p=>normalise(p,prefix)).filter(Boolean);updatedAt=data.generated_at||'';const media=posts.filter(p=>p.media_type==='video').length;feedStatus=origin==='Cloudflare'?'Limited feed · wider sources updating soon':posts.length+' fresh posts · '+media+' videos';}else{feedStatus='Couldn’t load live stories';posts=[]}loading=false;render();const shared=new URL(location.href).searchParams.get('post');if(shared)sharedPost(shared)}
function changeTab(t){tab=t;filter='All';render();window.scrollTo({top:0,behavior:'instant'})}
document.addEventListener('input',e=>{if(e.target.matches('[data-weight]')){const k=e.target.dataset.weight;weights[k]=Number(e.target.value);document.getElementById('val-'+slug(k)).textContent=weights[k];persist()}if(e.target.id==='search-input'){searchTerm=e.target.value;document.getElementById('results').innerHTML=cardsOrEmpty(selection())}});
const slug=s=>s.replace(/[^A-Za-z0-9]/g,'-');
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if(d.tab){changeTab(d.tab);return}if(b.id==='settings-btn'){changeTab('You');return}if(b.id==='search-btn'){changeTab('Search');document.getElementById('search-input')?.focus();return}if(b.id==='refresh-feed'){await fetchFeed(true);return}if(d.filter){filter=d.filter;render();return}if(d.close!==undefined){closeOverlay();return}if(d.save){const p=item(d.save);if(!p)return;if(bookmarks[p.id])delete bookmarks[p.id];else{bookmarks[p.id]={...p,saved_at:new Date().toISOString()};const ids=Object.keys(bookmarks);if(ids.length>100)delete bookmarks[ids[0]]}persist();render();if(!overlay.hidden&&new URL(location.href).searchParams.has('post'))sharedPost(p.id);toast(bookmarks[p.id]?'Saved':'Removed from saved');return}if(d.share){const p=item(d.share);if(p)await sharePost(p);return}if(d.options){const p=item(d.options);if(p)openOptions(p);return}if(d.hideTopic){muted.add(d.hideTopic);persist();closeOverlay();render();toast('Topic hidden. Change this in You.');return}if(d.unmute){muted.delete(d.unmute);persist();render();return}if(d.play){playing(d.play);return}if(d.sharedAnswer){if(d.sharedAnswer==='yes'){weights[d.topic]=Math.max(weights[d.topic]||0,16);tentative.delete(d.topic)}if(d.sharedAnswer==='maybe')tentative.add(d.topic);persist();openOverlay('<section class="panel"><h2>Thanks</h2><p>'+(d.sharedAnswer==='yes'?'This topic is now part of your interests.':d.sharedAnswer==='maybe'?'We saved this as a maybe. It will not change your feed yet.':'Your recommendations remain unchanged.')+'</p><button class="primary-btn" data-close>Continue</button></section>');return}if(b.id==='copy-prompt'){try{await navigator.clipboard.writeText(AI_PROMPT);toast('Prompt copied')}catch{window.prompt('Copy this prompt',AI_PROMPT)}return}if(b.id==='review-profile'){showPreview();return}if(b.id==='approve-import'){const selected=importCandidates.filter((p,i)=>document.querySelector('[data-import="'+i+'"]')?.checked);for(const p of selected){weights[p.topic]=p.weight;muted.delete(p.topic)}persist();render();toast('Interests updated on your device');return}if(b.id==='reset-interests'){weights={...DEFAULT_WEIGHTS};muted.clear();persist();render();return}});
window.addEventListener('popstate',()=>{const id=new URL(location.href).searchParams.get('post');if(id)sharedPost(id);else if(!overlay.hidden)closeOverlay()});
changeTab('Home');fetchFeed();
})();
