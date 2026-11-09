import importlib.util
import json
from pathlib import Path
import tempfile
import sqlite3
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('monitor', Path(__file__).with_name('guide-source-monitor.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class SourceMonitorTests(unittest.TestCase):
    def test_static_body_ignores_scripts_navigation_and_tracks_numbers(self):
        raw = b'<html><title>Official</title><nav>counter 123</nav><main><h1>Museum</h1><p>' + b'Useful visitor information. ' * 8 + b'Price 20</p><script>print("never execute")</script></main></html>'
        first = m.fingerprint(raw, 'text/html')
        self.assertEqual(first[0], m.fingerprint(raw.replace(b'counter 123', b'counter 999'), 'text/html')[0])
        self.assertNotEqual(first[0], m.fingerprint(raw.replace(b'Price 20', b'Price 21'), 'text/html')[0])
        self.assertEqual(first[1], 'static-text')
        self.assertEqual(first[2], 'Official')
    def test_http_200_shell_and_captcha_do_not_become_baselines(self):
        for body in [b'<html><div id="app"></div></html>', b'<title>Just a moment</title><p>' + b'Verify you are human. ' * 15 + b'</p>']:
            with self.assertRaises(m.PolicyError): m.fingerprint(body, 'text/html')
        self.assertEqual(m.fingerprint(b'%PDF-1.7\nexample', 'application/pdf')[1], 'raw-pdf-only')
    def test_private_addresses_and_cross_host_redirect_are_rejected(self):
        for url in ['http://example.org', 'https://127.0.0.1', 'https://localhost', 'https://user:pass@example.org', 'https://example.org:8443']:
            with self.assertRaises(m.PolicyError): m.public_url(url, resolve=False)
        with patch.object(m.socket, 'getaddrinfo', return_value=[(2,1,6,'',('10.0.0.1',443))]):
            with self.assertRaises(m.PolicyError): m.public_url('https://example.org')
        with patch.object(m, 'public_url', side_effect=lambda u: m.urllib.parse.urlsplit(u)):
            with self.assertRaises(m.PolicyError): m.Redirects().redirect_request(m.urllib.request.Request('https://official.org/'), None, 302, '', {}, 'https://other.org/')
    def test_fetch_results_distinguish_baseline_same_changed_and_failure(self):
        body = b'<main>' + b'Official visitor information. ' * 10 + b'</main>'
        fingerprint = m.fingerprint(body, 'text/html')[0]
        def inspect(previous):
            monitor = m.Monitor(previous)
            with patch.object(m, 'public_url', return_value=m.urllib.parse.urlsplit('https://official.org')), patch.object(monitor, 'robots_allowed'), patch.object(monitor, 'request', return_value=(200,'https://official.org',body,'text/html')), patch.object(m.time, 'sleep'):
                return monitor.inspect(('https://official.org',['city']))
        self.assertEqual(inspect({})['result'], 'baseline')
        self.assertEqual(inspect({'https://official.org':{'fingerprint':fingerprint,'fingerprintKind':'static-text'}})['result'], 'body-unchanged')
        self.assertEqual(inspect({'https://official.org':{'fingerprint':'a'*64,'fingerprintKind':'static-text'}})['result'], 'body-changed')
        monitor = m.Monitor({})
        with patch.object(m, 'public_url', return_value=m.urllib.parse.urlsplit('https://official.org')), patch.object(monitor, 'robots_allowed', side_effect=m.PolicyError('robots-denied')):
            blocked = monitor.inspect(('https://official.org',['city']))
        self.assertEqual(blocked['result'], 'robots-denied')
        self.assertIsNone(blocked['fingerprint'])
        self.assertFalse(blocked['factsReviewed'])
    def test_robots_disallow_prevents_the_source_request(self):
        monitor=m.Monitor({})
        with patch.object(monitor,'request',return_value=(200,'https://official.org/robots.txt',b'User-agent: *\nDisallow: /blocked','text/plain')) as request:
            with self.assertRaises(m.PolicyError): monitor.robots_allowed('https://official.org/blocked')
            self.assertEqual(request.call_count,1)
    def fixture(self, root):
        folder=root/'guidebook-database/records';folder.mkdir(parents=True)
        record={'guide':{'id':'city','sources':[{'url':'https://official.org/info'}]}}
        body=m.encoded(record);(folder/'city.json').write_bytes(body)
        (root/'guidebook-database/index.json').write_text(json.dumps({'guideCount':1,'guides':[{'id':'city','file':'records/city.json','contentHash':m.digest(body)}]}))
        with sqlite3.connect(root/'guidebook-database/guides.sqlite') as connection:
            connection.execute('CREATE TABLE guides(id TEXT,content_hash TEXT,json TEXT)')
            connection.execute('INSERT INTO guides VALUES (?,?,?)',('city',m.digest(body),body.decode()))
        (root/'research/guidebooks/runs').mkdir(parents=True)
        return body
    def artifact(self, root, output):
        index, urls, signature=m.scope(root)
        entry=dict(url='https://official.org/info',guideIds=['city'],fetchedAt='2026-11-09T00:00:00Z',result='baseline',documentSha256='a'*64,fingerprint='b'*64,previousFingerprint=None,factsReviewed=False)
        report=dict(schemaVersion=1,mode='source-check',scopeDigest=signature,previousStateSha256=m.digest(b''),reportFile='20261109T000000Z-source-check-local-1.json',guideCount=1,totalSources=1,attempted=1,guideContentChanged=False,factsReviewed=False,lastReviewedAtChanged=False,newGuidesCreated=0,results=[entry],counts={result:int(result=='baseline') for result in m.RESULTS})
        output.mkdir();(output/'report.json').write_bytes(m.encoded(report));(output/'state.json').write_bytes(m.encoded({'schemaVersion':1,'sources':{}}))
        return report
    def test_publication_changes_only_owned_reports_and_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);original=self.fixture(root);output=root/'artifact';self.artifact(root,output)
            paths=m.publish(root,output)
            self.assertEqual(len(paths),2)
            self.assertEqual((root/'guidebook-database/records/city.json').read_bytes(),original)
            self.assertFalse((root/'research/guidebooks/reviews.json').exists())
            with self.assertRaises(ValueError):m.publish(root,output)
    def test_sqlite_mismatch_is_rejected_before_source_fetch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);self.fixture(root)
            with sqlite3.connect(root/'guidebook-database/guides.sqlite') as connection:
                connection.execute("UPDATE guides SET content_hash='invalid'")
            with self.assertRaises(ValueError):m.scope(root)
    def test_changed_source_remains_pending_after_later_unchanged_body(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);self.fixture(root)
            url='https://official.org/info'
            old={'schemaVersion':1,'sources':{url:{'guideIds':['city'],'lastAttemptAt':'2026-01-01T00:00:00Z','lastResult':'baseline','fingerprint':'a'*64,'fingerprintKind':'static-text'}}}
            (root/m.STATE_PATH).write_bytes(m.encoded(old))
            entry=dict(url=url,guideIds=['city'],fetchedAt='2026-11-09T00:00:00Z',result='body-changed',fingerprint='b'*64,fingerprintKind='static-text')
            with patch.object(m.Monitor,'inspect',return_value=entry),patch.object(m.subprocess,'check_output',return_value='0'*40):
                report=m.run(root,root/'out')
            self.assertEqual(report['pendingBodyChanges'],1)
            (root/m.STATE_PATH).write_bytes((root/'out/state.json').read_bytes())
            entry.update(result='body-unchanged',fetchedAt='2026-11-10T00:00:00Z')
            with patch.object(m.Monitor,'inspect',return_value=entry),patch.object(m.subprocess,'check_output',return_value='0'*40):
                report=m.run(root,root/'out')
            self.assertEqual(report['pendingBodyChanges'],1)
            state=json.loads((root/'out/state.json').read_text())
            self.assertEqual(state['sources'][url]['pendingReviewSince'],'2026-11-09T00:00:00Z')
    def test_stale_main_or_artifact_path_cannot_overwrite_current_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);self.fixture(root);output=root/'artifact';report=self.artifact(root,output)
            report['reportFile']='../../private.json';(output/'report.json').write_bytes(m.encoded(report))
            with self.assertRaises(ValueError):m.publish(root,output)
            report['reportFile']='20261109T000000Z-source-check-local-1.json';report['scopeDigest']='0'*64;(output/'report.json').write_bytes(m.encoded(report))
            with self.assertRaises(ValueError):m.publish(root,output)
            self.assertFalse((root/m.STATE_PATH).exists())

if __name__=='__main__': unittest.main()
