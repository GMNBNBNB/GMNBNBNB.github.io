/* ============================================================
   Procedural cover art + pointer interactions.
   Every project card gets its own generated animation instead of a
   screenshot, so nothing here depends on image assets.
   2D canvas on purpose: six more WebGL contexts would crowd the
   browser's ~16-context budget.
   ============================================================ */
(function () {
  'use strict';

  var FX = window.__FX;
  if (!FX) return;

  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  /* ---------- resolve palette from CSS so themes stay in sync ---------- */
  var PALETTE = {};
  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    ['accent', 'accent-light', 'cyan', 'pink', 'green', 'orange'].forEach(function (name) {
      PALETTE[name] = cs.getPropertyValue('--' + name).trim() || '#7c5cff';
    });
  }

  // "#7c5cff" -> "124,92,255" so we can vary alpha per stroke.
  function rgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    var c = rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  readPalette();
  FX.onTheme(function () { readPalette(); });

  /* ---------- canvas sizing in CSS pixels ---------- */
  function fit(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; canvas.height = ph;
    }
    var g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g: g, w: w, h: h };
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

  // Deterministic per-index pseudo-random, so a card looks the same each load.
  function rnd(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /* ============================================================
     Cover modes
     ============================================================ */
  var MODES = {

    /* Speech emotion recognition: a spectrum analyser. */
    waves: function (g, w, h, t, col) {
      var bars = 34, gap = 2;
      var bw = (w - gap * (bars - 1)) / bars;
      var mid = h * 0.62;

      for (var i = 0; i < bars; i++) {
        var f = i / (bars - 1);
        var env = Math.sin(f * Math.PI);
        var v = Math.abs(Math.sin(t * 1.9 + i * 0.42)) * 0.5 +
                Math.abs(Math.sin(t * 3.3 + i * 0.17 + rnd(i) * 6.0)) * 0.5;
        var bh = (6 + v * 74 * (0.35 + env * 0.9));

        var x = i * (bw + gap);
        var grad = g.createLinearGradient(0, mid - bh, 0, mid);
        grad.addColorStop(0, rgba(col, 0.95));
        grad.addColorStop(1, rgba(col, 0.18));
        g.fillStyle = grad;
        rrect(g, x, mid - bh, bw, bh, bw / 2);
        g.fill();

        // reflection under the baseline
        g.globalAlpha = 0.22;
        rrect(g, x, mid + 3, bw, bh * 0.42, bw / 2);
        g.fill();
        g.globalAlpha = 1;
      }

      g.strokeStyle = rgba(col, 0.30);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, mid + 1.5); g.lineTo(w, mid + 1.5); g.stroke();
    },

    /* Food search: a drifting constellation of connected nodes. */
    mesh: function (g, w, h, t, col) {
      var n = 16, pts = [];
      for (var i = 0; i < n; i++) {
        var sx = rnd(i) * w;
        var sy = rnd(i + 90) * h;
        var ax = 14 + rnd(i + 20) * 20;
        var ay = 10 + rnd(i + 50) * 16;
        pts.push([
          sx + Math.sin(t * (0.22 + rnd(i) * 0.3) + i) * ax,
          sy + Math.cos(t * (0.18 + rnd(i + 7) * 0.26) + i * 1.7) * ay
        ]);
      }

      g.lineWidth = 1;
      for (var a = 0; a < n; a++) {
        for (var b = a + 1; b < n; b++) {
          var dx = pts[a][0] - pts[b][0], dy = pts[a][1] - pts[b][1];
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > 72) continue;
          g.strokeStyle = rgba(col, (1 - d / 72) * 0.42);
          g.beginPath(); g.moveTo(pts[a][0], pts[a][1]); g.lineTo(pts[b][0], pts[b][1]); g.stroke();
        }
      }
      for (var k = 0; k < n; k++) {
        var pulse = 1.7 + Math.sin(t * 2.2 + k) * 0.8;
        g.fillStyle = rgba(col, 0.9);
        g.beginPath(); g.arc(pts[k][0], pts[k][1], pulse, 0, 6.2832); g.fill();
        g.fillStyle = rgba(col, 0.14);
        g.beginPath(); g.arc(pts[k][0], pts[k][1], pulse * 3.4, 0, 6.2832); g.fill();
      }
    },

    /* Cloud API: request packets streaming across lanes. */
    cloud: function (g, w, h, t, col) {
      var lanes = 6;
      for (var l = 0; l < lanes; l++) {
        var y = (h / (lanes + 1)) * (l + 1);

        g.strokeStyle = rgba(col, 0.10);
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();

        for (var p = 0; p < 3; p++) {
          var seed = l * 3 + p;
          var speed = 0.10 + rnd(seed) * 0.20;
          var x = ((t * speed + rnd(seed + 33)) % 1.25 - 0.15) * w;
          var pw = 16 + rnd(seed + 11) * 22;
          if (x < -pw || x > w) continue;

          var grad = g.createLinearGradient(x - pw * 2.2, 0, x + pw, 0);
          grad.addColorStop(0, rgba(col, 0));
          grad.addColorStop(1, rgba(col, 0.55));
          g.fillStyle = grad;
          g.fillRect(x - pw * 2.2, y - 1, pw * 2.2, 2);

          g.fillStyle = rgba(col, 0.95);
          rrect(g, x, y - 2.5, pw, 5, 2.5);
          g.fill();
        }
      }
    },

    /* Startup MVP: websocket pulses plus a live latency trace. */
    pulse: function (g, w, h, t, col) {
      var cx = w * 0.24, cy = h * 0.5;

      for (var i = 0; i < 4; i++) {
        var ph = (t * 0.45 + i / 4) % 1;
        var r = 8 + ph * 84;
        g.strokeStyle = rgba(col, (1 - ph) * 0.5);
        g.lineWidth = 1.4;
        g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.stroke();
      }
      g.fillStyle = rgba(col, 0.95);
      g.beginPath(); g.arc(cx, cy, 5, 0, 6.2832); g.fill();
      g.fillStyle = rgba(col, 0.18);
      g.beginPath(); g.arc(cx, cy, 13, 0, 6.2832); g.fill();

      g.strokeStyle = rgba(col, 0.75);
      g.lineWidth = 1.8;
      g.beginPath();
      for (var x = 0; x <= w; x += 3) {
        var u = x / w;
        var y = cy +
          Math.sin(u * 11 - t * 2.4) * 13 * Math.sin(u * 3.1 + t * 0.6) +
          Math.sin(u * 27 - t * 4.1) * 4;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    },

    /* Distributed cache: concentric rings with a rotating hit sweep. */
    cache: function (g, w, h, t, col) {
      var cx = w * 0.5, cy = h * 0.56;

      for (var i = 1; i <= 4; i++) {
        g.strokeStyle = rgba(col, 0.13 + i * 0.02);
        g.lineWidth = 1;
        g.beginPath(); g.arc(cx, cy, i * 21, 0, 6.2832); g.stroke();
      }

      var sweep = t * 0.9;
      var grad = g.createLinearGradient(cx, cy, cx + Math.cos(sweep) * 86, cy + Math.sin(sweep) * 86);
      grad.addColorStop(0, rgba(col, 0.42));
      grad.addColorStop(1, rgba(col, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, 86, sweep - 0.42, sweep);
      g.closePath();
      g.fill();

      for (var k = 0; k < 9; k++) {
        var ring = 1 + (k % 4);
        var ang = rnd(k) * 6.2832 + t * (0.16 + rnd(k + 5) * 0.3);
        var x = cx + Math.cos(ang) * ring * 21;
        var y = cy + Math.sin(ang) * ring * 21;
        var hit = Math.max(0, Math.sin(t * 2.2 + k * 1.3));
        g.fillStyle = rgba(col, 0.35 + hit * 0.6);
        g.beginPath(); g.arc(x, y, 2 + hit * 2.2, 0, 6.2832); g.fill();
      }
    },

    /* AutoSeek phone screen: application cards scrolling under a scan line. */
    phone: function (g, w, h, t, col) {
      var accent = PALETTE.accent, cyan = PALETTE.cyan;

      var bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, 'rgba(16,12,38,1)');
      bg.addColorStop(1, 'rgba(6,8,20,1)');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);

      g.save();
      g.translate(0, -((t * 16) % 74));

      for (var i = -1; i < 9; i++) {
        var y = 52 + i * 74;
        var seed = Math.floor((t * 16) / 74) + i;
        var pct = 0.35 + rnd(seed) * 0.6;

        g.fillStyle = 'rgba(255,255,255,0.055)';
        rrect(g, 12, y, w - 24, 60, 12); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.09)';
        g.lineWidth = 1; g.stroke();

        // logo tile
        g.fillStyle = rgba(i % 2 ? cyan : accent, 0.8);
        rrect(g, 22, y + 12, 20, 20, 6); g.fill();

        // title + subtitle bars
        g.fillStyle = 'rgba(255,255,255,0.55)';
        rrect(g, 50, y + 13, 58 + rnd(seed + 3) * 40, 6, 3); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.22)';
        rrect(g, 50, y + 25, 40 + rnd(seed + 9) * 30, 5, 2.5); g.fill();

        // match-score progress bar
        g.fillStyle = 'rgba(255,255,255,0.10)';
        rrect(g, 22, y + 44, w - 44, 4, 2); g.fill();
        var pg = g.createLinearGradient(22, 0, 22 + (w - 44) * pct, 0);
        pg.addColorStop(0, rgba(accent, 0.95));
        pg.addColorStop(1, rgba(cyan, 0.95));
        g.fillStyle = pg;
        rrect(g, 22, y + 44, (w - 44) * pct, 4, 2); g.fill();
      }
      g.restore();

      // scanning highlight sweeping down the list
      var sy = (t * 52) % (h + 120) - 60;
      var sg = g.createLinearGradient(0, sy - 50, 0, sy + 50);
      sg.addColorStop(0, rgba(cyan, 0));
      sg.addColorStop(0.5, rgba(cyan, 0.16));
      sg.addColorStop(1, rgba(cyan, 0));
      g.fillStyle = sg;
      g.fillRect(0, sy - 50, w, 100);

      // status bar
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.font = '600 9px Inter, sans-serif';
      g.fillText('9:41', 16, 24);
      g.fillStyle = rgba(cyan, 0.9);
      g.fillText('AutoSeek', w - 58, 24);
    }
  };

  /* ---------- mount every cover canvas ---------- */
  $$('canvas[data-mode]').forEach(function (canvas) {
    var mode = MODES[canvas.getAttribute('data-mode')];
    if (!mode) return;

    var colorVar = canvas.getAttribute('data-color') || 'accent';

    if (FX.reduceMotion) {
      // Paint one static frame and stop.
      var s = fit(canvas);
      mode(s.g, s.w, s.h, 0, PALETTE[colorVar]);
      return;
    }

    FX.addTicker(canvas, function (t) {
      var s = fit(canvas);
      if (!s.w || !s.h) return;
      s.g.clearRect(0, 0, s.w, s.h);
      mode(s.g, s.w, s.h, t, PALETTE[colorVar] || PALETTE.accent);
    });
  });

  /* ============================================================
     Pointer interactions
     ============================================================ */
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* spotlight position on glass cards */
  $$('.glass').forEach(function (el) {
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  });

  /* 3D tilt */
  if (fine && !FX.reduceMotion) {
    $$('[data-tilt]').forEach(function (el) {
      // Softened from the first pass: a steep tilt on every card meant
      // something was swinging wherever the cursor went.
      var max = (parseFloat(el.getAttribute('data-tilt')) || 6) * 0.55;

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform =
          'perspective(1100px) rotateX(' + (-py * max).toFixed(2) + 'deg) ' +
          'rotateY(' + (px * max).toFixed(2) + 'deg) translateY(-3px)';
      }, { passive: true });

      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });

    /* magnetic buttons */
    $$('.btn, .footer-link, .icon-btn').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * 0.14;
        var dy = (e.clientY - (r.top + r.height / 2)) * 0.18;
        el.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + (dy - 1).toFixed(1) + 'px)';
      }, { passive: true });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }
})();
