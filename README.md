# Orbit — media-first mobile prototype

A private personalised feed. Likes are private recommendation signals; there are no public like counts, follows, comments or public profiles. Accounts are optional.

## Live deployment

- Front end: GitHub Pages `https://tylerrockytheo.github.io/orbit-app/`
- News: GitHub Actions collects open RSS/Atom metadata approximately hourly into `data/feed.json` (public repo). The browser fetches the latest committed data via GitHub raw, with a Pages mirror and the existing Cloudflare Worker as fallbacks.
- Backend: Cloudflare Worker `https://orbit-api.tyler-r-theo.workers.dev/feed` remains a fallback while the static content pipeline matures.

## V35 — universal areas and typed interests

The setup now separates optional starter areas (Film & TV, Food & Cooking, Sport, Art & Design and other comparable areas) from user-defined subjects. Dragon Ball is no longer a suggested area, Entertainment is replaced, and Discover is not treated as an interest. Existing selected Dragon Ball interests migrate to custom subjects rather than being discarded.

Users can enter up to 12 specific interests, remove them, review them, and save before any external lookup occurs. Typed interests affect ranking and have their own Home filters. Pending text is added when Continue is tapped, so pressing Add is not required to preserve it. Existing source-category sliders were removed from You; onboarding is now the single interest editor.

Public article lookup currently uses Wikipedia's read-only API to retrieve real introductions and canonical source links, beyond Orbit's fixed source catalog. Background reads are explicitly labelled, with source attribution and CC BY-SA licence links; they have no invented publication date or image. Queries use no credentials and omit referrers. Up to two requests run concurrently, with timeouts, a bounded one-day browser cache, retries and per-interest no-match/unavailable states. Removing an interest removes its discoveries. Old profiles do not initiate searches until explicitly saving the new review screen.

**Limit:** This is not live publisher-news or arbitrary video discovery. The existing Cloudflare service requires sign-in to deploy that capability; the cancelled sign-in was not retried. No paid service or new infrastructure was enabled. Provider availability still depends on the public API.

## V34 — first tester round

Invite testers with `https://tylerrockytheo.github.io/orbit-app/?test=1`. First-time invitees see a brief introduction, honest feature limits, optional interest setup and a guest browse path. Normal visits and shared-post routes retain their existing behaviour. Feedback is reachable from the header and You.

The feedback form asks about repeat use, the reason, actual return visits, alternatives and blockers. Drafts stay local when browser storage is available; preview, native Share and Copy make delivery explicit. **There is no automatic collection, analytics upload or central inbox.** Testers send the report back to their inviter. No identity, account details, interests, viewed posts or imported chats are appended. Drafts can be cleared; cancellation and blocked storage retain answers in memory for the current page.

See [TESTING.md](TESTING.md) for the invitation, three-day test, private results template and proposed continue/pause rules. Browser smoke checks cover onboarding isolation, validation, escaping, drafts, preview-before-share and copy/cancel behaviour.

## V33 — varied video posts

Video posts now mix classic widescreen, video-first, square and portrait (4:5) layouts. Square and portrait thumbnail previews use centre crops. The live YouTube player stays complete and fits inside those frames, with a soft thumbnail backdrop around it; the provider's video, captions, advertising and controls are not cropped out.

Framed cards offer **Original ratio** to switch to the usual widescreen shape, and a button to return to the square/portrait layout. This changes framing in place: the same iframe keeps playing, without a new source URL or lost playback position. Per-post framing choices and random layouts stay stable through ordinary rerenders within the session. Native fullscreen still shows the original player.

## V32 — varied article posts

Website imagery now appears in the post itself rather than as a small thumbnail inside the source link. Photo posts vary between image-first, text-first with a full-width image, and a large side-photo layout. Sources without images get one of two text layouts; no picture or pull quote is invented. All layouts keep the publisher excerpt, attribution, original link and private actions.

Layout selection varies across posts and browser sessions, and an explicit Home refresh can remix it. Each post keeps its layout during ordinary scrolling, Likes, Saves and navigation within the session. Failed images collapse cleanly, and video playback and the V31 mixed-content ordering are unchanged.

## V31 — website summaries throughout Home

V30 changed presentation without protecting the main feed's content mix. Strong video Likes could still bury website articles. V31 fixes the feed composition itself.

