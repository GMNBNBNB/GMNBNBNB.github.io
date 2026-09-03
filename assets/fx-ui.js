/* ============================================================
   Interaction layer: command palette, theme wipe, decode-in
   headings, cursor-tracked card borders, live GitHub readout.

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
     2. Command palette

     The thing every tool this person uses all day has - Linear,
     VS Code, GitHub, Raycast - and that no portfolio has. It is the
     single clearest way for the site itself to say what kind of
     engineer built it.
     ============================================================ */
  var COMMANDS = [
    { g: 'Navigate', t: 'About',        i: 'fa-user',           c: 'var(--accent)', a: nav('#about') },
    { g: 'Navigate', t: 'Experience',   i: 'fa-briefcase',      c: 'var(--cyan)',   a: nav('#experience') },
    { g: 'Navigate', t: 'Education',    i: 'fa-graduation-cap', c: 'var(--accent)', a: nav('#education') },
    { g: 'Navigate', t: 'Skills',       i: 'fa-tools',          c: 'var(--green)',  a: nav('#skills') },
    { g: 'Navigate', t: 'Projects',     i: 'fa-code-branch',    c: 'var(--pink)',   a: nav('#projects') },
    { g: 'Navigate', t: 'Beyond Code',  i: 'fa-heart',          c: 'var(--pink)',   a: nav('#drives') },
    { g: 'Navigate', t: 'Contact',      i: 'fa-envelope',       c: 'var(--cyan)',   a: nav('#contact') },

    { g: 'Actions', t: 'Toggle theme', i: 'fa-circle-half-stroke', c: 'var(--amber)',
      k: 'T', a: function () {
        var btn = $('#themeToggle');
        if (btn) btn.click();
      } },
    { g: 'Actions', t: 'Open resume', i: 'fa-file-alt', c: 'var(--accent)',
      k: 'R', a: function () { window.open('resume.html', '_blank', 'noopener'); } },
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
      var found = -1;
      while (ti < lt.length) {
        if (lt[ti] === ch) { found = ti; break; }
        ti++;
      }
      if (found < 0) return null;
      s += 1;
      if (run) s += 4;                                        // consecutive
      if (found === 0 || /[\s·@.-]/.test(lt[found - 1])) s += 6;  // word start
      hit.push(found);
      run = 1;
      ti = found + 1;
    }
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
  var sel = 0, shown = [], lastFocus = null;

  if (pal && input && list) {
    // Label the shortcut for the platform actually in use.
    $$('.kbd-hint kbd').forEach(function (k) { k.textContent = isMac ? '⌘K' : 'Ctrl K'; });

    function render() {
      var q = input.value.trim();
      shown = [];

      COMMANDS.forEach(function (cmd) {
        var m = score(cmd.t, q);
        if (!m) return;
        shown.push({ cmd: cmd, s: m.s, hit: m.hit });
      });
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
        html +=
          '<div class="cmdk-item" role="option" data-i="' + i + '"' +
            ' aria-selected="' + (i === sel) + '" style="--ci-c:' + r.cmd.c + '">' +
            '<span class="ci-ico"><i class="' + (r.cmd.b ? 'fab ' : 'fas ') + r.cmd.i + '"></i></span>' +
            '<span class="ci-label">' + highlight(r.cmd.t, q ? r.hit : null) + '</span>' +
            (r.cmd.k ? '<span class="ci-hint">' + r.cmd.k + '</span>' : '') +
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
      document.body.classList.remove('cmdk-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

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
     3. Decode-in headings

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
     4. Cursor-tracked border glow

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
     5. Live GitHub readout

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

      box.hidden = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { box.classList.add('in'); });
      });
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

})();
