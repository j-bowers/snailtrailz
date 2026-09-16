import { clientScript } from './client.js';

const esc = (v) =>
  v === null || v === undefined || v === ''
    ? '—'
    : String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

/** ISO-3166 alpha-2 → regional indicator pair. Returns '' for anything else. */
function flag(code) {
  if (!code || code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function row(label, value, extra = '') {
  return `<div class="row"><dt>${esc(label)}</dt><dd>${value}${extra}</dd></div>`;
}

function clientRow(label, id, note = false) {
  return `<div class="row"><dt>${esc(label)}</dt><dd><span id="${esc(id)}">…</span>${
    note ? `<p class="note" id="${esc(id)}-note"></p>` : ''
  }</dd></div>`;
}

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    color-scheme: light dark;
    --bg: #f4f6f4;
    --panel: #ffffff;
    --ink: #17201a;
    --muted: #5d6b61;
    --line: #dfe5e0;
    --accent: #2f6b4f;
    --warn: #8a5a12;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1411; --panel: #161d18; --ink: #e7ede9; --muted: #9aa8a0;
      --line: #27322c; --accent: #7fc9a2; --warn: #e0b060;
    }
  }
  body {
    margin: 0; padding: 2rem 1rem 4rem;
    background: var(--bg); color: var(--ink);
    font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    /* min-height, not height: the old stylesheet clipped content on short screens */
    min-height: 100vh;
  }
  .wrap { max-width: 44rem; margin: 0 auto; }
  header { text-align: center; margin-bottom: 2rem; }
  .brand {
    display: inline-flex; align-items: center; gap: .5rem;
    font-weight: 600; letter-spacing: -.01em; color: var(--muted);
    text-decoration: none; font-size: .95rem;
  }
  .brand svg { display: block; }
  h1 { font-size: 1rem; font-weight: 500; color: var(--muted); margin: 1.5rem 0 .5rem; }
  .ip {
    font-family: var(--mono); font-size: clamp(1.5rem, 6vw, 2.5rem);
    font-weight: 600; letter-spacing: -.02em; word-break: break-all; margin: 0;
  }
  .ip-meta { color: var(--muted); font-size: .85rem; margin: .4rem 0 0; }
  button {
    font: inherit; font-size: .8rem; padding: .3rem .7rem; margin-left: .5rem;
    border: 1px solid var(--line); border-radius: 6px;
    background: var(--panel); color: var(--muted); cursor: pointer;
  }
  button:hover { color: var(--ink); border-color: var(--muted); }
  #copy-status { font-size: .8rem; color: var(--accent); margin-left: .5rem; }
  section {
    background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: .25rem 1.25rem; margin: 1rem 0;
  }
  h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .08em;
       color: var(--muted); margin: 1.25rem 0 .25rem; }
  .lede { color: var(--muted); font-size: .85rem; margin: 0 0 1rem; }
  .lede-last { margin-bottom: 1.25rem; }
  dl { margin: 0 0 1.25rem; }
  .row { display: flex; gap: 1rem; padding: .5rem 0; border-top: 1px solid var(--line); }
  .row:first-of-type { border-top: 0; }
  dt { flex: 0 0 11rem; color: var(--muted); font-size: .9rem; }
  dd { margin: 0; flex: 1; min-width: 0; word-break: break-word; }
  .mono { font-family: var(--mono); font-size: .92em; }
  .note { font-size: .8rem; color: var(--muted); margin: .25rem 0 0; }
  .note-match { color: var(--accent); }
  .note-mismatch { color: var(--warn); }
  pre {
    font-family: var(--mono); font-size: .85rem; background: var(--bg);
    border: 1px solid var(--line); border-radius: 8px;
    padding: .75rem 1rem; overflow-x: auto; margin: .5rem 0;
  }
  footer { color: var(--muted); font-size: .85rem; margin-top: 2rem; text-align: center; }
  footer a { color: inherit; }
  @media (max-width: 34rem) {
    .row { display: block; }
    dt { margin-bottom: .1rem; }
  }
`;

const SNAIL = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
  <path d="M2 18h6"/><path d="M9 18a6 6 0 1 0 6-6 4 4 0 0 0-4 4 2.5 2.5 0 0 0 4.5 1.5"/>
  <path d="M16 8l1.5-3"/><path d="M19 7.5l1.5-3"/>
</svg>`;

