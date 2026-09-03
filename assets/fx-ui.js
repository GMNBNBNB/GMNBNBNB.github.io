/* ============================================================
   Interaction layer: theme wipe, accent colours, command palette,
   decode-in headings, cursor-tracked card borders, live GitHub
   readout, activity grid, telemetry HUD.

   Everything here is additive. If a browser lacks any of the APIs
   used below the page degrades to exactly what it was before.
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var FX = window.__FX || {};
  var SITE = window.__SITE || {};
  var reduce = FX.reduceMotion ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);


  /* ============================================================
     1. Theme wipe

     The old and new themes are two full-page snapshots; the new one
     is revealed through a circle growing out of the button you just
     pressed. Bounded, one-shot, and it starts where your eye already
     is - the toggle - so nothing about it is disorienting.

     app.js calls this if it exists and falls back to a plain swap if
     the browser has no View Transitions.
     ============================================================ */
  window.__themeWipe = function (next, originEl, apply) {
    if (!document.startViewTransition || reduce) { apply(next); return; }

    var r = originEl.getBoundingClientRect();
    var x = r.left + r.width / 2;
    var y = r.top + r.height / 2;
    // Radius that still covers the furthest corner from the origin.
    var far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    var vt = document.startViewTransition(function () { apply(next); });
    vt.ready.then(function () {
      document.documentElement.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)',
                     'circle(' + far + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 620, easing: 'cubic-bezier(.22,.61,.36,1)',
          pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function () {});
  };


  /* ============================================================
     2. Accent colour

     One hue drives the whole site - links, gradients, glows, the hero
     canvas. Swapping it is five custom properties on <html>, and the
     inline style outranks both theme blocks, so it survives a theme
     toggle. The light column is a separate hex rather than the same
     one dimmed: 45% violet on white is a smear, not a colour.
     ============================================================ */
  var ACCENTS = {
    violet: { d: '#7c5cff', l: '#6d4df6', dl: '#a78bfa', ll: '#8b6cf8' },
    cyan:   { d: '#22d3ee', l: '#0e8ba8', dl: '#67e8f9', ll: '#0891b2' },
    mint:   { d: '#34d399', l: '#047f5c', dl: '#6ee7b7', ll: '#059669' },
    amber:  { d: '#f59e0b', l: '#b45309', dl: '#fcd34d', ll: '#d97706' },
    rose:   { d: '#fb7185', l: '#d4145a', dl: '#fda4af', ll: '#e11d48' },
    blue:   { d: '#3b82f6', l: '#1d4ed8', dl: '#93c5fd', ll: '#2563eb' }
  };
  window.__ACCENTS = ACCENTS;

  var ACCENT_KEY = 'accent-v1';
  var accentName = 'violet';
  try {
    var savedAccent = localStorage.getItem(ACCENT_KEY);
    if (savedAccent && ACCENTS[savedAccent]) accentName = savedAccent;
  } catch (e) {}

  function paintAccent(name) {
    var a = ACCENTS[name];
    if (!a) return;
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    var base = dark ? a.d : a.l;
    var lite = dark ? a.dl : a.ll;
    var s = document.documentElement.style;
    s.setProperty('--accent', base);
    s.setProperty('--violet', base);            // a few older rules still use this
    s.setProperty('--accent-light', lite);
    s.setProperty('--accent-bg', 'color-mix(in srgb, ' + base + ' ' + (dark ? 14 : 10) + '%, transparent)');
    s.setProperty('--glow',      'color-mix(in srgb, ' + base + ' ' + (dark ? 45 : 30) + '%, transparent)');
  }

  /* fx.js re-reads the palette off computed style whenever data-theme
     mutates, and that is the only hook it offers. Re-setting the
     attribute to its current value still queues a mutation record, so
     this is how the hero canvas learns about a new accent. */
  var skipTheme = 0;
  function repaintCanvas() {
    var el = document.documentElement;
    skipTheme++;
    el.setAttribute('data-theme', el.getAttribute('data-theme'));
  }

  window.__setAccent = function (name) {
    if (!ACCENTS[name]) return;
    accentName = name;
    paintAccent(name);
    try { localStorage.setItem(ACCENT_KEY, name); } catch (e) {}
    repaintCanvas();
    if (SITE.toast) SITE.toast('Accent · ' + name);
  };

  paintAccent(accentName);

  // A real theme change needs the other column of hexes. Our own pokes
  // are counted off first so this cannot feed itself.
  new MutationObserver(function () {
    if (skipTheme > 0) { skipTheme--; return; }
    paintAccent(accentName);
    repaintCanvas();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });


  /* ============================================================
     3. Command palette

     The thing every tool this person uses all day has - Linear,
     VS Code, GitHub, Raycast - and that no portfolio has. It is the
     single clearest way for the site itself to say what kind of
     engineer built it.
     ============================================================ */

  /* Filled in by sections 9 and 10. The entries below only call these
     on click, long after both assignments have run. */
  var openKeys     = function () {};
  var copyMarkdown = function () {};

  var COMMANDS = [
    { g: 'Navigate', t: 'About',        i: 'fa-user',           c: 'var(--accent)', a: nav('#about') },
    { g: 'Navigate', t: 'Experience',   i: 'fa-briefcase',      c: 'var(--cyan)',   a: nav('#experience') },
    { g: 'Navigate', t: 'Education',    i: 'fa-graduation-cap', c: 'var(--accent)', a: nav('#education') },
    { g: 'Navigate', t: 'Skills',       i: 'fa-tools',          c: 'var(--green)',  a: nav('#skills') },
    { g: 'Navigate', t: 'Projects',     i: 'fa-code-branch',    c: 'var(--pink)',   a: nav('#projects') },
    { g: 'Navigate', t: 'Beyond Code',  i: 'fa-heart',          c: 'var(--pink)',   a: nav('#drives') },
    { g: 'Navigate', t: 'Contact',      i: 'fa-envelope',       c: 'var(--cyan)',   a: nav('#contact') },

    { g: 'Actions', t: 'Open terminal', i: 'fa-terminal', c: 'var(--green)',
      k: '`', a: function () { if (window.__term) window.__term.open(); } },
    { g: 'Actions', t: 'Toggle theme', i: 'fa-circle-half-stroke', c: 'var(--amber)',
      k: 'T', a: function () {
        var btn = $('#themeToggle');
        if (btn) btn.click();
      } },
    { g: 'Actions', t: 'Change accent colour', i: 'fa-palette', c: 'var(--pink)',
      a: function () { openAccents(); } },
    { g: 'Actions', t: 'Toggle telemetry HUD', i: 'fa-gauge-high', c: 'var(--cyan)',
      a: function () { if (window.__hud) window.__hud.toggle(); } },
    { g: 'Actions', t: 'Keyboard shortcuts', i: 'fa-keyboard', c: 'var(--text-secondary)',
      k: '?', a: function () { openKeys(); } },
    { g: 'Actions', t: 'Open resume', i: 'fa-file-alt', c: 'var(--accent)',
      k: 'R', a: function () { window.open('resume.html', '_blank', 'noopener'); } },
    { g: 'Actions', t: 'Copy page as Markdown', i: 'fa-file-lines', c: 'var(--amber)',
      a: function () { copyMarkdown(); } },
    { g: 'Actions', t: 'Copy email address', i: 'fa-copy', c: 'var(--green)',
      a: function () { copy('mg4774@columbia.edu', 'Email copied'); } },
    { g: 'Actions', t: 'Copy phone number', i: 'fa-copy', c: 'var(--green)',
      a: function () { copy('(614) 569-1267', 'Phone copied'); } },
    { g: 'Actions', t: 'Back to top', i: 'fa-arrow-up', c: 'var(--text-secondary)',
      a: function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); } },

    { g: 'Links', t: 'GitHub  ·  @GMNBNBNB', i: 'fa-github', b: 1, c: 'var(--text-primary)',
      a: link('https://github.com/GMNBNBNB') },
    { g: 'Links', t: 'LinkedIn  ·  Meng Gao', i: 'fa-linkedin', b: 1, c: '#0a66c2',
      a: link('https://www.linkedin.com/in/meng-gao-58772b299/') },
    { g: 'Links', t: 'Send me an email', i: 'fa-paper-plane', c: 'var(--cyan)',
      a: function () { location.href = 'mailto:mg4774@columbia.edu'; } },
    { g: 'Links', t: 'View source of this site', i: 'fa-code', c: 'var(--amber)',
      a: link('https://github.com/GMNBNBNB/GMNBNBNB.github.io') }
  ];

  function nav(hash) {
    return function () {
      var el = $(hash);
      if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };
  }
  function link(url) {
    return function () { window.open(url, '_blank', 'noopener'); };
  }
  function copy(text, msg) {
    var done = function () { if (SITE.toast) SITE.toast(msg); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* Subsequence match. Consecutive hits and word-start hits score
     higher, so "cp em" ranks "Copy email address" above anything that
     merely contains those letters scattered about. Returns null on no
     match so the caller can filter in one pass. */
  function score(text, q) {
    if (!q) return { s: 0, hit: [] };
    var lt = text.toLowerCase(), lq = q.toLowerCase();
    var ti = 0, s = 0, run = 0, hit = [];

    for (var qi = 0; qi < lq.length; qi++) {
      var ch = lq[qi];
      if (ch === ' ') { run = 0; continue; }
      var from = ti;                                          // where the scan resumed
      var found = -1;
      while (ti < lt.length) {
        if (lt[ti] === ch) { found = ti; break; }
        ti++;
      }
      if (found < 0) return null;
      s += 1;
      // Adjacent to the previous hit, not merely after it. Without the
      // position check every match past the first collects this bonus,
      // which lets a long paragraph outscore the exact word.
      if (run && found === from) s += 4;
      if (found === 0 || /[\s·@.-]/.test(lt[found - 1])) s += 6;  // word start
      hit.push(found);
      run = 1;
      ti = found + 1;
    }
    // A literal run of the query beats any scattered subsequence: typing
    // "swift" should surface the skill, not a sentence with an s and a
    // w and an i somewhere in it.
    if (lq.indexOf(' ') < 0 && lt.indexOf(lq) >= 0) s += 12;
    return { s: s - text.length * 0.02, hit: hit };
  }

  function highlight(text, hit) {
    if (!hit || !hit.length) return esc(text);
    var out = '', h = 0;
    for (var i = 0; i < text.length; i++) {
      if (hit[h] === i) { out += '<b>' + esc(text[i]) + '</b>'; h++; }
      else out += esc(text[i]);
    }
    return out;
  }
  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var pal   = $('#cmdk');
  var input = $('#cmdkInput');
  var list  = $('#cmdkList');
  var sel = 0, shown = [], lastFocus = null, mode = 'cmd';

  /* ------------------------------------------------------------
     Page index

     The palette searches what the page actually says, not just its
     own sixteen commands - every heading, role, bullet, skill and
     project blurb. Built from the DOM on first use, so it can never
     describe a version of the resume that is no longer on screen.
     ------------------------------------------------------------ */
  var PAGE = null;

  function flat(el) { return el.textContent.replace(/\s+/g, ' ').trim(); }

  function goTo(el) {
    return function () {
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      // Mark the whole card, not the run of text - a ring around one
      // <li> is hard to spot, a ring around its panel is not.
      var host = el.closest('.glass, .timeline-card, .project-card, .drive-card') || el;
      host.classList.remove('cmdk-flash');
      void host.offsetWidth;                       // restart the animation
      host.classList.add('cmdk-flash');
      setTimeout(function () { host.classList.remove('cmdk-flash'); }, 1700);
    };
  }

  function buildIndex() {
    if (PAGE) return PAGE;
    PAGE = [];

    function add(el, sec, icon, colour, text) {
      var t = (text === undefined ? flat(el) : text.replace(/\s+/g, ' ').trim());
      if (t.length < 3) return;
      // Truncate at index time so the highlight offsets stay valid.
      if (t.length > 96) t = t.slice(0, 95) + '…';
      PAGE.push({ t: t, g: 'Page', sec: sec, i: icon, c: colour, a: goTo(el) });
    }

    $$('.bento-main h3').forEach(function (e) { add(e, 'About', 'fa-user', 'var(--accent)'); });

    $$('.timeline-item').forEach(function (it) {
      var co = $('.tl-company', it), ro = $('.tl-role', it);
      if (co) add(co, 'Experience', 'fa-briefcase', 'var(--cyan)',
                  flat(co) + '  ·  ' + (ro ? flat(ro) : ''));
      $$('.tl-list li', it).forEach(function (li) { add(li, 'Experience', 'fa-circle-dot', 'var(--cyan)'); });
    });

    $$('.edu-card').forEach(function (c) {
      var s = $('.edu-school', c), d = $('.edu-degree', c);
      if (s) add(s, 'Education', 'fa-graduation-cap', 'var(--accent)',
                 flat(s) + '  ·  ' + (d ? flat(d) : ''));
    });

    $$('.skill-category').forEach(function (cat) {
      var name = flat($('.skill-title', cat) || cat);
      $$('.skill-item', cat).forEach(function (s) { add(s, name, 'fa-cube', 'var(--green)'); });
    });

    var pf = $('.project-featured');
    if (pf) {
      add($('.pf-title', pf) || pf, 'Projects', 'fa-star', 'var(--amber)');
      $$('.pf-highlights li', pf).forEach(function (li) { add(li, 'AutoSeek', 'fa-circle-dot', 'var(--amber)'); });
    }
    $$('.project-card').forEach(function (c) {
      var t = $('.pc-title', c), d = $('.pc-desc', c);
      if (t) add(t, 'Projects', 'fa-code-branch', 'var(--pink)');
      if (d) add(d, 'Projects', 'fa-align-left', 'var(--pink)');
    });

    $$('.drive-card').forEach(function (c) {
      var h = c.querySelector('.drive-title') || c;
      add(h, 'Beyond Code', 'fa-heart', 'var(--pink)');
    });

    return PAGE;
  }

  /* Accent picker, rendered as a second mode of the same panel rather
     than as another floating thing to dismiss. */
  function accentItems() {
    return Object.keys(ACCENTS).map(function (n) {
      return {
        g: 'Accent', sw: 1, t: n.charAt(0).toUpperCase() + n.slice(1),
        i: 'fa-circle', c: ACCENTS[n].d,
        k: n === accentName ? 'current' : '',
        a: function () { window.__setAccent(n); }
      };
    });
  }

  /* Forward slot. The real implementation needs render() and open(),
     which are block-scoped inside the guard below; the COMMANDS entry
     only calls this on click, long after the assignment. */
  var openAccents = function () {};

  if (pal && input && list) {
    // Label the shortcut for the platform actually in use.
    $$('.kbd-hint kbd').forEach(function (k) { k.textContent = isMac ? '⌘K' : 'Ctrl K'; });

    function render() {
      var q = input.value.trim();
      shown = [];

      if (mode === 'accent') {
        accentItems().forEach(function (cmd) {
          var m = score(cmd.t, q);
          if (m) shown.push({ cmd: cmd, s: m.s, hit: m.hit });
        });
      } else {
        COMMANDS.forEach(function (cmd) {
          var m = score(cmd.t, q);
          // Commands are the palette's own vocabulary; on an equal match
          // they should sit above a paragraph that happens to contain
          // the same letters.
          if (m) shown.push({ cmd: cmd, s: m.s + 9, hit: m.hit });
        });

        if (q.length > 1) {
          var hits = [];
          buildIndex().forEach(function (cmd) {
            var m = score(cmd.t, q);
            if (m) hits.push({ cmd: cmd, s: m.s, hit: m.hit });
          });
          hits.sort(function (a, b) { return b.s - a.s; });
          shown = shown.concat(hits.slice(0, 10));
        }
      }

      if (q) shown.sort(function (a, b) { return b.s - a.s; });

      if (!shown.length) {
        list.innerHTML = '<div class="cmdk-empty">No match for <code>' + esc(q) + '</code></div>';
        return;
      }

      var html = '', group = null;
      shown.forEach(function (r, i) {
        // Grouping headers only make sense in the unfiltered list; once
        // results are ranked by score the groups interleave.
        if (!q && r.cmd.g !== group) {
          group = r.cmd.g;
          html += '<div class="cmdk-group">' + group + '</div>';
        }
        var hint = r.cmd.sec || r.cmd.k;
        html +=
          '<div class="cmdk-item' + (r.cmd.sec ? ' is-page' : '') + (r.cmd.sw ? ' is-swatch' : '') +
            '" role="option" data-i="' + i + '"' +
            ' aria-selected="' + (i === sel) + '" style="--ci-c:' + r.cmd.c + '">' +
            '<span class="ci-ico"><i class="' + (r.cmd.b ? 'fab ' : 'fas ') + r.cmd.i + '"></i></span>' +
            '<span class="ci-label">' + highlight(r.cmd.t, q ? r.hit : null) + '</span>' +
            (hint ? '<span class="ci-hint">' + esc(hint) + '</span>' : '') +
          '</div>';
      });
      list.innerHTML = html;
    }

    function move(d) {
      if (!shown.length) return;
      sel = (sel + d + shown.length) % shown.length;
      $$('.cmdk-item', list).forEach(function (el) {
        var on = +el.getAttribute('data-i') === sel;
        el.setAttribute('aria-selected', on);
        if (on) el.scrollIntoView({ block: 'nearest' });
      });
    }

    function run(i) {
      var r = shown[i];
      if (!r) return;
      var isAccent = mode === 'accent';
      // Picking a colour is a preview, not a destination: staying open
      // lets you try all six against the live page.
      if (isAccent) { r.cmd.a(); render(); return; }
      close();
      // Let the palette finish closing before the action moves the page,
      // otherwise a smooth scroll starts under a panel that is still up.
      setTimeout(function () { r.cmd.a(); }, 60);
    }

    function open() {
      if (!pal.hidden) return;
      lastFocus = document.activeElement;
      pal.hidden = false;
      document.body.classList.add('cmdk-open');
      input.value = '';
      sel = 0;
      render();
      input.focus();
    }

    function close() {
      if (pal.hidden) return;
      pal.hidden = true;
      mode = 'cmd';
      input.placeholder = 'Jump to a section, copy an address, flip the theme…';
      document.body.classList.remove('cmdk-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    openAccents = function () {
      mode = 'accent';
      open();                                  // no-op if it is already up
      input.value = '';
      input.placeholder = 'Pick an accent…';
      sel = 0;
      render();
      input.focus();
    };
    window.__palette = { open: open, close: close, accents: openAccents };

    input.addEventListener('input', function () { sel = 0; render(); });

    pal.addEventListener('click', function (e) {
      if (e.target.closest('[data-cmdk-close]')) { close(); return; }
      var item = e.target.closest('.cmdk-item');
      if (item) run(+item.getAttribute('data-i'));
    });

    pal.addEventListener('mousemove', function (e) {
      var item = e.target.closest('.cmdk-item');
      if (!item) return;
      var i = +item.getAttribute('data-i');
      if (i !== sel) { sel = i; move(0); }
    });

    $$('.kbd-hint').forEach(function (b) { b.addEventListener('click', open); });

    document.addEventListener('keydown', function (e) {
      var k = e.key;

      if ((e.metaKey || e.ctrlKey) && (k === 'k' || k === 'K')) {
        e.preventDefault();
        pal.hidden ? open() : close();
        return;
      }

      if (pal.hidden) {
        // "/" to search, the way GitHub does it - but not while the
        // visitor is typing a message into the contact form.
        var tag = (document.activeElement && document.activeElement.tagName) || '';
        if (k === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          open();
        }
        return;
      }

      if (k === 'Escape')    { e.preventDefault(); close(); }
      else if (k === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (k === 'ArrowUp')   { e.preventDefault(); move(-1); }
      else if (k === 'Enter')     { e.preventDefault(); run(sel); }
    });
  }


  /* ============================================================
     4. Decode-in headings

     Section titles resolve out of noise the first time they scroll
     into view. Every glyph is replaced by another glyph, so the line
     never changes character count and nothing below it reflows.
     ============================================================ */
  var NOISE = '#$%&/\\<>[]{}=+*!?01';

  function decode(el) {
    // Text nodes only - the titles carry a <span class="gradient">
    // that has to survive intact.
    var parts = [];
    (function walk(n) {
      for (var i = 0; i < n.childNodes.length; i++) {
        var c = n.childNodes[i];
        if (c.nodeType === 3) parts.push({ n: c, t: c.nodeValue });
        else if (c.nodeType === 1) walk(c);
      }
    })(el);

    var total = parts.reduce(function (s, p) { return s + p.t.length; }, 0);
    if (!total) return;

    var start = null, DUR = 120 + total * 22;

    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / DUR, 1);
      var upto = p * total;
      var seen = 0;

      for (var i = 0; i < parts.length; i++) {
        var src = parts[i].t, out = '';
        for (var j = 0; j < src.length; j++, seen++) {
          // Spaces stay spaces: word boundaries are what stop the line
          // reading as one long smear of noise while it resolves.
          if (seen < upto || src[j] === ' ') out += src[j];
          else out += NOISE[(Math.random() * NOISE.length) | 0];
        }
        parts[i].n.nodeValue = out;
      }

      if (p < 1) requestAnimationFrame(frame);
      else for (var k = 0; k < parts.length; k++) parts[k].n.nodeValue = parts[k].t;
    }
    requestAnimationFrame(frame);
  }

  var titles = $$('.section-title');
  if (titles.length && !reduce && 'IntersectionObserver' in window) {
    var titleObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        titleObs.unobserve(en.target);
        decode(en.target);
      });
    }, { threshold: 0.6 });
    titles.forEach(function (t) { titleObs.observe(t); });
  }


  /* ============================================================
     5. Cursor-tracked border glow

     fx-cards.js already writes --mx / --my on every .glass element for
     the inner spotlight; this rides the same two variables, so the
     border ring costs no additional listener.
     ============================================================ */
  $$('.glass').forEach(function (el) {
    var g = document.createElement('span');
    g.className = 'card-glow';
    g.setAttribute('aria-hidden', 'true');
    el.insertBefore(g, el.firstChild);
  });


  /* ============================================================
     6. Live GitHub readout

     Two unauthenticated calls against the public API. Anything less
     than a clean result hides the block: a rate-limited visitor should
     see the page without it rather than a panel reporting zeroes.
     ============================================================ */
  var LANG_C = {
    'C#': '#178600', Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6',
    HTML: '#e34c26', CSS: '#563d7c', Java: '#b07219', Swift: '#F05138', Rust: '#dea584',
    'C++': '#f34b7d', C: '#555555', Go: '#00ADD8', Ruby: '#701516', Shell: '#89e051',
    Jupyter: '#DA5B0B', 'Jupyter Notebook': '#DA5B0B', Dockerfile: '#384d54', Vue: '#41b883'
  };

  function ago(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (d < 1)  return 'today';
    if (d < 2)  return 'yesterday';
    if (d < 31) return Math.round(d) + ' days ago';
    if (d < 365) return Math.round(d / 30) + ' months ago';
    return Math.round(d / 365) + ' years ago';
  }

  function loadGitHub() {
    var box = $('#ghLive');
    if (!box || !window.fetch) return;

    var U = 'https://api.github.com/users/GMNBNBNB';
    Promise.all([
      fetch(U).then(ok),
      fetch(U + '/repos?per_page=100&sort=updated').then(ok)
    ]).then(function (r) {
      render(r[0], r[1]);
    }).catch(function () { /* stays hidden */ });

    function ok(res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    }

    function render(user, repos) {
      if (!user || !Array.isArray(repos) || !repos.length) return;

      // Forks are somebody else's work; they inflate both the repo
      // count and the star total without saying anything true.
      var own = repos.filter(function (r) { return !r.fork; });
      if (!own.length) return;

      var stars = own.reduce(function (s, r) { return s + (r.stargazers_count || 0); }, 0);

      var last = own.reduce(function (m, r) {
        var t = r.pushed_at || r.updated_at;
        return (!m || t > m) ? t : m;
      }, null);

      var byLang = {};
      own.forEach(function (r) {
        if (r.language) byLang[r.language] = (byLang[r.language] || 0) + 1;
      });
      var langs = Object.keys(byLang)
        .map(function (k) { return { k: k, n: byLang[k] }; })
        .sort(function (a, b) { return b.n - a.n; });
      var langTotal = langs.reduce(function (s, l) { return s + l.n; }, 0) || 1;

      var stats =
        stat(own.length, 'Public repositories') +
        stat('<i class="fas fa-star"></i>' + stars, 'Stars earned') +
        stat(langs.length, 'Languages shipped') +
        (last ? stat('<span style="font-size:.95rem">' + ago(last) + '</span>', 'Last push') : '');

      var bar = langs.map(function (l) {
        return '<i style="flex:' + l.n + ';background:' + (LANG_C[l.k] || 'var(--accent)') + '"></i>';
      }).join('');

      var legend = langs.slice(0, 7).map(function (l) {
        return '<span class="gh-lang" style="--lc:' + (LANG_C[l.k] || 'var(--accent)') + '">' +
                 '<s></s>' + esc(l.k) +
                 '<span>' + Math.round(l.n / langTotal * 100) + '%</span>' +
               '</span>';
      }).join('');

      $('#ghLiveBody').innerHTML =
        '<div class="gh-stats">' + stats + '</div>' +
        '<div class="gh-langbar">' + bar + '</div>' +
        '<div class="gh-langs">' + legend +
          '<span class="gh-lang" style="color:var(--text-tertiary)">by repository count</span>' +
        '</div>';

      // Published for the terminal's `gh` command, so the two surfaces
      // can never disagree - there is only one fetch.
      window.__GH = { repos: own.length, stars: stars, langs: langs.map(function (l) {
        return { k: l.k, n: l.n, c: LANG_C[l.k] || 'var(--accent)' };
      }), last: last };

      box.hidden = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { box.classList.add('in'); });
      });

      // Second panel, same payload. Section 7.
      drawTimeline(own);
    }

    function stat(v, l) {
      return '<div><div class="gh-stat-v">' + v + '</div>' +
             '<div class="gh-stat-l">' + l + '</div></div>';
    }
  }

  // After first paint - the readout is a bonus, not part of the story
  // the page has to tell to be complete.
  if (window.requestIdleCallback) requestIdleCallback(loadGitHub, { timeout: 2500 });
  else setTimeout(loadGitHub, 900);


  /* ============================================================
     7. Repository timeline

     Drawn from the same /repos payload section 6 already fetched, so
     there is no second request and the two panels cannot disagree.

     The obvious thing to put here is a wall of green contribution
     squares. GitHub's only public, unauthenticated source of dated
     activity is /events/public, it keeps about 90 days, and for an
     account whose day job lives in private repos it comes back empty.
     Ninety-one grey squares are a worse lie than no squares at all.
     What the repos payload does carry is dated and true: when each
     project started and when it was last pushed. That is what this
     draws - one bar per repository, from birth to last commit.
     ============================================================ */
  var MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var TL_MAX = 14;                         // taller than this stops being scannable

  function stamp(t) {
    var d = new Date(t);
    return MON3[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
  }

  function drawTimeline(own) {
    var box = $('#ghGrid'), body = $('#ghGridBody');
    if (!box || !body) return;

    var rows = own.filter(function (r) { return r.created_at; });
    if (rows.length < 3) return;           // two bars is a list, not a timeline

    var total = rows.length;
    // Cut by most-recently-pushed so the live projects survive, then
    // display oldest-first so the chart reads left-to-right in time.
    rows = rows.slice().sort(function (a, b) {
      var x = a.pushed_at || a.created_at, y = b.pushed_at || b.created_at;
      return x < y ? 1 : x > y ? -1 : 0;
    }).slice(0, TL_MAX).sort(function (a, b) {
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    });

    var t1 = Date.now();
    var t0 = rows.reduce(function (m, r) {
      var t = +new Date(r.created_at);
      return t < m ? t : m;
    }, t1);
    var span = (t1 - t0) || 1;
    function pct(t) { return (t - t0) / span * 100; }

    // One rule per January inside the window. Evenly spaced in time,
    // so they double as a scale without an axis to read.
    var lines = '', y1 = new Date(t1).getFullYear();
    for (var y = new Date(t0).getFullYear() + 1; y <= y1; y++) {
      lines += '<i style="left:' + pct(+new Date(y, 0, 1)).toFixed(2) +
               '%" data-y="' + y + '"></i>';
    }

    var html = '';
    rows.forEach(function (r, i) {
      var a = +new Date(r.created_at);
      var b = +new Date(r.pushed_at || r.created_at);
      if (b < a) b = a;
      var tip = r.name + (r.language ? ' · ' + r.language : '') +
                ' · ' + stamp(a) + ' → ' + stamp(b);
      html +=
        '<span class="ag-name" title="' + esc(tip) + '">' +
          '<b>' + esc(r.name) + '</b>' +
          (r.stargazers_count ? '<s>' + r.stargazers_count + '</s>' : '') +
        '</span>' +
        '<span class="ag-lane"><i class="ag-bar" title="' + esc(tip) +
          '" style="--bc:' + (LANG_C[r.language] || 'var(--accent)') +
          ';--i:' + i +
          ';left:' + pct(a).toFixed(2) + '%' +
          ';right:' + (100 - pct(b)).toFixed(2) + '%"></i></span>';
    });

    body.innerHTML =
      '<div class="ag-tl">' +
        '<div class="ag-lines">' + lines + '</div>' +
        '<div class="ag-rows">' + html + '</div>' +
      '</div>' +
      '<div class="ag-foot">' +
        '<span>' + (total > TL_MAX ? TL_MAX + ' of ' + total : total) +
          ' repositories · created → last push</span>' +
        '<span class="ag-key">bar colour = primary language</span>' +
      '</div>';

    box.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { box.classList.add('in'); });
    });
  }


  /* ============================================================
     8. Telemetry HUD

     Off by default, opened from the palette or with Shift+D. Every
     number is measured, not decorative: the frame counter is a real
     rAF tally and the sparkline is the last 60 of them. The loop only
     runs while the panel is open, so a closed HUD costs nothing.
     ============================================================ */
  var hud = $('#hud');
  if (hud) {
    var hudOn = false, raf = 0, frames = 0, mark = 0;
    var spark = $('#hudSpark'), ctx = spark && spark.getContext ? spark.getContext('2d') : null;
    var hist = [], HN = 60;

    function set(id, v) {
      var el = $('#' + id);
      if (el && el.textContent !== v) el.textContent = v;
    }

    function sizeSpark() {
      if (!ctx) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      spark.width  = spark.offsetWidth * dpr;
      spark.height = spark.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawSpark() {
      if (!ctx) return;
      var w = spark.offsetWidth, h = spark.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      if (!hist.length) return;
      var cs = getComputedStyle(document.documentElement);
      var a = cs.getPropertyValue('--accent').trim() || '#7c5cff';
      var bw = w / HN;
      for (var i = 0; i < hist.length; i++) {
        // Scaled against 60, clamped - a 144Hz display should peg the
        // bar, not squash everything else into the floor.
        var v = Math.min(hist[i] / 60, 1);
        var bh = Math.max(1, v * (h - 1));
        ctx.fillStyle = hist[i] < 30 ? '#ff4d4f' : hist[i] < 50 ? '#fbbf24' : a;
        ctx.globalAlpha = 0.35 + 0.65 * (i / HN);
        ctx.fillRect(i * bw, h - bh, Math.max(1, bw - 1), bh);
      }
      ctx.globalAlpha = 1;
    }

    function loop(ts) {
      if (!hudOn) return;
      frames++;
      if (!mark) mark = ts;
      if (ts - mark >= 500) {
        var fps = Math.round(frames * 1000 / (ts - mark));
        frames = 0; mark = ts;
        hist.push(fps);
        if (hist.length > HN) hist.shift();
        set('hudFps', fps);
        drawSpark();
        readSlow();
      }
      raf = requestAnimationFrame(loop);
    }

    function readSlow() {
      var de = document.documentElement;
      var span = de.scrollHeight - window.innerHeight;
      set('hudView', window.innerWidth + '×' + window.innerHeight);
      set('hudScroll', (span > 0 ? Math.round(window.pageYOffset / span * 100) : 0) + '%');
      set('hudTheme', de.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
      set('hudAccent', accentName);
      set('hudDpr', (window.devicePixelRatio || 1).toFixed(1) + '×');
      set('hudNodes', document.getElementsByTagName('*').length);
    }

    function show() {
      if (hudOn) return;
      hudOn = true;
      hud.hidden = false;
      requestAnimationFrame(function () { hud.classList.add('in'); });
      sizeSpark();
      readSlow();
      mark = 0; frames = 0;
      raf = requestAnimationFrame(loop);
    }

    function hide() {
      if (!hudOn) return;
      hudOn = false;
      cancelAnimationFrame(raf);
      hud.classList.remove('in');
      setTimeout(function () { if (!hudOn) hud.hidden = true; }, 200);
    }

    window.__hud = {
      toggle: function () { hudOn ? hide() : show(); },
      show: show, hide: hide,
      get on() { return hudOn; }
    };

    hud.addEventListener('click', function (e) {
      if (e.target.closest('[data-hud-close]')) hide();
    });

    window.addEventListener('resize', function () { if (hudOn) sizeSpark(); }, { passive: true });

    // A closed tab should not be burning a rAF loop.
    document.addEventListener('visibilitychange', function () {
      if (!hudOn) return;
      if (document.hidden) cancelAnimationFrame(raf);
      else { mark = 0; frames = 0; raf = requestAnimationFrame(loop); }
    });

    document.addEventListener('keydown', function (e) {
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'D' ) return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      e.preventDefault();
      window.__hud.toggle();
    });
  }


  /* ============================================================
     9. Global shortcuts, and the panel that documents them

     The palette has advertised T and R since the day it shipped and
     nothing anywhere was bound to either. Rather than delete the
     hints, bind the keys - then add the one key that makes the rest
     findable at all. Every row in the table below is a key that is
     really handled somewhere in this codebase; a shortcut nobody can
     discover is not a feature, and one that does nothing is a lie.
     ============================================================ */
  var MOD = isMac ? '⌘' : 'ctrl';

  var KEYMAP = [
    ['Anywhere', [
      [[MOD, 'K'],     'Command palette'],
      [['/'],          'Straight into its search'],
      [['`'],          'Terminal'],
      [['T'],          'Light / dark'],
      [['R'],          'Printable resume'],
      [['shift', 'D'], 'Telemetry HUD'],
      [['?'],          'This panel']
    ]],
    ['In the palette', [
      [['↑', '↓'],     'Move the selection'],
      [['↵'],          'Run it'],
      [['esc'],        'Dismiss']
    ]],
    ['In the terminal', [
      [['tab'],        'Complete a command'],
      [['↑', '↓'],     'Previous lines'],
      [['ctrl', 'L'],  'Clear the screen'],
      [['ctrl', 'C'],  'Abandon the line'],
      [['md'],         'This page as Markdown'],
      [['help'],       'Everything it knows']
    ]]
  ];

  var keysBox  = $('#keys');
  var keysBody = $('#keysBody');

  if (keysBox && keysBody) {
    var keysBack = null;

    keysBody.innerHTML = KEYMAP.map(function (g) {
      return '<div class="keys-col"><h4>' + esc(g[0]) + '</h4>' +
        g[1].map(function (r) {
          return '<div class="keys-row"><span class="keys-k">' +
            r[0].map(function (k) { return '<kbd>' + esc(k) + '</kbd>'; }).join('') +
            '</span><span class="keys-d">' + esc(r[1]) + '</span></div>';
        }).join('') +
      '</div>';
    }).join('');

    var showKeys = function () {
      if (!keysBox.hidden) return;
      keysBack = document.activeElement;
      keysBox.hidden = false;
      document.body.classList.add('cmdk-open');
      requestAnimationFrame(function () { keysBox.classList.add('in'); });
    };
    var hideKeys = function () {
      if (keysBox.hidden) return;
      keysBox.classList.remove('in');
      document.body.classList.remove('cmdk-open');
      setTimeout(function () { keysBox.hidden = true; }, 180);
      if (keysBack && keysBack.focus) keysBack.focus();
    };

    openKeys = function () { keysBox.hidden ? showKeys() : hideKeys(); };
    keysBox.addEventListener('click', function (e) {
      if (e.target.closest('[data-keys-close]') || e.target === keysBox) hideKeys();
    });
  }

  /* One listener for the three page-level keys. It stands down for
     anything that is already listening: a focused field, an open
     palette, an open terminal. */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var open = keysBox && !keysBox.hidden;
    if (e.key === 'Escape' && open) { e.preventDefault(); openKeys(); return; }

    var el  = document.activeElement;
    var tag = (el && el.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (el && el.isContentEditable)) return;

    var pal = $('#cmdk'), trm = $('#term');
    if ((pal && !pal.hidden) || (trm && !trm.hidden)) return;

    if (e.key === '?') { e.preventDefault(); openKeys(); return; }
    if (open) return;

    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      var btn = $('#themeToggle');
      if (btn) btn.click();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      window.open('resume.html', '_blank', 'noopener');
    }
  });


  /* ============================================================
     10. Copy the page as Markdown

     Half the traffic a resume site gets now arrives through a
     parser - a recruiter pasting into an ATS, or into a model. Let
     them take the clean version instead of whatever the clipboard
     makes of styled HTML.

     Read out of the live DOM at the moment you press it, so it can
     never describe a version of the resume that is no longer here.
     ============================================================ */
  var MD_CARDS = [
    { s: '.bento-main',       h: 'h3',             p: 'p' },
    { s: '.timeline-item',    h: '.tl-company',    r: '.tl-role',      m: '.tl-meta',
      p: null, li: '.tl-list li',       t: '.tag' },
    { s: '.edu-card',         h: '.edu-school',    r: '.edu-degree',   m: '.edu-meta',
      p: '.edu-courses-label',                                          t: '.tag' },
    { s: '.skill-category',   h: '.skill-title',                        t: '.skill-item' },
    { s: '.project-featured', h: '.pf-title',      r: '.pf-subtitle',
      p: '.pf-desc',          li: '.pf-highlights li',                  t: '.pf-tech-item' },
    { s: '.project-card',     h: '.pc-title',                          m: '.pc-year',
      p: '.pc-desc',                                                    t: '.tag' },
    { s: '.drive-card',       h: '.drive-title',   p: '.drive-desc' },
    { s: '.contact-item',     h: '.contact-label', r: '.contact-value' }
  ];
  var MD_SEL = MD_CARDS.map(function (c) { return c.s; }).join(',');

  /* Icons carry no text, <br> and sibling <span>s are really
     separators, and <strong> is the one bit of inline styling on the
     page that means something. */
  function mdText(el) {
    if (!el) return '';
    var c = el.cloneNode(true);
    $$('i, svg', c).forEach(function (n) { n.parentNode.removeChild(n); });
    $$('br', c).forEach(function (n) {
      n.parentNode.replaceChild(document.createTextNode(' · '), n);
    });
    $$('strong, b', c).forEach(function (n) {
      var t = n.textContent.replace(/\s+/g, ' ').trim();
      n.parentNode.replaceChild(document.createTextNode(t ? '**' + t + '**' : ''), n);
    });
    return c.textContent.replace(/\s+/g, ' ').replace(/\s+·/g, ' ·').trim();
  }

  function mdMeta(el) {
    if (!el) return '';
    var kids = $$('span', el).filter(function (s) { return s.parentNode === el; });
    return kids.length > 1
      ? kids.map(mdText).filter(Boolean).join(' · ')
      : mdText(el);
  }

  function buildMarkdown() {
    var out = [];
    var name = mdText($('.hero-title')).replace(/^Hi,? I'?m\s*/i, '');
    var role = mdText($('.hero-role'));

    out.push('# ' + (name || 'Meng Gao'));
    if (role) out.push('', role);
    out.push('', '<' + location.origin + location.pathname + '>');

    $$('section[id]').forEach(function (sec) {
      var head = mdText($('.section-tag', sec)) ||
                 mdText($('.section-title', sec));
      if (!head) return;
      out.push('', '## ' + head);

      var sub = mdText($('.section-sub', sec));
      if (sub) out.push('', sub);

      $$(MD_SEL, sec).forEach(function (card) {
        // A card nested inside another card is already being printed.
        if (card.parentNode && card.parentNode.closest(MD_SEL)) return;
        var d = MD_CARDS.filter(function (x) { return card.matches(x.s); })[0];
        if (!d) return;

        var h = mdText($(d.h, card));
        var r = d.r ? mdText($(d.r, card)) : '';
        if (h) out.push('', '### ' + h + (r ? ' — ' + r : ''));
        else if (r) out.push('', r);

        var m = d.m ? mdMeta($(d.m, card)) : '';
        if (m) out.push('', '*' + m + '*');

        if (d.p) $$(d.p, card).forEach(function (p) {
          var t = mdText(p);
          if (t) out.push('', t);
        });

        if (d.li) {
          var li = $$(d.li, card).map(mdText).filter(Boolean);
          if (li.length) out.push('', li.map(function (x) { return '- ' + x; }).join('\n'));
        }

        if (d.t) {
          var tags = $$(d.t, card).map(mdText).filter(Boolean);
          if (tags.length) out.push('', '`' + tags.join('` `') + '`');
        }
      });
    });

    out.push('', '---', '', 'Exported from the live page on ' +
             new Date().toISOString().slice(0, 10) + '.');

    return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
  }

  window.__md = buildMarkdown;

  copyMarkdown = function () {
    var md = buildMarkdown();
    copy(md, 'Page copied as Markdown · ' + Math.round(md.length / 1024 * 10) / 10 + ' KB');
    return md;
  };

})();