- **All** now interleaves two article posts with each video when both formats are available; **More videos** uses one article per two videos, and **More stories** uses three articles per video. This operates after personalised ranking, so older video-heavy profiles also benefit. A depleted source pool is never padded with invented stories or repeated posts.
- Website posts show the actual publisher excerpt directly in the feed, a linked headline, domain, optional source thumbnail and **Read article** action. They use the same private Like, Save and Share controls as video posts. These are publisher summaries, not newly generated AI summaries or independent verification.
- **All / Stories / Videos** gives an immediate format choice on Home. Topic controls and hidden-topic exclusions still apply.
- Source diversity is considered within each format, and duplicate article URLs with common RSS/tracking parameters are collapsed. A non-empty video-only response no longer stops the loader from trying another source for website articles.
- The slogan, Reading Room section, decorative article graphics and serif/green/terracotta treatment have been removed. Home starts with compact controls and posts; the optional Reels shelf follows six posts.
- Added `node tests/feed-mix.mjs`: it reproduces an IGN-heavy history, then verifies article presence, format controls, fallback enrichment, missing-source behavior, hidden topics, safe rendering and duplicate removal. Existing playback and onboarding checks remain in CI.

## V30 — a more personal Orbit

- New optional four-step setup: broad interests → optional finer interests → story/video and discovery mix → review and explicit save. Music, Gaming and Travel are examples alongside the wider topic catalog. Fresh guests see setup; returning users and shared-post visitors keep their current route. Reopen it from **You → Personalise my Orbit** or **Home → Make it yours**.
- Drafts survive closing/reloading setup; dismissing never applies draft choices. Saving updates topic priorities and ranking. New guests start with neutral topic weights, rather than personalised defaults. Existing saved weights, Likes, bookmarks and playback positions are preserved until deliberately edited.
- Reading/video mix, familiarity and finer interests actually contribute to ranking; they do not promise content the current source catalog lacks. **Explore** still exposes all available formats and topics. Explicit feedback remains the learning signal, rather than passive watch tracking.
- **The Reading Room** surfaces three attributed article picks on Home. Tapping one opens the existing story viewer with publisher excerpt, original-source link, private Like, Save and Share. Topic spaces narrow Home to a chosen interest.
- Warm paper, forest-green ink, vermilion accents and editorial serif headlines replace the earlier Facebook-style chrome. Light/dark follows the device, and reduced-motion preferences are respected. Existing V29 provider playback logic remains intact.
- Setup drafts, finer interests, reading/video mix and discovery preference remain browser-local. On explicit sign-in, topic priorities follow the existing account-sync path. No automatic private-chat import, analytics or new third-party login has been added.
- Run `node tests/discovery-smoke.mjs` alongside the existing frontend checks. CI runs the new test and syntax validation.

### Remaining integration boundaries

YouTube subscription OAuth still has no client ID in the current configuration. Spotify/library imports, automatic Steam-library imports, live travel offers, AI-generated source-grounded posts and native/app-store delivery are **not connected** by this release. They require separate provider/application configuration, supported permissions or backend work. No paid API or subscription has been enabled. The existing RSS content, reviewed AI-profile import, optional configured Firebase account module and local public-clip imports remain available. Provider advertising is controlled by the original platforms.

## Main improvements

