import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function harness({href='https://orbit.example/?test=1',initial={},blocked=false,shareError=null}={}){
 const storage=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));const events={};let dialog=null,formValues={},status='',copied='',shares=0,setup=0,paused=0;
 const noop=()=>{};const field={focus:noop,select:noop,setAttribute:noop};const fakeForm={};
 const node=()=>({innerHTML:'',setAttribute:noop,focus:noop,querySelector(sel){if(sel==='#beta-form')return fakeForm;if(sel==='[data-beta-status]')return {set textContent(s){status=s}};return field},addEventListener:noop,showModal:noop,close:noop,contains:()=>true,remove(){dialog=null}});
 const document={activeElement:field,body:{classList:{add:noop,remove:noop},appendChild(n){dialog=n}},createElement:node,addEventListener(type,fn){(events[type]??=[]).push(fn)}};
 const window={OrbitFeed:{settings:noop,pause(){paused++},refresh:noop,filter:noop},OrbitDiscovery:{start(){setup++}}};
 const ctx=vm.createContext({document,window,location:{href},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(blocked)throw Error('Blocked');storage.set(k,v)},removeItem(k){if(blocked)throw Error('Blocked');storage.delete(k)}},navigator:{clipboard:{async writeText(t){copied=t}},async share(){shares++;if(shareError)throw shareError}},FormData:class{get(k){return formValues[k]}},URL,console});
 new vm.Script(fs.readFileSync(new URL('../beta.js',import.meta.url),'utf8')).runInContext(ctx);
 return {api:window.OrbitBeta,storage,get html(){return dialog?.innerHTML||''},get status(){return status},get copied(){return copied},get shares(){return shares},get setup(){return setup},get paused(){return paused},async click(dataset){const b={dataset};for(const fn of events.click||[])await fn({target:{closest:()=>b}})},async submit(v){formValues=v;for(const fn of events.submit||[])await fn({target:{id:'beta-form'},preventDefault:noop})}};
}
const test=harness();
assert.match(test.html,/A feed worth coming back to/);assert.ok(test.paused>0);
assert.equal(test.shares,0,'opening an invitation cannot send feedback');
await test.click({betaStart:''});assert.equal(test.setup,1);assert.equal(test.api.isOpen(),false);assert.equal(test.storage.get('orbit_beta_seen_v1'),'true');
const returning=harness({initial:{orbit_beta_seen_v1:true}});assert.equal(returning.api.isOpen(),false,'returning testers keep their route');
const normal=harness({href:'https://orbit.example/'});assert.equal(normal.api.isOpen(),false,'normal visitors retain existing onboarding');
const shared=harness({href:'https://orbit.example/?test=1&post=abc'});assert.equal(shared.api.isOpen(),false,'a shared post is not covered by the test intro');
await test.click({betaFeedback:''});
await test.submit({again:'yes',visits:'first',reason:' ',instead:'YouTube'});assert.match(test.status,/four required/);assert.doesNotMatch(test.html,/Ready to share/);
const answers={again:'no',visits:'once',reason:'<img src=x onerror=alert(1)>',instead:'RSS reader',problem:'Buffering',device:'android',alias:'T01'};
await test.submit(answers);assert.match(test.html,/Ready to share/);assert.match(test.html,/Nothing has been sent/);assert.doesNotMatch(test.html,/<img src=x/);assert.match(test.html,/&lt;img/);assert.equal(test.shares,0,'preview is not permission to send');
await test.click({betaCopy:''});assert.match(test.copied,/Would choose Orbit again this week: No/);assert.match(test.copied,/Visits: Returned once/);assert.doesNotMatch(test.copied,/orbit_weights|apiKey|email|userAgent/);assert.match(test.status,/Paste it into a message/);assert.equal(test.shares,0,'copy must not claim or attempt delivery');
await test.click({betaFeedback:''});assert.match(test.html,/RSS reader/,'editing preserves answers');
await test.click({betaDelete:''});assert.equal(test.storage.has('orbit_beta_feedback_v1'),false);assert.doesNotMatch(test.html,/RSS reader/);
const denied=harness({blocked:true,shareError:{name:'AbortError'}});await denied.click({betaFeedback:''});await denied.submit(answers);await denied.click({betaFeedback:''});assert.match(denied.html,/RSS reader/,'answers survive in memory when browser storage is blocked');await denied.submit(answers);await denied.click({betaShare:''});assert.match(denied.status,/Sharing cancelled/);assert.match(denied.html,/Ready to share/,'cancelled share keeps preview');
const src=fs.readFileSync(new URL('../beta.js',import.meta.url),'utf8');assert.doesNotMatch(src,/\bfetch\s*\(|sendBeacon|XMLHttpRequest/,'no automatic report or analytics endpoint');
console.log('Beta checks passed: invite routing, no auto-sharing, required answers, safe preview, copy, drafts, blocked storage and cancelled share.');
