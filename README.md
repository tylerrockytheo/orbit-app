# Orbit — media-first mobile prototype

A private personalised feed. **Not** a social network: Likes are private recommendation signals; there are no public like counts, follows, comments, accounts or public profiles.

## Live deployment

- Front end: GitHub Pages `https://tylerrockytheo.github.io/orbit-app/`
- News: GitHub Actions collects open RSS/Atom metadata approximately hourly into `data/feed.json` (public repo). The browser fetches the latest committed data via GitHub raw, with a Pages mirror and the existing Cloudflare Worker as fallbacks.
- Backend: Cloudflare Worker `https://orbit-api.tyler-r-theo.workers.dev/feed` remains a fallback while the static content pipeline matures.

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
