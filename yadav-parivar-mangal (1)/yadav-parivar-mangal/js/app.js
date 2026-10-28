/*
 * यादव परिवार का मंगल परिणयोत्सव - invitation behaviour
 * Order of events:  gate (loading + start button) -> Ganesh -> welcome (hands + guest name)
 *                   -> 5 s after the welcome begins the palace-door envelope -> main card.
 */
(function () {
  'use strict';

  var G = window.YadavGuest, M = window.YadavMusic;
  var doc = document, html = doc.documentElement, body = doc.body;
  var $ = function (id) { return doc.getElementById(id); };

  // ------------------------------------------------------------------ config
  // 02 December 2026, 00:00 in India (Asia/Kolkata = UTC+05:30, no daylight saving) -> a fixed instant.
  // NOTE: this is the start of the wedding DATE, not a muhurat time.
  var TARGET = Date.UTC(2026, 11, 1, 18, 30, 0);
  var DAY = 86400000;

  // ------------------------------------------------------------------ helpers
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { /* private mode */ }
    return null;
  }
  function prefersReduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function toast(msg) {
    var t = doc.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
  }

  // ------------------------------------------------------------------ smart performance mode
  // Only uses widely supported hints; it never claims to know the exact network speed.
  function autoLite() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var slow = !!(c && (c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || '') || (c.downlink && c.downlink < 1.2)));
    var weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    return !!(slow || weak);
  }
  var reduced = prefersReduced();
  var liteOverride = store('yadav-lite');
  var lite = liteOverride === '1' ? true : liteOverride === '0' ? false : autoLite();
  function applyModes() {
    html.classList.toggle('lite', lite || reduced);
    html.classList.toggle('rm', reduced);
  }
  applyModes();
  function isLite() { return lite || reduced; }

  // ------------------------------------------------------------------ guest
  var guest = G.readFromSearch(window.location.search);

  function appendClusters(parent, text, startIdx, step) {
    var idx = startIdx;
    text.split(' ').forEach(function (word, wi, arr) {
      var w = doc.createElement('span'); w.className = 'word'; w.setAttribute('aria-hidden', 'true');
      G.clusters(word).forEach(function (cl) {
        var s = doc.createElement('span'); s.className = 'ch'; s.textContent = cl;
        s.style.setProperty('--d', String(Math.round(idx * step)));
        w.appendChild(s); idx++;
      });
      parent.appendChild(w);
      if (wi < arr.length - 1) parent.appendChild(doc.createTextNode(' '));
    });
    return idx;
  }

  function buildWelcome() {
    var box = $('welcomeText');
    var line1 = guest ? G.honorific(guest) + ',' : 'आप सभी स्नेहीजन';
    var line2 = 'सादर आमंत्रित हैं।';
    var total = Array.from(line1).length + Array.from(line2).length;
    var step = Math.min(70, 1800 / Math.max(total, 1));
    box.textContent = '';
    var a = doc.createElement('span'); a.className = 'line';
    var b = doc.createElement('span'); b.className = 'line';
    var n = appendClusters(a, line1, 0, step);
    appendClusters(b, line2, n + 1, step);
    var sr = doc.createElement('span'); sr.className = 'sr-only'; sr.textContent = line1 + ' ' + line2;
    box.appendChild(sr); box.appendChild(a); box.appendChild(b);
    $('welcomeSub').textContent = 'आंचल यादव एवं अनंत यादव के शुभ विवाह में · 02 दिसंबर 2026, बुधवार';

    // main card: same guest, shown with textContent only (never as HTML)
    if (guest) {
      var gn = $('guestName');
      gn.textContent = G.honorific(guest) + ',';
      gn.hidden = false;
      $('guestSub').textContent = 'सादर आमंत्रित हैं।';
    }
  }

  // ------------------------------------------------------------------ gate (loader -> start button)
  var gateShown = false;
  function showStartButton() {
    if (gateShown) return; gateShown = true;
    $('gateSpin').hidden = true;
    $('gateSub').textContent = 'आपका निमंत्रण तैयार है';
    $('gateActions').hidden = false;
    try { $('startBtn').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function initGate() {
    var img = $('gateImg');
    if (img) {
      img.addEventListener('error', function () {
        var d = doc.createElement('div'); d.className = 'gate-fallback'; d.textContent = '🕉 श्री गणेशाय नमः';
        if (img.parentNode) img.parentNode.replaceChild(d, img);
      });
    }
    var ready = [];
    ready.push(new Promise(function (res) {
      if (doc.readyState === 'complete') res(); else window.addEventListener('load', function () { res(); });
    }));
    if (doc.fonts && doc.fonts.ready) ready.push(doc.fonts.ready.catch(function () {}));
    // Never keep the guest waiting: after 3.5 s show the button no matter what.
    setTimeout(showStartButton, 3500);
    Promise.all(ready).then(function () { setTimeout(showStartButton, 350); });
    $('startBtn').addEventListener('click', onStart);
  }

  // ------------------------------------------------------------------ intro timeline
  var timers = [], introActive = false, finished = false;
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  var intro, site;
  function stage(name) {
    intro.classList.remove('s-ganesh', 's-welcome', 's-env');
    intro.classList.add(name);
  }

  function onStart() {
    // 1. Music must be started synchronously inside this tap (browser autoplay rule).
    M.start('welcome').then(function (ok) {
      if (!ok) toast('संगीत शुरू नहीं हो सका। ऊपर दाईं ओर के बटन से दोबारा कोशिश करें — निमंत्रण संगीत के बिना भी देखा जा सकता है।');
    });
    $('musicBtn').hidden = false;

    $('gate').classList.add('gone');
    setTimeout(function () { $('gate').style.display = 'none'; }, 900);

    intro.hidden = false;
    introActive = true;
    $('skipBtn').focus({ preventScroll: true });
    startDust();

    var rm = reduced;
    if (rm) {
      // reduced motion: no travelling hands / opening doors, just short, calm steps
      stage('s-welcome');
      at(3500, finish);
      return;
    }
    // t = 0            Ganesh scene
    // t = W0 (3.4 s)   welcome animation begins (hands enter from the left, name appears letter by letter)
    // t = W0 + 5 s     envelope scene begins; doors open ~1 s later, card rises, then the main card shows
    var W0 = lite ? 2600 : 3400;
    stage('s-ganesh');
    at(W0, function () { stage('s-welcome'); });
    at(W0 + 5000, function () { stage('s-env'); });
    at(W0 + 6200, function () { intro.classList.add('s-open'); });
    at(W0 + 7000, function () { intro.classList.add('s-card'); });
    at(W0 + 9600, finish);
  }

  function finish() {
    if (finished) return; finished = true;
    clearTimers();
    M.switchTo('card');           // royal instrumental for the main card (soft fade)
    intro.classList.add('fade');
    site.classList.remove('pre');
    site.classList.remove('hero-wait'); site.classList.add('hero-go');
    body.classList.remove('lock');
    window.scrollTo(0, 0);
    setTimeout(function () {
      intro.hidden = true; introActive = false; stopDust();
      var h = $('siteTitle'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }, 1000);
  }

  // ------------------------------------------------------------------ gold dust (intro only, full mode only)
  var dust = { raf: 0, ctx: null, parts: [], w: 0, h: 0 };
  function startDust() {
    var cv = $('dust');
    if (isLite() || !cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'); if (!ctx) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function size() { dust.w = cv.clientWidth; dust.h = cv.clientHeight; cv.width = dust.w * dpr; cv.height = dust.h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    dust.ctx = ctx;
    var n = dust.w < 600 ? 26 : 44;
    dust.parts = [];
    for (var i = 0; i < n; i++) dust.parts.push({ x: Math.random() * dust.w, y: Math.random() * dust.h, r: 0.8 + Math.random() * 2, v: 8 + Math.random() * 22, p: Math.random() * 6.28 });
    var last = performance.now();
    (function frame(t) {
      if (!introActive) return;
      var dt = Math.min(0.05, (t - last) / 1000); last = t;
      ctx.clearRect(0, 0, dust.w, dust.h);
      for (var i = 0; i < dust.parts.length; i++) {
        var p = dust.parts[i];
        p.y -= p.v * dt; p.p += dt * 2;
        if (p.y < -6) { p.y = dust.h + 6; p.x = Math.random() * dust.w; }
        var a = 0.35 + 0.35 * Math.sin(p.p);
        ctx.beginPath(); ctx.fillStyle = 'rgba(255,226,140,' + a.toFixed(2) + ')';
        ctx.arc(p.x + Math.sin(p.p * 0.7) * 6, p.y, p.r, 0, 6.283); ctx.fill();
      }
      dust.raf = requestAnimationFrame(frame);
    })(last);
  }
  function stopDust() { cancelAnimationFrame(dust.raf); }

  // ------------------------------------------------------------------ countdown
  var cd = { box: null, msg: null, label: null, grid: null, note: null, nums: {}, last: {}, timer: 0 };
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function setNum(k, v, tick) {
    if (cd.last[k] === v) return;
    cd.last[k] = v; cd.nums[k].textContent = v;
    if (tick && !isLite()) { var b = cd.nums[k].parentNode; b.classList.remove('tick'); void b.offsetWidth; b.classList.add('tick'); }
  }
  function renderCountdown() {
    var now = Date.now(), diff = TARGET - now;
    if (diff > 0) {
      var d = Math.floor(diff / DAY), h = Math.floor(diff % DAY / 3600000), m = Math.floor(diff % 3600000 / 60000), s = Math.floor(diff % 60000 / 1000);
      setNum('d', pad(d), false); setNum('h', pad(h), false); setNum('m', pad(m), false); setNum('s', pad(s), true);
      cd.timer = setTimeout(renderCountdown, 1000 - (Date.now() % 1000) + 5);   // stay aligned to whole seconds
      return;
    }
    // the date has arrived: never show negative time
    cd.grid.hidden = true; cd.label.hidden = true; cd.note.hidden = true; cd.msg.hidden = false;
    if (now < TARGET + DAY) {
      cd.msg.textContent = 'आज शुभ विवाह का मंगल दिवस है — आपका हार्दिक स्वागत है 🙏';
      cd.timer = setTimeout(renderCountdown, 60000);
    } else {
      cd.msg.textContent = 'शुभ विवाह मंगलमय संपन्न हुआ। आपके स्नेह एवं आशीर्वाद के लिए हृदय से आभार 🙏';
    }
  }
  function initCountdown() {
    cd.grid = $('cdGrid'); cd.msg = $('cdMsg'); cd.note = $('cdNote'); cd.label = doc.querySelector('#countdown .cd-label');
    Array.prototype.forEach.call(cd.grid.querySelectorAll('.cd-num'), function (n) { cd.nums[n.getAttribute('data-u')] = n; });
    renderCountdown();
  }

  // ------------------------------------------------------------------ reveal on scroll
  function initReveal() {
    var items = doc.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { Array.prototype.forEach.call(items, function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    Array.prototype.forEach.call(items, function (n) { io.observe(n); });
  }

  // ------------------------------------------------------------------ controls
  function initControls() {
    var top = $('toTop'), ticking = false, progress = $('progress'), tl = doc.querySelector('.timeline');
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        top.classList.toggle('show', window.scrollY > 500);
        var max = doc.documentElement.scrollHeight - window.innerHeight;
        if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ')';
        if (tl) {
          var r = tl.getBoundingClientRect(), mid = window.innerHeight * 0.55;
          tl.style.setProperty('--p', Math.max(0, Math.min(1, (mid - r.top) / Math.max(r.height, 1))).toFixed(3));
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });

    var mb = $('musicBtn');
    function paint() {
      var on = M.isEnabled();
      mb.setAttribute('aria-pressed', on ? 'true' : 'false');
      mb.setAttribute('aria-label', on ? 'संगीत बंद करें' : 'संगीत चालू करें');
      $('musicLbl').textContent = on ? 'संगीत चालू' : 'संगीत बंद';
    }
    M.onChange(paint); paint();
    mb.addEventListener('click', function () {
      M.toggle().then(function (on) {
        if (on === false && M.hasFailed()) toast('संगीत चल नहीं पाया — निमंत्रण संगीत के बिना देखा जा सकता है।');
        paint();
      });
    });

    var lb = $('liteBtn');
    function paintLite() { lb.textContent = (lite || reduced) ? 'चालू' : 'बंद'; lb.setAttribute('aria-pressed', (lite || reduced) ? 'true' : 'false'); }
    paintLite();
    lb.addEventListener('click', function () {
      if (reduced) { toast('आपके डिवाइस में "कम गति" पहले से चालू है।'); return; }
      lite = !lite; store('yadav-lite', lite ? '1' : '0'); applyModes(); paintLite();
      if (!lite) initPetals(); // re-evaluate
    });

    $('skipBtn').addEventListener('click', function () { finish(); });
  }

  // ------------------------------------------------------------------ gallery lightbox
  function initGallery() {
    var lbx = $('lightbox'), img = $('lbImg'), cap = $('lbCap'), closeBtn = $('lbClose'), opener = null;
    function close() { lbx.hidden = true; body.classList.remove('lock'); if (opener) { try { opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
    Array.prototype.forEach.call(doc.querySelectorAll('.g-btn'), function (b) {
      b.addEventListener('click', function () {
        var im = b.querySelector('img'); opener = b;
        img.src = b.getAttribute('data-full') || im.currentSrc || im.getAttribute('src'); img.alt = im.getAttribute('alt') || ''; cap.textContent = b.getAttribute('data-cap') || '';
        lbx.hidden = false; body.classList.add('lock'); closeBtn.focus();
      });
    });
    closeBtn.addEventListener('click', close);
    lbx.addEventListener('click', function (e) { if (e.target === lbx) close(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lbx.hidden) close(); });
  }

  // ------------------------------------------------------------------ petal showers (main card + closing)
  var petalInit = {};
  function petalShower(canvasId, sectionId, small) {
    var cv = $(canvasId); if (!cv || !cv.getContext || petalInit[canvasId]) return;
    if (isLite() || !('IntersectionObserver' in window)) return;
    petalInit[canvasId] = true;
    var ctx = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), w = 0, h = 0, parts = [], running = false, raf = 0, last = 0;
    function size() { w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    var n = small ? (w < 600 ? 9 : 14) : (w < 600 ? 14 : 24), cols = ['#ffb703', '#f4a300', '#ffd54a', '#ff7a59'];
    for (var i = 0; i < n; i++) parts.push({ x: Math.random() * w, y: Math.random() * h, r: 4 + Math.random() * 5, v: 22 + Math.random() * 30, s: Math.random() * 6.28, rot: Math.random() * 6.28, c: cols[i % cols.length] });
    function frame(t) {
      if (!running) return;
      if (isLite()) { running = false; ctx.clearRect(0, 0, w, h); return; }
      var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i]; p.y += p.v * dt; p.s += dt; p.rot += dt * 1.4;
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        ctx.save(); ctx.translate(p.x + Math.sin(p.s) * 18, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.globalAlpha = small ? 0.7 : 0.85; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 6.283); ctx.fill(); ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
        else if (!e.isIntersecting) { running = false; cancelAnimationFrame(raf); }
      });
    }, { threshold: 0.05 }).observe($(sectionId));
  }
  function initPetals() { petalShower('petals', 'samapan', false); petalShower('petalsHero', 'top', true); }

  // ------------------------------------------------------------------ boot
  function boot() {
    intro = $('intro'); site = $('site');
    site.classList.add('pre', 'hero-wait');   // hidden behind the gate until the intro finishes
    buildWelcome();
    initCountdown();
    initReveal();
    initControls();
    initGallery();
    initPetals();
    initGate();
    window.__yadavBooted = true;
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
