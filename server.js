import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const allowDirectEgress = process.env.ALLOW_DIRECT_EGRESS !== 'false';
const requireAnonEgress = process.env.REQUIRE_ANON_EGRESS === 'true';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const blockedIPv4Ranges = [
  { base: '0.0.0.0', mask: 8 },
  { base: '10.0.0.0', mask: 8 },
  { base: '100.64.0.0', mask: 10 },
  { base: '127.0.0.0', mask: 8 },
  { base: '169.254.0.0', mask: 16 },
  { base: '172.16.0.0', mask: 12 },
  { base: '192.0.0.0', mask: 24 },
  { base: '192.0.2.0', mask: 24 },
  { base: '192.168.0.0', mask: 16 },
  { base: '198.18.0.0', mask: 15 },
  { base: '198.51.100.0', mask: 24 },
  { base: '203.0.113.0', mask: 24 },
  { base: '224.0.0.0', mask: 4 },
  { base: '240.0.0.0', mask: 4 }
];

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function ipv4ToInt(ip) {
  return ip
    .split('.')
    .map(Number)
    .reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0;
}

function isIPv4InCIDR(ip, base, mask) {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  const maskInt = mask === 0 ? 0 : ((0xffffffff << (32 - mask)) >>> 0);
  return (ipInt & maskInt) === (baseInt & maskInt);
}

function isBlockedIP(address) {
  if (net.isIPv4(address)) {
    return blockedIPv4Ranges.some(({ base, mask }) => isIPv4InCIDR(address, base, mask));
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80') ||
      normalized.startsWith('::ffff:127.')
    );
  }

  return true;
}

function looksLikeAntiBotBlock(status, body, contentType) {
  if (status !== 403 || !contentType.includes('text/html')) {
    return false;
  }

  const lowered = body.toLowerCase();
  return (
    lowered.includes('just a moment') ||
    lowered.includes('cf_chl_opt') ||
    lowered.includes('challenge-platform') ||
    lowered.includes('enable javascript and cookies to continue')
  );
}

async function validateTarget(targetUrl) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are allowed');
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new Error('Missing hostname');
  }

  const records = await dns.lookup(hostname, { all: true });
  if (!records.length) {
    throw new Error('Unable to resolve host');
  }

  if (records.some((record) => isBlockedIP(record.address))) {
    throw new Error('Target resolves to a private or restricted network address');
  }

  return parsed.toString();
}

async function serveStatic(res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const resolvedPath = path.resolve(publicDir, `.${safePath}`);

  if (!resolvedPath.startsWith(publicDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const data = await fs.readFile(resolvedPath);
    const ext = path.extname(resolvedPath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': contentType });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: 'Invalid request' });
    return;
  }

  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && parsed.pathname === '/api/proxy') {
    if (requireAnonEgress) {
      sendJson(res, 503, {
        error:
          'Anonymous egress is required. Connect this app to a dedicated outbound proxy/VPN gateway before enabling proxy traffic.'
      });
      return;
    }

    if (!allowDirectEgress) {
      sendJson(res, 503, {
        error:
          'Direct egress is disabled. Configure an outbound proxy network before enabling this endpoint.'
      });
      return;
    }

    const targetUrl = parsed.searchParams.get('url');
    if (!targetUrl) {
      sendJson(res, 400, { error: 'Query parameter "url" is required' });
      return;
    }

    let target;
    try {
      target = await validateTarget(targetUrl);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return;
    }

    try {
      const response = await fetch(target, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': 'RailwayProxy/1.0 (+https://railway.app)',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.7',
          pragma: 'no-cache',
          'cache-control': 'no-cache'
        }
      });

      const body = await response.text();
      const contentType = response.headers.get('content-type') || 'text/plain; charset=utf-8';

      if (looksLikeAntiBotBlock(response.status, body, contentType)) {
        sendJson(res, 403, {
          error:
            'Blocked by anti-bot protection on target site. Use a compliant outbound proxy provider to avoid exposing your Railway egress IP.'
        });
        return;
      }

      res.writeHead(response.status, {
        'content-type': contentType,
        'x-proxy-mode': 'direct-egress'
      });
      res.end(body);
    } catch {
      sendJson(res, 502, { error: 'Failed to fetch target URL' });
    }

    return;
  }

  if (req.method === 'GET') {
    await serveStatic(res, parsed.pathname);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(port, () => {
  console.log(`Proxy app running on port ${port}`);
});
