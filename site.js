/* site.js — Nikoflor: the split stage, the story clock and the real open/closed status.
 *
 * Desktop: the stage is fixed on the left and holds one image per scene, stacked in page order. Any element with
 * data-scene="<key>" turns its scene on as it crosses the middle of the screen: instantly for the six morning frames,
 * which share one camera, or as a shutter rising over data-wipe viewports of scroll.
 * Phone: the stage and the steps are pinned together for the morning; the scroll through that section picks the step,
 * and the frame and its line change in place. Later scenes are ordinary pictures in the page.
 * The clock: elements with data-time="h:mm" pin it to that time as they cross the same line; data-hold keeps it there
 * until the next one (the morning ticks with the frames), otherwise it runs minute by minute.
 * Position, never time: scrolling back runs all of it backwards. No dependencies.
 */
(function () {
  'use strict';

  var desk = window.matchMedia('(min-width: 1000px) and (min-aspect-ratio: 5/4)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var header = document.querySelector('.awning');
  var manana = document.querySelector('.manana');
  var stage = document.querySelector('.stage');
  var stepsBox = document.querySelector('.steps');
  var pin = document.querySelector('.pin');
  var clock = document.querySelector('[data-clock]');
  var all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var imgs = stage ? all('img[data-key]', stage) : [];
  var frames = imgs.filter(function (im) { return /^m\d$/.test(im.dataset.key); });
  var steps = stepsBox ? all('.step', stepsBox) : [];
  var byKey = {};
  imgs.forEach(function (im) { byKey[im.dataset.key] = im; });
  var sceneEls = all('[data-scene]');
  var timeEls = all('[data-time]');

  var toMin = function (s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+(p[1] || 0)); };
  var fmt = function (m) { m = Math.round(m); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
  var docTop = function (el) { return el.getBoundingClientRect().top + window.scrollY; };
  var morningTimes = steps.map(function (s) { var t = s.querySelector('[data-time]'); return t ? toMin(t.dataset.time) : null; });

  var scenes = [], anchors = [], phoneAnchors = [], ticking = false;

  function measure() {
    var vh = window.innerHeight;
    scenes = sceneEls.map(function (el) {
      return { img: byKey[el.dataset.scene], top: docTop(el), zone: reduce.matches ? 0 : (parseFloat(el.dataset.wipe) || 0) * vh };
    }).filter(function (s) { return s.img; });
    anchors = timeEls.map(function (el) {
      return { top: docTop(el), min: toMin(el.dataset.time), hold: el.hasAttribute('data-hold'), morning: !!(manana && manana.contains(el)) };
    }).sort(function (a, b) { return a.top - b.top; });
    var end = manana ? docTop(manana) + manana.offsetHeight : 0;
    var last = morningTimes.length ? morningTimes[morningTimes.length - 1] : 600;
    phoneAnchors = [{ top: end, min: last, hold: false }].concat(anchors.filter(function (a) { return !a.morning; }));
  }

  function clockAt(y, list) {
    var m = list[0].min;
    for (var i = 0; i < list.length; i++) {
      if (y < list[i].top) break;
      var a = list[i], b = list[i + 1];
      m = (!b || a.hold) ? a.min : a.min + (b.min - a.min) * Math.min(1, (y - a.top) / Math.max(1, b.top - a.top));
    }
    return m;
  }
  function setClock(m) {
    if (!clock || m == null) return;
    var t = fmt(m);
    if (clock.textContent !== t) clock.textContent = t;
  }
  function setImg(im, p) {
    if (im._p === p) return;
    im._p = p;
    im.style.visibility = p > 0 ? 'visible' : 'hidden';
    im.style.clipPath = p > 0 && p < 1 ? 'inset(' + ((1 - p) * 100).toFixed(2) + '% 0 0 0)' : '';
  }

  function deskUpdate() {
    var y = window.scrollY + window.innerHeight * 0.5;
    var prog = new Map();
    scenes.forEach(function (s) {
      var p = s.zone > 0 ? (y + s.zone - s.top) / s.zone : (y >= s.top ? 1 : 0);
      p = Math.max(0, Math.min(1, p));
      if (p > (prog.get(s.img) || 0)) prog.set(s.img, p);
    });
    imgs.forEach(function (im, i) { setImg(im, i === 0 ? 1 : (prog.get(im) || 0)); });
    if (anchors.length) setClock(clockAt(y, anchors));
  }

  function phoneUpdate() {
    var i = 0;
    if (manana && pin && steps.length) {
      var top = manana.getBoundingClientRect().top - (header ? header.offsetHeight : 0);
      var travel = manana.offsetHeight - pin.offsetHeight;
      var p = travel > 0 ? Math.max(0, Math.min(1, -top / travel)) : 0;
      i = Math.min(steps.length - 1, Math.floor(p * steps.length));
      frames.forEach(function (im, k) { setImg(im, k <= i ? 1 : 0); });
      steps.forEach(function (s, k) { s.classList.toggle('is-on', k === i); });
      stepsBox.classList.add('is-live');
    }
    var vh = window.innerHeight;
    if (manana && manana.getBoundingClientRect().bottom > vh * 0.5) setClock(morningTimes[i]);
    else if (phoneAnchors.length) setClock(clockAt(window.scrollY + vh * 0.5, phoneAnchors));
  }

  function update() {
    ticking = false;
    if (desk.matches) deskUpdate(); else phoneUpdate();
  }
  function onScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }
  function refresh() { measure(); update(); }
  var watch = function (q) {
    if (q.addEventListener) q.addEventListener('change', refresh); else if (q.addListener) q.addListener(refresh);
  };

  if (stage) {
    refresh();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', refresh);
    window.addEventListener('load', refresh);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    watch(desk);
    watch(reduce);
  }

  // the live thing: is the kiosk open right now, in Fuengirola time? (hours as published: Mon–Sat 9:30–14:30)
  var status = document.querySelector('[data-status]');
  if (status && window.Intl && Intl.DateTimeFormat.prototype.formatToParts) {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      var get = function (type) { for (var k = 0; k < parts.length; k++) if (parts[k].type === type) return parts[k].value; return ''; };
      var day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
      var now = (+get('hour')) * 60 + (+get('minute'));
      var workday = day >= 0 && day <= 5;
      var open = workday && now >= 570 && now < 870;
      var when;
      if (open) when = 'abierto, cierra a las 14:30';
      else if (workday && now < 570) when = 'cerrado, abre hoy a las 9:30';
      else if (day === 5) when = 'cerrado, abre el lunes a las 9:30';
      else when = 'cerrado, abre mañana a las 9:30';
      if (day >= 0) {
        status.textContent = 'En Fuengirola son las ' + fmt(now) + ': ' + when + '.';
        status.dataset.open = open ? 'yes' : 'no';
      }
    } catch (e) { /* keep the published hours */ }
  }
})();
