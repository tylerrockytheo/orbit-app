import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Public Firebase Web App credentials identify the configured project;
// do not include service account keys, client secrets or refresh tokens.
const context=vm.createContext({window:{}});
const text=fs.readFileSync(new URL('../orbit-config.js',import.meta.url),'utf8');
new vm.Script(text,{filename:'orbit-config.js'}).runInContext(context);
const config=context.window.ORBIT_CONFIG;
assert.equal(config.firebase?.projectId,'orbit-6e517');
assert.equal(config.firebase?.authDomain,config.firebase.projectId+'.firebaseapp.com');
assert.match(config.firebase.apiKey,/^AIza[\w-]+$/);
assert.match(config.firebase.appId,/^1:\d+:web:[a-f\d]+$/);
assert.ok(!('clientSecret' in config));
assert.ok(!('privateKey' in config.firebase));
assert.equal(typeof config.youtubeOAuthClientId,'string');
assert.ok(!config.youtubeOAuthClientId||config.youtubeOAuthClientId.endsWith('.apps.googleusercontent.com'));
console.log('Public Orbit Firebase project configuration is complete; no private credentials present.');
