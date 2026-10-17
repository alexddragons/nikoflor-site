/* sequence.js — a scroll-bound frame sequence. No dependencies, no scroll-jacking, no timers.
 *
 * Markup (see skeleton.html):
 *
 *   <section class="seq" id="s1" data-frames="6"
 *            data-src="frames/{n}.webp" data-src-narrow="frames/{n}-1280.webp"
 *            style="--frames: 6">
 *     <div class="seq-stage">
 *       <img class="seq-img" alt="" decoding="async">
 *       <p class="seq-caption" aria-live="off"></p>
 *     </div>
 *     <ol class="seq-lines visually-hidden"><li>line for 01</li> … <li>line for 06</li></ol>
 *   </section>
 *
 * Behaviour:
 *   - frame index = scroll progress across the section: 0 when its top meets the viewport top,
 *     1 when its bottom meets the viewport bottom. Position, not time — so scrolling up runs it backwards.
 *   - every frame is requested at once; frame 01 shows as soon as it arrives; the binding switches on
 *     once all frames are decoded, so no frame is ever shown half-loaded.
 *   - prefers-reduced-motion: the last frame, still, with every line stacked under it. Nothing moves.
 */
(function () {
  'use strict';

  var pad = function (n) { return String(n).padStart(2, '0'); };
  var narrow = window.matchMedia('(max-width: 767px)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setup(section) {
    var count = parseInt(section.dataset.frames, 10);
    var tpl = (narrow.matches && section.dataset.srcNarrow) || section.dataset.src;
    var img = section.querySelector('.seq-img');
    var cap = section.querySelector('.seq-caption');
    var list = section.querySelector('.seq-lines');
    var lines = list ? Array.prototype.map.call(list.querySelectorAll('li'), function (li) { return li.textContent; }) : [];
    if (!count || !tpl || !img) return;

    var urls = [];
    for (var i = 1; i <= count; i++) urls.push(tpl.replace('{n}', pad(i)));

    var show = function (i) {
      if (img.dataset.frame === String(i)) return;
      img.dataset.frame = String(i);
      img.src = urls[i];
      if (cap) cap.textContent = lines[i] || '';
    };

    if (reduce.matches) {
      show(count - 1);
      if (list) list.classList.remove('visually-hidden');
      section.classList.add('seq-static');
      return;
    }

    show(0);

    var loads = urls.map(function (u) {
      var im = new Image();
      im.src = u;
      return (im.decode ? im.decode() : Promise.resolve()).catch(function () {});
    });

    Promise.all(loads).then(function () {
      var ticking = false;
      var update = function () {
        ticking = false;
        var travel = section.offsetHeight - window.innerHeight;
        if (travel <= 0) return;
        var top = section.getBoundingClientRect().top;
        var p = Math.min(1, Math.max(0, -top / travel));
        show(Math.round(p * (count - 1)));
      };
      var onScroll = function () {
        if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      section.classList.add('seq-ready');
      update();
    });
  }

  var init = function () { Array.prototype.forEach.call(document.querySelectorAll('.seq'), setup); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
