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
- The first video starts on a user tap; swiping to the next video attempts autoplay using the previous sound preference. **Tap anywhere on the playing video** to mute/unmute without pausing, seeking or reloading. The separate sound button works too. The site uses the official YouTube IFrame Player API with an early-command fallback; some mobile browsers may still require a tap before allowing sound. Only one video iframe stays active, so previous videos stop.
- **Continuous adaptive Reels**: No fixed “3/49” counter or frozen playlist. Orbit keeps a small buffer of upcoming clips and rebuilds only that future buffer immediately when you Like/Unlike, without replacing the current YouTube player. As you swipe, it appends more ranked clips and attempts to discover newly published videos from its GitHub-fed catalog about every 90 seconds while watching.
- **Content honesty**: The pool is finite. The content feed currently updates approximately hourly. Once all available unique clips have been queued, Orbit cycles previously shown videos and clearly labels them; it cannot provide endlessly new uploads without more provider integrations. Browser DOM for older clips is pruned to keep long sessions performant.
- Likes and “less like this” preferences remain private on the device; passive viewing and opening a friend's shared post do not train the feed. No visible public like counts, followers or comments.
- YouTube videos still come from public RSS channels, including Shorts where available. **Public TikTok, Instagram Reel, Facebook Reel, and YouTube Shorts permalinks** can now be added in **You → Add public clips from other apps**. Those links and their categories stay in the browser, and their provider players are opened in Reels. Instagram/Facebook players may require login or disallow embeds. The app does not scrape any platform. Video length is not yet reliably classified.
- Manual interests and **local, approval-based** import of AI-generated interest profiles. The import parser operates in the browser, with no backend upload or private chat history storage.
- Save posts, filter topics, navigate tabs, and share a post without changing the recipient's feed unless they explicitly answer Yes/No/Maybe. Shared links need a post still present in current feed; durable sharing is a production TODO.
- Follows the device's light/dark setting.

## Playback controls and multiple platforms

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
