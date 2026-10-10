import sys
import unittest
from pathlib import Path

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
