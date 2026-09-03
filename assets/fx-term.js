/* ============================================================
   fx-term.js - an actual shell, not a picture of one.

   Every command reads live state: the section printers walk the
   page's own DOM, `neofetch` reports the real browser it is running
   in, `gh` reuses the GitHub response fx-ui.js already fetched. There
   is no canned transcript anywhere in this file - if the resume
   changes, `cat experience.md` changes with it.

   Opened with the backtick key, or from the command palette.
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var win  = $('#term');
  var body = $('#termBody');
  var line = $('#termInput');
  var bar  = $('#termBar');
  if (!win || !body || !line) return;

  var HOST = 'meng@portfolio';
  var BOOT = Date.now();
  var history = [], hIdx = -1, draft = '';
  var booted = false;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }


  /* ------------------------------------------------------------
     Output

     Lines are appended already-complete and then faded in on a short
     per-line stagger. It reads as a program printing rather than as a
     block appearing, and unlike a character-by-character typewriter
     it never makes anyone wait to read.
     ------------------------------------------------------------ */
  var stagger = 0;

  function out(html, cls) {
    var d = document.createElement('div');
    d.className = 't-line' + (cls ? ' ' + cls : '');
    d.innerHTML = html === undefined ? '' : html;
    // Cap the stagger: a 40-line dump should not take two seconds.
    d.style.animationDelay = Math.min(stagger++ * 14, 260) + 'ms';
    body.appendChild(d);
    return d;
  }
  function outAll(lines, cls) { lines.forEach(function (l) { out(l, cls); }); }
  function bottom() { body.scrollTop = body.scrollHeight; }

  // Two-column key/value rows, used by neofetch and the stat printers.
  function kv(k, v) {
    return '<span class="t-k">' + esc(k) + '</span>' +
           '<span class="t-sep">·</span>' + v;
  }
  function bullet(s) { return '<span class="t-dim">  -</span> ' + s; }


  /* ------------------------------------------------------------
     Page readers

     Each returns lines built from the live DOM. Nothing is duplicated
     from the markup, so these cannot drift out of date.
     ------------------------------------------------------------ */
  function readAbout() {
    var p = $('.bento-main p');
    if (!p) return ['<span class="t-err">about.md: not found</span>'];
    var t = txt(p);
    // Wrap by words so the paragraph respects the window width without
    // relying on CSS wrapping inside a pre-like line.
    return ['<span class="t-b">' + esc(txt($('.bento-main h3'))) + '</span>', ''].concat(
      wrap(t, 78).map(esc)
    );
  }

  function wrap(s, n) {
    var words = s.split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).trim().length > n) { lines.push(cur.trim()); cur = w; }
      else cur += ' ' + w;
    });
    if (cur.trim()) lines.push(cur.trim());
    return lines;
  }

  function readExperience() {
    var items = $$('.timeline-item');
    if (!items.length) return ['<span class="t-err">experience.md: not found</span>'];
    var lines = [];
    items.forEach(function (it, i) {
      var meta = txt($('.tl-meta', it));
      lines.push(
        '<span class="t-idx">' + String(i + 1).padStart(2, '0') + '</span> ' +
        '<span class="t-b">' + esc(txt($('.tl-company', it))) + '</span>' +
        '<span class="t-sep">·</span><span class="t-v">' + esc(txt($('.tl-role', it))) + '</span>'
      );
      lines.push('   <span class="t-dim">' + esc(meta) + '</span>');
      $$('.tl-list li', it).forEach(function (li) {
        wrap(txt(li), 72).forEach(function (w, wi) {
          lines.push(wi === 0 ? bullet(esc(w)) : '    <span>' + esc(w) + '</span>');
        });
      });
      var tags = $$('.tag', it).map(function (t) { return txt(t); });
      if (tags.length) lines.push('   <span class="t-tag">' + tags.map(esc).join('</span> <span class="t-tag">') + '</span>');
      lines.push('');
    });
    return lines;
  }

  function readEducation() {
    var cards = $$('.edu-card');
    if (!cards.length) return ['<span class="t-err">education.md: not found</span>'];
    var lines = [];
    cards.forEach(function (c) {
      lines.push('<span class="t-b">' + esc(txt($('.edu-school', c))) + '</span>');
      lines.push('  <span class="t-v">' + esc(txt($('.edu-degree', c))) + '</span>');
      var meta = $$('.edu-meta > *', c).map(txt).filter(Boolean);
      if (!meta.length) meta = [txt(c.querySelector('.edu-meta'))].filter(Boolean);
      if (meta.length) lines.push('  <span class="t-dim">' + esc(meta.join('   ')) + '</span>');
      var tags = $$('.tag', c).map(txt);
      if (tags.length) lines.push('  <span class="t-tag">' + tags.map(esc).join('</span> <span class="t-tag">') + '</span>');
      lines.push('');
    });
    return lines;
  }

  function skillGroups() {
    return $$('.skill-category').map(function (c) {
      return { name: txt($('.skill-title', c)), items: $$('.skill-item', c).map(txt) };
    });
  }

  function readSkills(json) {
    var g = skillGroups();
    if (!g.length) return ['<span class="t-err">skills.json: not found</span>'];

    if (json) {
      var obj = {};
      g.forEach(function (x) { obj[x.name] = x.items; });
      return JSON.stringify(obj, null, 2).split('\n').map(function (l) {
        // Colour the keys the way a JSON pretty-printer would.
        return esc(l).replace(/&quot;(.*?)&quot;(\s*:)?/g, function (m, s, colon) {
          return '<span class="' + (colon ? 't-k' : 't-str') + '">"' + s + '"</span>' + (colon || '');
        });
      });
    }

    var lines = [];
    g.forEach(function (x) {
      lines.push('<span class="t-b">' + esc(x.name) + '</span> <span class="t-dim">(' + x.items.length + ')</span>');
      // Three columns, padded to the longest entry in the group.
      var w = Math.max.apply(null, x.items.map(function (s) { return s.length; })) + 2;
      for (var i = 0; i < x.items.length; i += 3) {
        lines.push('  ' + x.items.slice(i, i + 3).map(function (s) {
          return '<span class="t-v">' + esc(s.padEnd(w)) + '</span>';
        }).join(''));
      }
      lines.push('');
    });
    return lines;
  }

  function readProjects() {
    var lines = [];
    var feat = $('.project-featured');
    if (feat) {
      lines.push('<span class="t-ok">★</span> <span class="t-b">' + esc(txt($('.pf-title', feat)) || 'AutoSeek') + '</span>' +
                 '<span class="t-sep">·</span><span class="t-dim">featured</span>');
      var sub = txt($('.pf-subtitle', feat));
      if (sub) lines.push('  <span class="t-v">' + esc(sub) + '</span>');
      lines.push('');
    }
    $$('.project-card').forEach(function (c) {
      lines.push('<span class="t-idx">' + esc(txt($('.pc-year', c))) + '</span> ' +
                 '<span class="t-b">' + esc(txt($('.pc-title', c))) + '</span>');
      wrap(txt($('.pc-desc', c)), 72).forEach(function (w) { lines.push('     <span class="t-v">' + esc(w) + '</span>'); });
      var tags = $$('.tag', c).map(txt);
      if (tags.length) lines.push('     <span class="t-tag">' + tags.map(esc).join('</span> <span class="t-tag">') + '</span>');
      lines.push('');
    });
    return lines.length ? lines : ['<span class="t-err">projects.md: not found</span>'];
  }

  function readContact() {
    return [
      kv('email   ', '<a href="mailto:mg4774@columbia.edu">mg4774@columbia.edu</a>'),
      kv('phone   ', '<span class="t-v">(614) 569-1267</span>'),
      kv('github  ', '<a href="https://github.com/GMNBNBNB" target="_blank" rel="noopener">github.com/GMNBNBNB</a>'),
      kv('linkedin', '<a href="https://www.linkedin.com/in/meng-gao-58772b299/" target="_blank" rel="noopener">in/meng-gao-58772b299</a>'),
      '',
      '<span class="t-dim">try `copy email` or `email` to open your mail app</span>'
    ];
  }


  /* ------------------------------------------------------------
     Virtual filesystem - what `ls` shows and `cat` reads.
     ------------------------------------------------------------ */
  var FS = {
    'about.md':      { size: 1.2, fn: readAbout },
    'experience.md': { size: 6.8, fn: readExperience },
    'education.md':  { size: 1.1, fn: readEducation },
    'skills.json':   { size: 2.4, fn: function () { return readSkills(true); } },
    'projects.md':   { size: 4.3, fn: readProjects },
    'contact.md':    { size: 0.4, fn: readContact }
  };

  var SECTIONS = ['about', 'experience', 'education', 'skills', 'projects', 'drives', 'contact'];


  /* ------------------------------------------------------------
     neofetch
     ------------------------------------------------------------ */
  var LOGO = [
    ' ███╗   ███╗ ██████╗ ',
    ' ████╗ ████║██╔════╝ ',
    ' ██╔████╔██║██║  ███╗',
    ' ██║╚██╔╝██║██║   ██║',
    ' ██║ ╚═╝ ██║╚██████╔╝',
    ' ╚═╝     ╚═╝ ╚═════╝ '
  ];

  function browser() {
    var ua = navigator.userAgent;
    var m = /(Edg|OPR|Chrome|Firefox|Version)\/([\d.]+)/.exec(ua);
    if (!m) return 'unknown';
    var name = { Edg: 'Edge', OPR: 'Opera', Version: 'Safari' }[m[1]] || m[1];
    return name + ' ' + m[2].split('.')[0];
  }

  function uptime() {
    var s = Math.floor((Date.now() - BOOT) / 1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60);
    return m + 'm ' + (s % 60) + 's';
  }

  function neofetch() {
    var cs = getComputedStyle(document.documentElement);
    var info = [
      ['user',    HOST],
      ['os',      navigator.platform || 'unknown'],
      ['browser', browser()],
      ['shell',   'mg-sh 1.0'],
      ['display', screen.width + 'x' + screen.height + ' @' + (devicePixelRatio || 1) + 'x'],
      ['viewport', innerWidth + 'x' + innerHeight],
      ['cores',   (navigator.hardwareConcurrency || '?') + ' threads' +
                  (navigator.deviceMemory ? '  /  ' + navigator.deviceMemory + ' GB' : '')],
      ['locale',  navigator.language || '-'],
      ['theme',   (document.documentElement.getAttribute('data-theme') || 'dark') +
                  '  /  ' + (localStorage.getItem('accent-v1') || 'violet')],
      ['uptime',  uptime()]
    ];

    var swatch = ['--accent', '--cyan', '--green', '--amber', '--orange', '--pink', '--red']
      .map(function (v) {
        return '<i class="t-swatch" style="background:' + cs.getPropertyValue(v).trim() + '"></i>';
      }).join('');

    var rows = Math.max(LOGO.length, info.length + 2);
    var lines = [];
    for (var i = 0; i < rows; i++) {
      var art = '<span class="t-logo">' + esc(LOGO[i] !== undefined ? LOGO[i] : '                     ') + '</span>';
      var right = '';
      if (i === 0) right = '<span class="t-b">' + HOST + '</span>';
      else if (i === 1) right = '<span class="t-dim">' + '-'.repeat(HOST.length) + '</span>';
      else if (info[i - 2]) right = kv(info[i - 2][0].padEnd(8), '<span class="t-v">' + esc(info[i - 2][1]) + '</span>');
      lines.push(art + '   ' + right);
    }
    lines.push('');
    lines.push('<span class="t-logo">' + ' '.repeat(21) + '</span>   ' + swatch);
    return lines;
  }


  /* ------------------------------------------------------------
     Commands
     ------------------------------------------------------------ */
  var CMD = {};
  function def(name, help, fn, args) { CMD[name] = { h: help, fn: fn, a: args }; }

  def('help', 'this list', function () {
    var names = Object.keys(CMD);
    var w = Math.max.apply(null, names.map(function (n) { return n.length; })) + 2;
    return ['<span class="t-dim">commands - Tab completes, ↑↓ walks history</span>', ''].concat(
      names.map(function (n) {
        return '  <span class="t-k">' + esc((n + (CMD[n].a ? ' ' + CMD[n].a : '')).padEnd(w + 10)) + '</span>' +
               '<span class="t-v">' + esc(CMD[n].h) + '</span>';
      })
    );
  });

  def('whoami', 'the short version', function () {
    return [
      '<span class="t-b">' + esc(txt($('.hero-card .hero-name')) || 'Meng Gao') + '</span>',
      '<span class="t-v">' + esc(txt($('.hero-card .hero-role')) || 'Software Engineer · Microsoft') + '</span>',
      '',
      kv('now     ', '<span class="t-v">SDK integration-test infrastructure in Rust, Python, C#</span>'),
      kv('before  ', '<span class="t-v">AWS SDE Intern · Columbia MS CS · Ohio State BS CSE</span>'),
      kv('shipped ', '<span class="t-v">AutoSeek - 16K lines of SwiftUI, solo, zero to one</span>'),
      '',
      '<span class="t-dim">`ls` for the rest, `neofetch` for the machine you are on</span>'
    ];
  });

  def('ls', 'list what is readable here', function () {
    var lines = ['<span class="t-dim">total ' + Object.keys(FS).length + '</span>'];
    Object.keys(FS).forEach(function (f) {
      lines.push('<span class="t-dim">-rw-r--r--</span>  ' +
                 '<span class="t-num">' + FS[f].size.toFixed(1).padStart(5) + 'K</span>  ' +
                 '<span class="t-file">' + esc(f) + '</span>');
    });
    lines.push('');
    lines.push('<span class="t-dim">`cat &lt;file&gt;` to read · `cd &lt;section&gt;` to jump there</span>');
    return lines;
  }, '');

  def('cat', 'print a file', function (a) {
    var f = a[0];
    if (!f) return ['<span class="t-err">cat: missing operand</span>', '<span class="t-dim">try: cat about.md</span>'];
    if (!FS[f]) {
      // Accept a bare section name too - nobody wants to type the extension.
      var guess = Object.keys(FS).filter(function (k) { return k.indexOf(f) === 0; })[0];
      if (!guess) return ['<span class="t-err">cat: ' + esc(f) + ': No such file</span>'];
      f = guess;
    }
    return FS[f].fn();
  }, '<file>');

  def('about',      'what I do',            function () { return readAbout(); });
  def('experience', 'where I have worked',  function () { return readExperience(); });
  def('education',  'degrees',              function () { return readEducation(); });
  def('projects',   'what I have built',    function () { return readProjects(); });
  def('contact',    'how to reach me',      function () { return readContact(); });

  def('skills', 'stack, --json for raw', function (a) {
    return readSkills(a[0] === '--json' || a[0] === '-j');
  }, '[--json]');

  def('gh', 'live GitHub numbers', function () {
    var g = window.__GH;
    if (!g) return ['<span class="t-warn">github: no data</span>',
                    '<span class="t-dim">the API call is still in flight, or the rate limit is hit</span>'];
    var lines = [
      kv('repos   ', '<span class="t-num">' + g.repos + '</span> <span class="t-dim">public, forks excluded</span>'),
      kv('stars   ', '<span class="t-num">' + g.stars + '</span>'),
      kv('langs   ', '<span class="t-num">' + g.langs.length + '</span>'),
      kv('lastpush', '<span class="t-v">' + esc(g.last) + '</span>'),
      ''
    ];
    var max = g.langs[0].n;
    g.langs.slice(0, 8).forEach(function (l) {
      var n = Math.max(1, Math.round(l.n / max * 22));
      lines.push('  <span class="t-v">' + esc(l.k.padEnd(14)) + '</span>' +
                 '<span class="t-bar" style="color:' + (l.c || 'var(--accent)') + '">' + '█'.repeat(n) + '</span>' +
                 ' <span class="t-dim">' + l.n + '</span>');
    });
    lines.push('');
    lines.push('<span class="t-dim">bars are repository counts - the API gives one language per repo</span>');
    return lines;
  });

  def('neofetch', 'the machine you are reading this on', neofetch);

  def('cd', 'jump to a section', function (a) {
    var s = (a[0] || '').replace(/^[#\/]/, '').replace(/\.md$|\.json$/, '');
    if (!s) return ['<span class="t-dim">' + SECTIONS.join('  ') + '</span>'];
    var hit = SECTIONS.filter(function (x) { return x.indexOf(s) === 0; })[0];
    if (!hit) return ['<span class="t-err">cd: ' + esc(s) + ': No such section</span>'];
    close();
    setTimeout(function () {
      var el = document.getElementById(hit);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 220);
    return ['<span class="t-ok">→</span> <span class="t-v">' + esc(hit) + '</span>'];
  }, '<section>');
  CMD.open = CMD.cd;

  def('theme', 'dark | light', function (a) {
    var cur = document.documentElement.getAttribute('data-theme');
    var next = a[0] === 'dark' || a[0] === 'light' ? a[0] : (cur === 'dark' ? 'light' : 'dark');
    var btn = $('#themeToggle');
    if (next !== cur && btn) btn.click();
    return ['<span class="t-ok">theme</span> <span class="t-sep">·</span> <span class="t-v">' + next + '</span>'];
  }, '[dark|light]');

  def('accent', 'recolour the site', function (a) {
    var A = window.__ACCENTS || {};
    var names = Object.keys(A);
    if (!a[0]) {
      return ['<span class="t-dim">accent &lt;name&gt;</span>', ''].concat(names.map(function (n) {
        return '  <i class="t-swatch" style="background:' + A[n].d + '"></i> <span class="t-v">' + n + '</span>';
      }));
    }
    var hit = names.filter(function (n) { return n.indexOf(a[0].toLowerCase()) === 0; })[0];
    if (!hit) return ['<span class="t-err">accent: ' + esc(a[0]) + ': unknown</span>',
                      '<span class="t-dim">' + names.join('  ') + '</span>'];
    if (window.__setAccent) window.__setAccent(hit);
    return ['<span class="t-ok">accent</span> <span class="t-sep">·</span> ' +
            '<i class="t-swatch" style="background:' + A[hit].d + '"></i> <span class="t-v">' + hit + '</span>'];
  }, '[name]');

  def('resume', 'open the printable resume', function () {
    window.open('resume.html', '_blank', 'noopener');
    return ['<span class="t-ok">opening</span> <span class="t-file">resume.html</span>'];
  });

  def('email', 'compose a message', function () {
    location.href = 'mailto:mg4774@columbia.edu';
    return ['<span class="t-ok">opening</span> <span class="t-v">mailto:mg4774@columbia.edu</span>'];
  });

  def('copy', 'email | phone | url', function (a) {
    var map = {
      email: 'mg4774@columbia.edu',
      phone: '(614) 569-1267',
      url:   location.href
    };
    var v = map[a[0]];
    if (!v) return ['<span class="t-err">copy: email | phone | url</span>'];
    if (navigator.clipboard) navigator.clipboard.writeText(v).catch(function () {});
    return ['<span class="t-ok">copied</span> <span class="t-sep">·</span> <span class="t-v">' + esc(v) + '</span>'];
  }, '<what>');

  /* The whole page as Markdown. Built by fx-ui.js out of the live DOM,
     so it is the same text the palette's "Copy page as Markdown" puts
     on the clipboard - this one just shows its work first. */
  def('md', '--copy to take it, --all to see it', function (a) {
    if (!window.__md) return ['<span class="t-err">md: exporter not loaded</span>'];
    var text = window.__md();
    var kb   = (text.length / 1024).toFixed(1);
    var arg  = a[0] || '';

    if (arg === '--copy' || arg === '-c') {
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
      return ['<span class="t-ok">copied</span> <span class="t-sep">·</span> ' +
              '<span class="t-v">' + kb + ' KB</span> <span class="t-dim">of Markdown</span>'];
    }

    var all   = arg === '--all' || arg === '-a';
    var lines = text.trim().split('\n');
    var head  = all ? lines : lines.slice(0, 34);

    // Colour the two things that carry the structure and leave the prose
    // alone - this is a preview, not a syntax highlighter.
    var out = head.map(function (l) {
      if (/^#{1,6} /.test(l)) return '<span class="t-b">' + esc(l) + '</span>';
      if (/^- /.test(l))      return '<span class="t-ok">-</span> <span class="t-dim">' +
                                     esc(l.slice(2)) + '</span>';
      return '<span class="t-dim">' + esc(l) + '</span>';
    });

    out.push('');
    if (!all) out.push('<span class="t-dim">… ' + (lines.length - head.length) +
                       ' more lines  ·  </span><span class="t-v">md --all</span>');
    out.push('<span class="t-dim">' + lines.length + ' lines  ·  ' + kb +
             ' KB  ·  </span><span class="t-v">md --copy</span>' +
             '<span class="t-dim"> for the clipboard</span>');
    return out;
  }, '[--copy|--all]');

  def('date', 'now, here and in New York', function () {
    var d = new Date();
    return [
      kv('local   ', '<span class="t-v">' + esc(d.toString().replace(/ \(.*\)$/, '')) + '</span>'),
      kv('new york', '<span class="t-v">' + esc(d.toLocaleString('en-US', { timeZone: 'America/New_York' })) + '</span>'),
      kv('utc     ', '<span class="t-v">' + esc(d.toISOString()) + '</span>')
    ];
  });

  def('echo', 'say it back', function (a) { return [esc(a.join(' '))]; }, '<text>');

  def('history', 'what you have typed', function () {
    return history.length
      ? history.map(function (h, i) { return '<span class="t-idx">' + String(i + 1).padStart(3) + '</span>  ' + esc(h); })
      : ['<span class="t-dim">nothing yet</span>'];
  });

  def('clear', 'wipe the screen', function () { body.innerHTML = ''; stagger = 0; return null; });

  def('sudo', 'no', function (a) {
    return a.length
      ? ['<span class="t-err">' + esc(HOST.split('@')[0]) + ' is not in the sudoers file. This incident will be reported.</span>']
      : ['<span class="t-dim">usage: sudo &lt;command&gt;</span>'];
  }, '<command>');

  def('exit', 'close the terminal', function () { close(); return null; });


  /* ------------------------------------------------------------
     Run
     ------------------------------------------------------------ */
  function prompt(cmd) {
    return '<span class="t-host">' + HOST + '</span>' +
           '<span class="t-path">:~$</span> <span class="t-cmd">' + esc(cmd) + '</span>';
  }

  function exec(raw) {
    var s = raw.trim();
    stagger = 0;
    out(prompt(s), 't-echo');
    if (!s) { bottom(); return; }

    if (history[history.length - 1] !== s) history.push(s);
    hIdx = -1;

    var parts = s.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);

    var c = CMD[name];
    if (!c) {
      // Suggest by prefix before giving up - a typo should not be a wall.
      var near = Object.keys(CMD).filter(function (k) { return k.indexOf(name[0]) === 0; }).slice(0, 5);
      out('<span class="t-err">' + esc(name) + ': command not found</span>');
      if (near.length) out('<span class="t-dim">did you mean: ' + near.join(', ') + '</span>');
      out('<span class="t-dim">`help` lists everything</span>');
      bottom();
      return;
    }

    var res;
    try { res = c.fn(args); }
    catch (e) { res = ['<span class="t-err">' + esc(name) + ': ' + esc(e.message) + '</span>']; }
    if (res) outAll(res);
    out('');
    bottom();
  }


  /* ------------------------------------------------------------
     Input: history, completion, control keys
     ------------------------------------------------------------ */
  line.addEventListener('keydown', function (e) {
    var k = e.key;

    if (k === 'Enter') {
      e.preventDefault();
      var v = line.value;
      line.value = '';
      exec(v);
      return;
    }

    if (k === 'Tab') {
      e.preventDefault();
      var cur = line.value;
      var seg = cur.split(/\s+/);
      // Complete the command when it is the only word, otherwise complete
      // a filename - `cat ab<Tab>` should give about.md, not a command.
      var pool = seg.length > 1 ? Object.keys(FS).concat(SECTIONS) : Object.keys(CMD);
      var frag = seg[seg.length - 1].toLowerCase();
      var hits = pool.filter(function (n) { return n.indexOf(frag) === 0; });
      if (!hits.length) return;
      if (hits.length === 1) {
        seg[seg.length - 1] = hits[0];
        line.value = seg.join(' ') + ' ';
      } else {
        stagger = 0;
        out(prompt(cur), 't-echo');
        out('<span class="t-v">' + hits.map(esc).join('   ') + '</span>');
        out('');
        bottom();
      }
      return;
    }

    if (k === 'ArrowUp' || k === 'ArrowDown') {
      if (!history.length) return;
      e.preventDefault();
      if (hIdx === -1) draft = line.value;
      hIdx = k === 'ArrowUp'
        ? Math.min(hIdx + 1, history.length - 1)
        : hIdx - 1;
      if (hIdx < 0) { hIdx = -1; line.value = draft; }
      else line.value = history[history.length - 1 - hIdx];
      // Park the caret at the end rather than wherever it was.
      setTimeout(function () { line.setSelectionRange(line.value.length, line.value.length); }, 0);
      return;
    }

    if (e.ctrlKey && (k === 'l' || k === 'L')) { e.preventDefault(); body.innerHTML = ''; stagger = 0; return; }
    if (e.ctrlKey && (k === 'c' || k === 'C') && !window.getSelection().toString()) {
      e.preventDefault();
      stagger = 0;
      out(prompt(line.value) + '<span class="t-err">^C</span>', 't-echo');
      line.value = '';
      bottom();
      return;
    }
    if (k === 'Escape') { e.preventDefault(); close(); }
  });


  /* ------------------------------------------------------------
     Window: open, close, drag, expand
     ------------------------------------------------------------ */
  function open() {
    if (!win.hidden) { line.focus(); return; }
    win.hidden = false;
    if (!booted) {
      booted = true;
      stagger = 0;
      outAll(neofetch());
      out('');
      out('<span class="t-dim">type <span class="t-k">help</span> for the command list, or <span class="t-k">ls</span> to look around</span>');
      out('');
    }
    requestAnimationFrame(function () {
      win.classList.add('in');
      line.focus();
      bottom();
    });
  }

  function close() {
    if (win.hidden) return;
    win.classList.remove('in');
    // Let the exit transition play before the element leaves the tree.
    setTimeout(function () { win.hidden = true; }, 180);
  }

  window.__term = { open: open, close: close, toggle: function () { win.hidden ? open() : close(); } };

  $$('[data-term-close]').forEach(function (b) { b.addEventListener('click', close); });
  $$('[data-term-max]').forEach(function (b) {
    b.addEventListener('click', function () {
      // Drop any dragged position so the expanded window re-centres
      // instead of growing off the edge of the screen.
      win.style.left = win.style.top = win.style.transform = '';
      win.classList.toggle('max');
      bottom();
    });
  });
  var launcher = $('#termToggle');
  if (launcher) launcher.addEventListener('click', function () { win.hidden ? open() : close(); });

  // Clicking dead space in the window puts the caret back in the prompt,
  // the way clicking a terminal pane does - but not while selecting text.
  win.addEventListener('mouseup', function () {
    if (!window.getSelection().toString()) line.focus();
  });

  // Drag by the title bar. Position is stored on the element, so it stays
  // put across open/close within a visit.
  if (bar) {
    var drag = null;
    bar.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) return;
      var r = win.getBoundingClientRect();
      drag = { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
      win.classList.add('dragging');
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      // Keep at least a strip of the title bar reachable at every edge.
      var x = Math.min(Math.max(e.clientX - drag.x, 12 - drag.w + 90), innerWidth - 90);
      var y = Math.min(Math.max(e.clientY - drag.y, 8), innerHeight - 44);
      win.style.left = x + 'px';
      win.style.top = y + 'px';
      win.style.transform = 'none';
    });
    window.addEventListener('mouseup', function () {
      if (!drag) return;
      drag = null;
      win.classList.remove('dragging');
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== '`' && e.key !== '~') return;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;   // not while typing a message
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    win.hidden ? open() : close();
  });

})();