- Real posts, no placeholder anime characters or generic topic cards.
- BBC World, BBC Science, BBC Entertainment, NPR, NASA, Atlas Obscura, Anime News Network, a Dragon Ball news search, and official public YouTube channel feeds for gaming, music, technology, discoveries, travel. Each feed is independent: any source may fail or block the reader.
- Post descriptions are cleaned **publisher-provided RSS excerpts**, *not* invented AI summaries or independently fact-checked news. Cards always link to the original story.
- Genuine media thumbnails when feeds supply them; YouTube thumbnails and optional privacy-enhanced YouTube player on tap. Embedded playback is subject to creator restrictions.
- **Reels**: immersive vertical, swipe/scroll-snap video feed with an always-visible Next control, creator attribution, save/share actions and original YouTube links. A horizontal Reels strip also appears near the top of Home. The six bottom tabs are Home, World, Reels, Explore, Saved and You. Closing Reels returns you to your previous tab.
- **Reel speaker correction:** On a newly autoplayed Reel, the first speaker press explicitly requests unmute, instead of assuming the displayed volume icon means YouTube actually enabled sound. After audio has been confirmed through user interaction, the same speaker button can mute normally. The Reels icon attempts to reflect the provider's real mute state; Android/browser audio policies may still block sound.
- **Home Refresh:** A refresh fetches available metadata and changes the ordering of similarly relevant recommendations while continuing to prioritise recent material. Orbit reports when no genuinely new posts were found. It does not label old posts as new.
- Reels: on YouTube/TikTok, **tap an initially muted video to unmute**. When sound is already on, tapping pauses or resumes playback. **Only the speaker icon deliberately mutes**. Instagram/Facebook clips defer playback and volume controls to their own embeds. Swiping attempts autoplay with the current sound preference, subject to mobile browser restrictions; only one provider video remains active.
- **Continuously updated Reels**: The app records up to 500 previously viewed video IDs locally; reopening and refreshing prefer genuinely unseen short-form clips, separate from editorial Home feed videos. The queue uses publication timestamps (today first), user Likes and creator diversity. Users can **pull down at the top of Reels** or tap ↻ to refresh without leaving the viewer. A browser reload restores Reels if it was the active tab. When the available unseen catalog runs out, Orbit shows a **caught-up state**, with an explicit choice to replay older clips; it does not silently pass repeats off as new. The RSS ingestion workflow is scheduled every **15 minutes** (GitHub scheduling may run late), and Reels also checks refreshed static data during viewing.
- **Content honesty**: The pool is finite. The source catalog still depends on publishers and has no guaranteed stream of fresh uploads. Updates scheduled every 15 minutes do not create new content when sources fail. The app labels older content and never fabricates timestamps. Users may opt in to replay older clips. Browser DOM for older clips is pruned to keep long sessions performant.
- Likes and “less like this” preferences remain private on the device; passive viewing and opening a friend's shared post do not train the feed. No visible public like counts, followers or comments.
- YouTube videos still come from public RSS channels, including Shorts where available. **Public TikTok, Instagram Reel, Facebook Reel, and YouTube Shorts permalinks** can now be added in **You → Add public clips from other apps**. Those links and their categories stay in the browser, and their provider players are opened in Reels. Instagram/Facebook players may require login or disallow embeds. The app does not scrape any platform. Video length is not yet reliably classified.
- Manual interests and **local, approval-based** import of AI-generated interest profiles. The import parser operates in the browser, with no backend upload or private chat history storage.
- Save posts, filter topics, navigate tabs, and share a post without changing the recipient's feed unless they explicitly answer Yes/No/Maybe. Shared links need a post still present in current feed; durable sharing is a production TODO.
- Follows the device's light/dark setting.

## Reliable content and personalised recommendations

- Expanded attributed RSS news and discoveries from **Polygon Gaming, PC Gamer, Rock Paper Shotgun, Variety Film/TV/Music, Hollywood Reporter and NME** in addition to existing BBC, NASA, anime, travel and creator feeds. Source URLs are public syndication feeds; some may fail transiently, and a failed source never creates fake content.
- Content ingestion reserves up to **160 playable videos** and **180 article posts** so fast-moving article publishers cannot displace the video catalog.
- **YouTube RSS intermittently returns HTTP 404** for active channels. Orbit retains previously retrieved videos and offers an optional **official YouTube Data API** fallback using the private `YOUTUBE_API_KEY` GitHub Actions secret. No API key is shipped to the website.
- To activate the fallback: in [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com), enable **YouTube Data API v3** for a Google Cloud project. Create a key in **APIs & Services → Credentials**, restrict it to the YouTube Data API, and save it under GitHub repository **Settings → Secrets and variables → Actions → New repository secret** with the exact name `YOUTUBE_API_KEY`. Never paste this key into a public chat, repository file, or Orbit's front-end. The read-only playlist-items calls use Google API quota; monitor the project's quota and any billing settings. The fallback works only after you provide the secret.
- User likes/less-like signals remain local and private. **Recent explicit feedback gets more weight** than old feedback, related creator/topic preferences are preferred, and the **Options** menu explains why each post is recommended. The algorithm never pulls private conversation history automatically.
- The playback experience and light/dark UI remain independent of the source provider. Instagram/TikTok/Facebook do not offer an unrestricted general feed API here; the app currently imports public permitted permalinks rather than scraping them.

## Playback controls and multiple platforms

