# Orbit private accounts — one-time developer setup

## Activation status (14 October 2026)

- ✅ Firebase Web App created for project `orbit-6e517`.
- ✅ Public Web App SDK identifiers connected in `orbit-config.js`, with the frontend loading Firebase SDK 13.0.0. Firebase Web App configuration is public; no account passwords, service-account keys or OAuth secrets were committed.
- ⏳ **Not verified in Firebase Console:** Authentication Google/Email providers, authorised website domain, creation of Cloud Firestore, and publication of the owner-only security rules in `firestore.rules`. These must be completed before live sign-in and syncing can be considered ready.
- ⏳ Optional YouTube subscriptions connection still needs an OAuth Web Client ID and Google consent setup. This is separate from basic Orbit login.


Regular Orbit users will **never** need to configure Firebase, OAuth clients, APIs or GitHub. These steps are exclusively for Orbit's developer/owner. Until completed, the new account panel explains that guest mode is available and sign-in is not yet active.

## 1. Make a Firebase project (Spark/free tier is enough for prototype)

1. Open https://console.firebase.google.com/ and create one project for Orbit.
2. In **Project overview → Add app → Web**, register the Orbit web app.
3. Under **Authentication → Sign-in method**, enable **Google** and **Email/Password**. Do not enable anonymous sign-in unless intentionally wanted.
4. Under **Authentication → Settings → Authorized domains**, add `tylerrockytheo.github.io` (no `https://`, slash or repo path). Add any future real Orbit domain separately.
5. Enable **Cloud Firestore**. Choose production/locked mode initially. Paste the contents of this repository's **firestore.rules** into the Firestore Rules editor and **Publish** them **before** allowing sign-in. The data path is `users/{uid}/private/preferences` and reads/writes require the matching authenticated UID. The app has no public profile, user directory or social data.
6. **Completed:** `orbit-config.js` in the GitHub repository now contains the Firebase **Web App SDK configuration** for the Orbit project:
   ```js
   firebase: {
     apiKey: "FIREBASE_PUBLIC_WEB_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT",
     appId: "FIREBASE_WEB_APP_ID"
   },
   ```
   These are browser-side Firebase **public project identifiers**, not admin/service-account credentials. Do not upload a Firebase service-account key, private key or any Google OAuth client secret.
7. Wait for the GitHub Pages deployment. Open Orbit in Chrome on your phone and check **You → Your private account → Continue with Google** (or create an email/password account).
8. Confirm Likes sync to a second browser when signed into the same account. Confirm they are **not accessible** to a different signed-in account. Never temporarily open Firestore rules to all users to diagnose problems.

Google popup sign-in may be blocked inside some in-app browsers. Open the Orbit link in Chrome (or migrate the app to Firebase Hosting/custom-domain auth as part of the production release). GitHub Pages stays the host for this prototype.

### Firebase cost boundary
Firebase Spark provides no-cost Authentication (most methods) and Firestore quotas. Monitor quotas in Firebase. Do not assume unlimited free usage; enable billing only intentionally.

## 2. Connect optional YouTube accounts

YouTube login is a **separate opt-in permission**; signing into Orbit alone will NOT read YouTube subscriptions.

1. In the Google Cloud project where the OAuth client is created, enable **YouTube Data API v3**.
2. Configure the Google Auth Platform branding/audience and permissions. Request only the read-only scope `https://www.googleapis.com/auth/youtube.readonly`. For early testing, use Testing mode and add your own Google account as a test user. Public access to sensitive scopes may require Google verification; don't promise production access until approved.
3. Create an **OAuth 2.0 Client ID → Web application** (not a server credential).
4. Add **Authorized JavaScript origin**: `https://tylerrockytheo.github.io` (do not include `/orbit-app/`).
5. Place the **OAuth client ID only** in `orbit-config.js` as `youtubeOAuthClientId: "YOUR_CLIENT_ID.apps.googleusercontent.com"`. **Never add an OAuth client secret** to this static website.
6. In Orbit, after account login, tap **Connect YouTube** in the **You** tab. The actual Google consent screen appears. Orbit imports up to 500 subscribed channel names/IDs, plus up to two recent public uploads from each of up to twelve subscribed channels. These are stored privately in the owner's Firestore document and displayed through the normal Orbit recommendations.
7. Orbit **does not** read private YouTube watch history, playlists, or recommendations, and does not download or rehost creator videos. YouTube authorisation tokens exist in browser memory only; they aren't persisted to Firestore, the public GitHub repo, or localStorage. The user can clear imported subscriptions from Orbit, and revoke external permissions in their Google Account security settings.

### Separate server-side content source (optional)
Our scheduled feed builder already supports an optional GitHub Actions secret named `YOUTUBE_API_KEY` (a YouTube Data API key, **not** the OAuth client ID) for recovering from intermittent public RSS 404s. Add it only to **GitHub → Settings → Secrets and variables → Actions**. Never paste it in chat or `orbit-config.js`. This improves the shared public creator feed for everyone and is distinct from an individual user's YouTube connection.

## Testing and limits

- `node --check app.js`, `node --check account.js`, `node tests/account-smoke.mjs` and `node tests/reels-smoke.mjs`.
- No credentials configured: account panel must clearly remain unavailable, while Home, Reels, Likes and Saved work for guests.
- Google/email auth configured: sign-in is real, not simulated. Firebase handles password storage; Orbit does not collect passwords itself except to send credentials to Firebase Auth.
- Firestore enabled with owner-only rules: Likes/bookmarks/categories sync only under the signed-in user. On an existing account, the account's cloud preferences take precedence over guest preferences on that device.
- YouTube consent configured: imports only creator/channel IDs and a bounded set of public uploads. It **does not** give full TikTok/Instagram/Facebook access. Those integrations require their own authorised support.
- Sign out does not currently erase guest/localStorage recommendations on the device; use a private browser or clear Orbit site data on shared devices. Add an explicit local-data clearing control before general release.
- Before a public launch, prepare a privacy policy, data deletion path, verified OAuth consent branding, and a more robust account recovery/password reset flow.

## Privacy-first product direction

Accounts are optional; there are no public pages, user search, visible Like counts, follows, friend graphs or comments. Shared links do not modify another person's recommendations without their explicit answer. The account's purpose is cross-device privacy/preferences and opt-in recommendations, not social networking.
