/**
 * Browser-side script, inlined into the page under a CSP nonce.
 *
 * Everything here reads from the visitor's own browser and stays there.
 * None of it is sent to the server — that is the point of the section it
 * fills in. Keep it that way: no fetch() calls, no beacons.
 */
export const clientScript = String.raw`
(function () {
  'use strict';

  var set = function (id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value == null || value === '' ? '—' : String(value);
  };

  // --- Operating system -----------------------------------------------------
  // User-agent string first, platform second. The old version checked
  // navigator.platform first, which made every Android device report "Linux"
  // and every iPad report "MacOS".
  function detectOS() {
    var ua = navigator.userAgent;
    var os = 'Unknown', version = '', device = 'Desktop', m;

    if (/Android/i.test(ua)) {
      os = 'Android';
      device = /Mobile/.test(ua) ? 'Phone' : 'Tablet';
      m = ua.match(/Android (\d+(?:\.\d+)*)/);
      if (m) version = m[1];
    } else if (/iPhone|iPod/.test(ua)) {
      os = 'iOS';
      device = 'Phone';
      m = ua.match(/OS (\d+(?:[._]\d+)*)/);
      if (m) version = m[1].replace(/_/g, '.');
    } else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      // iPadOS 13+ claims to be a Mac. Touch points give it away.
      os = 'iPadOS';
      device = 'Tablet';
      m = ua.match(/OS (\d+(?:[._]\d+)*)/);
      if (m) version = m[1].replace(/_/g, '.');
    } else if (/CrOS/.test(ua)) {
      os = 'ChromeOS';
      m = ua.match(/CrOS \S+ (\d+(?:\.\d+)*)/);
      if (m) version = m[1];
    } else if (/Windows NT/.test(ua)) {
      os = 'Windows';
      m = ua.match(/Windows NT (\d+\.\d+)/);
      // Windows 11 still reports NT 10.0. Only Client Hints can tell them apart.
      if (m) version = m[1] === '10.0' ? '10 or 11' : m[1];
    } else if (/Mac OS X/.test(ua)) {
      os = 'macOS';
      m = ua.match(/Mac OS X (\d+(?:[._]\d+)*)/);
      if (m) version = m[1].replace(/_/g, '.');
    } else if (/Linux/.test(ua)) {
      os = 'Linux';
    }

    if (/Mobi/.test(ua) && device === 'Desktop') device = 'Phone';
    return { os: os, version: version, device: device };
  }

  function detectBrowser() {
    var ua = navigator.userAgent, m;
    if ((m = ua.match(/Firefox\/(\d+)/))) return 'Firefox ' + m[1];
    if ((m = ua.match(/Edg\/(\d+)/))) return 'Edge ' + m[1];
    if ((m = ua.match(/OPR\/(\d+)/))) return 'Opera ' + m[1];
    if ((m = ua.match(/Chrome\/(\d+)/))) return 'Chrome ' + m[1];
    if (/Safari\//.test(ua) && (m = ua.match(/Version\/(\d+)/))) return 'Safari ' + m[1];
    return 'Unknown';
  }

  var info = detectOS();
  set('c-os', info.os + (info.version ? ' ' + info.version : ''));
  set('c-device', info.device);
  set('c-browser', detectBrowser());

  // --- Fingerprint surface --------------------------------------------------
  set('c-screen', screen.width + ' × ' + screen.height + ' @ ' + (window.devicePixelRatio || 1) + 'x');
  set('c-languages', (navigator.languages || [navigator.language]).join(', '));
  set('c-cores', navigator.hardwareConcurrency || 'not exposed');
  set('c-memory', navigator.deviceMemory ? navigator.deviceMemory + ' GB (approx)' : 'not exposed');
  set('c-touch', navigator.maxTouchPoints > 0 ? navigator.maxTouchPoints + ' points' : 'none');

  var tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (e) { /* older browsers */ }
  set('c-timezone', tz);

  // --- Timezone cross-check -------------------------------------------------
  // Your browser reports the timezone your device is set to. The network
  // section reports the timezone of the IP you arrived on. A mismatch usually
  // means a VPN, a proxy, or travel — it is a hint, never proof.
  var edgeTz = document.body.getAttribute('data-edge-tz') || '';
  var note = document.getElementById('c-tz-note');
  if (note && tz && edgeTz) {
    if (tz === edgeTz) {
      note.textContent = 'Matches the timezone of your IP address.';
      note.className = 'note note-match';
    } else {
      note.textContent = 'Does not match your IP address (' + edgeTz + '). Usually a VPN, a proxy, or travel.';
      note.className = 'note note-mismatch';
    }
  }

  // --- Copy button ----------------------------------------------------------
  var btn = document.getElementById('copy-ip');
  if (btn && navigator.clipboard) {
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var ip = btn.getAttribute('data-ip') || '';
      navigator.clipboard.writeText(ip).then(function () {
        var status = document.getElementById('copy-status');
        if (status) {
          status.textContent = 'Copied';
          setTimeout(function () { status.textContent = ''; }, 2000);
        }
      }).catch(function () { /* clipboard denied; nothing to do */ });
    });
  }
})();
`;
