/* ============================================================
   fx-graph.js - the CV as a graph, not a list.

   Every node on this canvas is scraped out of a card that is already
   somewhere on this page: a job, a degree, a project, or a tag inside
   one of them. Nothing is authored twice. Add a technology to a role
   in the markup and a node appears here, wired to that role, with no
   edit to this file - the same rule the Markdown exporter follows, for
   the same reason: a second copy of the resume is a copy that will one
   day disagree with the first.

   The interesting shape is not the list of technologies, it is which
   ones show up in more than one place. Those are drawn brighter and
   bigger, and they are the only tech nodes labelled at rest.

   It runs the physics until the layout stops moving, then stops. The
   page's standing rule is that nothing animates forever; a graph that
   jitters under the cursor for as long as you look at it is precisely
   what that rule exists to prevent.
   ============================================================ */
(function () {
  'use strict';

  var stage = document.getElementById('network');
  var cv    = document.getElementById('netCanvas');
  if (!stage || !cv || !cv.getContext) return;

  var ctx  = cv.getContext('2d');
  var side = document.getElementById('netSide');
  var legendBox = document.getElementById('netLegend');

  var reduce = (window.__FX && window.__FX.reduceMotion) ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }


  /* ============================================================
     1. Read the page
     ============================================================ */

  var KIND = {
    person:  { label: 'Me',          v: '--accent' },
    work:    { label: 'Work',        v: '--cyan'   },
    edu:     { label: 'Education',   v: '--green'  },
    project: { label: 'Project',     v: '--pink'   },
    tech:    { label: 'Technology',  v: '--text-tertiary' }
  };

  var nodes = [], edges = [], byKey = {}, seenEdge = {};

  function node(kind, name, src) {
    var key = kind + ':' + name.toLowerCase();
    if (byKey[key]) return byKey[key];
    var n = {
      id: nodes.length, kind: kind, name: name, key: key, src: src || null,
      sub: '', x: 0, y: 0, vx: 0, vy: 0, deg: 0, r: 5, adj: []
    };
    byKey[key] = n;
    nodes.push(n);
    return n;
  }

  function link(a, b) {
    if (!a || !b || a === b) return;
    var k = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
    if (seenEdge[k]) return;
    seenEdge[k] = 1;
    edges.push({ a: a, b: b });
    a.deg++; b.deg++;
    a.adj.push(b); b.adj.push(a);
  }

  /* Tags are the join key between cards. They are written by hand in the
     markup, so trim the punctuation that creeps in and match without
     case - "CI/CD" and "ci/cd" are one technology, not two. */
  function tagsOf(root, sel) {
    return $$(sel, root).map(function (t) {
      return { name: txt(t).replace(/^[·•\-\s]+|[·•\-\s]+$/g, ''), el: t };
    }).filter(function (t) { return t.name && t.name.length < 34; });
  }

  var me = node('person',
    (txt($('.hero-title')) || 'Meng Gao').replace(/^hi,?\s*i'?m\s*/i, ''),
    $('.hero-title'));
  me.sub = txt($('.hero-role')) || 'Software Engineer';

  $$('.timeline-item').forEach(function (it) {
    var name = txt($('.tl-company', it));
    if (!name) return;
    var n = node('work', name, it);
    n.sub = txt($('.tl-role', it));
    link(me, n);
    tagsOf(it, '.tag').forEach(function (t) { link(n, node('tech', t.name, t.el)); });
  });

  $$('.edu-card').forEach(function (c) {
    var name = txt($('.edu-school', c));
    if (!name) return;
    var n = node('edu', name, c);
    n.sub = txt($('.edu-degree', c));
    link(me, n);
    tagsOf(c, '.tag').forEach(function (t) { link(n, node('tech', t.name, t.el)); });
  });

  var pf = $('.project-featured');
  if (pf) {
    var fp = node('project', txt($('.pf-title', pf)) || 'Featured', pf);
    fp.sub = txt($('.pf-subtitle', pf));
    link(me, fp);
    tagsOf(pf, '.pf-tech-item').forEach(function (t) { link(fp, node('tech', t.name, t.el)); });
  }

  $$('.project-card').forEach(function (c) {
    var name = txt($('.pc-title', c));
    if (!name) return;
    var p = node('project', name, c);
    p.sub = txt($('.pc-year', c));
    link(me, p);
    tagsOf(c, '.tag').forEach(function (t) { link(p, node('tech', t.name, t.el)); });
  });

  // Nothing to draw, and nothing to apologise for - leave the section out.
  if (nodes.length < 6 || !edges.length) { stage.hidden = true; return; }

  /* A technology that only ever appears once is a leaf: it says nothing
     the card it came from did not already say. One that appears twice is
     the actual finding, so it gets the size, the colour and the label.

     Leaves also get a fraction of the repulsive mass. At equal mass the
     forty-odd of them out-push the dozen nodes that matter and end up
     pinned around the edge of the frame in a ring, which is the exact
     opposite of the structure this is supposed to show. */
  nodes.forEach(function (n) {
    var base = { person: 16, work: 11.5, edu: 10.5, project: 9.5, tech: 4.2 }[n.kind];
    n.hub  = n.kind === 'tech' && n.deg > 1;
    n.r    = base + Math.min(n.deg, 9) * (n.kind === 'tech' ? 1.7 : 0.65);
    n.big  = n.kind !== 'tech' || n.hub;
    n.mass = n.kind === 'person' ? 2.6
           : n.big ? 1.35
           : 0.3;
  });


  /* ============================================================
     2. Colours

     Read off the stylesheet rather than repeated here, so the graph
     follows the theme toggle and every accent in the picker without
     knowing either of them exists.
     ============================================================ */

  var COL = {};
  function readColours() {
    var cs = getComputedStyle(document.documentElement);
    function v(name, fallback) {
      return (cs.getPropertyValue(name) || '').trim() || fallback;
    }
    COL.person = v('--accent', '#7c5cff');
    COL.work   = v('--cyan',   '#22d3ee');
    COL.edu    = v('--green',  '#34d399');
    COL.project= v('--pink',   '#f472b6');
    COL.tech   = v('--text-tertiary', '#6e6e85');
    COL.hub    = v('--amber',  '#fbbf24');
    COL.line   = v('--border-hi', 'rgba(255,255,255,.18)');
    COL.text   = v('--text-primary', '#f4f4f8');
    COL.dim    = v('--text-tertiary', '#6e6e85');
    COL.panel  = v('--bg-soft', '#0a0a12');
  }
  readColours();

  function colourOf(n) { return n.hub ? COL.hub : COL[n.kind]; }


  /* ============================================================
     3. Layout

     Plain O(n^2) repulsion. There are eighty-odd nodes here; a
     quadtree would be the correct data structure and the wrong amount
     of code for the size of the problem.
     ============================================================ */

  var W = 0, H = 0;

  /* Height of the strip along the bottom of the canvas that the legend
     occupies. Measured rather than guessed: the legend wraps to two rows
     on a phone, and a hard-coded number would be wrong on exactly the
     screen where the collision is worst. */
  var FLOOR = 0;

  /* Seeded, so the layout is the same every time you load the page.
     A portfolio that rearranges itself on refresh looks broken, not alive. */
  var seed = 20260903;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  function seedPositions() {
    var ring = { person: 0, work: 0.30, edu: 0.34, project: 0.42, tech: 0.78 };
    nodes.forEach(function (n, i) {
      var a = (i / nodes.length) * Math.PI * 2 + rnd() * 0.7;
      var d = Math.min(W, H) * (ring[n.kind] + rnd() * 0.06);
      n.x = W / 2 + Math.cos(a) * d;
      n.y = H / 2 + Math.sin(a) * d;
      n.vx = n.vy = 0;
    });
    me.x = W / 2; me.y = H / 2;
  }

  var REST = 54, SPRING = 0.05, REP = 3400, GRAV = 0.021, DAMP = 0.86;

  function step() {
    var i, j, a, b, dx, dy, d2, d, f;

    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        dx = b.x - a.x; dy = b.y - a.y;
        d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = (rnd() - 0.5); dy = (rnd() - 0.5); d2 = 0.25; }
        if (d2 > 90000) continue;                 // far enough to ignore
        d = Math.sqrt(d2);
        f = REP * a.mass * b.mass / d2;
        if (f > 4) f = 4;
        dx /= d; dy /= d;
        // Push each one in inverse proportion to its own weight, so a
        // leaf gets shoved aside by a hub rather than moving it.
        a.vx -= dx * f / a.mass; a.vy -= dy * f / a.mass;
        b.vx += dx * f / b.mass; b.vy += dy * f / b.mass;
      }
    }

    for (i = 0; i < edges.length; i++) {
      a = edges[i].a; b = edges[i].b;
      dx = b.x - a.x; dy = b.y - a.y;
      d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      f = (d - (REST + a.r + b.r)) * SPRING;
      dx = dx / d * f; dy = dy / d * f;
      a.vx += dx; a.vy += dy;
      b.vx -= dx; b.vy -= dy;
    }

    var energy = 0;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      a.vx += (W / 2 - a.x) * GRAV * 0.06;
      a.vy += ((H - FLOOR) / 2 - a.y) * GRAV * 0.06;

      if (a === dragging) { a.vx = a.vy = 0; continue; }

      a.vx *= DAMP; a.vy *= DAMP;
      if (a.vx > 14) a.vx = 14; if (a.vx < -14) a.vx = -14;
      if (a.vy > 14) a.vy = 14; if (a.vy < -14) a.vy = -14;
      a.x += a.vx; a.y += a.vy;

      // Keep everything inside the frame; a node parked off-canvas is
      // a node the reader will never find. The floor sits higher than
      // the other three walls because the legend is painted down there
      // in HTML, and the canvas has no way to know that.
      var m = a.r + 6;
      if (a.x < m) { a.x = m; a.vx *= -0.4; }
      if (a.x > W - m) { a.x = W - m; a.vx *= -0.4; }
      if (a.y < m) { a.y = m; a.vy *= -0.4; }
      if (a.y > H - m - FLOOR) { a.y = H - m - FLOOR; a.vy *= -0.4; }

      energy += a.vx * a.vx + a.vy * a.vy;
    }
    return energy / nodes.length;
  }


  /* ============================================================
     4. Paint
     ============================================================ */

  var hovered = null, selected = null, dragging = null;

  /* The set of things to keep bright when something is picked. */
  function lit() {
    var focus = hovered || selected;
    if (!focus) return null;
    var set = {};
    set[focus.id] = 1;
    focus.adj.forEach(function (n) { set[n.id] = 1; });
    return set;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var on = lit();
    var focus = hovered || selected;

    // Edges first, so nodes sit on top of their own wires.
    //
    // At rest a wire takes the colour of the card it came out of rather
    // than a flat grey. A uniform mesh reads as noise; a fan of cyan
    // lines reads as "those six technologies all belong to that one
    // job", which is the entire reason for drawing this instead of
    // printing the list again.
    ctx.lineWidth = 1;
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var hot = on && on[e.a.id] && on[e.b.id] &&
                (e.a === focus || e.b === focus);
      if (on && !hot) {
        ctx.globalAlpha = 0.05;
        ctx.strokeStyle = COL.line;
      } else if (hot) {
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = colourOf(e.a === focus ? e.b : e.a);
        ctx.lineWidth = 1.9;
      } else {
        // The card end of the wire, never the technology end.
        ctx.strokeStyle = colourOf(e.a.kind === 'tech' ? e.b : e.a);
        var shared = e.a.hub || e.b.hub;
        ctx.globalAlpha = shared ? 0.6 : 0.38;
        ctx.lineWidth   = shared ? 1.3 : 1;
      }
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.globalAlpha = 1;

    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var dim = on && !on[n.id];
      var c = colourOf(n);

      ctx.globalAlpha = dim ? 0.16 : 1;

      if (!dim && (n.big || n === focus)) {
        ctx.shadowColor = c;
        ctx.shadowBlur = n === focus ? 22 : 11;
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (n === selected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 5.5, 0, Math.PI * 2);
        ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.lineWidth = 1;
      }
      ctx.globalAlpha = 1;
    }

    // Labels last, so no node can be drawn over a name.
    //
    // Names are placed by priority into whichever of two slots is still
    // free - under the node, then over it - and dropped entirely if
    // neither is. A graph with four names printed on top of each other
    // is less readable than one with two of them missing, and the two
    // that survive are the ones worth reading.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var rank = { person: 0, work: 1, edu: 1, project: 1, tech: 2 };
    var queue = nodes.filter(function (m) {
      if (on && !on[m.id]) return false;          // dimmed: never labelled
      return m.big || m === focus || (on && on[m.id]);
    }).sort(function (p, q) {
      if (p === focus) return -1;
      if (q === focus) return 1;
      return rank[p.kind] - rank[q.kind] || q.deg - p.deg;
    });

    var taken = [];

    /* Every node is an obstacle before any label is placed. Label-vs-label
       collisions are the obvious problem, but a name printed across a
       neighbouring dot is just as unreadable and much easier to miss when
       you are looking at your own layout. */
    for (i = 0; i < nodes.length; i++) {
      var o = nodes[i];
      if (on && !on[o.id]) continue;              // dimmed dots don't block
      taken.push({ x1: o.x - o.r - 2, x2: o.x + o.r + 2,
                   y1: o.y - o.r - 2, y2: o.y + o.r + 2 });
    }

    function free(box) {
      for (var k = 0; k < taken.length; k++) {
        var t = taken[k];
        if (box.x1 < t.x2 && box.x2 > t.x1 && box.y1 < t.y2 && box.y2 > t.y1) return false;
      }
      return true;
    }

    for (i = 0; i < queue.length; i++) {
      var m   = queue[i];
      var big = m.kind !== 'tech';
      var fs  = big ? 12 : 10.5;
      ctx.font = (big ? '600 ' : '500 ') + fs + 'px ' +
                 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

      var label = m.name;
      if (label.length > 22) label = label.slice(0, 21) + '…';
      var w = ctx.measureText(label).width;
      var h = fs + 3;

      /* Eight places to try, in order of how naturally the eye ties the
         name back to its dot: under it, over it, then out to either
         side, then the diagonals. Two slots was not enough - the busiest
         corner of the graph is exactly where the names matter most, and
         that is where both vertical slots are already occupied. */
      var vy = m.r + (big ? 13 : 10);
      var hx = m.r + w / 2 + 7;
      var cands = [
        [m.x, m.y + vy], [m.x, m.y - vy],
        [m.x + hx, m.y], [m.x - hx, m.y],
        [m.x + hx * 0.72, m.y + vy * 0.9], [m.x - hx * 0.72, m.y + vy * 0.9],
        [m.x + hx * 0.72, m.y - vy * 0.9], [m.x - hx * 0.72, m.y - vy * 0.9]
      ];

      var slot = null, lx = 0;
      for (var s = 0; s < cands.length; s++) {
        // Keep the whole name inside the frame even when its node is not.
        var cx  = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, cands[s][0]));
        var cy  = Math.max(h / 2 + 3, Math.min(H - FLOOR - h / 2 - 3, cands[s][1]));
        var box = { x1: cx - w / 2 - 3, x2: cx + w / 2 + 3,
                    y1: cy - h / 2,     y2: cy + h / 2 };
        if (free(box)) { slot = cy; lx = cx; taken.push(box); break; }
      }
      // The person and whatever is selected always get printed; they are
      // the two the reader is actually looking for.
      if (slot === null) {
        if (m !== focus && m.kind !== 'person') continue;
        lx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, m.x));
        slot = m.y + vy;
        taken.push({ x1: lx - w / 2 - 3, x2: lx + w / 2 + 3,
                     y1: slot - h / 2, y2: slot + h / 2 });
      }

      // A three-pixel halo in the panel colour, so a name crossing an
      // edge stays readable without drawing a box behind it.
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = COL.panel;
      ctx.strokeText(label, lx, slot);
      ctx.lineWidth = 1;
      ctx.fillStyle = (m === focus) ? COL.text : (big ? COL.text : colourOf(m));
      ctx.globalAlpha = (big || m === focus) ? 1 : 0.88;
      ctx.fillText(label, lx, slot);
      ctx.globalAlpha = 1;
    }
  }


  /* ============================================================
     5. Run it, then stop

     rAF only while the layout still has somewhere to go and the
     section is actually on screen. Once it settles the loop exits and
     the canvas holds its last frame until something disturbs it.
     ============================================================ */

  var raf = 0, calm = 0, visible = false, ready = false;

  /* Centre gravity pulls toward the middle but it does not guarantee the
     finished layout is centred - it only has to balance the springs, and
     it balances them wherever the crowd happens to be. So once the thing
     stops moving, slide the whole cloud so its bounding box is centred in
     the frame. Translating every node by the same vector changes no
     distance and no force, so nothing starts moving again. */
  function recentre() {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, i, n;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n.x - n.r < x1) x1 = n.x - n.r;
      if (n.y - n.r < y1) y1 = n.y - n.r;
      if (n.x + n.r > x2) x2 = n.x + n.r;
      if (n.y + n.r > y2) y2 = n.y + n.r;
    }
    var dx = W / 2 - (x1 + x2) / 2;
    var dy = (H - FLOOR) / 2 - (y1 + y2) / 2;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return false;
    for (i = 0; i < nodes.length; i++) { nodes[i].x += dx; nodes[i].y += dy; }
    return true;
  }

  function frame() {
    raf = 0;
    var e = step();
    if (e < 0.02 && !dragging) { calm++; } else { calm = 0; }
    if (calm === 26) recentre();
    draw();
    if (calm < 26 && visible && !document.hidden) {
      raf = requestAnimationFrame(frame);
    }
  }

  function kick() {
    calm = 0;
    if (!raf && visible && !document.hidden && !reduce) raf = requestAnimationFrame(frame);
    else if (reduce) draw();
  }

  function resize() {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var fresh = !W;
    W = r.width; H = r.height;
    FLOOR = legendBox ? legendBox.offsetHeight + 10 : 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width  = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (fresh) {
      seedPositions();
      // Reduced motion gets the finished layout, not the journey to it.
      if (reduce) {
        for (var i = 0; i < 420; i++) step();
        recentre();
      }
    }
    ready = true;
    kick();
    draw();
  }

  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(cv);
  } else {
    window.addEventListener('resize', resize);
  }

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible) { if (!ready) resize(); kick(); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0.05 }).observe(stage);
  } else {
    visible = true;
    resize();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    else kick();
  });

  /* Theme and accent both land on <html>, one as an attribute and one
     as an inline custom property, so a single observer catches both.
     The legend and the side-panel chips carry their colours as inline
     custom properties, so they have to be rebuilt rather than restyled. */
  new MutationObserver(function () {
    readColours();
    renderLegend();
    renderSide();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });


  /* ============================================================
     6. Pointer
     ============================================================ */

  function at(ev) {
    var r = cv.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function hit(p) {
    var best = null, bd = 1e9;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var dx = n.x - p.x, dy = n.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      // Small nodes get a generous target; 4px circles are not clickable.
      if (d < Math.max(n.r + 7, 12) && d < bd) { bd = d; best = n; }
    }
    return best;
  }

  var moved = false;

  cv.addEventListener('pointermove', function (ev) {
    var p = at(ev);
    if (dragging) {
      moved = true;
      dragging.x = p.x; dragging.y = p.y;
      kick();
      return;
    }
    var h = hit(p);
    if (h !== hovered) {
      hovered = h;
      cv.style.cursor = h ? 'pointer' : 'default';
      if (!raf) draw();
      kick();
    }
  });

  cv.addEventListener('pointerleave', function () {
    if (dragging) return;
    if (hovered) { hovered = null; cv.style.cursor = 'default'; draw(); }
  });

  cv.addEventListener('pointerdown', function (ev) {
    var n = hit(at(ev));
    if (!n) { select(null); draw(); return; }
    dragging = n; moved = false;
    if (cv.setPointerCapture) { try { cv.setPointerCapture(ev.pointerId); } catch (e) {} }
    kick();
  });

  function release(ev) {
    if (!dragging) return;
    var n = dragging;
    dragging = null;
    if (cv.releasePointerCapture && ev) {
      try { cv.releasePointerCapture(ev.pointerId); } catch (e) {}
    }
    // A press that never moved is a click.
    if (!moved) select(selected === n ? null : n);
    kick();
  }
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);

  // Keyboard: the canvas is not reachable otherwise, and the side panel
  // is the accessible route into the same information.
  cv.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && selected) { ev.preventDefault(); select(null); }
  });


  /* ============================================================
     7. Side panel

     The graph shows the shape; this shows the names. It is also the
     only part of the feature that works without a pointer.
     ============================================================ */

  function select(n) {
    selected = n;
    renderSide();
    draw();
  }

  function chip(n) {
    return '<button class="net-chip" data-key="' + esc(n.key) + '" ' +
           'style="--k:' + colourOf(n) + '">' + esc(n.name) +
           (n.kind === 'tech' && n.deg > 1 ? '<s>' + n.deg + '</s>' : '') + '</button>';
  }

  function topHubs() {
    return nodes.filter(function (n) { return n.kind === 'tech' && n.deg > 1; })
                .sort(function (a, b) { return b.deg - a.deg || a.name.localeCompare(b.name); });
  }

  function renderSide() {
    if (!side) return;

    if (!selected) {
      var hubs = topHubs();

      /* A stacked bar of what the canvas is actually made of. It fills
         the space under the chips, but it earns it: the first question
         anyone asks of a graph they have not seen before is "how much
         of this is one thing?", and counting dots is a bad way to
         answer it. The widths are the real counts, not a nice shape. */
      var count = {};
      nodes.forEach(function (n) { count[n.kind] = (count[n.kind] || 0) + 1; });

      var kinds = ['work', 'edu', 'project', 'tech'].filter(function (k) { return count[k]; });
      var PLURAL = { work: 'Roles', edu: 'Degrees', project: 'Projects', tech: 'Technologies' };

      var mix = kinds.length
        ? '<div class="net-mix" aria-hidden="true">' +
            kinds.map(function (k) {
              return '<i style="--k:' + COL[k] + ';flex:' + count[k] + '"></i>';
            }).join('') +
          '</div>' +
          '<ul class="net-mix-key">' +
            kinds.map(function (k) {
              return '<li style="--k:' + COL[k] + '"><span>' + esc(PLURAL[k]) +
                     '</span><b>' + count[k] + '</b></li>';
            }).join('') +
          '</ul>'
        : '';

      side.innerHTML =
        '<div class="net-stat"><b>' + nodes.length + '</b> nodes <s>·</s> <b>' +
          edges.length + '</b> edges</div>' +
        '<p class="net-note">Read off the cards above and below this one. ' +
          'Nothing here is typed twice.</p>' +
        mix +
        (hubs.length
          ? '<h4>Shows up more than once</h4><div class="net-chips">' +
            hubs.slice(0, 14).map(chip).join('') + '</div>'
          : '') +
        '<p class="net-note net-tip">Click a node to trace it. Drag to pull the layout apart.</p>';
      return;
    }

    var n = selected;
    var groups = {};
    n.adj.forEach(function (m) { (groups[m.kind] = groups[m.kind] || []).push(m); });

    var order = ['person', 'work', 'edu', 'project', 'tech'];
    var body = order.filter(function (k) { return groups[k]; }).map(function (k) {
      return '<h4>' + esc(KIND[k].label) +
             (groups[k].length > 1 ? ' <s>' + groups[k].length + '</s>' : '') + '</h4>' +
             '<div class="net-chips">' +
             groups[k].sort(function (a, b) { return b.deg - a.deg; }).map(chip).join('') +
             '</div>';
    }).join('');

    side.innerHTML =
      '<div class="net-sel" style="--k:' + colourOf(n) + '">' +
        '<span class="net-kind">' + esc(n.hub ? 'Shared technology' : KIND[n.kind].label) + '</span>' +
        '<strong>' + esc(n.name) + '</strong>' +
        (n.sub ? '<span class="net-sub">' + esc(n.sub) + '</span>' : '') +
        '<span class="net-deg">' + n.deg + ' connection' + (n.deg === 1 ? '' : 's') + '</span>' +
      '</div>' + body +
      (n.src ? '<button class="net-go" data-src="1">' +
               '<i class="fas fa-arrow-turn-down"></i> Show it on the page</button>' : '') +
      '<button class="net-clear" data-clear="1">Clear selection</button>';
  }

  if (side) {
    side.addEventListener('click', function (ev) {
      var c = ev.target.closest('[data-key]');
      if (c) { select(byKey[c.getAttribute('data-key')] || null); return; }
      if (ev.target.closest('[data-clear]')) { select(null); return; }
      if (ev.target.closest('[data-src]') && selected && selected.src) {
        // Reuse the palette's own scroll-and-flash, so a jump from the
        // graph looks exactly like a jump from Cmd+K.
        if (window.__focusEl) window.__focusEl(selected.src);
        else selected.src.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      }
    });
  }

  function renderLegend() {
    if (!legendBox) return;
    legendBox.innerHTML = ['person', 'work', 'edu', 'project'].map(function (k) {
      return '<span style="--k:' + COL[k] + '">' + esc(KIND[k].label) + '</span>';
    }).join('') +
    '<span style="--k:' + COL.hub + '">Shared tech</span>' +
    '<span style="--k:' + COL.tech + '">Used once</span>';
  }
  renderLegend();

  renderSide();


  /* ============================================================
     8. Handles for the terminal and the palette
     ============================================================ */

  function find(q) {
    q = String(q || '').toLowerCase().trim();
    if (!q) return null;
    var exact = null, part = null;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], name = n.name.toLowerCase();
      if (name === q) { exact = n; break; }
      if (!part && name.indexOf(q) >= 0) part = n;
    }
    return exact || part;
  }

  window.__graph = {
    stats: function () { return { nodes: nodes.length, edges: edges.length }; },
    hubs:  function () {
      return topHubs().map(function (n) { return { name: n.name, deg: n.deg }; });
    },
    list: function () {
      return nodes.map(function (n) {
        return { name: n.name, kind: n.kind, deg: n.deg };
      });
    },
    neighbours: function (q) {
      var n = find(q);
      return n ? n.adj.map(function (m) { return m.name; }) : null;
    },
    focus: function (q) {
      var n = find(q);
      if (!n) return null;
      stage.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      select(n);
      kick();
      return n.name;
    }
  };
})();
