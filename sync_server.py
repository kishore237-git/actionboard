import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

PORT = int(os.environ.get("SYNC_PORT", "9000"))
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DATA_FILE = os.path.join(DATA_DIR, "actions.json")


def ensure_storage():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def read_actions():
    ensure_storage()
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def write_actions(actions):
    ensure_storage()
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(actions, f, indent=2)


def parse_timestamp(value):
    try:
        if not value:
            return 0
        if isinstance(value, (int, float)):
            return float(value)
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0


def dedupe_actions(actions=None):
    ordered = {}
    for action in actions or []:
        if not action or not action.get("id"):
            continue

        current = ordered.get(action["id"])
        if current is None:
            ordered[action["id"]] = action
            continue

        current_time = parse_timestamp(action.get("updatedAt") or action.get("createdAt"))
        previous_time = parse_timestamp(current.get("updatedAt") or current.get("createdAt"))

        if current_time >= previous_time:
            ordered[action["id"]] = action

    return [
        action
        for action in sorted(
            ordered.values(),
            key=lambda item: parse_timestamp(item.get("updatedAt") or item.get("createdAt")),
            reverse=True,
        )
        if not action.get("deletedAt")
    ]


def merge_actions(existing=None, incoming=None):
    return dedupe_actions((existing or []) + (incoming or []))


class SyncHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(b"{}")

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/actions":
            self._send_json(404, {"error": "Not found"})
            return
        self._send_json(200, {"actions": read_actions()})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/actions":
            self._send_json(404, {"error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length)
        try:
            payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            payload = {}

        incoming = payload.get("actions", []) if isinstance(payload, dict) else []
        current = read_actions()
        merged = merge_actions(current, incoming)
        write_actions(merged)
        self._send_json(200, {"actions": merged, "synced": True})

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), SyncHandler)
    print(f"Next Pulse sync server running on http://localhost:{PORT}")
    server.serve_forever()
