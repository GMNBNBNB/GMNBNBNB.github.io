/* ============================================================
   Site behaviour: theme, nav, typing, reveal, counters, form.
   Visual/canvas layer lives in fx.js.
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- theme ---------- */
  var themeToggle = $('#themeToggle');
  // Versioned key: the previous site persisted theme=light on load, so reusing
  // 'theme' would pin every returning visitor to light. Must match index.html.
  var THEME_KEY = 'theme-v2';

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    var icon = themeToggle && themeToggle.querySelector('i');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }

  var saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  // Dark is the designed default; only honour an explicit stored preference.
  setTheme(saved === 'light' ? 'light' : 'dark');

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      // fx-ui.js installs a circular View Transitions reveal centred on
      // this button. It is decoration, so the swap has to work without it.
      if (window.__themeWipe) window.__themeWipe(next, themeToggle, setTheme);
      else setTheme(next);
    });
  }

  /* ---------- typing headline ---------- */
  var typingEl = $('#heroTyping');
  if (typingEl) {
    var phrases = [
      'Software Engineer at Microsoft.',
      'Building SDK test infrastructure in Rust, Python, and C#.',
      'Columbia CS grad & former AWS SDE Intern.',
      'Shipped a 16K-line SwiftUI app from zero to one.'
    ];
    var pi = 0, ci = 0, deleting = false;

    (function tick() {
      var phrase = phrases[pi];
      typingEl.textContent = phrase.slice(0, ci);

      var delay;
      if (!deleting) {
        ci++;
        delay = 55;
        if (ci > phrase.length) { deleting = true; delay = 2000; }
      } else {
        ci--;
        delay = 28;
        if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; delay = 380; }
      }
      setTimeout(tick, delay);
    })();
  }

  /* ---------- nav: shadow, active link, scroll-top ---------- */
  var nav = $('#nav');
  var scrollTopBtn = $('#scrollTop');
  var progress = $('#scrollProgress');
  var sections = $$('section[id]');
  // The edge rail marks the same sections as the header, so it rides
  // along on the one scroll handler rather than adding a second.
  var navAnchors = $$('.nav-links a, .rail a');
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset;

    if (nav) nav.classList.toggle('scrolled', y > 20);
    if (scrollTopBtn) scrollTopBtn.classList.toggle('show', y > 600);

    if (progress) {
      // Guard the divisor: a viewport taller than the document would make
      // this Infinity, and the bar would flicker to full on short pages.
      var span = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform =
        'scaleX(' + (span > 0 ? Math.min(y / span, 1).toFixed(4) : 0) + ')';
    }

    var current = '';
    for (var i = 0; i < sections.length; i++) {
      if (y >= sections[i].offsetTop - 200) current = sections[i].id;
    }
    for (var j = 0; j < navAnchors.length; j++) {
      navAnchors[j].classList.toggle('active', navAnchors[j].getAttribute('href') === '#' + current);
    }
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- mobile menu ---------- */
  var menuBtn = $('#mobileMenuBtn');
  var mobileNav = $('#mobileNav');

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('open');
      var icon = menuBtn.querySelector('i');
      if (icon) icon.className = open ? 'fas fa-xmark' : 'fas fa-bars';
    });
    $$('a', mobileNav).forEach(function (a) {
      a.addEventListener('click', function () {
        mobileNav.classList.remove('open');
        var icon = menuBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
      });
    });
  }

  /* ---------- scroll reveal ---------- */
  var revealSelector = '.bento-card, .bento-main, .timeline-item, .edu-card, ' +
                       '.skill-category, .project-featured, .project-card, ' +
                       '.contact-card, .drive-card, .section-head';
  var revealTargets = $$(revealSelector);
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var siblings = Array.prototype.slice.call(entry.target.parentNode.children);
        var idx = siblings.indexOf(entry.target);
        setTimeout(function () { entry.target.classList.add('visible'); }, Math.max(0, idx) * 70);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ---------- counters ---------- */
  var counters = $$('.counter[data-target]');
  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-target'));
    var decimals = (el.getAttribute('data-decimals') | 0);
    var duration = 1500;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(decimals);
    }
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window && counters.length) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { counterObserver.observe(el); });
  } else {
    counters.forEach(function (el) {
      el.textContent = parseFloat(el.getAttribute('data-target')).toFixed(el.getAttribute('data-decimals') | 0);
    });
  }

  /* ---------- meters ---------- */
  // Same trigger as the counters so the bar and the digits move together.
  var meters = $$('.meter[data-fill]');
  function fillMeter(el) {
    var bar = el.querySelector('span');
    if (bar) bar.style.transform = 'scaleX(' + (parseFloat(el.getAttribute('data-fill')) / 100) + ')';
  }

  if ('IntersectionObserver' in window && meters.length) {
    var meterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        fillMeter(entry.target);
        meterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    meters.forEach(function (el) { meterObserver.observe(el); });
  } else {
    meters.forEach(fillMeter);
  }

  /* ---------- toast ---------- */
  var toast = $('#toast');
  var toastMsg = $('#toastMsg');
  var toastTimer = null;

  function showToast(msg) {
    if (!toast) return;
    if (toastMsg) toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3600);
  }

  /* ---------- contact form -> mailto ---------- */
  var form = $('#contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#name').value.trim();
      var email = $('#email').value.trim();
      var message = $('#message').value.trim();

      var body = 'From: ' + name + ' <' + email + '>\n\n' + message;
      window.location.href = 'mailto:mg4774@columbia.edu' +
        '?subject=' + encodeURIComponent('Portfolio message from ' + name) +
        '&body=' + encodeURIComponent(body);

      showToast('Opening your mail app…');
      form.reset();
    });
  }

  /* ---------- shared with fx-ui.js ---------- */
  window.__SITE = { setTheme: setTheme, toast: showToast };
})();
