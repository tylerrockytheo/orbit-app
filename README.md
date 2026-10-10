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
- Reels: on YouTube/TikTok, **tap an initially muted video to unmute**. When sound is already on, tapping pauses or resumes playback. **Only the speaker icon deliberately mutes**. Instagram/Facebook clips defer playback and volume controls to their own embeds. Swiping attempts autoplay with the current sound preference, subject to mobile browser restrictions; only one provider video remains active.
- **Continuously updated Reels**: The app records up to 500 previously viewed video IDs locally; reopening and refreshing prefer genuinely unseen clips. The queue uses publication timestamps (today first), user Likes and creator diversity. Users can **pull down at the top of Reels** or tap ↻ to refresh without leaving the viewer. A browser reload restores Reels if it was the active tab. When the available unseen catalog runs out, Orbit shows a **caught-up state**, with an explicit choice to replay older clips; it does not silently pass repeats off as new. The RSS ingestion workflow is scheduled every **15 minutes** (GitHub scheduling may run late), and Reels also checks refreshed static data during viewing.
- **Content honesty**: The pool is finite. The source catalog still depends on publishers and has no guaranteed stream of fresh uploads. Updates scheduled every 15 minutes do not create new content when sources fail. The app labels older content and never fabricates timestamps. Users may opt in to replay older clips. Browser DOM for older clips is pruned to keep long sessions performant.
- Likes and “less like this” preferences remain private on the device; passive viewing and opening a friend's shared post do not train the feed. No visible public like counts, followers or comments.
- YouTube videos still come from public RSS channels, including Shorts where available. **Public TikTok, Instagram Reel, Facebook Reel, and YouTube Shorts permalinks** can now be added in **You → Add public clips from other apps**. Those links and their categories stay in the browser, and their provider players are opened in Reels. Instagram/Facebook players may require login or disallow embeds. The app does not scrape any platform. Video length is not yet reliably classified.
- Manual interests and **local, approval-based** import of AI-generated interest profiles. The import parser operates in the browser, with no backend upload or private chat history storage.
- Save posts, filter topics, navigate tabs, and share a post without changing the recipient's feed unless they explicitly answer Yes/No/Maybe. Shared links need a post still present in current feed; durable sharing is a production TODO.
- Follows the device's light/dark setting.

## Playback controls and multiple platforms

- **Normal feed:** YouTube videos automatically start **muted** when enough of the video is visible, and stop when scrolled offscreen or when another feed video takes over. Tap **Sound** on the playing card to request audio. Autoplay may be blocked by mobile browser settings or the creator.
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
