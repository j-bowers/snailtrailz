// Runs the browser-side script under Node with a stubbed DOM. This tests the
// detection logic — given this user-agent, what label? — not rendering, CSS,
// or the CSP nonce path. Those still need a real browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { clientScript } from '../src/client.js';

/** Evaluate clientScript against a fake page and return what it wrote to each element. */
function run(ua, { edgeTz = 'America/New_York', localTz = 'America/New_York', touch = 0 } = {}) {
  const els = {};
  const el = (id) => (els[id] ??= { textContent: '', className: 'note', hidden: true, addEventListener() {} });
  const ctx = {
    navigator: { userAgent: ua, maxTouchPoints: touch, languages: ['en-GB', 'en'], hardwareConcurrency: 8, deviceMemory: 8, clipboard: {} },
    screen: { width: 1440, height: 900 },
    window: { devicePixelRatio: 2 },
    document: { getElementById: el, body: { getAttribute: (k) => (k === 'data-edge-tz' ? edgeTz : null) } },
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: localTz }) }) },
    setTimeout,
  };
  vm.runInNewContext(clientScript, ctx);
  return Object.fromEntries(Object.entries(els).map(([k, v]) => [k, v.textContent]));
}

const UA = {
  macChrome:    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  macSafari:    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  iphone:       'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.0.0 Mobile/15E148 Safari/604.1',
  iphoneFirefox:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge:   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/129.0.2792.61 Mobile/15E148 Safari/604.1',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  androidTablet:'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  samsung:      'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  winEdge:      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  winFirefox:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
  linuxOpera:   'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/115.0.0.0',
  chromeOS:     'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

test('browser detection', () => {
  const cases = [
    [UA.macChrome, 'Chrome 129'],
    [UA.macSafari, 'Safari 17'],
    [UA.iphone, 'Safari 17'],
    [UA.iphoneChrome, 'Chrome 129'],
    [UA.iphoneFirefox, 'Firefox 130'],
    [UA.iphoneEdge, 'Edge 129'],
    [UA.samsung, 'Samsung Internet 26'],
    [UA.winEdge, 'Edge 129'],
    [UA.winFirefox, 'Firefox 130'],
    [UA.linuxOpera, 'Opera 115'],
    [UA.chromeOS, 'Chrome 129'],
  ];
  for (const [ua, expected] of cases) assert.equal(run(ua)['c-browser'], expected, ua);
});

test('OS and device detection', () => {
  const cases = [
    [UA.macChrome, {}, 'macOS 10.15.7', 'Desktop'],
    [UA.iphone, {}, 'iOS 17.5', 'Phone'],
    // iPadOS 13+ claims to be a Mac; touch points give it away.
    [UA.macSafari, { touch: 5 }, 'iPadOS', 'Tablet'],
    [UA.androidPhone, {}, 'Android 14', 'Phone'],
    [UA.androidTablet, {}, 'Android 14', 'Tablet'],
    [UA.winEdge, {}, 'Windows 10 or 11', 'Desktop'],
    [UA.linuxOpera, {}, 'Linux', 'Desktop'],
    [UA.chromeOS, {}, 'ChromeOS 14541.0.0', 'Desktop'],
  ];
  for (const [ua, opts, os, device] of cases) {
    const r = run(ua, opts);
    assert.equal(r['c-os'], os, ua);
    assert.equal(r['c-device'], device, ua);
  }
});

test('timezone cross-check', () => {
  assert.match(run(UA.macChrome)['c-timezone-note'], /^Matches/);
  assert.match(run(UA.macChrome, { localTz: 'Europe/London' })['c-timezone-note'], /^Does not match.*America\/New_York/);
  // No edge timezone → no verdict either way. Previously rendered as "—" and
  // produced a false VPN warning.
  assert.equal(run(UA.macChrome, { edgeTz: '' })['c-timezone-note'], '');
  assert.equal(run(UA.macChrome, { localTz: '' })['c-timezone-note'], '');
});

test('fingerprint surface', () => {
  const r = run(UA.macChrome);
  assert.equal(r['c-screen'], '1440 × 900 @ 2x');
  assert.equal(r['c-languages'], 'en-GB, en');
  assert.equal(r['c-cores'], '8');
  assert.equal(r['c-memory'], '8 GB (approx)');
  assert.equal(r['c-touch'], 'none');
  assert.equal(r['c-timezone'], 'America/New_York');
});

test('client script never talks to the network', () => {
  assert.doesNotMatch(clientScript, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);
});
