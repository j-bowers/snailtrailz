/**
 * SnailTrailz — tells you what the internet knows about you.
 *
 * Design notes:
 *  - The client IP comes from CF-Connecting-IP, which Cloudflare sets at the
 *    edge and strips from inbound requests. We never read X-Forwarded-For:
 *    that header is caller-supplied and trivially spoofed.
 *  - Nothing here is ever logged. No console.log touches a visitor's address.
 *    See PRIVACY in README.md for what Cloudflare itself sees.
 *  - Responses are no-store. The body contains the requester's own IP, so it
 *    must never be cached by us, by Cloudflare, or by any proxy in between.
 */

import { renderPage } from './render.js';

const RATE_LIMIT_KEY_SALT = 'st1';

/** Fields we expose. Anything not listed here is deliberately not surfaced. */
function collect(request) {
  const cf = request.cf ?? {};
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const version = ip.includes(':') ? 6 : ip ? 4 : null;

  return {
    ip: ip || 'unavailable',
    ipVersion: version,
    network: {
      asn: cf.asn ?? null,
      organization: cf.asOrganization ?? null,
    },
    location: {
      country: cf.country ?? null,
      continent: cf.continent ?? null,
      region: cf.region ?? null,
      regionCode: cf.regionCode ?? null,
      city: cf.city ?? null,
      postalCode: cf.postalCode ?? null,
      timezone: cf.timezone ?? null,
    },
    connection: {
      httpProtocol: cf.httpProtocol ?? null,
      tlsVersion: cf.tlsVersion ?? null,
      tlsCipher: cf.tlsCipher ?? null,
      edgeLocation: cf.colo ?? null,
    },
    userAgent: request.headers.get('User-Agent') ?? null,
  };
}

/**
 * Security headers applied to every response.
 * `nonce` ties the CSP to this request's inline <script>/<style>, which lets us
 * keep a strict policy without 'unsafe-inline'.
 */
function securityHeaders(nonce) {
  const csp = [
    "default-src 'none'",
    nonce ? `script-src 'nonce-${nonce}'` : "script-src 'none'",
    nonce ? `style-src 'nonce-${nonce}'` : "style-src 'none'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=(), usb=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // The body contains the caller's own IP. Never let anything cache it.
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  };
}

function textResponse(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...securityHeaders(null),
      ...extra,
    },
  });
}

function jsonResponse(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2) + '\n', {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Public read-only endpoint: usable from other origins by design.
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      ...securityHeaders(null),
      ...extra,
    },
  });
}

/** A browser asks for HTML. curl, wget and scripts do not. */
function wantsHtml(request) {
  const accept = request.headers.get('Accept') ?? '';
  return accept.includes('text/html');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return textResponse('405 method not allowed\n', 405, { Allow: 'GET, HEAD, OPTIONS' });
    }

    const data = collect(request);

    // Abuse control. Keyed on the caller's IP because on an anonymous public
    // endpoint there is no stabler identifier available. The binding is
    // eventually consistent and errs permissive, which is the right tradeoff
    // here: we would rather serve a few extra requests than drop a real one.
    if (env.RATE_LIMITER && data.ip !== 'unavailable') {
      const { success } = await env.RATE_LIMITER.limit({ key: RATE_LIMIT_KEY_SALT + data.ip });
      if (!success) {
        return textResponse('429 slow down — rate limit exceeded\n', 429, { 'Retry-After': '60' });
      }
    }

    switch (path) {
      case '/':
        // Plain-text root returns the address and nothing else, so that
        // `IP=$(curl -s <host>)` does the obvious thing.
        return wantsHtml(request)
          ? renderHtml(data, 200, { host: url.host })
          : textResponse(data.ip + '\n');

      case '/json':
        return jsonResponse(data);

      case '/health':
        return textResponse('ok\n');

      default:
        return wantsHtml(request)
          ? renderHtml(data, 404, { notFound: true, host: url.host })
          : textResponse('404 not found\n', 404);
    }
  },
};

function renderHtml(data, status = 200, opts = {}) {
  // A fresh nonce per response. The same value goes into the CSP header and
  // the inline <script>/<style>, so neither works without the other.
  const nonce = crypto.randomUUID();
  return new Response(renderPage(data, nonce, opts), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...securityHeaders(nonce),
    },
  });
}
