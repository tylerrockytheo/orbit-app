/* Orbit accounts: voluntary, private, never a social network.
   Firebase Auth + Firestore keep login/prefs in the user's own document.
   YouTube permission uses a separate incremental Google OAuth consent.
   No tokens or passwords are stored in GitHub, localStorage or Firestore.
*/
(()=>{
  'use strict';
  const cfg=window.ORBIT_CONFIG||{};
  const firebaseConfig=cfg.firebase;
  const configured=Boolean(firebaseConfig?.apiKey&&firebaseConfig?.authDomain&&firebaseConfig?.projectId&&firebaseConfig?.appId);
  const googleClientId=typeof cfg.youtubeOAuthClientId==='string'?cfg.youtubeOAuthClientId.trim():'';
  const state={
    configured,ready:false,loading:configured,busy:false,user:null,email:'',name:'',
    channels:[],youtubeVideos:[],youtubeToken:null,youtubeLinked:false,
    cloudReady:false,error:'',notice:'',lastSync:null
  };
  let sdk=null,auth=null,db=null,writeTimer=null,queuedPrefs=null,syncInProgress=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function announce(){
    window.dispatchEvent(new CustomEvent('orbit-account-changed',{detail:{signedIn:!!state.user,ready:state.ready}}));
  }
  function ytAnnounce(){
    window.dispatchEvent(new CustomEvent('orbit-youtube-changed',{detail:{
      channels:state.channels.map(x=>({id:x.id,title:x.title})),
      videos:state.youtubeVideos.map(x=>({...x}))
    }}));
  }
  function explain(e){
    const c=String(e?.code||'');
    if(c.includes('popup-blocked')||c.includes('popup-closed'))return 'The sign-in window was blocked or closed. Try again in your browser.';
    if(c.includes('unauthorized-domain'))return 'The Orbit website domain must be allowed in Firebase Authentication settings.';
    if(c.includes('operation-not-allowed'))return 'This sign-in method is not enabled in the Orbit Firebase project yet.';
    if(c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('invalid-email'))return 'Check your email and password.';
    if(c.includes('email-already-in-use'))return 'That email already has an account. Try signing in.';
    if(c.includes('weak-password'))return 'Please choose a password at least 6 characters long.';
    if(c.includes('permission-denied'))return 'Cloud syncing is unavailable until the private Firestore security rules are published.';
    if(c.includes('network'))return 'Could not connect. Please check your internet connection.';
    return String(e?.message||'This request could not be completed.').slice(0,240);
  }
  function change(message='',error=false){
    state.notice=error?'':message;state.error=error?message:'';
    announce();
  }
  function accountView(){
    if(!state.configured){
      return '<section class="panel orbit-account-panel"><h2>Your Orbit account</h2>'+
        '<p>Keep using Orbit privately as a guest. Account sign-in and cross-device syncing are not enabled by the developer yet.</p>'+
        '<p class="small">Once configured, signing in will be optional. Other users will not need API keys or developer accounts.</p></section>';
    }
    if(state.loading){
      return '<section class="panel orbit-account-panel"><h2>Orbit account</h2><p>Checking sign-in…</p></section>';
    }
    let content='';
    if(!state.user){
      content='<p>Sign in to save your Likes, interests and bookmarks across your devices. No public profile, followers or comments.</p>'+
        '<button class="primary-btn" type="button" data-account-action="google">Continue with Google</button>'+
        '<div class="orbit-account-divider">or use email</div>'+
        '<label for="orbit-auth-email">Email</label><input id="orbit-auth-email" type="email" autocomplete="email" placeholder="you@example.com">'+
        '<label for="orbit-auth-password">Password</label><input id="orbit-auth-password" type="password" autocomplete="current-password" placeholder="Your password">'+
        '<div class="inline-actions"><button class="secondary-btn" type="button" data-account-action="email-signin">Sign in</button>'+
        '<button class="secondary-btn" type="button" data-account-action="email-signup">Create account</button></div>';
    }else{
      content='<div class="orbit-account-identity"><strong>'+esc(state.name||state.email||'Private Orbit member')+
        '</strong><span>'+esc(state.email)+'</span></div>'+
        '<p class="small">'+(state.cloudReady?'Your private preferences sync to your account.':'Signed in; cloud preferences may still be loading.')+'</p>'+
        '<div class="inline-actions"><button class="secondary-btn" type="button" data-account-action="signout">Sign out</button></div>';
      content+='<div class="orbit-account-youtube"><h3>YouTube subscriptions</h3>'+
        '<p>Optionally connect YouTube so Orbit can recommend videos from channels you subscribe to. Orbit reads only subscribed channel IDs and names—not watch history.</p>';
      if(!googleClientId){
        content+='<p class="small">YouTube account connection needs a one-time developer OAuth setup.</p>';
      }else{
        content+='<button type="button" class="secondary-btn" data-account-action="youtube">'+
          (state.channels.length?'Refresh YouTube subscriptions':'Connect YouTube')+'</button>';
      }
      if(state.channels.length){
        content+='<p class="small">'+state.channels.length+' subscribed channels and '+state.youtubeVideos.length+' recent videos imported. Access tokens are not saved.</p>'+
          '<div class="learned-interests">'+state.channels.slice(0,8).map(x=>'<span class="learned-pill">'+esc(x.title)+'</span>').join('')+'</div>'+
          '<button type="button" class="secondary-btn" data-account-action="youtube-disconnect">Remove imported subscriptions</button>';
      }
      content+='</div>';
    }
    return '<section class="panel orbit-account-panel"><h2>Your private account</h2>'+content+
      (state.error?'<p class="orbit-account-error" role="alert">'+esc(state.error)+'</p>':'')+
      (state.notice?'<p class="orbit-account-notice" role="status">'+esc(state.notice)+'</p>':'')+
      '<p class="small">Guest browsing always works. Signing in does not connect any social features. YouTube access is separately authorised.</p></section>';
  }
  function validPrefs(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    const allowed=['weights','muted','likes','lessLiked','bookmarks','tentative','importedClips'];
    const result={};
    for(const k of allowed){
      if(Object.prototype.hasOwnProperty.call(raw,k) && raw[k]!=null)result[k]=raw[k];
    }
    return result;
  }
  async function savePrefsNow(){
    if(!state.user||!state.cloudReady||!db||!queuedPrefs||syncInProgress)return;
    const prefs=queuedPrefs;queuedPrefs=null;syncInProgress=true;
    try{
      await sdk.setDoc(sdk.doc(db,'users',state.user.uid,'private','preferences'),{
        schema:1,preferences:prefs,updatedAt:sdk.serverTimestamp()
      },{merge:true});
      state.lastSync=new Date().toISOString();
      state.error='';
    }catch(e){
      state.error='Could not sync preferences: '+explain(e);
      // Keep local preferences safely in the app; do not spam retries.
      announce();
    }finally{
      syncInProgress=false;
      if(queuedPrefs)writeTimer=setTimeout(savePrefsNow,1200);
    }
  }
  function saveLocal(snapshot){
    const cleaned=validPrefs(snapshot);
    if(!cleaned||!state.cloudReady||!state.user)return;
    queuedPrefs=cleaned;
    clearTimeout(writeTimer);
    writeTimer=setTimeout(savePrefsNow,900);
  }
  async function readCloud(user){
    state.cloudReady=false;
    state.channels=[];state.youtubeVideos=[];ytAnnounce();
    const path=sdk.doc(db,'users',user.uid,'private','preferences');
    try{
      const document=await sdk.getDoc(path);
      if(auth.currentUser?.uid!==user.uid)return;
      const data=document.exists()?document.data():null;
      state.channels=Array.isArray(data?.youtubeChannels)?
        data.youtubeChannels.filter(x=>typeof x?.id==='string'&&/^UC[A-Za-z0-9_-]{22}$/.test(x.id))
          .slice(0,500).map(x=>({id:x.id,title:String(x.title||'Channel').slice(0,90)})):[];
      state.youtubeVideos=Array.isArray(data?.youtubeVideos)?data.youtubeVideos.slice(0,45):[];
      state.cloudReady=true;state.error='';
      if(data?.preferences){
        window.dispatchEvent(new CustomEvent('orbit-cloud-prefs',{detail:{prefs:validPrefs(data.preferences)}}));
      }else{
        // The cloud write is allowed only after the initial read finishes.
        window.dispatchEvent(new CustomEvent('orbit-cloud-needs-seed'));
      }
      ytAnnounce();announce();
    }catch(e){
      state.cloudReady=false;
      change('Account signed in, but cloud preferences could not be read: '+explain(e),true);
    }
  }
  async function init(){
    if(!configured){state.ready=true;announce();return}
    try{
      const version='13.0.0';
      const [appSdk,authSdk,firestoreSdk]=await Promise.all([
        import('https://www.gstatic.com/firebasejs/'+version+'/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/'+version+'/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/'+version+'/firebase-firestore.js')
      ]);
      sdk={...appSdk,...authSdk,...firestoreSdk};
      const app=appSdk.initializeApp(firebaseConfig,'orbit');
      auth=authSdk.getAuth(app);
      db=firestoreSdk.getFirestore(app);
      authSdk.onAuthStateChanged(auth,async user=>{
        state.user=user;
        state.email=user?.email||'';
        state.name=user?.displayName||'';
        state.ready=true;state.loading=false;
        state.cloudReady=false;
        if(user)await readCloud(user);
        else{state.channels=[];state.youtubeVideos=[];state.youtubeToken=null;ytAnnounce()}
        announce();
      },e=>{state.loading=false;state.ready=true;change(explain(e),true)});
    }catch(e){state.loading=false;state.ready=true;change('Account service could not load: '+explain(e),true)}
  }
  async function doLogin(action){
    if(!sdk||!auth||state.busy)return;
    // Capture typed credentials BEFORE announcing a state change: announcing
    // redraws the You tab, which otherwise clears the email/password inputs.
    const email=action==='google'?'':document.getElementById('orbit-auth-email')?.value?.trim();
    const pass=action==='google'?'':document.getElementById('orbit-auth-password')?.value||'';
    state.busy=true;state.error='';
    announce();
    try{
      if(action==='google'){
        const provider=new sdk.GoogleAuthProvider();
        await sdk.signInWithPopup(auth,provider);
      }else{
        if(!email||!pass)throw Error('Enter your email and password first.');
        if(action==='email-signup')await sdk.createUserWithEmailAndPassword(auth,email,pass);
        else await sdk.signInWithEmailAndPassword(auth,email,pass);
      }
      change('Signed in. Your private preferences can now sync.');
    }catch(e){change(explain(e),true)}
    finally{state.busy=false;announce()}
  }
  async function signOut(){
    clearTimeout(writeTimer);
    await savePrefsNow();
    if(auth)await sdk.signOut(auth);
    state.youtubeToken=null;state.channels=[];state.youtubeVideos=[];ytAnnounce();
    change('Signed out. Guest preferences remain on this device.');
  }
  async function syncYoutube(){
    if(!state.user||!db||!state.cloudReady)return;
    await sdk.setDoc(sdk.doc(db,'users',state.user.uid,'private','preferences'),{
      schema:1,youtubeChannels:state.channels.map(x=>({id:x.id,title:x.title})),youtubeVideos:state.youtubeVideos.slice(0,45),
      updatedAt:sdk.serverTimestamp()
    },{merge:true});
  }
  // Load Google's OAuth library once. A token-client request MUST come directly
  // from a button press so Android/Chrome will not block its consent popup.
  let gisPromise=null;
  function loadGis(){
    if(window.google?.accounts?.oauth2)return Promise.resolve(true);
    if(gisPromise)return gisPromise;
    gisPromise=new Promise(resolve=>{
      const script=document.createElement('script');
      script.src='https://accounts.google.com/gsi/client';
      script.async=true;script.onload=()=>resolve(Boolean(window.google?.accounts?.oauth2));
      script.onerror=()=>resolve(false);
      document.head.appendChild(script);
    });
    return gisPromise;
  }
  async function latestYouTubeUploads(channels,token){
    // PlaylistItems reads are low-quota, unlike expensive YouTube search queries.
    // Cap to 12 subscriptions and 2 recent public uploads per creator per import.
    const selected=channels.slice(0,12);
    const groups=await Promise.allSettled(selected.map(async ch=>{
      const url=new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      url.searchParams.set('part','snippet,contentDetails');
      url.searchParams.set('playlistId','UU'+ch.id.slice(2));
      url.searchParams.set('maxResults','4');
      const response=await fetch(url.toString(),{
        headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store'
      });
      if(!response.ok)return [];
      const data=await response.json();
      return (data.items||[]).map(item=>{
        const details=item.contentDetails||{},snippet=item.snippet||{};
        const vid=details.videoId||snippet.resourceId?.videoId;
        const published=details.videoPublishedAt||snippet.publishedAt;
        if(!/^[A-Za-z0-9_-]{11}$/.test(String(vid||'')))return null;
        if(!Number.isFinite(Date.parse(published||''))||Date.now()-Date.parse(published)>120*86400000)return null;
        const title=String(snippet.title||'').slice(0,180);
        if(!title||/^(private|deleted) video$/i.test(title))return null;
        return {
          id:'subscriptions:'+vid,title,category:'Discover',
          source_name:ch.title,source_url:'https://www.youtube.com/watch?v='+vid,
          published_at:published,summary:null,summary_status:'unavailable',
          media_type:'video',video_id:vid,youtube_channel_id:ch.id,
          image_url:'https://i.ytimg.com/vi/'+vid+'/hqdefault.jpg'
        };
      }).filter(Boolean).slice(0,2);
    }));
    const out=[],seen=new Set();
    for(const result of groups){
      if(result.status!=='fulfilled')continue;
      for(const row of result.value){
        if(seen.has(row.video_id))continue;
        seen.add(row.video_id);out.push(row);
      }
    }
    return out.slice(0,30);
  }
  async function importYouTube(token){
    const channels=[],seen=new Set();
    let page='',count=0;
    do{
      const url=new URL('https://www.googleapis.com/youtube/v3/subscriptions');
      url.searchParams.set('part','snippet');
      url.searchParams.set('mine','true');
      url.searchParams.set('maxResults','50');
      if(page)url.searchParams.set('pageToken',page);
      const response=await fetch(url.toString(),{
        headers:{'Authorization':'Bearer '+token,'Accept':'application/json'},
        cache:'no-store'
      });
      if(!response.ok){
        if(response.status===401)throw Error('YouTube authorisation expired. Connect again.');
        if(response.status===403)throw Error('YouTube subscriptions could not be read. Check API access and consent permissions.');
        throw Error('YouTube returned HTTP '+response.status);
      }
      const data=await response.json();
      for(const entry of data.items||[]){
        const channel=entry.snippet?.resourceId?.channelId;
        if(typeof channel!=='string'||!/^UC[A-Za-z0-9_-]{22}$/.test(channel)||seen.has(channel))continue;
        seen.add(channel);
        channels.push({id:channel,title:String(entry.snippet?.title||'Channel').slice(0,90)});
      }
      page=typeof data.nextPageToken==='string'?data.nextPageToken:'';
      count++;
    }while(page&&count<10);
    state.channels=channels;
    state.youtubeVideos=await latestYouTubeUploads(channels,token).catch(()=>[]);
    state.youtubeLinked=true;
    ytAnnounce();
    await syncYoutube();
    change(channels.length+' subscribed channels imported, with '+state.youtubeVideos.length+' recent videos available in your private feed.');
  }
  function connectYoutube(){
    if(!state.user||!state.cloudReady){change('Sign in to Orbit before importing YouTube subscriptions.',true);return}
    if(!googleClientId){change('Orbit YouTube sign-in has not been configured yet.',true);return}
    if(!window.google?.accounts?.oauth2){change('Google connection is still loading. Tap Connect YouTube again.',true);loadGis();return}
    if(state.busy)return;
    state.busy=true;announce();
    try{
      const tokenClient=window.google.accounts.oauth2.initTokenClient({
        client_id:googleClientId,
        scope:'https://www.googleapis.com/auth/youtube.readonly',
        callback:async response=>{
          try{
            if(response.error)throw Error(String(response.error));
            // Ephemeral access token only. No refresh token persisted.
            state.youtubeToken=response.access_token;
            await importYouTube(response.access_token);
          }catch(e){change(explain(e),true)}
          finally{state.busy=false;announce()}
        },
        error_callback:e=>{state.busy=false;change(explain(e),true)}
      });
      tokenClient.requestAccessToken({prompt:'consent'});
    }catch(e){state.busy=false;change(explain(e),true)}
  }
  async function disconnectYoutube(){
    if(state.busy)return;
    const token=state.youtubeToken;
    state.youtubeToken=null;state.channels=[];state.youtubeVideos=[];state.youtubeLinked=false;
    ytAnnounce();
    try{
      if(token&&window.google?.accounts?.oauth2?.revoke)
        window.google.accounts.oauth2.revoke(token,()=>{});
      if(state.user)await syncYoutube();
      change('Imported YouTube subscriptions cleared.');
    }catch(e){change('Subscriptions cleared locally; cloud update failed: '+explain(e),true)}
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-account-action]');
    if(!button)return;
    const action=button.dataset.accountAction;
    if(action==='google'||action==='email-signin'||action==='email-signup')await doLogin(action);
    else if(action==='signout'){try{await signOut()}catch(e){change(explain(e),true)}}
    else if(action==='youtube')connectYoutube();
    else if(action==='youtube-disconnect')await disconnectYoutube();
  });
  window.OrbitAccount={
    panel:accountView,
    saveLocal,
    channels:()=>state.channels.map(x=>({...x})),
    videos:()=>state.youtubeVideos.map(x=>({...x})),
    status:()=>({configured:state.configured,ready:state.ready,signedIn:!!state.user,cloudReady:state.cloudReady}),
    // The public API intentionally exposes no access tokens or credentials.
  };
  if(googleClientId)loadGis().catch(()=>{});
  init();
})();
