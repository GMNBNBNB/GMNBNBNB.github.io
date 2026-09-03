/* ============================================================
   Visual layer.

   Built around a stable frame of reference. The page background
   never moves; motion is confined to bounded, discrete elements.
   The radial warp tunnel this replaced filled the viewport with
   outward optical flow, which the visual system reads as forward
   self-motion (vection) - it looked fast, but it made people queasy.

   The hero now speaks the same language as the project covers:
   nodes, edges, and packets. Legible structure rather than noise.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TAU = Math.PI * 2;

  /* ------------------------------------------------------------
     One rAF loop drives everything. Tickers pause when off-screen
     or when the tab is hidden.
     ------------------------------------------------------------ */
  var tickers = [];
  var running = false;
  var t0 = performance.now();

  function frame(now) {
    running = false;
    var t = (now - t0) / 1000;
    var alive = false;

    for (var i = 0; i < tickers.length; i++) {
      var tk = tickers[i];
      if (tk.visible && !document.hidden) { tk.draw(t); alive = true; }
    }
    if (alive) start();
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function addTicker(el, draw) {
    var tk = { el: el, draw: draw, visible: true };
    tickers.push(tk);

    if ('IntersectionObserver' in window) {
      tk.visible = false;
      new IntersectionObserver(function (entries) {
        tk.visible = entries[0].isIntersecting;
        if (tk.visible) start();
      }, { rootMargin: '120px' }).observe(el);
    }
    start();
    return tk;
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) start();
  });

  /* ------------------------------------------------------------
     Theme
     ------------------------------------------------------------ */
  function isDark() {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  var themeHooks = [];
  function onTheme(fn) { themeHooks.push(fn); fn(isDark()); }

  new MutationObserver(function () {
    var d = isDark();
    for (var i = 0; i < themeHooks.length; i++) themeHooks[i](d);
    start();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ------------------------------------------------------------
     Shared helpers
     ------------------------------------------------------------ */
  // Deterministic pseudo-random: the field looks identical every load.
  function rnd(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function fit(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    var g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g: g, w: w, h: h };
  }

  function rgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function css(c, a) {
    // Clamp here rather than at every call site: dim is 1.7 on the light theme,
    // which pushes the brighter alphas past 1.
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
  }

  function rrect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  var MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

  /* Alert glyphs, drawn as paths rather than pulled from an icon font: no
     load-order dependency, no missing-glyph tofu, and they stay crisp at the
     11-21px range these render at. Each takes a centre and a half-size, and
     paints with whatever stroke/fill style is already set. */
  var ICONS = {
    // Warning triangle.
    tri: function (g, x, y, s) {
      g.beginPath();
      g.moveTo(x, y - s * 0.98);
      g.lineTo(x + s * 0.95, y + s * 0.68);
      g.lineTo(x - s * 0.95, y + s * 0.68);
      g.closePath();
      g.stroke();
      g.beginPath();
      g.moveTo(x, y - s * 0.34); g.lineTo(x, y + s * 0.16);
      g.stroke();
      g.beginPath(); g.arc(x, y + s * 0.42, s * 0.12, 0, TAU); g.fill();
    },
    // No entry: circle with a bar through it.
    ban: function (g, x, y, s) {
      g.beginPath(); g.arc(x, y, s * 0.86, 0, TAU); g.stroke();
      g.beginPath();
      g.moveTo(x - s * 0.60, y + s * 0.60);
      g.lineTo(x + s * 0.60, y - s * 0.60);
      g.stroke();
    },
    // Circle with an X.
    x: function (g, x, y, s) {
      g.beginPath(); g.arc(x, y, s * 0.86, 0, TAU); g.stroke();
      var d = s * 0.38;
      g.beginPath();
      g.moveTo(x - d, y - d); g.lineTo(x + d, y + d);
      g.moveTo(x + d, y - d); g.lineTo(x - d, y + d);
      g.stroke();
    },
    // Padlock.
    lock: function (g, x, y, s) {
      g.beginPath();
      g.arc(x, y - s * 0.18, s * 0.44, Math.PI, 0);
      g.stroke();
      rrect(g, x - s * 0.72, y - s * 0.18, s * 1.44, s * 1.02, s * 0.22);
      g.stroke();
    },
    // Clock, for the timeouts.
    clock: function (g, x, y, s) {
      g.beginPath(); g.arc(x, y, s * 0.86, 0, TAU); g.stroke();
      g.beginPath();
      g.moveTo(x, y - s * 0.48); g.lineTo(x, y); g.lineTo(x + s * 0.40, y + s * 0.20);
      g.stroke();
    },
    // Lightning bolt: the 5xx mark.
    bolt: function (g, x, y, s) {
      g.beginPath();
      g.moveTo(x + s * 0.30, y - s * 0.95);
      g.lineTo(x - s * 0.52, y + s * 0.10);
      g.lineTo(x - s * 0.04, y + s * 0.10);
      g.lineTo(x - s * 0.28, y + s * 0.95);
      g.lineTo(x + s * 0.54, y - s * 0.12);
      g.lineTo(x + s * 0.06, y - s * 0.12);
      g.closePath();
      g.fill();
    },
    // A teapot, for the one status code nobody implements on purpose.
    pot: function (g, x, y, s) {
      g.beginPath();
      g.moveTo(x - s * 0.60, y - s * 0.06);
      g.lineTo(x + s * 0.44, y - s * 0.06);
      g.lineTo(x + s * 0.32, y + s * 0.66);
      g.lineTo(x - s * 0.48, y + s * 0.66);
      g.closePath();
      g.stroke();
      g.beginPath();
      g.moveTo(x - s * 0.18, y - s * 0.06);
      g.lineTo(x - s * 0.06, y - s * 0.46);
      g.lineTo(x + s * 0.12, y - s * 0.46);
      g.stroke();
      g.beginPath();
      g.moveTo(x + s * 0.42, y + s * 0.08);
      g.lineTo(x + s * 0.90, y - s * 0.30);
      g.stroke();
      g.beginPath();
      g.arc(x - s * 0.58, y + s * 0.28, s * 0.26, -Math.PI * 0.44, Math.PI * 0.44);
      g.stroke();
    }
  };

  var SEV = { blk: 'BLOCKED', err: 'ERROR', wrn: 'WARNING', fun: 'NOTICE' };

  /* The hero's alert banners: [code, reason, severity, glyph].

     Severity drives the colour, the way a real console does it - red for
     refused and broken, amber for merely wrong, and one cyan escape hatch for
     418 and 420, which are jokes and shouldn't shout. The glyph varies inside
     each colour so nine red banners don't read as nine copies of one thing.

     23 entries walked at a stride of 7, which is coprime with the length, so
     the 14 banners on screen never repeat a code. Nine entries therefore never
     get drawn; the order below is arranged so the ones that fall out are the
     forgettable codes and 404 / 418 / 420 / 500 / 502 / 503 / 505 always show. */
  var HTTP = [
    ['403', 'FORBIDDEN',           'blk', 'ban'],
    ['500', 'INTERNAL ERROR',      'err', 'bolt'],
    ['409', 'CONFLICT',            'wrn', 'tri'],
    ['404', 'NOT FOUND',           'wrn', 'tri'],
    ['411', 'LENGTH REQUIRED',     'wrn', 'tri'],
    ['418', "I'M A TEAPOT",        'fun', 'pot'],
    ['405', 'NOT ALLOWED',         'wrn', 'ban'],
    ['503', 'UNAVAILABLE',         'err', 'x'],
    ['401', 'UNAUTHORIZED',        'blk', 'lock'],
    ['422', 'UNPROCESSABLE',       'wrn', 'tri'],
    ['429', 'TOO MANY REQUESTS',   'blk', 'ban'],
    ['425', 'TOO EARLY',           'wrn', 'clock'],
    ['502', 'BAD GATEWAY',         'err', 'bolt'],
    ['402', 'PAYMENT REQUIRED',    'blk', 'lock'],
    ['420', 'ENHANCE YOUR CALM',   'fun', 'pot'],
    ['408', 'REQUEST TIMEOUT',     'wrn', 'clock'],
    ['501', 'NOT IMPLEMENTED',     'err', 'x'],
    ['451', 'LEGAL REASONS',       'blk', 'lock'],
    ['511', 'AUTH REQUIRED',       'blk', 'lock'],
    ['505', 'VERSION UNSUPPORTED', 'err', 'x'],
    ['410', 'GONE',                'wrn', 'tri'],
    ['504', 'GATEWAY TIMEOUT',     'err', 'clock'],
    ['400', 'BAD REQUEST',         'wrn', 'tri']
  ];

  /* ============================================================
     Hero: a network under alarm.

     Every node orbits its own small ellipse around a fixed home
     point, so the field breathes in place instead of streaming in
     any direction. Nothing here produces global optical flow.

     A seventh of the nodes are HTTP alert banners - red for refused
     and broken, amber for merely wrong - so edges converge on them
     and the packets riding those edges read as requests coming back
     with a status attached.
     ============================================================ */
  (function heroField() {
    var canvas = document.getElementById('heroCanvas');
    if (!canvas) return;

    var COUNT = 68;
    var LINK  = 128;          // px; edges appear inside this radius
    var nodes = [];
    var lastW = 0, lastH = 0;

    var C = { a: [124,92,255], b: [34,211,238], red: [255,77,79], amber: [251,191,36], line: [150,140,255], dim: 1 };
    onTheme(function (dark) {
      var cs = getComputedStyle(document.documentElement);
      C.a = rgb((cs.getPropertyValue('--accent') || '#7c5cff').trim());
      C.b = rgb((cs.getPropertyValue('--cyan')   || '#22d3ee').trim());
      C.red   = rgb((cs.getPropertyValue('--red')   || '#ff4d4f').trim());
      C.amber = rgb((cs.getPropertyValue('--amber') || '#fbbf24').trim());
      C.line = C.a;
      // On light backgrounds the same alphas would wash out completely.
      C.dim = dark ? 1 : 1.7;
    });

    // Severity -> hue. Blocked and errored share red because that is what an
    // alert palette actually does; the glyph and the word tell them apart.
    function hue(sev) { return sev === 'wrn' ? C.amber : sev === 'fun' ? C.b : C.red; }

    // Rectangles a banner must not sit on. A mesh dot behind the headline is
    // invisible texture, but a bordered red banner reads as a label stuck to
    // the wrong thing - and behind the glass card it bleeds through as a smear.
    function avoidBoxes() {
      var out = [];
      var cr = canvas.getBoundingClientRect();
      if (!cr.width) return out;
      ['.hero-content', '.hero-card'].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (!r.width) return;
        out.push({
          x0: r.left - cr.left - 26, x1: r.right - cr.left + 26,
          y0: r.top - cr.top - 22,   y1: r.bottom - cr.top + 22
        });
      });
      return out;
    }

    function build(w, h) {
      nodes.length = 0;
      // Jittered grid keeps coverage even; pure random leaves bald patches.
      var cols = Math.max(3, Math.round(Math.sqrt(COUNT * w / Math.max(h, 1))));
      var rows = Math.ceil(COUNT / cols);
      var cw = w / cols, ch = h / rows;
      var i, k;

      for (i = 0; i < COUNT; i++) {
        var col = i % cols, row = Math.floor(i / cols);
        var z = 0.42 + rnd(i + 240) * 0.58;   // depth -> size, brightness, parallax
        var ra = 10 + rnd(i + 80) * 22;       // orbit radii, in px
        var rb = 8  + rnd(i + 120) * 18;

        // Footprint this node would occupy if it drew a banner, orbit included.
        // The exact width needs a canvas context to measure text; the type is
        // monospace, so estimating from the glyph count is tight enough to
        // decide collisions with.
        var fs0 = Math.round(12 + z * 9);
        var bw0 = 22 + fs0 * 0.8 + 9 + fs0 * 1.8 + (z > 0.52 ? 19 + fs0 * 2.52 : 0);

        nodes.push({
          hx: (col + 0.18 + rnd(i) * 0.64) * cw,
          hy: (row + 0.18 + rnd(i + 40) * 0.64) * ch,
          ra: ra,
          rb: rb,
          sp: 0.055 + rnd(i + 160) * 0.10,    // orbit speed
          ph: rnd(i + 200) * TAU,
          z:  z,
          hw: bw0 / 2 + ra,
          hh: (fs0 + 16) / 2 + rb + 9,        // +9 leaves room for the caption
          code: null, text: null, sev: null, icon: null,
          tw: 0, sw: 0,                       // cached text widths, filled on first draw
          x: 0, y: 0
        });
      }

      /* ---- which nodes carry a banner ---- */
      var boxes = avoidBoxes();
      var pad = 42;                                    // widest orbit excursion
      // Banners are wide bordered objects: clipped at an edge, or tucked under
      // the nav, they read as a layout bug where a clipped dot reads as nothing.
      var mx = Math.min(118, w * 0.2);
      var mt = Math.min(108, h * 0.13);
      var mb = Math.min(64, h * 0.085);

      var cand = [];
      for (i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.hx < mx || n.hx > w - mx || n.hy < mt || n.hy > h - mb) continue;
        var clear = true;
        for (k = 0; k < boxes.length; k++) {
          var bx = boxes[k];
          if (n.hx > bx.x0 - pad && n.hx < bx.x1 + pad &&
              n.hy > bx.y0 - pad && n.hy < bx.y1 + pad) { clear = false; break; }
        }
        if (clear) cand.push(n);
      }

      /* Farthest-point sampling over the clear nodes, with a hard
         no-overlap rule. Labelling every fifth node by index was the obvious
         thing and it was wrong: wherever the jittered grid happened to
         cluster, two banners landed on top of each other and stacked into an
         unreadable pile.

         A candidate is admissible only if its footprint misses every banner
         already placed; among those, take the one furthest from all of them so
         the field stays evenly covered. Distance weights y up, because a
         banner is about 180px wide and 37 tall - two side by side collide long
         before two stacked ones do.

         The cap is 14, but the no-overlap rule is what actually decides the
         count. On a narrow viewport it runs out of room first and draws fewer,
         which is the right answer. */
      var want = Math.min(14, cand.length);
      var picked = [];
      if (cand.length) {
        picked.push(cand[Math.floor(rnd(7) * cand.length) % cand.length]);
        picked[0].pick = 1;
      }
      while (picked.length < want) {
        var best = null, bestD = -1;
        for (i = 0; i < cand.length; i++) {
          var c = cand[i];
          if (c.pick) continue;
          var ok = true, dmin = Infinity;
          for (k = 0; k < picked.length; k++) {
            var q = picked[k];
            var adx = Math.abs(c.hx - q.hx), ady = Math.abs(c.hy - q.hy);
            if (adx < c.hw + q.hw + 8 && ady < c.hh + q.hh + 6) { ok = false; break; }
            var ddy = ady * 2.6;
            var dd = adx * adx + ddy * ddy;
            if (dd < dmin) dmin = dd;
          }
          if (ok && dmin > bestD) { bestD = dmin; best = c; }
        }
        if (!best) break;
        best.pick = 1;
        picked.push(best);
      }

      for (i = 0; i < picked.length; i++) {
        var e = HTTP[(i * 7) % HTTP.length];
        picked[i].code = e[0];
        picked[i].text = e[1];
        picked[i].sev  = e[2];
        picked[i].icon = e[3];
      }

      lastW = w; lastH = h;
    }

    // Pointer in canvas space, eased so the field drifts rather than snaps.
    // Listen on the hero section: .hero-mesh sits at z-index -1, so events
    // over the headline never reach it.
    var host = canvas.closest ? (canvas.closest('.hero') || canvas.parentNode) : canvas.parentNode;
    var pointer = { x: -9999, y: -9999, active: false };
    var par = { x: 0, y: 0, tx: 0, ty: 0 };

    host.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
      par.tx = (pointer.x / Math.max(r.width, 1)) * 2 - 1;
      par.ty = (pointer.y / Math.max(r.height, 1)) * 2 - 1;
      start();
    }, { passive: true });

    host.addEventListener('mouseleave', function () {
      pointer.active = false;
      pointer.x = pointer.y = -9999;
      par.tx = par.ty = 0;
    }, { passive: true });

    function draw(t) {
      var s = fit(canvas);
      var g = s.g, w = s.w, h = s.h;
      if (!w || !h) return;
      if (w !== lastW || h !== lastH) build(w, h);

      g.clearRect(0, 0, w, h);

      par.x += (par.tx - par.x) * 0.05;
      par.y += (par.ty - par.y) * 0.05;

      var i, n;
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        var ang = n.ph + t * n.sp;
        // Parallax is small and only responds to the user's own pointer,
        // so it reads as depth rather than as the page moving.
        n.x = n.hx + Math.cos(ang) * n.ra - par.x * n.z * 7;
        n.y = n.hy + Math.sin(ang) * n.rb - par.y * n.z * 7;
      }

      /* ---- edges, plus packets riding the ones that qualify ---- */
      var A = C.a, B = C.b, L = C.line, dim = C.dim;
      g.lineWidth = 1;

      for (i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          // Banner nodes reach further, so they collect spokes instead of
          // sitting in the mesh at the same valence as everything else.
          var spoke = (a.code || b.code);
          var reach = spoke ? LINK * 1.32 : LINK;
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 > reach * reach) continue;

          var d = Math.sqrt(d2);
          var fade = 1 - d / reach;
          g.strokeStyle = 'rgba(' + L[0] + ',' + L[1] + ',' + L[2] + ',' +
                          (fade * (spoke ? 0.30 : 0.20) * dim).toFixed(3) + ')';
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();

          // A stable minority of edges carry a travelling packet.
          var hh = rnd(i * 97 + j);
          if (hh < (spoke ? 0.82 : 0.90) || fade < 0.35) continue;

          var tt = (t * (0.20 + hh * 0.45) + hh * 9.13) % 1;
          var px = a.x + (b.x - a.x) * tt;
          var py = a.y + (b.y - a.y) * tt;
          var pc = hh > 0.95 ? B : A;

          g.fillStyle = 'rgba(' + pc[0] + ',' + pc[1] + ',' + pc[2] + ',' +
                        (0.16 * fade * dim).toFixed(3) + ')';
          g.beginPath(); g.arc(px, py, 5.5, 0, TAU); g.fill();
          g.fillStyle = 'rgba(' + pc[0] + ',' + pc[1] + ',' + pc[2] + ',' +
                        (0.95 * fade).toFixed(3) + ')';
          g.beginPath(); g.arc(px, py, 1.9, 0, TAU); g.fill();
        }
      }

      /* ---- plain nodes ---- */
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        n.near = 0;
        if (pointer.active) {
          var mdx = n.x - pointer.x, mdy = n.y - pointer.y;
          var md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < 170) {
            n.near = 1 - md / 170;
            g.strokeStyle = css(B, n.near * 0.30 * dim);
            g.lineWidth = 1;
            g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(pointer.x, pointer.y); g.stroke();
          }
        }
        if (n.code) continue;   // labelled nodes are banners, drawn below

        var col = n.near > 0.25 ? B : A;
        var r = (1.1 + n.z * 1.5) * (1 + n.near * 0.7);

        g.fillStyle = css(col, (0.07 + n.near * 0.16) * dim);
        g.beginPath(); g.arc(n.x, n.y, r * 4.5, 0, TAU); g.fill();

        g.fillStyle = css(col, (0.30 + n.z * 0.42 + n.near * 0.28) * dim);
        g.beginPath(); g.arc(n.x, n.y, r, 0, TAU); g.fill();
      }

      /* ---- alert banners ---- */
      // Second pass on purpose: drawn inline, a later node's halo would wash
      // over a numeral that had already been painted.
      g.textBaseline = 'middle';

      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        if (!n.code) continue;

        var hc = hue(n.sev);
        var near = n.near;
        var fs = Math.round(12 + n.z * 9);          // 12..21px, by depth
        var showSev = n.z > 0.52;                   // fixed per node, so no width jitter

        g.font = '800 ' + fs + 'px ' + MONO;
        if (!n.tw) n.tw = g.measureText(n.code).width;
        var sfs = Math.round(fs * 0.60);
        if (showSev && !n.sw) {
          g.font = '700 ' + sfs + 'px ' + MONO;
          n.sw = g.measureText(SEV[n.sev]).width;
        }

        var padX = 11, is = fs * 0.40, gap = 9;
        var bw = padX * 2 + is * 2 + gap + n.tw + (showSev ? gap * 2 + 1 + n.sw : 0);
        var bh = fs + 16;
        var x0 = n.x - bw / 2, y0 = n.y - bh / 2;
        var rad = 7;

        // Errors emit one outward pulse per cycle - a 5xx ought to look like it
        // is alarming about something. Bounded and local, so it reads as a
        // signal leaving a node rather than the view rushing at you.
        if (n.sev === 'err') {
          var ph = (t * 0.34 + rnd(i + 300)) % 1;
          g.lineWidth = 1;
          g.strokeStyle = css(hc, (1 - ph) * 0.26 * dim);
          rrect(g, x0 - ph * 28, y0 - ph * 22, bw + ph * 56, bh + ph * 44, rad + ph * 22);
          g.stroke();
        }

        // Body. Solid enough to read as a label rather than a watermark, with
        // a bright left rule - the bar down the side of every alert box ever.
        g.fillStyle = css(hc, (0.16 + n.z * 0.05 + near * 0.14) * dim);
        rrect(g, x0, y0, bw, bh, rad);
        g.fill();
        g.lineWidth = 1.4;
        g.strokeStyle = css(hc, (0.46 + n.z * 0.22 + near * 0.30) * dim);
        g.stroke();

        g.fillStyle = css(hc, (0.72 + n.z * 0.20 + near * 0.08) * dim);
        rrect(g, x0, y0 + 3, 3.5, bh - 6, 1.75);
        g.fill();

        // Glyph.
        var gx = x0 + padX + 3 + is;
        g.lineWidth = Math.max(1.2, fs * 0.10);
        g.lineJoin = 'round';
        g.lineCap = 'round';
        g.strokeStyle = g.fillStyle = css(hc, (0.80 + n.z * 0.16 + near * 0.04) * dim);
        (ICONS[n.icon] || ICONS.tri)(g, gx, n.y, is);

        // Code, glowing like a lit indicator.
        var tx = gx + is + gap;
        g.textAlign = 'left';
        g.font = '800 ' + fs + 'px ' + MONO;
        g.shadowColor = css(hc, 0.55 * dim);
        g.shadowBlur = 10 + n.z * 8;
        g.fillStyle = css(hc, (0.86 + n.z * 0.14) * dim);
        g.fillText(n.code, tx, n.y + 0.5);
        g.shadowBlur = 0;

        if (showSev) {
          var dx2 = tx + n.tw + gap;
          g.lineWidth = 1;
          g.strokeStyle = css(hc, 0.30 * dim);
          g.beginPath();
          g.moveTo(dx2, y0 + 5); g.lineTo(dx2, y0 + bh - 5);
          g.stroke();

          g.font = '700 ' + sfs + 'px ' + MONO;
          g.fillStyle = css(hc, (0.62 + n.z * 0.18 + near * 0.16) * dim);
          g.fillText(SEV[n.sev], dx2 + gap + 1, n.y + 0.5);
        }

        // Reason phrase on the nearest banners only, plus whatever the pointer
        // is beside. Printing all fourteen at once puts a wall of text behind
        // the headline; held back, they're something you find on second look.
        var ca = ((n.z > 0.80 ? 0.30 : 0) + near * 0.55) * dim;
        if (ca < 0.04) continue;
        g.textAlign = 'center';
        g.font = '600 ' + Math.round(fs * 0.52) + 'px ' + MONO;
        g.fillStyle = css(hc, ca);
        g.fillText(n.text, n.x, y0 + bh + fs * 0.62);
      }

      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.lineJoin = 'miter';
      g.lineCap = 'butt';
    }

    if (reduceMotion) {
      var s0 = fit(canvas);
      build(s0.w, s0.h);
      draw(0);
      canvas.classList.add('ready');
      return;
    }

    addTicker(canvas, draw);
    requestAnimationFrame(function () { canvas.classList.add('ready'); });
  })();

  // Exposed for the second half of the visual layer (fx-cards.js).
  window.__FX = { addTicker: addTicker, onTheme: onTheme, isDark: isDark, reduceMotion: reduceMotion };
})();
