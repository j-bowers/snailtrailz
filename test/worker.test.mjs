// Calls the Worker's fetch handler directly with a synthetic Request and a stub
// rate limiter. No Wrangler, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const HOST = 'https://snailtrailz.test';

/** Minimal stand-in for what Cloudflare attaches at the edge. */
const CF = {
  asn: 64496, asOrganization: 'Example ISP', country: 'GB', continent: 'EU',
  region: 'England', regionCode: 'ENG', city: 'London', postalCode: 'SW1A',
  timezone: 'Europe/London', httpProtocol: 'HTTP/2', tlsVersion: 'TLSv1.3',
  tlsCipher: 'AEAD-AES256-GCM-SHA384', colo: 'LHR',
};

// Pass `ip: null` / `cf: null` to simulate their absence.
function req(path, { method = 'GET', headers = {}, ip = '203.0.113.42', cf = CF } = {}) {
  const r = new Request(HOST + path, {
    method,
    headers: { ...(ip ? { 'CF-Connecting-IP': ip } : {}), 'User-Agent': 'curl/8.7.1', ...headers },
  });
  return Object.assign(r, { cf: cf ?? undefined });
}

/** Rate limiter stub: allows `allow` requests, then refuses. */
function env({ allow = Infinity } = {}) {
  let n = 0;
  return { RATE_LIMITER: { limit: async () => ({ success: ++n <= allow }) } };
}

const BROWSER = { Accept: 'text/html,application/xhtml+xml' };

test('root: curl gets the bare address, browser gets the page', async () => {
  const text = await worker.fetch(req('/'), env());
  assert.equal(text.headers.get('Content-Type'), 'text/plain; charset=utf-8');
  assert.equal(await text.text(), '203.0.113.42\n');

  const html = await worker.fetch(req('/', { headers: BROWSER }), env());
  assert.equal(html.status, 200);
  assert.equal(html.headers.get('Content-Type'), 'text/html; charset=utf-8');
  const body = await html.text();
  assert.match(body, /<p class="ip">203\.0\.113\.42<\/p>/);
  assert.match(body, /data-edge-tz="Europe\/London"/);
  assert.match(body, /curl snailtrailz\.test/, 'shell examples use the reached host');
});

test('root: IPv6', async () => {
  const r = await worker.fetch(req('/', { ip: '2606:4700:4700::1111' }), env());
  assert.equal(await r.text(), '2606:4700:4700::1111\n');
});

test('/json: everything, CORS-enabled', async () => {
  const r = await worker.fetch(req('/json'), env());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*');
  const data = await r.json();
  assert.equal(data.ip, '203.0.113.42');
  assert.equal(data.ipVersion, 4);
  assert.equal(data.location.city, 'London');
  assert.equal(data.network.asn, 64496);
  assert.equal(data.connection.edgeLocation, 'LHR');
  assert.equal(data.userAgent, 'curl/8.7.1');
});

test('missing edge data degrades to null, not undefined', async () => {
  const r = await worker.fetch(req('/json', { cf: null }), env());
  const data = await r.json();
  assert.equal(data.location.timezone, null);
  assert.equal(data.network.asn, null);
});

test('missing edge timezone renders an empty attribute, not a dash', async () => {
  // The client script compares this against the browser timezone. A "—"
  // here produced a false "you are on a VPN" warning.
  const r = await worker.fetch(req('/', { headers: BROWSER, cf: null }), env());
  assert.match(await r.text(), /data-edge-tz=""/);
});

test('/health', async () => {
  const r = await worker.fetch(req('/health'), env());
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'ok\n');
});

test('trailing slashes are normalised', async () => {
  const r = await worker.fetch(req('/json///'), env());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Content-Type'), 'application/json; charset=utf-8');
});

test('404: text for curl, styled page for browsers, both status 404', async () => {
  const text = await worker.fetch(req('/nope'), env());
  assert.equal(text.status, 404);
  assert.equal(await text.text(), '404 not found\n');

  const html = await worker.fetch(req('/nope', { headers: BROWSER }), env());
  assert.equal(html.status, 404);
  assert.match(await html.text(), /Page not found/);
});

test('methods: OPTIONS preflight, everything else 405', async () => {
  const opt = await worker.fetch(req('/json', { method: 'OPTIONS' }), env());
  assert.equal(opt.status, 204);
  assert.equal(opt.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, OPTIONS');

  for (const method of ['POST', 'PUT', 'DELETE']) {
    const r = await worker.fetch(req('/', { method }), env());
    assert.equal(r.status, 405, method);
    assert.equal(r.headers.get('Allow'), 'GET, HEAD, OPTIONS');
  }
});

test('security headers on every response', async () => {
  for (const path of ['/', '/json', '/health', '/nope']) {
    for (const headers of [{}, BROWSER]) {
      const r = await worker.fetch(req(path, { headers }), env());
      assert.equal(r.headers.get('Cache-Control'), 'no-store, no-cache, must-revalidate, private', path);
      assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff', path);
      assert.equal(r.headers.get('X-Frame-Options'), 'DENY', path);
      assert.equal(r.headers.get('Referrer-Policy'), 'no-referrer', path);
      assert.match(r.headers.get('Strict-Transport-Security'), /max-age=\d+/, path);
      assert.match(r.headers.get('Content-Security-Policy'), /default-src 'none'/, path);
    }
  }
});

test('CSP nonce matches the inline script and style, and is fresh per request', async () => {
  const nonceOf = async () => {
    const r = await worker.fetch(req('/', { headers: BROWSER }), env());
    const [, nonce] = r.headers.get('Content-Security-Policy').match(/script-src 'nonce-([^']+)'/);
    const body = await r.text();
    assert.match(body, new RegExp(`<script nonce="${nonce}">`));
    assert.match(body, new RegExp(`<style nonce="${nonce}">`));
    return nonce;
  };
  assert.notEqual(await nonceOf(), await nonceOf());
});

test('user-agent is HTML-escaped', async () => {
  const ua = '<script>alert(1)</script>"onload="x';
  const r = await worker.fetch(req('/', { headers: { ...BROWSER, 'User-Agent': ua } }), env());
  const body = await r.text();
  assert.doesNotMatch(body, /<script>alert/);
  assert.match(body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;&quot;onload=&quot;x/);
});

test('X-Forwarded-For is never read', async () => {
  const r = await worker.fetch(req('/', { headers: { 'X-Forwarded-For': '1.2.3.4' } }), env());
  assert.equal(await r.text(), '203.0.113.42\n');
});

test('rate limit: 429 with Retry-After once the binding says no', async () => {
  const e = env({ allow: 2 });
  assert.equal((await worker.fetch(req('/health'), e)).status, 200);
  assert.equal((await worker.fetch(req('/health'), e)).status, 200);
  const r = await worker.fetch(req('/health'), e);
  assert.equal(r.status, 429);
  assert.equal(r.headers.get('Retry-After'), '60');
});

test('rate limit: not applied when the address is unknown', async () => {
  const r = await worker.fetch(req('/', { ip: null }), env({ allow: 0 }));
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'unavailable\n');
});
