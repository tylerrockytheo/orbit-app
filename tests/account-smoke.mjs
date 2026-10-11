import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Test that an unconfigured app cannot fake account sign-in or break guest mode.
// No network, credentials, or real OAuth requests are used by this test.
const listeners=new Map(),events=[];
const window={
  ORBIT_CONFIG:{firebase:null,youtubeOAuthClientId:''},
  dispatchEvent(event){events.push(event.type)},
  addEventListener(){}
};
const document={
  addEventListener(type,listener){listeners.set(type,listener)},
  getElementById(){return null}
};
class CustomEvent {
  constructor(type,options={}){this.type=type;this.detail=options.detail}
}
const context=vm.createContext({window,document,CustomEvent,URL,Date,console,Promise,setTimeout,clearTimeout});
new vm.Script(fs.readFileSync(new URL('../account.js',import.meta.url),'utf8'),{filename:'account.js'}).runInContext(context);
await new Promise(resolve=>setTimeout(resolve,0));
const account=window.OrbitAccount;
assert.ok(account,'account module should expose a safe public interface');
assert.equal(account.status().configured,false);
assert.equal(account.status().ready,true);
assert.equal(account.status().signedIn,false);
assert.deepEqual(Array.from(account.channels()),[]);
assert.match(account.panel(),/Guest mode|guest/i,'guest experience remains accessible');
assert.match(account.panel(),/not enabled/i,'must not claim working sign-in without configuration');
assert.doesNotMatch(account.panel(),/data-account-action="google"/,'no fake login button without Firebase');
assert.doesNotMatch(account.panel(),/OAuth client secret|access_token|Bearer /,'no sensitive tokens should enter UI');
assert.ok(events.includes('orbit-account-changed'),'account state event not fired');
console.log('Orbit account tests passed: honest disabled state and uninterrupted private guest mode');