export function renderPage(data, nonce, opts = {}) {
  const { ip, ipVersion, network, location, connection, userAgent } = data;
  const n = esc(nonce);
  // Whatever host the visitor actually reached us on, so the shell examples
  // are correct on workers.dev today and on a real domain later, with no edit.
  const host = opts.host || 'snailtrailz.example';
  const countryLabel = [flag(location.country), location.country].filter(Boolean).join(' ');
  const place = [location.city, location.region].filter(Boolean).join(', ');

  const heading = opts.notFound
    ? `<h1>Page not found — but here you are anyway</h1>`
    : `<h1>Your IP address</h1>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SnailTrailz — what the internet knows about you</title>
<meta name="description" content="Your IP address, where it says you are, and what your browser gives away. Nothing is logged.">
<meta name="robots" content="index, follow">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>%F0%9F%90%8C</text></svg>">
<style nonce="${n}">${STYLES}</style>
</head>
<body data-edge-tz="${esc(location.timezone === null ? '' : location.timezone)}">
<div class="wrap">

<header>
  <span class="brand">${SNAIL} SnailTrailz</span>
</header>

<main>
  ${heading}
  <p class="ip">${esc(ip)}</p>
  <p class="ip-meta">
    ${ipVersion ? `IPv${esc(ipVersion)}` : 'address unavailable'}
    <button id="copy-ip" data-ip="${esc(ip)}" hidden>Copy</button>
    <span id="copy-status" role="status" aria-live="polite"></span>
  </p>

  <section>
    <h2>What your connection reveals</h2>
    <p class="lede">Read from your request at the network edge. This is what every site you visit can see without asking.</p>
    <dl>
      ${row('Country', esc(countryLabel))}
      ${row('Region / city', esc(place))}
      ${row('Postal code', esc(location.postalCode))}
      ${row('Timezone', esc(location.timezone))}
      ${row('Network (ASN)', network.asn ? `<span class="mono">AS${esc(network.asn)}</span>` : '—')}
      ${row('Operator', esc(network.organization))}
    </dl>

    <h2>How you got here</h2>
    <dl>
      ${row('Protocol', `<span class="mono">${esc(connection.httpProtocol)}</span>`)}
      ${row('TLS version', `<span class="mono">${esc(connection.tlsVersion)}</span>`)}
      ${row('Cipher', `<span class="mono">${esc(connection.tlsCipher)}</span>`)}
      ${row('Served from', esc(connection.edgeLocation))}
    </dl>
  </section>

  <section>
    <h2>What your browser reveals</h2>
    <p class="lede">Read in your browser by the script on this page. It is <strong>never sent to our server</strong> — but any other site could read the same things and quietly keep them.</p>
    <dl>
      ${clientRow('Operating system', 'c-os')}
      ${clientRow('Device type', 'c-device')}
      ${clientRow('Browser', 'c-browser')}
      ${clientRow('Screen', 'c-screen')}
      ${clientRow('Languages', 'c-languages')}
      ${clientRow('CPU cores', 'c-cores')}
      ${clientRow('Memory', 'c-memory')}
      ${clientRow('Touch', 'c-touch')}
      <div class="row">
        <dt>Timezone</dt>
        <dd><span id="c-timezone">…</span><p class="note" id="c-tz-note"></p></dd>
      </div>
    </dl>
    <p class="note">Browsers deliberately freeze or round some of these to make you harder to track, so a version number here may be a polite fiction. Safari, for instance, has reported macOS 10.15.7 for years.</p>
  </section>

  <section>
    <h2>Use it from the command line</h2>
    <pre>$ curl ${esc(host)}
${esc(ip)}

$ curl ${esc(host)}/json</pre>
    <p class="note">The root returns your address and nothing else, so <span class="mono">IP=$(curl -s ${esc(host)})</span> does what you would expect. <span class="mono">/json</span> returns everything above, CORS-enabled.</p>
  </section>

  <section>
    <h2>What we keep</h2>
    <p class="lede lede-last">Nothing. SnailTrailz writes no logs, sets no cookies, and stores no record of your visit. Your request is read, answered, and forgotten. Cloudflare delivers this site and, like any network carrying your traffic, sees the request in transit.</p>
  </section>
</main>

<footer>
  <p>Your user agent: <span class="mono">${esc(userAgent)}</span></p>
  <p>Thanks for visiting SnailTrailz.</p>
</footer>

</div>
<script nonce="${n}">${clientScript}</script>
</body>
</html>
`;
}
