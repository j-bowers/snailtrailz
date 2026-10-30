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

// BowCloud brand: tokens from "BowCloud Designs/07 Colors", type is Bricolage Grotesque
// (headings) + Figtree (body), self-hosted from public/fonts. Gold is for accents only and
// never carries text on the light theme.
const STYLES = `
  @font-face { font-family: "Bricolage Grotesque"; src: url("/fonts/bricolage-grotesque.woff2") format("woff2");
    font-weight: 400 800; font-display: swap; }
  @font-face { font-family: "Figtree"; src: url("/fonts/figtree.woff2") format("woff2");
    font-weight: 400 700; font-style: normal; font-display: swap; }
  @font-face { font-family: "Figtree"; src: url("/fonts/figtree-italic.woff2") format("woff2");
    font-weight: 400; font-style: italic; font-display: swap; }
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    color-scheme: light dark;
    --bg: #F8F6FB;      /* Canvas */
    --panel: #FFFFFF;
    --ink: #221A2E;     /* Ink */
    --muted: #5E5470;
    --line: #E3DDEC;
    --accent: #6B3FB8;  /* Violet */
    --gold: #F4B740;
    --match: #237A68;   /* Teal */
    --warn: #8A5A12;
    --snail: #6B3FB8; --feelers: #2B1A40;
    --code-bg: #EFE8FA;
    --display: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
    --body: "Figtree", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1E1230; --panel: #2B1A40; --ink: #EFE8FA; --muted: #B9ADCB;
      --line: #3F2B58; --accent: #C9B4F2; --match: #8FE0C8; --warn: #F4B740;
      --snail: #FFFFFF; --feelers: #F4B740; --code-bg: #170E25;
    }
  }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.55 var(--body); -webkit-font-smoothing: antialiased;
    /* min-height, not height: the old stylesheet clipped content on short screens */
    min-height: 100vh;
  }
  a { color: var(--accent); text-underline-offset: .18em; }
  :focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 3px; }
  .wrap { max-width: 46rem; margin: 0 auto; padding: 0 1.25rem; }
  .top { border-bottom: 1px solid var(--line); }
  .top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    flex-wrap: wrap; padding-top: .9rem; padding-bottom: .9rem; }
  .brand { display: inline-flex; align-items: center; gap: .5rem; color: var(--ink); text-decoration: none;
    font: 700 1.3rem var(--display); letter-spacing: -.015em; }
  .brand svg { display: block; width: 2rem; height: 2rem; }
  .snail { stroke: var(--snail); } .feelers { stroke: var(--feelers); }
  .by { display: inline-flex; align-items: center; gap: .4rem; color: var(--muted); text-decoration: none;
    font-size: .85rem; font-weight: 600; }
  .by:hover { color: var(--ink); }
  .by svg { width: 1.35rem; height: 1.35rem; display: block; }
  .mk-cloud { stroke: var(--snail); } .mk-arrow { stroke: var(--feelers); } .mk-head { fill: var(--feelers); stroke: var(--feelers); }
  main { padding: 2.5rem 0 1rem; }
  h1 { font: 600 .8rem var(--display); text-transform: uppercase; letter-spacing: .12em;
    color: var(--muted); margin: 0 0 .5rem; }
  .hero { background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
    padding: 1.5rem 1.5rem 1.25rem; margin-bottom: 1.5rem; position: relative; overflow: hidden; }
  .hero::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--gold); }
  .ip {
    font-family: var(--mono); font-size: clamp(1.6rem, 6.5vw, 2.8rem);
    font-weight: 600; letter-spacing: -.02em; word-break: break-all; margin: 0; line-height: 1.15;
  }
  .ip-meta { color: var(--muted); font-size: .85rem; margin: .6rem 0 0; display: flex; align-items: center;
    flex-wrap: wrap; gap: .5rem; }
  .ver { font: 700 .7rem/1 var(--body); letter-spacing: .08em; text-transform: uppercase; padding: .38em .65em;
    border-radius: 999px; background: var(--code-bg); color: var(--accent); }
  button {
    font: 600 .8rem var(--body); padding: .35rem .8rem;
    border: 1px solid var(--accent); border-radius: 999px;
    background: transparent; color: var(--accent); cursor: pointer;
  }
  button:hover { background: var(--accent); color: var(--panel); }
  #copy-status { font-size: .8rem; color: var(--match); }
  section {
    background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
    padding: .25rem 1.5rem; margin: 1rem 0;
  }
  h2 { font: 700 1.15rem/1.2 var(--display); letter-spacing: -.01em; margin: 1.4rem 0 .4rem; }
  h2::before { content: ""; display: block; width: 1.75rem; height: 3px; border-radius: 2px;
    background: var(--gold); margin-bottom: .55rem; }
  .lede { color: var(--muted); font-size: .9rem; margin: 0 0 1rem; }
  .lede-last { margin-bottom: 1.4rem; }
  dl { margin: 0 0 1.25rem; }
  .row { display: flex; gap: 1rem; padding: .55rem 0; border-top: 1px solid var(--line); }
  .row:first-of-type { border-top: 0; }
  dt { flex: 0 0 11rem; color: var(--muted); font-size: .9rem; }
  dd { margin: 0; flex: 1; min-width: 0; word-break: break-word; font-weight: 500; }
  .mono { font-family: var(--mono); font-size: .9em; }
  .note { font-size: .82rem; color: var(--muted); margin: .25rem 0 0; }
  section > .note:last-child { margin-bottom: 1.25rem; }
  .note-match { color: var(--match); }
  .note-mismatch { color: var(--warn); }
  pre {
    font-family: var(--mono); font-size: .85rem; background: var(--code-bg); color: var(--ink);
    border-radius: 8px; padding: .85rem 1rem; overflow-x: auto; margin: .5rem 0;
  }
  footer { border-top: 1px solid var(--line); margin-top: 2.5rem; color: var(--muted); font-size: .85rem; }
  footer .wrap { padding-top: 1.25rem; padding-bottom: 2.5rem; }
  footer p { margin: .35rem 0; }
  footer a { color: inherit; }
  .ua { word-break: break-all; }
  @media (max-width: 34rem) {
    .row { display: block; }
    dt { margin-bottom: .1rem; }
    section, .hero { padding-left: 1.1rem; padding-right: 1.1rem; }
  }
`;

