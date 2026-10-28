/*
 * Background music controller.
 *  - One <audio> element (unlocked by the guest's first tap), tracks swapped with a soft fade.
 *  - Music never starts before the guest taps "शाही निमंत्रण खोलें".
 *  - If a file is missing/blocked, nothing else on the site is affected.
 *  - If the guest turns music off, it stays off (we never restart it by ourselves).
 */
(function (root) {
  'use strict';

  var SRC = { welcome: 'assets/audio/welcome.mp3', card: 'assets/audio/card.mp3' };
  var MAX_VOL = 0.7;

  var el = null;            // the audio element (created on first start)
  var current = null;       // 'welcome' | 'card'
  var enabled = false;      // does the guest want music right now?
  var failed = false;       // audio file could not be loaded/played
  var canVolume = true;     // iOS Safari ignores element.volume
  var token = 0;            // cancels stale fades/switches
  var listeners = [];

  function emit() { listeners.forEach(function (fn) { try { fn(state()); } catch (e) { /* ignore */ } }); }
  function state() { return { enabled: enabled, failed: failed, track: current }; }

  function make() {
    if (el) return el;
    el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    try { el.volume = 0.5; canVolume = Math.abs(el.volume - 0.5) < 0.01; el.volume = 0; } catch (e) { canVolume = false; }
    el.addEventListener('error', function () { failed = true; enabled = false; emit(); });
    document.addEventListener('visibilitychange', function () {
      if (!el) return;
      if (document.hidden) { el.pause(); }
      else if (enabled && !failed) { var p = el.play(); if (p && p.catch) p.catch(function () { enabled = false; emit(); }); }
    });
    return el;
  }

  function fadeTo(target, ms) {
    var my = ++token;
    return new Promise(function (resolve) {
      if (!el) return resolve();
      if (!canVolume || ms <= 0) { try { el.volume = canVolume ? target : 1; } catch (e) { /* ignore */ } return resolve(); }
      var from = el.volume, t0 = Date.now();
      var id = setInterval(function () {
        if (my !== token) { clearInterval(id); return resolve(); }
        var k = Math.min(1, (Date.now() - t0) / ms);
        try { el.volume = Math.max(0, Math.min(1, from + (target - from) * k)); } catch (e) { /* ignore */ }
        if (k >= 1) { clearInterval(id); resolve(); }
      }, 40);
    });
  }

  function playCurrent() {
    var p;
    try { p = el.play(); } catch (e) { p = Promise.reject(e); }
    return Promise.resolve(p).then(function () { return true; }, function () { return false; });
  }

  /** Must be called directly from a tap handler. Resolves true when music is playing. */
  function start(name) {
    make();
    failed = false;
    enabled = true;
    current = name || 'welcome';
    el.src = SRC[current];
    try { el.volume = canVolume ? 0 : 1; } catch (e) { /* ignore */ }
    var played = playCurrent();          // call play() synchronously (gesture rule)
    emit();
    return played.then(function (ok) {
      if (!ok) { enabled = false; failed = true; emit(); return false; }
      return fadeTo(MAX_VOL, 2200).then(function () { return true; });
    });
  }

  /** Move to another track with a gentle fade-out / fade-in. Respects a muted state. */
  function switchTo(name) {
    if (!el || current === name) return Promise.resolve();
    current = name;
    if (!enabled || failed) { el.src = SRC[name]; el.pause(); return Promise.resolve(); }
    return fadeTo(0, 900).then(function () {
      if (!enabled || current !== name) return;
      el.src = SRC[name];
      return playCurrent().then(function (ok) {
        if (!ok) { enabled = false; failed = true; emit(); return; }
        return fadeTo(MAX_VOL, 2200);
      });
    });
  }

  /** Toggle by the guest's choice. Resolves with the new enabled state. */
  function toggle() {
    make();
    if (enabled) {
      enabled = false; emit();
      return fadeTo(0, 400).then(function () { if (!enabled) el.pause(); return false; });
    }
    enabled = true; failed = false;
    if (!current) current = 'welcome';
    if (!el.src) el.src = SRC[current];
    try { el.volume = canVolume ? 0 : 1; } catch (e) { /* ignore */ }
    var ok = playCurrent();
    emit();
    return ok.then(function (played) {
      if (!played) { enabled = false; failed = true; emit(); return false; }
      return fadeTo(MAX_VOL, 1200).then(function () { return true; });
    });
  }

  root.YadavMusic = {
    start: start, switchTo: switchTo, toggle: toggle,
    isEnabled: function () { return enabled; },
    hasFailed: function () { return failed; },
    onChange: function (fn) { listeners.push(fn); }
  };
})(window);
