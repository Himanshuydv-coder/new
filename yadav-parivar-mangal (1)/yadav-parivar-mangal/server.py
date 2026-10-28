#!/usr/bin/env python3
"""Yadav Parivar - Mangal Parinayotsav: tiny Python web server (standard library only, no pip install needed).

Run:   python3 server.py            (PORT is taken from the environment, default 8000)
Render: Build Command  ->  echo ok
        Start Command  ->  python3 server.py

Only the public site files are served (never server.py, README, tools, source images).
Supports HTTP Range requests (needed for the music on iPhone/Safari).
"""
import mimetypes, os, re, sys, time
from email.utils import formatdate
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC_FILES = {'index.html', 'invite.html', 'site.webmanifest'}
PUBLIC_DIRS = ('css', 'js', 'assets')
mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('audio/mpeg', '.mp3')
mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('text/javascript', '.js')


def resolve(url_path):
    """Map a URL path to a real public file, or None."""
    p = unquote(urlsplit(url_path).path)
    if p in ('', '/'):
        p = '/index.html'
    rel = os.path.normpath(p.lstrip('/'))
    if rel.startswith('..') or os.path.isabs(rel) or '\x00' in rel:
        return None
    rel = rel.replace(os.sep, '/')
    if rel not in PUBLIC_FILES and rel.split('/')[0] not in PUBLIC_DIRS:
        return None
    full = os.path.join(ROOT, rel)
    real = os.path.realpath(full)
    if not real.startswith(ROOT + os.sep) or not os.path.isfile(real):
        return None
    return real, rel


class Handler(BaseHTTPRequestHandler):
    server_version = 'YadavSite'
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))

    def common_headers(self):
        self.send_header('X-Robots-Tag', 'noindex, nofollow')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Content-Type-Options', 'nosniff')

    def send_error_page(self, code, head=False):
        body = ('<!doctype html><meta charset="utf-8"><title>%d</title><p>%s</p>' % (code, HTTPStatus(code).phrase)).encode()
        self.send_response(code)
        self.common_headers()
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def serve(self, head=False):
        path = urlsplit(self.path).path
        if path == '/healthz':
            body = b'ok'
            self.send_response(200); self.send_header('Content-Type', 'text/plain'); self.send_header('Content-Length', '2'); self.end_headers()
            if not head: self.wfile.write(body)
            return
        hit = resolve(self.path)
        if not hit:
            return self.send_error_page(404, head)
        real, rel = hit
        st = os.stat(real)
        size = st.st_size
        ctype = mimetypes.guess_type(real)[0] or 'application/octet-stream'
        if ctype.startswith('text/') or ctype in ('application/manifest+json', 'image/svg+xml'):
            ctype += '; charset=utf-8' if ctype.startswith('text/') else ''
        etag = '"%x-%x"' % (st.st_mtime_ns, size)
        if self.headers.get('If-None-Match') == etag:
            self.send_response(304); self.send_header('ETag', etag); self.common_headers(); self.end_headers(); return
        start, end, code = 0, size - 1, 200
        rng = self.headers.get('Range')
        if rng:
            m = re.fullmatch(r'bytes=(\d*)-(\d*)', rng.strip())
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1)); end = int(m.group(2)) if m.group(2) else size - 1
                else:
                    start = max(0, size - int(m.group(2))); end = size - 1
                end = min(end, size - 1)
                if start > end or start >= size:
                    self.send_response(416); self.send_header('Content-Range', 'bytes */%d' % size); self.send_header('Content-Length', '0'); self.end_headers(); return
                code = 206
        length = end - start + 1
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(length))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('ETag', etag)
        self.send_header('Last-Modified', formatdate(st.st_mtime, usegmt=True))
        if code == 206:
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        if rel.endswith('.html') or rel.endswith('.webmanifest'):
            self.send_header('Cache-Control', 'no-cache')
        else:
            self.send_header('Cache-Control', 'public, max-age=86400')
        self.common_headers()
        self.end_headers()
        if head:
            return
        try:
            with open(real, 'rb') as f:
                f.seek(start)
                left = length
                while left > 0:
                    chunk = f.read(min(65536, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self): self.serve(False)
    def do_HEAD(self): self.serve(True)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8000'))
    srv = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    srv.daemon_threads = True
    print('Serving on port', port, flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
