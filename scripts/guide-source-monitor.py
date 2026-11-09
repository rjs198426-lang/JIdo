#!/usr/bin/env python3
"""Read public sources; fingerprint changes. Never edit guide facts or review dates."""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

AGENT = 'JDo-Guide-Source-Monitor/1.0 (+https://github.com/rjs198426-lang/JIdo)'
STATE_PATH = 'research/guidebooks/source-monitor-state.json'
RESULTS = {'baseline', 'body-unchanged', 'body-changed', 'http-error', 'network-error', 'redirect-review', 'blocked-address', 'robots-denied', 'robots-unavailable', 'unreadable-body', 'too-large', 'budget-exceeded'}
MAX_RESPONSE = 1024 * 1024
MAX_TOTAL = 96 * 1024 * 1024
MAX_SECONDS = 1800

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()

def digest(value):
    return hashlib.sha256(value).hexdigest()

class PolicyError(Exception):
    pass

class Budget:
    def __init__(self):
        self.total = 0
        self.started = time.monotonic()
        self.lock = threading.Lock()
    def add(self, count):
        with self.lock:
            if self.total + count > MAX_TOTAL or time.monotonic() - self.started > MAX_SECONDS:
                raise PolicyError('budget-exceeded')
            self.total += count

def public_url(url, resolve=True):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise PolicyError('blocked-address')
    host = parsed.hostname.lower()
    if host in {'localhost', 'metadata.google.internal'} or host.endswith(('.local', '.internal', '.localhost')):
        raise PolicyError('blocked-address')
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise PolicyError('blocked-address')
    if resolve:
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(address[4][0]).is_global for address in addresses):
            raise PolicyError('blocked-address')
    return parsed

class Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        original, target = public_url(req.full_url), public_url(newurl)
        if original.hostname.removeprefix('www.') != target.hostname.removeprefix('www.'):
            raise PolicyError('redirect-review')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

