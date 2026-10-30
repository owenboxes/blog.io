"""Local preview with the isolation headers required for true paused stepping."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    root = str(Path(__file__).parent / 'site')
    print('OWEN preview: http://localhost:8765', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8765), partial(Handler, directory=root)).serve_forever()
