/* Orbit discovery: explicit choices only; setup stays local to this browser. */
(()=>{'use strict';
const KEY='orbit_discovery_v1',DRAFT='orbit_setup_draft_v1';
const topics=['Music','Gaming','Travel','Anime','AI & Tech','Comedy','Animals','Fitness','Science','Entertainment','World','Business','Dragon Ball','Discover'];
const details={Music:['New releases','Guitar','Music production','Live music'],Gaming:['PC gaming','Nintendo','PlayStation','Indie games'],Travel:['Food & culture','City breaks','Outdoors','Budget travel'],Anime:['New series','Manga','Animation'], 'AI & Tech':['AI tools','Robotics','Gadgets'],Comedy:['Stand-up','Sketches','Funny clips'],Animals:['Wildlife','Dogs','Cats'],Fitness:['Strength','Running','Nutrition'],Science:['Space','Nature','Engineering'],Entertainment:['Movies','TV','Behind the scenes'],World:['Global news','Culture','Environment'],Business:['Startups','Design','Creative work'],'Dragon Ball':['Dragon Ball Z','Dragon Ball Super','Manga'],Discover:['Art','History','New hobbies']};
const matches={'New releases':/new (album|single|release)|debut|album|release/i,Guitar:/guitar|riff|guitarist/i,'Music production':/produc|mixing|studio|daw|recording/i,'Live music':/live|tour|concert|festival/i,'PC gaming':/pc|steam|computer/i,Nintendo:/nintendo|zelda|mario|switch/i,PlayStation:/playstation|ps5|sony/i,'Indie games':/indie|independent game/i,'Food & culture':/food|cultur|cuisine/i,'City breaks':/city|cities|urban/i,Outdoors:/outdoor|hik|mountain|nature/i,'Budget travel':/budget|cheap|affordable|backpack/i};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key)=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
function clean(raw){if(!raw||typeof raw!=='object')return null;return {topics:Array.isArray(raw.topics)?raw.topics.filter(t=>topics.includes(t)):[],details:Array.isArray(raw.details)?raw.details.filter(d=>Object.values(details).flat().includes(d)):[],mix:['balanced','read','watch'].includes(raw.mix)?raw.mix:'balanced',discovery:['familiar','balanced','adventurous'].includes(raw.discovery)?raw.discovery:'balanced',complete:raw.complete===true};}
let prefs=clean(read(KEY)),draft=null,step=0,dialog=null,previousFocus=null;
const selected=()=>prefs?.topics?.length?prefs.topics:Object.entries(window.OrbitFeed.preferences().weights).filter(([t,w])=>w>=16&&topics.includes(t)).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([t])=>t);
const labelMix=m=>({balanced:'A bit of everything',read:'More stories',watch:'More videos'})[m];
function settings(){return '<section class="panel setup-panel"><span class="eyebrow">MAKE IT YOURS</span><h2>Your interests</h2><p>'+esc(prefs?.complete?([prefs.topics.join(', ')||'Open to everything',labelMix(prefs.mix)].join(' · ')):'Choose your interests in a few taps. No account needed.')+'</p><button type="button" class="primary-btn" data-setup-open>'+ (prefs?.complete?'Edit my Orbit':'Personalise my Orbit')+'</button><p class="small">Your mix and finer interests stay in this browser. Topic priorities can sync when you sign in.</p></section>';}
function home(items,active){
 const chosen=selected();
 return '<div class="space-tabs" aria-label="Your topic spaces"><button type="button" data-space="All" aria-pressed="'+(active==='All')+'">Everything</button>'+chosen.map(t=>'<button type="button" data-space="'+esc(t)+'" aria-pressed="'+(active===t)+'">'+esc(t)+'</button>').join('')+'<button type="button" data-setup-open aria-label="Edit your interests">Edit interests</button></div>';
}
function score(p){if(!prefs?.complete)return 0;let n=0;const familiar=prefs.topics.includes(p.category);if(familiar)n+=prefs.discovery==='familiar'?24:prefs.discovery==='adventurous'?5:14;else if(prefs.discovery==='adventurous')n+=10;if(prefs.mix==='read'&&p.media_type==='article')n+=28;if(prefs.mix==='watch'&&p.media_type==='video')n+=28;const text=p.title+' '+(p.summary||'');for(const detail of prefs.details){const re=matches[detail];if(re?re.test(text):text.toLowerCase().includes(detail.toLowerCase()))n+=12;}return Math.min(75,n);}
function start(){
 if(dialog)return;
 previousFocus=document.activeElement;window.OrbitFeed.pause();
 draft=clean(read(DRAFT))||{topics:[...selected()],details:[...(prefs?.details||[])],mix:prefs?.mix||'balanced',discovery:prefs?.discovery||'balanced'};step=0;
 dialog=document.createElement('dialog');dialog.className='orbit-setup';dialog.setAttribute('aria-labelledby','setup-title');document.body.appendChild(dialog);document.body.classList.add('setup-open');
 dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss()});dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const els=[...dialog.querySelectorAll('button:not([disabled]),input,a[href]')];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}});
 draw();dialog.showModal();dialog.querySelector('[data-setup-dismiss]')?.focus();
}
function dismiss(){if(!dialog)return;write(DRAFT,draft);dialog.close();dialog.remove();dialog=null;document.body.classList.remove('setup-open');window.OrbitFeed.refresh();previousFocus?.focus?.();}
function option(value,title,description,kind){return '<button type="button" class="setup-choice" data-setup-'+kind+'="'+value+'" aria-pressed="'+(draft[kind]===value)+'"><span><b>'+title+'</b><small>'+description+'</small></span><span class="choice-radio" aria-hidden="true"></span></button>';}
function draw(){
 let content='';
 if(step===0)content='<h1 id="setup-title">What are you into?</h1><p>Pick a few things you love. You can always change your mind.</p><div class="topic-grid">'+topics.map((t,i)=>'<button type="button" data-setup-topic="'+esc(t)+'" aria-pressed="'+draft.topics.includes(t)+'"><span class="topic-index">'+String(i+1).padStart(2,'0')+'</span>'+esc(t)+'<span class="topic-check" aria-hidden="true">'+(draft.topics.includes(t)?'✓':'+')+'</span></button>').join('')+'</div>';
 if(step===1)content='<span class="eyebrow">A LITTLE MORE YOU</span><h1 id="setup-title">Anything more specific?</h1><p>Into the whole topic, or just one part? Everything here is optional.</p>'+(draft.topics.length?draft.topics.map(t=>'<fieldset class="detail-group"><legend>'+esc(t)+'</legend><div class="detail-chips">'+details[t].map(d=>'<button type="button" data-setup-detail="'+esc(d)+'" aria-pressed="'+draft.details.includes(d)+'">'+esc(d)+'</button>').join('')+'</div></fieldset>').join(''):'<div class="setup-note">A wide-open start. Orbit will offer a mix of topics, and you can choose more later.</div>');
 if(step===2)content='<span class="eyebrow">SET THE PACE</span><h1 id="setup-title">How do you like<br>to explore?</h1><p>A starting point for your Home feed. Every format stays available.</p><h2 class="setup-label">Your mix</h2>'+option('balanced','A bit of everything','Stories and videos, side by side.','mix')+option('read','More stories','Make room for a good read.','mix')+option('watch','More videos','Let the pictures do the talking.','mix')+'<h2 class="setup-label">How far should we wander?</h2>'+option('familiar','Close to home','More of the interests you chose.','discovery')+option('balanced','A little curious','Your favourites, with a few detours.','discovery')+option('adventurous','Surprise me','Give unfamiliar topics more room.','discovery');
 if(step===3)content='<span class="eyebrow">READY WHEN YOU ARE</span><h1 id="setup-title">This is your Orbit.</h1><p>One quick look. Your choices only take effect when you save.</p><div class="setup-recap"><h2>Your interests</h2><p>'+esc(draft.topics.join(' · ')||'A wide-open mix')+'</p>'+(draft.details.length?'<h2>The little details</h2><p>'+esc(draft.details.join(' · '))+'</p>':'')+'<h2>Your pace</h2><p>'+labelMix(draft.mix)+' · '+({familiar:'Close to home',balanced:'A little curious',adventurous:'Surprise me'})[draft.discovery]+'</p></div><div class="setup-note"><b>Private starts here.</b><p>No public profile. No automatic access to your conversations. Your mix and finer interests stay in this browser. Topic priorities can sync if you sign in. Likes are private; simply viewing a post does not train your feed.</p></div><p class="small">Optional account and YouTube connections, and reviewed AI interest imports, are available later in You.</p>';
 dialog.innerHTML='<div class="setup-top"><span class="logo">orbit<span class="logo-dot">.</span></span><button type="button" data-setup-dismiss aria-label="Close setup">×</button></div><div class="setup-progress" aria-label="Step '+(step+1)+' of 4">'+[0,1,2,3].map(i=>'<span class="'+(i<=step?'done':'')+'"></span>').join('')+'</div><div class="setup-body">'+content+'</div><footer class="setup-footer"><div><button type="button" class="setup-back" '+(step===0?'data-setup-dismiss':'data-setup-back')+'>'+(step===0?'Maybe later':'← Back')+'</button><span class="small">'+(step+1)+' / 4</span></div><button type="button" class="primary-btn" data-setup-next>'+(step===3?'Make it mine':'Continue →')+'</button></footer>';
 dialog.scrollTop=0;
}
function status(message){const t=document.getElementById('toast');if(t){t.textContent=message;t.hidden=false;setTimeout(()=>{t.hidden=true},3500)}}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.setupOpen!==undefined){start();return}
 if(d.space!==undefined){window.OrbitFeed.filter(d.space);return}
 if(d.story){window.OrbitFeed.open(d.story);return}
 if(!dialog||!dialog.contains(b))return;
 if(d.setupDismiss!==undefined){dismiss();return}
 if(d.setupTopic){draft.topics=draft.topics.includes(d.setupTopic)?draft.topics.filter(t=>t!==d.setupTopic):[...draft.topics,d.setupTopic];draft.details=draft.details.filter(x=>draft.topics.some(t=>details[t].includes(x)));}
 else if(d.setupDetail){draft.details=draft.details.includes(d.setupDetail)?draft.details.filter(x=>x!==d.setupDetail):[...draft.details,d.setupDetail];}
 else if(d.setupMix){draft.mix=d.setupMix;}
 else if(d.setupDiscovery){draft.discovery=d.setupDiscovery;}
 else if(d.setupBack!==undefined){step=Math.max(0,step-1);}
 else if(d.setupNext!==undefined){if(step===3){const result={...draft,complete:true};if(!write(KEY,result)){status('Your browser could not save setup. Please allow site storage and try again.');return}prefs=result;window.OrbitFeed.applyTopics(draft.topics);try{localStorage.removeItem(DRAFT)}catch{}dialog.close();dialog.remove();dialog=null;document.body.classList.remove('setup-open');window.OrbitFeed.filter('All');status('Your feed preferences are saved.');return}step++;}
 else return;
 write(DRAFT,draft);const focusAttr=d.setupTopic?'data-setup-topic':d.setupDetail?'data-setup-detail':d.setupMix?'data-setup-mix':d.setupDiscovery?'data-setup-discovery':null;const value=focusAttr?b.getAttribute(focusAttr):null;const scroll=dialog.scrollTop;draw();if(focusAttr){[...dialog.querySelectorAll('['+focusAttr+']')].find(x=>x.getAttribute(focusAttr)===value)?.focus();dialog.scrollTop=scroll;}else dialog.querySelector('h1')?.setAttribute('tabindex','-1'),dialog.querySelector('h1')?.focus();
});
window.OrbitDiscovery={home,settings,score,start,mixMode:()=>prefs?.mix||'balanced',isOpen:()=>!!dialog};
window.OrbitFeed.refresh();
// Shared-post guests and returning users keep their route; onboarding is voluntary.
if(!prefs?.complete&&!read(DRAFT)&&!new URL(location.href).searchParams.has('post')){
 const hasPreferences=['orbit_weights_v2','orbit_likes_v1','orbit_bookmarks_v2'].some(k=>{const v=read(k);return v&&Object.keys(v).length});
 if(!hasPreferences)start();
}
})();
