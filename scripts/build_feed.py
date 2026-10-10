#!/usr/bin/env python3
"""Public, attribution-first RSS/Atom ingestion for Orbit. No API keys required.

Writes static JSON consumed by GitHub Pages. A failed feed never fails the whole job.
Does NOT scrape or republish full articles or manufacture summaries.
"""
from __future__ import annotations
import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import html
import json
import logging
import os
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'feed.json'
NOW = dt.datetime.now(dt.timezone.utc)
MAX_AGE_DAYS = 14
SOURCES = [
    # News: each source has a known category. No inference about political allegiance.
    dict(label='BBC World', category='World', url='https://feeds.bbci.co.uk/news/world/rss.xml', cap=12),
    dict(label='BBC Science', category='Science', url='https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', cap=9),
    dict(label='BBC Entertainment', category='Entertainment', url='https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', cap=10),
    dict(label='NPR World', category='World', url='https://feeds.npr.org/1004/rss.xml', cap=7),
    dict(label='NASA', category='Science', url='https://www.nasa.gov/feed/', cap=9),
    dict(label='Atlas Obscura', category='Travel', url='https://www.atlasobscura.com/feeds/latest', cap=8),
    dict(label='Anime News Network', category='Anime', url='https://www.animenewsnetwork.com/all/rss.xml', cap=12),
    # Google News returns individual article cards, not generic search links.
    dict(label='Google News · Dragon Ball', category='Dragon Ball', url='https://news.google.com/rss/search?q=site%3Aen.dragon-ball-official.com%20when%3A30d&hl=en-US&gl=US&ceid=US%3Aen', cap=8),
    dict(label='IGN · YouTube', category='Gaming', channel='UCKy1dAqELo0zrOtPkf0eTMw', cap=8),
    dict(label='Google Developers · YouTube', category='AI & Tech', channel='UC_x5XG1OV2P6uZZ5FSM9Ttw', cap=7),
    dict(label='Rick Beato · YouTube', category='Music', channel='UCJquYOG5EL82sKTfH9aMA9Q', cap=8),
    dict(label='TED · YouTube', category='Discover', channel='UCAuUUnT6oDeKwE6v1NGQxug', cap=6),
    dict(label='Wolters World · YouTube', category='Travel', channel='UCFr3sz2t3bDp6Cux08B93KQ', cap=6),
]
for s in SOURCES:
    if 'channel' in s:
        s['url'] = f'https://www.youtube.com/feeds/videos.xml?channel_id={s["channel"]}'

