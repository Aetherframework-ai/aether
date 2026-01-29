import asyncio
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
import json


class DemoService:
    """Python demo service with sync/async steps"""

    def sync_step(self, data: dict) -> dict:
        """Sync step - executes immediately"""
        message = data.get("message", "")
        print(f"[Python] Sync step: {message}")
        return {
            "source": "python",
            "type": "sync",
            "message": message,
            "timestamp": time.time(),
        }

    async def async_step(self, data: dict) -> dict:
        """Async step - has delay"""
        message = data.get("message", "")
        await asyncio.sleep(0.5)
        print(f"[Python] Async step: {message}")
        return {
            "source": "python",
            "type": "async",
            "message": message,
            "timestamp": time.time(),
        }


service = DemoService()


class RequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers["Content-Length"])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode("utf-8"))

        if self.path == "/sync-step":
            result = service.sync_step(data)
        elif self.path == "/async-step":
            result = asyncio.run(service.async_step(data))
        else:
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode("utf-8"))

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {"status": "ok", "service": "python-demo", "timestamp": time.time()}
                ).encode("utf-8")
            )
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress default logging


def main():
    port = 3002
    server = HTTPServer(("0.0.0.0", port), RequestHandler)
    print(f"[Python] Demo service running on http://localhost:{port}")
    print(f"[Python] Endpoints: /sync-step, /async-step, /health")
    server.serve_forever()


if __name__ == "__main__":
    main()
