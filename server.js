const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const STORAGE_FILE = path.join(__dirname, 'data', 'actions.json');
const DATA_DIR = path.dirname(STORAGE_FILE);

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function ensureStorageFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORAGE_FILE)) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify([], null, 2));
  }
}

function readActions() {
  ensureStorageFile();
  const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
  const parsed = safeJsonParse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeActions(actions) {
  ensureStorageFile();
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(actions, null, 2));
}

function mergeActions(existing = [], incoming = []) {
  const map = new Map();

  [...existing, ...incoming].forEach((action) => {
    if (!action || !action.id) return;

    const previous = map.get(action.id);
    if (!previous) {
      map.set(action.id, action);
      return;
    }

    const currentUpdatedAt = new Date(action.updatedAt || action.createdAt || 0).getTime();
    const previousUpdatedAt = new Date(previous.updatedAt || previous.createdAt || 0).getTime();

    map.set(action.id, currentUpdatedAt >= previousUpdatedAt ? action : previous);
  });

  return [...map.values()].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === '/api/actions') {
    if (request.method === 'GET') {
      sendJson(response, 200, { actions: readActions() });
      return;
    }

    if (request.method === 'POST') {
      let body = '';

      request.on('data', (chunk) => {
        body += chunk;
      });

      request.on('end', () => {
        const parsed = safeJsonParse(body) || {};
        const incoming = Array.isArray(parsed.actions) ? parsed.actions : [];
        const current = readActions();
        const merged = mergeActions(current, incoming);
        writeActions(merged);
        sendJson(response, 200, { actions: merged, synced: true });
      });

      return;
    }
  }

  sendJson(response, 404, { error: 'Not found' });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Next Pulse sync server running on http://localhost:${PORT}`);
  });
}

module.exports = {
  mergeActions,
  readActions,
  writeActions,
};