USER_AGENT = 'OrbitFeedPrototype/0.3 (RSS reader; +https://github.com/tylerrockytheo/orbit-app)'
NS = {'atom': 'http://www.w3.org/2005/Atom', 'media': 'http://search.yahoo.com/mrss/', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
TAG_RE = re.compile(r'<[^>]+>')
WHITESPACE_RE = re.compile(r'\s+')


def clean(value: str | None) -> str:
    s = str(value or '')
    for _ in range(3):
        s = html.unescape(s)
    s = TAG_RE.sub(' ', s)
    s = WHITESPACE_RE.sub(' ', s)
    return s.strip().replace(' \u2026', '\u2026')


def description(value: str | None) -> str | None:
    s = clean(value)
    s = re.sub(r'^(read more|continue reading)\s*[:\-\u2026]*\s*', '', s, flags=re.I)
    if len(s) < 45:
        return None
    if len(s) > 330:
        clipped = s[:330].rsplit(' ', 1)[0]
        punctuation = max(clipped.rfind('. '), clipped.rfind('! '), clipped.rfind('? '))
        s = clipped[:punctuation+1] if punctuation > 85 else clipped + '\u2026'
    return s


def datetime_iso(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    try:
        x = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        try:
            x = email.utils.parsedate_to_datetime(value)
        except (ValueError, TypeError):
            return None
    if x.tzinfo is None:
        x = x.replace(tzinfo=dt.timezone.utc)
    return x.astimezone(dt.timezone.utc).isoformat().replace('+00:00', 'Z')


def valid_http(url: str | None, only_image=False) -> str | None:
    if not url:
        return None
    url = html.unescape(url).strip()
    if not re.match(r'^https?://[^\s<>]+$', url, re.I):
        return None
    if only_image and not re.match(r'^https://', url, re.I):
        return None
    return url


def text_of(element: ET.Element | None, path: str, ns=None) -> str:
    node = element.find(path, ns or {}) if element is not None else None
    return ''.join(node.itertext()).strip() if node is not None else ''


def pick_image(el: ET.Element, description_html: str) -> str | None:
    thumb = el.find('media:thumbnail', NS)
    if thumb is not None and valid_http(thumb.get('url'), True):
        return valid_http(thumb.get('url'), True)
    for e in el.findall('media:content', NS) + el.findall('enclosure'):
        url = e.attrib.get('url')
        mime = e.attrib.get('type', '')
        if valid_http(url, True) and (mime.startswith('image/') or re.search(r'\.(jpe?g|png|webp)(\?|$)', url, re.I)):
            return url
    match = re.search(r'<img[^>]+src=["\'](https://[^"\']+)["\']', html.unescape(description_html), re.I)
    return valid_http(match.group(1), True) if match else None


def extract_items(xml: bytes, source: dict) -> list[dict]:
    root = ET.fromstring(xml)
    rss = root.findall('.//item')
    atom = [] if rss else root.findall('atom:entry', NS)
    records = []
    for entry in (rss or atom)[:source['cap']]:
        is_video = 'channel' in source
        title = clean(text_of(entry, 'title' if rss else 'atom:title', NS))
        if not title:
            continue
        if is_video:
            video_id = clean(text_of(entry, 'yt:videoId', NS))
            if not re.match(r'^[A-Za-z0-9_-]{11}$', video_id):
                continue
            url = f'https://www.youtube.com/watch?v={video_id}'
            media_group = entry.find('media:group', NS)
            raw_desc = text_of(media_group, 'media:description', NS) if media_group is not None else ''
            image = f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg'
        else:
            video_id = None
            if rss:
                url = clean(text_of(entry, 'link'))
                raw_desc = text_of(entry, 'description')
                if not raw_desc:
                    raw_desc = text_of(entry, '{http://purl.org/rss/1.0/modules/content/}encoded')
            else:
                link = entry.find('atom:link', NS)
                url = link.attrib.get('href', '') if link is not None else ''
                raw_desc = text_of(entry, 'atom:summary', NS) or text_of(entry, 'atom:content', NS)
            image = pick_image(entry, raw_desc)
        url = valid_http(url)
        if not url:
            continue
        if rss:
            published = datetime_iso(text_of(entry, 'pubDate')) or datetime_iso(text_of(entry, 'dc:date', {'dc': 'http://purl.org/dc/elements/1.1/'}))
        else:
            published = datetime_iso(text_of(entry, 'atom:published', NS)) or datetime_iso(text_of(entry, 'atom:updated', NS))
        if published:
            try:
                age = (NOW - dt.datetime.fromisoformat(published.replace('Z','+00:00'))).total_seconds()/86400
                if age > MAX_AGE_DAYS or age < -2:
                    continue
            except ValueError:
                pass
        # Never label publisher-provided text as AI writing. We don't access full articles.
        summary = description(raw_desc)
        if summary and clean(summary).casefold() == title.casefold():
            summary = None
        stable = hashlib.sha256((source['label'] + '|' + url).encode()).hexdigest()[:18]
        category = source['category']
        if category == 'Gaming' and re.search(r'\b(trailer|gameplay|review|games|gaming|indie|unreal|steam)\b', title, re.I) is None:
            # Official gaming channel posts also include film; don't falsely classify them as gaming.
            category = 'Entertainment'
        records.append({
            'id': stable,
            'title': title[:220],
            'category': category,
            'summary': summary,
            'summary_status': 'publisher_excerpt' if summary else 'unavailable',
            'source_name': source['label'],
            'source_url': url,
            'published_at': published,
            'image_url': image,
            'media_type': 'video' if video_id else 'article',
            'video_id': video_id,
            'topics': [category],
        })
    return records


def fetch_source(source: dict) -> tuple[str, list[dict], str | None]:
    url = source['url']
    try:
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*'})
        with urllib.request.urlopen(req, timeout=13) as resp:
            # 1 MiB cap protects the workflow from feeds with enormous posts.
            raw = resp.read(1_000_001)
            if len(raw) > 1_000_000:
                raise ValueError('feed exceeds 1MiB')
        items = extract_items(raw, source)
        return source['label'], items, None
    except Exception as e:
        return source['label'], [], f'{type(e).__name__}: {str(e)[:120]}'


def load_previous() -> list[dict]:
    try:
        return json.loads(OUT.read_text(encoding='utf-8')).get('posts', [])
    except (FileNotFoundError, ValueError, OSError):
        return []


def keep_previous(posts: list[dict]) -> list[dict]:
    cutoff = NOW - dt.timedelta(days=MAX_AGE_DAYS)
    result = []
    for post in posts:
        try:
            when = dt.datetime.fromisoformat(post['published_at'].replace('Z', '+00:00'))
        except (ValueError, KeyError, TypeError, AttributeError):
            continue
        if when >= cutoff:
            result.append(post)
    return result


def collect(fetcher=fetch_source) -> dict:
    previous = keep_previous(load_previous())
    fetched = []
    stats = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for name, items, error in pool.map(fetcher, SOURCES):
            stats.append({'name': name, 'items': len(items), 'error': error})
            logging.info('%s: %s records%s', name, len(items), ' (%s)' % error if error else '')
            fetched.extend(items)
    if not fetched and not previous:
        raise RuntimeError('No public feeds responded and no prior data available; refusing empty deployment')
    posts_by_id = {p['id']: p for p in previous}
    for post in fetched:
        old = posts_by_id.get(post['id'])
        if old and not post.get('summary'):
            post['summary'] = old.get('summary')
            post['summary_status'] = old.get('summary_status', 'unavailable')
        if old and not post.get('image_url'):
            post['image_url'] = old.get('image_url')
        posts_by_id[post['id']] = post
    posts = sorted(posts_by_id.values(), key=lambda p: p.get('published_at') or '', reverse=True)[:220]
    return {'schema_version': 2, 'generated_at': NOW.isoformat().replace('+00:00','Z'), 'posts': posts, 'sources': stats}


def main():
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    feed = collect()
    OUT.parent.mkdir(exist_ok=True, parents=True)
    OUT.write_text(json.dumps(feed, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Wrote {len(feed["posts"])} posts to {OUT}')


if __name__ == '__main__':
    main()