const SNAIL = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
  <g class="snail"><path d="M2 18h6"/><path d="M9 18a6 6 0 1 0 6-6 4 4 0 0 0-4 4 2.5 2.5 0 0 0 4.5 1.5"/></g>
  <g class="feelers"><path d="M16 8l1.5-3"/><path d="M19 7.5l1.5-3"/></g>
</svg>`;

// The BowCloud mark, small-size version: cloud outline with the gold arrow.
const BOWCLOUD = `<svg viewBox="0 0 120 120" aria-hidden="true"><path class="mk-cloud" d="M16 78C8 78 6 62 18 58C18 44 34 38 44 44C48 28 72 24 80 40C94 36 106 48 100 60C110 64 110 78 104 78" fill="none" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path class="mk-arrow" d="M60 100V26" stroke-width="10" stroke-linecap="round"/><path class="mk-head" d="M60 2L44 28H76Z" stroke-width="4" stroke-linejoin="round"/></svg>`;

// Favicon: the snail on a Night tile, feelers in gold. Inline data: URI (img-src allows data:).
const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7.3" fill="#2B1A40"/><g transform="translate(4 4)" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M2 18h6M9 18a6 6 0 1 0 6-6 4 4 0 0 0-4 4 2.5 2.5 0 0 0 4.5 1.5" stroke="#fff"/><path d="M16 8l1.5-3M19 7.5l1.5-3" stroke="#F4B740"/></g></svg>`
);

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
<link rel="icon" href="${FAVICON}">
<meta name="theme-color" content="#2B1A40">
<style nonce="${n}">${STYLES}</style>
</head>
<body data-edge-tz="${location.timezone ? esc(location.timezone) : ''}">
<header class="top"><div class="wrap">
  <a class="brand" href="/">${SNAIL} SnailTrailz</a>
  <a class="by" href="https://bowcloud.dev">${BOWCLOUD} a BowCloud tool</a>
</div></header>

<div class="wrap">
<main>
  <div class="hero">
  ${heading}
  <p class="ip">${esc(ip)}</p>
  <p class="ip-meta">
    <span class="ver">${ipVersion ? `IPv${esc(ipVersion)}` : 'address unavailable'}</span>
    <button id="copy-ip" data-ip="${esc(ip)}" hidden>Copy</button>
    <span id="copy-status" role="status" aria-live="polite"></span>
  </p>
  </div>

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
      ${clientRow('Timezone', 'c-timezone', true)}
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

</div>

<footer><div class="wrap">
  <p>Your user agent: <span class="mono ua">${esc(userAgent)}</span></p>
  <p>SnailTrailz is a <a href="https://bowcloud.dev">BowCloud</a> tool. Source on <a href="https://github.com/j-bowers/snailtrailz">GitHub</a>.</p>
</div></footer>
<script nonce="${n}">${clientScript}</script>
</body>
</html>
`;
}