- **V29 — smoother loading, fewer unnecessary stalls:** Orbit keeps the current Reel's thumbnail until YouTube playback is available, instead of revealing a black player after an arbitrary 2.8-second timeout. Once the provider iframe loads, its own ad and Skip Ad controls remain accessible. A small nonblocking **Connecting…/Buffering…** label appears only when needed; after a prolonged stall, users may tap **Next clip**. Orbit never automatically skips a publisher ad.
- **Bandwidth-aware look-ahead:** A single next Reel is prepared only **after the current YouTube player is actually playing**, preventing speculative loading from competing with a stalled current clip. Browser Data Saver, slow 2G and very low reported downlink disable look-ahead. Additional media requests may still be controlled by YouTube.
- **Better progress restoration:** When YouTube initially reports zero duration, the saved playback timestamp is held until valid video duration is available and then restored once. Quick back-swipes continue reusing the cached player and playback position.
- **Flick responsiveness:** Strong fast finger swipes settle immediately, rather than forcing a second browser smooth-scroll animation that can cause rubber-band jitter. Gentle swipes retain animated settling; scrolling outside Reels remains native.
- **Ads aren't removable through embedded YouTube:** YouTube's official iframe controls its pre-roll, buffering and ad frequency. Orbit keeps the native Skip Ad area reachable when offered, and reduces reinitialisations when revisiting nearby clips. Truly ad-free/native-smooth video in Orbit would require permission to host and deliver that video itself, rather than an embedded YouTube stream.

- **Orbit V28: fast, controlled Reels swipe.** Reels now uses a finger-tracked vertical swipe with one decisive adjacent-card transition, instead of Chrome's mandatory scroll snapping/rubber-band behaviour. Fast flicks work in either direction, downward pull at the real beginning refreshes, and desktop mouse wheel / keyboard arrows are supported. Touch listeners are bound **only to Reels**, leaving the Home feed's native scrolling untouched.
- **Resume playback:** The active YouTube Reel is paused when it leaves the screen and its time is saved locally (150 recent clips, automatically pruned). One previous and one upcoming player may be kept alive; quickly swiping back reuses the exact iframe and playback time. After an older iframe is evicted, Orbit requests a seek to the saved position when the player is ready. Returning to Reels within five minutes restores the last clip rather than starting over; an explicit Refresh still requests new recommendations.
- **Warm next clip:** Unless Data Saver is enabled, Orbit prepares one upcoming YouTube iframe **muted and without autoplay** behind the poster, reducing the black-screen wait on the next swipe. At most three adjacent player iframes should be resident; old players are destroyed as the queue advances. This adds some bandwidth, so Data Saver skips prewarming.
- **Provider limitation:** Native apps can decode/stream their own videos continuously; Orbit still embeds third-party YouTube/TikTok players. Caching and prewarming reduce Orbit-caused jank and position resets but cannot guarantee native-level latency, control YouTube's buffering, or remove ads.

- **V27 feed stability:** Scrolling away pauses the embedded YouTube video without destroying it. Orbit caches a small, bounded number of recently played inline videos, so returning to one can resume the *same iframe* at its previous position rather than restarting a new ad session. Moving to another video pauses the prior player; leaving a feed tab or rerendering releases the sessions. YouTube still controls all ads and any network buffering.
- **Recover from stalled players:** Loading status appears while waiting for YouTube; after extended buffering, Orbit offers **Tap to retry**, and if YouTube refuses autoplay, a **Tap to play** fallback appears. This asks the provider to resume playback; it does not skip or suppress advertising. The sound button stays available to retry an unsuccessful unmute.
- **Sound and ad controls:** Once a user taps Sound, Orbit remembers that choice for subsequent videos *in the same browser session* and attempts audible playback where the browser permits it. Mobile browsers may require a new tap. Orbit keeps the speaker button clear of YouTube's usual lower-right **Skip Ad** area and requests provider state rather than claiming to have forced sound on.
- **Inline fullscreen:** Main-feed YouTube embeds disable YouTube's independent fullscreen navigation. Orbit provides its own fullscreen action on the feed media container, subject to Android browser fullscreen support.

