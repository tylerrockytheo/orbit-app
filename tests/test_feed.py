import sys
import unittest
import tempfile
import json
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build_feed


class FeedTests(unittest.TestCase):
    def test_html_entity_and_markup_cleanup(self):
        self.assertEqual(build_feed.clean('It&amp;#x27;s &lt;b&gt;great&lt;/b&gt; <b>today</b>'), "It's great today")

    def test_short_or_empty_summary_not_invented(self):
        self.assertIsNone(build_feed.description('Read more'))
        self.assertIsNone(build_feed.description(None))

    def test_rss_image_and_date(self):
        src = {'label': 'BBC World', 'category': 'World', 'cap': 3}
        xml = b'''<?xml version="1.0"?><rss version="2.0"><channel><item>
        <title>World event in review</title><link>https://example.com/item/1</link>
        <pubDate>Sat, 10 Oct 2026 00:00:00 GMT</pubDate>
        <description><![CDATA[<p>A short but complete publisher summary that has enough information to understand what was announced.</p>]]></description>
        <enclosure url="https://example.com/cover.jpg" type="image/jpeg" />
        </item></channel></rss>'''
        result = build_feed.extract_items(xml, src)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['category'], 'World')
        self.assertTrue(result[0]['image_url'].endswith('cover.jpg'))
        self.assertEqual(result[0]['summary_status'], 'publisher_excerpt')
        self.assertEqual(result[0]['source_url'], 'https://example.com/item/1')
        self.assertEqual(result[0]['media_type'], 'article')

    def test_youtube_video_media_and_source(self):
        src = {'label': 'IGN · YouTube', 'category': 'Gaming', 'cap': 2, 'channel': 'ignored'}
        xml = b'''<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
        <entry><title>New indie game trailer with gameplay</title><yt:videoId>abc123ABC-0</yt:videoId>
        <published>2026-10-10T00:00:00+00:00</published><media:group><media:description>Watch this gameplay demonstration of the new trailer.</media:description></media:group>
        </entry></feed>'''
        result = build_feed.extract_items(xml, src)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['media_type'], 'video')
        self.assertEqual(result[0]['video_id'], 'abc123ABC-0')
        self.assertEqual(result[0]['source_url'], 'https://www.youtube.com/watch?v=abc123ABC-0')
        self.assertIn('i.ytimg.com', result[0]['image_url'])

    def test_approved_public_clips_are_whitelisted_and_never_rehosted(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "approved-clips.json"
            path.write_text(json.dumps({"posts": [
                {"source_url": "https://www.tiktok.com/@demo/video/6718335390845095173", "category": "Comedy"},
                {"source_url": "https://www.instagram.com/reel/CABC123_-/", "category": "Entertainment"},
                {"source_url": "https://www.facebook.com/reel/123456789012345", "category": "Gaming"},
                {"source_url": "https://www.youtube.com/shorts/abcdefghijk", "category": "Music"},
                {"source_url": "https://unsafe.example/reel/123456789012345", "category": "Comedy"},
                {"source_url": "http://www.tiktok.com/@demo/video/6718335390845095173", "category": "Comedy"}
            ]}), encoding="utf-8")
            previous = build_feed.APPROVED
            try:
                build_feed.APPROVED = path
                clips = build_feed.approved_public_clips()
            finally:
                build_feed.APPROVED = previous
            self.assertEqual(len(clips), 4)
            self.assertEqual({c["platform"] for c in clips}, {"youtube","instagram","tiktok","facebook"})
            self.assertTrue(all(c["source_url"].startswith("https://") for c in clips))
            self.assertTrue(all(c["media_type"] == "video" for c in clips))
            self.assertEqual([c["video_id"] for c in clips if c["platform"] == "tiktok"], [None])

    def test_official_youtube_api_fallback_parses_reliable_video_metadata(self):
        source = {'label': 'Dude Perfect · YouTube', 'category': 'Comedy',
                  'channel': 'UCRijo3ddMTht_IHyNSNXpNQ', 'cap': 3}
        payload = {'items': [
            {'snippet': {'title': 'New trick shot', 'description': 'A funny short demonstration of an unbelievable trick shot.',
                         'publishedAt': build_feed.NOW.isoformat(),
                         'thumbnails': {'high': {'url': 'https://example.com/image.jpg'}}},
             'contentDetails': {'videoId': 'abcdefghijk', 'videoPublishedAt': build_feed.NOW.isoformat()}},
            {'snippet': {'title': 'Private video'}, 'contentDetails': {'videoId': 'bcdefghijkl'}}
        ]}
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, *_): return json.dumps(payload).encode()
        def opener(request, timeout=12):
            self.assertIn('playlistItems?', request.full_url)
            self.assertIn('playlistId=UURijo3ddMTht_IHyNSNXpNQ', request.full_url)
            return Response()
        items = build_feed.youtube_api_fallback(source, 'test-key', opener)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['video_id'], 'abcdefghijk')
        self.assertEqual(items[0]['category'], 'Comedy')
        self.assertEqual(items[0]['media_type'], 'video')
        self.assertEqual(items[0]['source_url'], 'https://www.youtube.com/watch?v=abcdefghijk')

    def test_rss_404_uses_official_api_if_key_is_set(self):
        from urllib.error import HTTPError
        source = {'label': 'Dude Perfect · YouTube', 'category': 'Comedy',
                  'url': 'https://www.youtube.com/feeds/videos.xml?channel_id=UCRijo3ddMTht_IHyNSNXpNQ',
                  'channel': 'UCRijo3ddMTht_IHyNSNXpNQ', 'cap': 3}
        with (patch.dict('os.environ', {'YOUTUBE_API_KEY': 'private-placeholder'}),
              patch('build_feed.urllib.request.urlopen', side_effect=HTTPError(source['url'], 404, 'No feed', {}, None)),
              patch('build_feed.youtube_api_fallback', return_value=[{'video_id': 'abcdefghijk'}]) as fallback):
            name, videos, error = build_feed.fetch_source(source)
        self.assertEqual(name, source['label'])
        self.assertEqual(videos[0]['video_id'], 'abcdefghijk')
        self.assertIsNone(error)
        fallback.assert_called_once()

    def test_fallback_previous_feed_on_provider_fail(self):
        p = build_feed.OUT
        # Patch pure helpers without touching actual persistent feed file.
        before = build_feed.load_previous
        try:
            build_feed.load_previous = lambda: [{'id': 'kept', 'title': 'Known', 'category': 'Science', 'source_url': 'https://example.com', 'published_at': build_feed.NOW.isoformat()}]
            output = build_feed.collect(lambda src: (src['label'], [], 'simulated outage'))
            self.assertEqual(output['posts'][0]['id'], 'kept')
        finally:
            build_feed.load_previous = before


if __name__ == '__main__':
    unittest.main()
