# SnailTrailz

Tells you what the internet knows about you: your IP address, what your
connection discloses about you at the network level, and what your browser
gives away on top of that.

Runs as a single Cloudflare Worker. No build step, no dependencies at runtime,
no database, no third-party API calls.

## Endpoints

| Path | Returns |
|---|---|
| `/` | Your IP as plain text — or the full page, if you're in a browser |
| `/json` | Everything, as JSON. CORS-enabled |
| `/health` | `ok` |

The root is content-negotiated on the `Accept` header. Browsers send
`Accept: text/html` and get the page; curl, wget and scripts don't, and get the
bare address:

```
$ curl snailtrailz.example
203.0.113.42

$ IP=$(curl -s snailtrailz.example)
```

That's deliberate. The address and nothing else is what makes the root usable
in a shell; everything else lives at `/json`.

The shell examples on the page render whatever hostname the visitor actually
reached -- `workers.dev` today, a real domain later -- so there is no hostname
hardcoded anywhere in `src/`. Don't add one.

## Privacy

SnailTrailz writes no logs, sets no cookies, and stores no record of any visit.
Nothing in `src/` calls `console.log` with a visitor's address, and nothing
should — Workers Logs captures console output, so logging an IP would quietly
turn this into the thing it's supposed to demonstrate.

What that claim does *not* cover, and the page says so: Cloudflare delivers this
site and, like any network carrying your traffic, sees the request in transit.
`observability` in `wrangler.jsonc` keeps sampled invocation traces so a broken
deploy is debuggable. Set it to `false` if you'd rather keep nothing at all.

The "what your browser reveals" section runs entirely client-side and is never
transmitted. `src/client.js` has no `fetch()` calls. Keep it that way.

## Security notes

- **The IP comes from `CF-Connecting-IP`**, which Cloudflare sets at the edge
  and strips from inbound requests. `X-Forwarded-For` is caller-supplied and
  trivially spoofed — this codebase never reads it.
- **Every response is `no-store`.** The body contains the requester's own
  address and must never be cached by us, by Cloudflare, or by a proxy in
  between.
- **CSP uses a per-request nonce**, so the inline style and script run without
  `unsafe-inline`. If you add an inline `style="..."` attribute it will be
  blocked — nonces don't apply to attributes. Use a class.
- **Rate limited** to 60 requests/minute/IP via the native binding. It's
  eventually consistent and errs permissive by design, which is the right
  tradeoff for an anonymous public endpoint.
- All interpolated values are HTML-escaped in `src/render.js`. The user-agent
  string is attacker-controlled and is echoed to the page — don't remove that
  escaping.

## Limits

Workers Free is 100,000 requests/day and 10ms CPU per request. Past the daily
limit Cloudflare returns Error 1027 rather than billing you. This Worker uses a
fraction of the CPU budget.

## Development

```bash
npm install
npm run dev      # http://127.0.0.1:8787
```

Locally, `request.cf` is a placeholder (Wrangler mocks a fixed US location)
and `CF-Connecting-IP` is `127.0.0.1`. Pass the header yourself to test a
specific address:

```bash
curl -H "CF-Connecting-IP: 203.0.113.42" http://127.0.0.1:8787/
curl -H "CF-Connecting-IP: 2606:4700:4700::1111" http://127.0.0.1:8787/json
```

## Deploy

```bash
npx wrangler login     # opens a browser; authorize your own Cloudflare account
npm run deploy
```

First deploy publishes to `snailtrailz.<your-subdomain>.workers.dev`. Attaching
a real domain later is a config change, not a rebuild.

## Layout

```
src/index.js    routing, content negotiation, rate limiting, headers
src/render.js   HTML rendering + escaping
src/client.js   browser-side script, inlined under the CSP nonce
legacy/         the original 2024 static site, kept for reference
```