class PageText(HTMLParser):
    """Extract static article/main text; never run scripts or fetch subresources."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.main_depth = 0
        self.article_depth = 0
        self.title_depth = 0
        self.all = []
        self.main = []
        self.article = []
        self.title = []
        self.dates = {'declaredPublishedAt': None, 'declaredModifiedAt': None}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {'script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'form'}:
            self.skip += 1
        if tag == 'main': self.main_depth += 1
        if tag == 'article': self.article_depth += 1
        if tag == 'title': self.title_depth += 1
        if tag == 'meta':
            key = attrs.get('property', attrs.get('name', '')).lower()
            target = 'declaredPublishedAt' if key in {'article:published_time', 'datepublished'} else 'declaredModifiedAt' if key in {'article:modified_time', 'datemodified'} else None
            value = attrs.get('content', '')
            if target and re.match(r'^\d{4}-\d{2}-\d{2}(?:$|T| )', value): self.dates[target] = value[:80]
        if tag in {'p', 'div', 'li', 'br', 'h1', 'h2', 'h3'}: self.handle_data(' ')
    def handle_endtag(self, tag):
        if tag in {'script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'form'} and self.skip:
            self.skip -= 1
        if tag == 'main' and self.main_depth: self.main_depth -= 1
        if tag == 'article' and self.article_depth: self.article_depth -= 1
        if tag == 'title' and self.title_depth: self.title_depth -= 1
        if tag in {'p', 'div', 'li', 'h1', 'h2', 'h3'}: self.handle_data(' ')
    def handle_data(self, value):
        if self.title_depth: self.title.append(value)
        if not self.skip:
            self.all.append(value)
            if self.main_depth: self.main.append(value)
            if self.article_depth: self.article.append(value)
    def result(self):
        text = re.sub(r'\s+', ' ', ''.join(self.main or self.article or self.all)).strip()
        title = re.sub(r'\s+', ' ', ''.join(self.title)).strip()[:180]
        return text, title

def fingerprint(body, content_type):
    if 'application/pdf' in content_type and body.startswith(b'%PDF-'):
        return digest(body), 'raw-pdf-only', '', {}, 0
    if not any(kind in content_type for kind in ['text/html', 'application/xhtml+xml', 'text/plain', 'application/json']):
        raise PolicyError('unreadable-body')
    source = body.decode('utf-8', errors='replace')
    if 'html' in content_type:
        parser = PageText()
        parser.feed(source)
        text, title = parser.result()
        dates = parser.dates
    else:
        text, title, dates = re.sub(r'\s+', ' ', source).strip(), '', {}
    if len(text) < 120 or len(text) < 2500 and any(term in (title + ' ' + text).lower() for term in ['just a moment', 'access denied', 'verify you are human', 'enable javascript', 'checking your browser', 'captcha']):
        raise PolicyError('unreadable-body')
    return digest(text.encode()), 'static-text', title, dates, len(text)

def scope(root):
    index = json.loads((root / 'guidebook-database/index.json').read_text())
    urls, guide_ids = {}, []
    for guide in index['guides']:
        guide_id = guide['id']
        if not re.fullmatch(r'[A-Za-z0-9_-]+', guide_id) or guide['file'] != f'records/{guide_id}.json':
            raise ValueError('Invalid public guide index')
        data = (root / 'guidebook-database' / guide['file']).read_bytes()
        if digest(data) != guide['contentHash']: raise ValueError('Public database record hash mismatch')
        record = json.loads(data)
        if record['guide']['id'] != guide_id: raise ValueError('Public guide ID mismatch')
        guide_ids.append(guide_id)
        for source in record['guide']['sources']:
            urls.setdefault(source['url'], set()).add(guide_id)
    if len(set(guide_ids)) != index['guideCount']: raise ValueError('Public guide count mismatch')
    database = root / 'guidebook-database/guides.sqlite'
    with sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True) as connection:
        if connection.execute('PRAGMA quick_check').fetchone()[0] != 'ok': raise ValueError('Public SQLite integrity error')
        rows = connection.execute('SELECT id,content_hash,json FROM guides').fetchall()
        expected = {g['id']:g['contentHash'] for g in index['guides']}
        if len(rows) != len(expected) or any(expected.get(row[0]) != row[1] or digest(row[2].encode()) != row[1] for row in rows): raise ValueError('Public SQLite/index mismatch')
    signature = digest(encoded({'guides': [(g['id'], g['contentHash']) for g in index['guides']], 'sources': {url: sorted(ids) for url, ids in sorted(urls.items())}}))
    return index, {url: sorted(ids) for url, ids in sorted(urls.items())}, signature

class Monitor:
    def __init__(self, previous, timeout=15):
        self.previous = previous
        self.timeout = timeout
        self.budget = Budget()
        self.locks = {}
        self.robots = {}
        self.registry_lock = threading.Lock()
    def request(self, url, limit=MAX_RESPONSE, timeout=None):
        public_url(url)
        self.budget.add(0)
        opener = urllib.request.build_opener(Redirects())
        request = urllib.request.Request(url, headers={'User-Agent': AGENT, 'Accept': 'text/html,application/pdf;q=0.8,text/plain;q=0.7,application/json;q=0.5', 'Accept-Encoding': 'identity'})
        with opener.open(request, timeout=timeout or self.timeout) as response:
            if int(response.headers.get('Content-Length', '0') or 0) > limit: raise PolicyError('too-large')
            body = bytearray()
            while True:
                part = response.read(min(65536, limit + 1 - len(body)))
                if not part: break
                self.budget.add(len(part))
                body.extend(part)
                if len(body) > limit: raise PolicyError('too-large')
            return response.status, response.url, bytes(body), response.headers.get('Content-Type', '').lower()
    def robots_allowed(self, url):
        p = urllib.parse.urlsplit(url)
        origin = f'https://{p.netloc}'
        if origin not in self.robots:
            try:
                _, _, body, _ = self.request(origin + '/robots.txt', 128 * 1024, min(self.timeout, 7))
                robot = urllib.robotparser.RobotFileParser()
                robot.parse(body.decode('utf-8', errors='replace').splitlines())
                self.robots[origin] = robot
            except urllib.error.HTTPError as error:
                self.robots[origin] = True if error.code == 404 else False if error.code in (401, 403) else None
            except Exception:
                self.robots[origin] = None
        robot = self.robots[origin]
        if robot is None: raise PolicyError('robots-unavailable')
        if robot is False or robot is not True and not robot.can_fetch(AGENT, url): raise PolicyError('robots-denied')
    def inspect(self, item):
        url, guide_ids = item
        entry = dict(url=url, guideIds=guide_ids, fetchedAt=now(), httpStatus=None, finalUrl=None, documentSha256=None, fingerprint=None, fingerprintKind=None, bytes=0, textLength=0, title='', declaredPublishedAt=None, declaredModifiedAt=None, result='network-error', previousFingerprint=self.previous.get(url, {}).get('fingerprint'), factsReviewed=False)
        try:
            self.budget.add(0)
            host = public_url(url).hostname
            with self.registry_lock: lock = self.locks.setdefault(host, threading.Lock())
            with lock:
                self.robots_allowed(url)
                status, final_url, body, kind = self.request(url)
                entry.update(httpStatus=status, finalUrl=final_url, bytes=len(body), documentSha256=digest(body))
                sha, fingerprint_kind, title, dates, length = fingerprint(body, kind)
                previous = self.previous.get(url, {})
                comparable = previous.get('fingerprintKind') == fingerprint_kind and previous.get('fingerprint')
                result = 'baseline' if not comparable else 'body-unchanged' if previous['fingerprint'] == sha else 'body-changed'
                entry.update(fingerprint=sha, fingerprintKind=fingerprint_kind, title=title, textLength=length, result=result, **dates)
                time.sleep(0.3)
        except PolicyError as error:
            entry['result'] = str(error)
        except urllib.error.HTTPError as error:
            entry.update(result='http-error', httpStatus=error.code)
        except Exception:
            # Never publish server error bodies, proxy credentials or stack traces.
            entry['result'] = 'network-error'
        return entry

def run(root, output, limit=0, workers=6, timeout=15):
    index, urls, signature = scope(root)
    path = root / STATE_PATH
    state_raw = path.read_bytes() if path.exists() else b''
    state = json.loads(state_raw) if state_raw else {'schemaVersion': 1, 'sources': {}}
    previous = state['sources']
    selected = sorted(urls.items(), key=lambda item: (previous.get(item[0], {}).get('lastAttemptAt', ''), item[0]))[:limit or 600]
    if limit < 0 or limit > 600 or workers < 1 or workers > 6: raise ValueError('Invalid bounded check options')
    started = now()
    monitor = Monitor(previous, timeout)
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(monitor.inspect, selected))
    counts = {result: sum(r['result'] == result for r in results) for result in sorted(RESULTS)}
    for entry in results:
        old = previous.get(entry['url'], {})
        previous[entry['url']] = {**old, 'guideIds': entry['guideIds'], 'lastAttemptAt': entry['fetchedAt'], 'lastResult': entry['result']}
        if entry['result'] == 'body-changed':
            previous[entry['url']].setdefault('pendingReviewSince', entry['fetchedAt'])
            previous[entry['url']]['lastBodyChangeAt'] = entry['fetchedAt']
        if entry['fingerprint']:
            previous[entry['url']].update(fingerprint=entry['fingerprint'], fingerprintKind=entry['fingerprintKind'], lastBodyFetchedAt=entry['fetchedAt'])
    state = {'schemaVersion': 1, 'sources': {url: previous[url] for url in urls if url in previous}}
    identifier = os.environ.get('GITHUB_RUN_ID', 'local')
    attempt = os.environ.get('GITHUB_RUN_ATTEMPT', '1')
    if not re.fullmatch(r'(?:[0-9]{1,20}|local)', identifier) or not re.fullmatch(r'[0-9]{1,4}', attempt): raise ValueError('Invalid run identifier')
    stamp = started.replace('-', '').replace(':', '')
    filename = f'{stamp}-source-check-{identifier}-{attempt}.json'
    report = dict(schemaVersion=1, mode='source-check', sourceCommit=subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip(), scopeDigest=signature, previousStateSha256=digest(state_raw), startedAt=started, completedAt=now(), reportFile=filename, guideCount=index['guideCount'], totalSources=len(urls), attempted=len(results), remainingSources=len(urls)-len(results), counts=counts, receivedBytes=monitor.budget.total, guideContentChanged=False, factsReviewed=False, lastReviewedAtChanged=False, newGuidesCreated=0, results=results)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'state.json').write_bytes(encoded(state))
    pending_reviews = sum(bool(source.get('pendingReviewSince')) for source in state['sources'].values())
    report['pendingBodyChanges'] = pending_reviews
    (output / 'report.json').write_bytes(encoded(report))
    summary = f"## 기존 가이드 출처 변경 점검\n\n- 기존 가이드: {index['guideCount']}개 · 출처 {len(urls)}개\n- 점검: {len(results)}개 · 남은 출처: {len(urls)-len(results)}개\n- 최초 기준 수집: {counts['baseline']}개\n- 본문 지문 동일: {counts['body-unchanged']}개\n- 본문 지문 변경: {counts['body-changed']}개\n- 누적 미검토 본문 변경: {pending_reviews}개\n- 접근 실패·보류: {len(results)-sum(counts[k] for k in ['baseline','body-unchanged','body-changed'])}개\n\n본문 지문은 정적 본문 또는 PDF 바이트 비교입니다. 동일/변경은 사실 검증 결과가 아닙니다. 첫 수집에는 과거와의 비교 기준이 없습니다. 새 가이드·장소·사진·좌표·앱 본문·실제 검토일은 변경하지 않습니다.\n"
    (output / 'summary.md').write_text(summary)
    return report

def publish(root, artifact):
    for name in ['report.json', 'state.json']:
        if (artifact / name).stat().st_size > 5 * 1024 * 1024: raise ValueError('Oversize report')
    report = json.loads((artifact / 'report.json').read_text())
    state = json.loads((artifact / 'state.json').read_text())
    index, urls, signature = scope(root)
    state_raw = (root / STATE_PATH).read_bytes() if (root / STATE_PATH).exists() else b''
    if report.get('schemaVersion') != 1 or report.get('mode') != 'source-check' or report.get('scopeDigest') != signature or report.get('previousStateSha256') != digest(state_raw): raise ValueError('Latest main differs from the checked public data/state; rerun without overwriting it')
    if report.get('guideContentChanged') is not False or report.get('factsReviewed') is not False or report.get('lastReviewedAtChanged') is not False or report.get('newGuidesCreated') != 0: raise ValueError('Source monitor cannot publish guide changes')
    filename = report.get('reportFile', '')
    if not re.fullmatch(r'\d{8}T\d{6}Z-source-check-(?:\d{1,20}|local)-\d{1,4}\.json', filename): raise ValueError('Unsafe report path')
    seen = set()
    for entry in report['results']:
        url = entry['url']
        if url not in urls or url in seen or entry['guideIds'] != urls[url] or entry['result'] not in RESULTS or entry.get('factsReviewed') is not False: raise ValueError('Invalid source result')
        seen.add(url)
        for field in ['documentSha256', 'fingerprint', 'previousFingerprint']:
            if entry[field] is not None and not re.fullmatch('[a-f0-9]{64}', entry[field]): raise ValueError('Invalid source hash')
    expected_counts = {result: sum(r['result'] == result for r in report['results']) for result in sorted(RESULTS)}
    if report.get('counts') != expected_counts: raise ValueError('Invalid result totals')
    if report['attempted'] != len(seen) or report['guideCount'] != index['guideCount'] or report['totalSources'] != len(urls): raise ValueError('Invalid report counts')
    if state.get('schemaVersion') != 1 or set(state.get('sources', {})) - set(urls): raise ValueError('Invalid state scope')
    for url, item in state['sources'].items():
        if not isinstance(item, dict) or item.get('guideIds') != urls[url] or item.get('lastResult') not in RESULTS: raise ValueError('Invalid state entry')
        if not isinstance(item.get('lastAttemptAt'), str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', item['lastAttemptAt']): raise ValueError('Invalid state date')
        if 'fingerprint' in item and not re.fullmatch('[a-f0-9]{64}', item['fingerprint']): raise ValueError('Invalid state fingerprint')
    destination = root / 'research/guidebooks/runs' / filename
    if destination.exists(): raise ValueError('Immutable source report already exists')
    destination.write_bytes(encoded(report))
    (root / STATE_PATH).write_bytes(encoded(state))
    return [destination.relative_to(root).as_posix(), STATE_PATH]

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['check', 'publish'])
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--output', type=Path, default=Path('.runtime/guide-source-monitor'))
    parser.add_argument('--limit', type=int, default=int(os.environ.get('SOURCE_CHECK_LIMIT', '0')))
    args = parser.parse_args()
    if args.mode == 'check':
        report = run(args.root, args.output, args.limit)
        print(json.dumps({key: report[key] for key in ['guideCount', 'totalSources', 'attempted', 'remainingSources', 'counts']}, ensure_ascii=False))
        if not any(report['counts'][key] for key in ['baseline', 'body-unchanged', 'body-changed']): raise SystemExit('No readable source bodies; see the retained failure report.')
    else:
        print(json.dumps({'published': publish(args.root, args.output)}, ensure_ascii=False))