- **Orbit V25 portrait Reels:** Opening Reels now attempts to autoplay the first video **muted**, rather than requiring a separate YouTube Play tap. Swiping to another Reel starts its embedded player automatically. Explicitly tapping the video enables audio (when muted) or pauses/resumes playback. Mobile browsers may still block some autoplay; Orbit shows its own compact **Play video** fallback on YouTube's official `onAutoplayBlocked` event.
- **Fullscreen without leaving Orbit:** YouTube embeds in Reels now use `playsinline=1&fs=0` and are not granted the browser `fullscreen` permission. The **Full** button in Orbit's Reels action rail requests fullscreen on **Orbit's own portrait Reels container**, retaining Like, Save, Next, scrubber and the return control. **Exit** leaves it. On unsupported/in-app browsers, portrait Reels remain available without fullscreen.
- **Third-party limits:** YouTube still owns the underlying video and any creator/advertiser controls, so publisher branding, advertising and playback restrictions cannot be eliminated through an iframe. Preserve legal original-source links and YouTube's skip-ad controls when provided.

- **Normal feed:** Longer editorial videos, trailers and explainers autoplay **muted** when sufficiently visible and stop offscreen. Fun, short creator clips are separated into Reels (the Home horizontal Reels shelf provides previews). Tap **Sound** once on a playing card to request audio; it queues the unmute until the YouTube player is ready and does not disable the button or falsely claim success before the player reports unmuted. A second tap before confirmation retries instead of muting again. Browser autoplay policies can still require user interaction and may block audible autoplay.
- **Ads:** Orbit cannot detect an ad or activate YouTube’s Skip Ad from an external custom button. The official YouTube IFrame API does not provide those actions. Orbit avoids dimming YouTube’s embedded player, reduces overlay obstruction and preserves access to the provider’s own Skip Ad button whenever offered. Some ads are non-skippable. Player / Done remains a fallback.

- **Swipe horizontally along the bottom of a playing YouTube or TikTok Reel** to seek when the provider reports a valid duration. YouTube seeking uses the official IFrame Player API; TikTok uses its documented player postMessage API. Seeking cannot bypass provider-controlled advertising. The scrubber stays disabled until playback metadata arrives.
- **Player / Done** at the top of Reels temporarily hides Orbit overlays so the original provider controls are reachable. That includes a YouTube **Skip Ad** button *when YouTube itself offers one*. Non-skippable embedded ads cannot be forced off.
- TikTok embeds use `www.tiktok.com/player/v1/...`. Public Instagram Reels use Instagram embed URLs, and public Facebook Reels use Facebook's video plugin. These are third-party players, not downloaded/rehosted clips. Some videos won't permit external playback.
- The GitHub feed builder also supports a **maintained approved-links catalog** at `data/approved-clips.json`, for publisher-approved public TikTok/Instagram/Facebook/YouTube permalinks. It is currently empty. Configured public links enter the shared feed on the next hourly GitHub Action.
- **Automatic discovery** of arbitrary TikToks, Instagram Reels and Facebook Reels is not implemented. TikTok's Display API needs an authorised creator/account and app approval; broader Meta discovery likewise requires supported API access and permissions. Public-link importing is functional, but not a substitute for those integrations.
- Viewer-imported links are kept on the user's device. We do not upload those personal lists into the public GitHub feed or collect TikTok/Instagram login credentials.

## Source/licensing notes

This is a noncommercial demonstration for testing. Displaying metadata and previews does not automatically grant commercial redistribution rights. Before commercial launch, verify each publisher's RSS, image, and video reuse terms. Do not hotlink copyrighted imagery without appropriate rights. No Instagram or TikTok scraping is involved.

## Preview locally

Run `python -m http.server 8000`, then open `http://localhost:8000` (requires feed.json generated by GitHub Actions or a working Cloudflare fallback).

Run the feed-parser tests with `python -m unittest discover -s tests -v`. Frontend smoke tests: `node tests/reels-smoke.mjs`, `node tests/providers-smoke.mjs`, and `node tests/seek-smoke.mjs`. GitHub Actions runs these checks on changes.

## Known limitations

- No automatic, independent AI news verification or generated summaries; no AI API key required.
- RSS freshness and availability are publisher-dependent, and some feeds can block automated fetching.
- GitHub-hosted metadata is public, **but individual profiles remain local browser data**. Account sync, authentication, private backup, app-store delivery, and permanent share snapshots are not yet supported.
- Scheduled GitHub Actions runs may be delayed; free GitHub hosting may be rate-limited. Debug the workflow runs in the repository's Actions tab.
- The current Cloudflare Worker has no persistence/caching; it is a fallback, not a scalable feed backend.
