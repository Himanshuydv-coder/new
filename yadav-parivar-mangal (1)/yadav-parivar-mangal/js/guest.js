/*
 * Guest-name helpers shared by the invitation page and the secret link-maker page.
 * Pure functions, no DOM access except where noted, so they can be unit-tested in Node.
 *
 * The guest name travels in the URL as  ?guest=<percent-encoded UTF-8 name>.
 * It is only ever put on the page with textContent (never innerHTML).
 */
(function (root) {
  'use strict';

  var MAX_LEN = 60;
  var COUPLE = 'आंचल यादव ♥ अनंत यादव';
  var DATE_TEXT = '02 दिसंबर 2026, बुधवार';
  var PLACE_TEXT = 'ग्राम हाफिजपुर, पोस्ट हाफिजपुर, जिला आजमगढ़, उत्तर प्रदेश।';

  // Remove control / format characters (bidi overrides etc.) but keep ZWJ/ZWNJ which Devanagari needs.
  function stripUnsafe(s) {
    var out = '';
    for (var ch of s) {
      var cp = ch.codePointAt(0);
      if (cp === 0x200c || cp === 0x200d) { out += ch; continue; }
      if (/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}]/u.test(ch)) { out += ' '; continue; }
      out += ch;
    }
    return out;
  }

  /** Validate + normalise a raw guest name. Returns {ok, name, error}. */
  function normalizeName(raw) {
    if (typeof raw !== 'string') return { ok: false, name: '', error: 'empty' };
    var s = stripUnsafe(raw);
    try { s = s.normalize('NFC'); } catch (e) { /* ignore */ }
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) return { ok: false, name: '', error: 'empty' };
    if (s.indexOf('�') !== -1) return { ok: false, name: '', error: 'invalid' };
    if (!/\p{L}/u.test(s)) return { ok: false, name: '', error: 'invalid' };
    if (Array.from(s).length > MAX_LEN) return { ok: false, name: '', error: 'toolong' };
    return { ok: true, name: s, error: '' };
  }

  /** Read the guest name from a query string. Never throws; returns '' when absent/invalid. */
  function readFromSearch(search) {
    try {
      var params = new URLSearchParams(search || '');
      var raw = params.get('guest');
      if (raw === null) return '';
      var r = normalizeName(raw);
      return r.ok ? r.name : '';
    } catch (e) {
      return '';
    }
  }

  /** Build the personal link from a base URL (page folder) and a validated name. */
  function buildLink(baseUrl, name) {
    var base = String(baseUrl).split('#')[0].split('?')[0];
    return base + '?guest=' + encodeURIComponent(name);
  }

  /** "आदरणीय <name> जी" without doubling honorifics the user may have typed already. */
  function honorific(name) {
    var n = name;
    var pre = /^आदरणीय\s+/.test(n) ? '' : 'आदरणीय ';
    var post = /\sजी$/.test(n) ? '' : ' जी';
    return pre + n + post;
  }

  function buildMessage(name, link) {
    return [
      '🙏 श्री गणेशाय नमः 🙏',
      '',
      honorific(name) + ',',
      '',
      'आपको सादर आमंत्रित करते हुए हमें अत्यंत हर्ष हो रहा है कि हमारे परिवार में आंचल यादव एवं अनंत यादव का शुभ विवाह दिनांक ' + DATE_TEXT + ' को संपन्न होगा।',
      '',
      'इस मंगल अवसर पर आपकी गरिमामयी उपस्थिति एवं नवयुगल को आपके स्नेहिल आशीर्वाद की हार्दिक अभिलाषा है।',
      '',
      'कृपया नीचे दिए गए लिंक पर क्लिक करके हमारा डिजिटल विवाह निमंत्रण देखें।',
      '',
      'व्यक्तिगत विवाह निमंत्रण: ' + link,
      '',
      'स्थान: ' + PLACE_TEXT,
      '',
      'सादर आमंत्रक — यादव परिवार।'
    ].join('\n');
  }

  function whatsappUrl(message) {
    return 'https://wa.me/?text=' + encodeURIComponent(message);
  }

  /** Split text into words -> grapheme-like clusters (base + combining marks + virama conjuncts). */
  function clusters(text) {
    var out = [], cur = '', prev = '';
    for (var ch of text) {
      var isMark = /\p{M}/u.test(ch) || ch === '‍' || ch === '‌';
      var afterVirama = prev === '्' || prev === '‍';
      if (cur && !isMark && !afterVirama) { out.push(cur); cur = ''; }
      cur += ch; prev = ch;
    }
    if (cur) out.push(cur);
    return out;
  }

  var api = {
    MAX_LEN: MAX_LEN, COUPLE: COUPLE, DATE_TEXT: DATE_TEXT, PLACE_TEXT: PLACE_TEXT,
    normalizeName: normalizeName, readFromSearch: readFromSearch, buildLink: buildLink,
    honorific: honorific, buildMessage: buildMessage, whatsappUrl: whatsappUrl, clusters: clusters
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YadavGuest = api;
})(typeof window !== 'undefined' ? window : globalThis);
