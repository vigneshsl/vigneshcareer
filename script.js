/* ==========================================================================
   Vignesh S — Portfolio
   script.js  —  vanilla JavaScript, no dependencies
   --------------------------------------------------------------------------
   1.  Preloader
   2.  Theme (dark / light) toggle with persistence
   3.  Mobile navigation
   4.  Smooth scrolling
   5.  Sticky nav state + scroll progress + back-to-top
   6.  Scrollspy (active nav link)
   7.  Scroll-reveal animations
   8.  Hero typing effect
   9.  Animated counters
   10. "Open to work" badge toggle with persistence
   11. Avatar parallax tilt
   12. Contact form validation -> mailto
   13. Certificate lightbox
   14. Footer year
   ========================================================================== */

(function () {
    'use strict';

    /** Shorthand query helpers. */
    var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ======================================================================
       1. PRELOADER
       ====================================================================== */
    function initPreloader() {
        var el = $('#preloader');
        if (!el) return;

        var dismiss = function () { el.classList.add('is-done'); };

        window.addEventListener('load', function () {
            // Small delay so the animation is perceptible rather than a flash.
            setTimeout(dismiss, 350);
        });
        // Safety net in case a third-party asset never fires `load`.
        setTimeout(dismiss, 3500);
    }

    /* ======================================================================
       2. THEME TOGGLE
       ====================================================================== */
    function initTheme() {
        var root = document.documentElement;
        var btn = $('#themeToggle');
        var KEY = 'vs-theme';

        var stored = null;
        try { stored = localStorage.getItem(KEY); } catch (e) { /* private mode */ }

        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        apply(stored || (prefersDark ? 'dark' : 'light'));

        function apply(theme) {
            root.setAttribute('data-theme', theme);
            if (!btn) return;
            var dark = theme === 'dark';
            btn.innerHTML = '<i class="fa-solid fa-' + (dark ? 'sun' : 'moon') + '" aria-hidden="true"></i>';
            btn.setAttribute('aria-label', 'Switch to ' + (dark ? 'light' : 'dark') + ' theme');
        }

        if (btn) {
            btn.addEventListener('click', function () {
                var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                apply(next);
                try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
            });
        }
    }

    /* ======================================================================
       3. MOBILE NAVIGATION
       ====================================================================== */
    function initNav() {
        var burger = $('#burger');
        var list = $('#navList');
        if (!burger || !list) return;

        function setOpen(open) {
            list.classList.toggle('is-open', open);
            burger.classList.toggle('is-open', open);
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        }

        burger.addEventListener('click', function () {
            setOpen(!list.classList.contains('is-open'));
        });

        // Close after choosing a destination.
        list.addEventListener('click', function (e) {
            if (e.target.closest('a')) setOpen(false);
        });

        // Close on outside click or Escape.
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#navList') && !e.target.closest('#burger')) setOpen(false);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setOpen(false);
        });
        window.addEventListener('resize', function () {
            if (window.innerWidth > 900) setOpen(false);
        });
    }

    /* ======================================================================
       4. SMOOTH SCROLLING
       ====================================================================== */
    function initSmoothScroll() {
        document.addEventListener('click', function (e) {
            var link = e.target.closest('a[href^="#"]');
            if (!link) return;

            var id = link.getAttribute('href');
            if (!id || id === '#') return;

            var target = document.querySelector(id);
            if (!target) return;

            e.preventDefault();
            target.scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'start'
            });
            history.replaceState(null, '', id);
        });
    }

    /* ======================================================================
       5. SCROLL STATE — sticky nav, progress bar, back-to-top
       ====================================================================== */
    function initScrollState() {
        var nav = $('#nav');
        var bar = $('#scrollProgress');
        var top = $('#toTop');
        var root = document.documentElement;
        var ticking = false;
        var maxScroll = 0;
        var idleTimer = 0;

        // Cached so the scroll handler never reads scrollHeight (forced reflow).
        function measure() {
            maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        }

        function update() {
            var y = window.scrollY || document.documentElement.scrollTop;

            if (nav) nav.classList.toggle('is-stuck', y > 10);
            if (top) top.classList.toggle('is-visible', y > 480);
            if (bar) bar.style.transform = 'scaleX(' + (maxScroll > 0 ? Math.min(y / maxScroll, 1) : 0) + ')';

            ticking = false;
        }

        window.addEventListener('scroll', function () {
            if (!idleTimer) root.classList.add('is-scrolling');
            clearTimeout(idleTimer);
            idleTimer = setTimeout(function () {
                idleTimer = 0;
                root.classList.remove('is-scrolling');
            }, 140);

            if (ticking) return;
            ticking = true;
            requestAnimationFrame(update);
        }, { passive: true });

        window.addEventListener('resize', function () {
            measure();
            update();
        }, { passive: true });

        // Re-measure once reveal animations and lazy images have settled.
        window.addEventListener('load', measure);

        measure();
        update();
    }

    /* ======================================================================
       6. SCROLLSPY
       ====================================================================== */
    function initScrollSpy() {
        var links = $$('.nav__link');
        var sections = $$('main section[id], .hero[id]');
        if (!links.length || !sections.length) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var id = '#' + entry.target.id;
                links.forEach(function (l) {
                    l.classList.toggle('is-active', l.getAttribute('href') === id);
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

        sections.forEach(function (s) { observer.observe(s); });
    }

    /* ======================================================================
       7. SCROLL REVEAL
       ====================================================================== */
    function initReveal() {
        var items = $$('.reveal');
        if (!items.length) return;

        if (reduceMotion || !('IntersectionObserver' in window)) {
            items.forEach(function (el) { el.classList.add('is-visible'); });
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

        items.forEach(function (el) { observer.observe(el); });
    }

    /* ======================================================================
       7b. PAUSE HERO ANIMATIONS ONCE SCROLLED PAST
       ====================================================================== */
    function initHeroIdle() {
        var hero = $('#home');
        if (!hero || !('IntersectionObserver' in window)) return;

        var observer = new IntersectionObserver(function (entries) {
            hero.classList.toggle('is-offscreen', !entries[0].isIntersecting);
        }, { threshold: 0 });

        observer.observe(hero);
    }

    /* ======================================================================
       8. HERO TYPING EFFECT
       ====================================================================== */
    function initTyping() {
        var out = $('#typed');
        if (!out) return;

        var phrases = [
            'C++ Software Engineer',
            'MFC Desktop Developer',
            'Qt / QML Developer',
            'Industrial Automation Engineer',
            'Experion PKS Specialist',
            'Automation Tool Builder'
        ];

        if (reduceMotion) {
            out.textContent = phrases[0];
            return;
        }

        var phrase = 0, chars = 0, deleting = false, paused = false;

        // Stop typing while the tab is hidden to save cycles.
        document.addEventListener('visibilitychange', function () { paused = document.hidden; });

        (function tick() {
            if (paused) return setTimeout(tick, 500);

            var current = phrases[phrase];
            chars += deleting ? -1 : 1;
            out.textContent = current.slice(0, chars);

            var wait = deleting ? 40 : 75;
            if (!deleting && chars === current.length) {
                wait = 1900;
                deleting = true;
            } else if (deleting && chars === 0) {
                deleting = false;
                phrase = (phrase + 1) % phrases.length;
                wait = 350;
            }
            setTimeout(tick, wait);
        })();
    }

    /* ======================================================================
       9. ANIMATED COUNTERS
       ====================================================================== */
    function initCounters() {
        var nodes = $$('.count');
        if (!nodes.length) return;

        function run(el) {
            var goal = parseInt(el.dataset.count, 10) || 0;
            var suffix = el.dataset.suffix || '';

            if (reduceMotion) {
                el.textContent = goal + suffix;
                return;
            }

            var duration = 1400;
            var start = performance.now();

            (function frame(now) {
                var p = Math.min((now - start) / duration, 1);
                // easeOutCubic
                var eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(goal * eased) + suffix;
                if (p < 1) requestAnimationFrame(frame);
            })(start);
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                run(entry.target);
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.5 });

        nodes.forEach(function (el) { observer.observe(el); });
    }

    /* ======================================================================
       10. "OPEN TO WORK" BADGE — toggled from the nav, remembered per browser
       ====================================================================== */
    function initOpenToWork() {
        var badge = $('#availability');
        var btn = $('#owtToggle');
        var KEY = 'vs-open-to-work';

        var stored = null;
        try { stored = localStorage.getItem(KEY); } catch (e) { /* private mode */ }

        apply(stored === 'on');

        function apply(on) {
            if (badge) badge.hidden = !on;
            if (!btn) return;
            btn.classList.toggle('is-on', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.setAttribute('aria-label', 'Open to work badge is ' + (on ? 'on' : 'off'));
            btn.title = on ? 'Open to work — showing' : 'Open to work — hidden';
        }

        if (btn) {
            btn.addEventListener('click', function () {
                var on = btn.getAttribute('aria-pressed') !== 'true';
                apply(on);
                try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
            });
        }
    }

    /* ======================================================================
       11. AVATAR PARALLAX TILT
       ====================================================================== */
    function initTilt() {
        var avatar = $('#avatar');
        if (!avatar || reduceMotion) return;
        if (window.matchMedia('(hover: none)').matches) return;

        var frame = 0;

        avatar.addEventListener('mousemove', function (e) {
            if (frame) return;
            frame = requestAnimationFrame(function () {
                var r = avatar.getBoundingClientRect();
                var x = (e.clientX - r.left) / r.width - 0.5;
                var y = (e.clientY - r.top) / r.height - 0.5;
                avatar.style.transform =
                    'perspective(900px) rotateY(' + (x * 14).toFixed(2) + 'deg) rotateX(' + (-y * 14).toFixed(2) + 'deg)';
                frame = 0;
            });
        }, { passive: true });

        avatar.addEventListener('mouseleave', function () {
            avatar.style.transform = '';
        });
    }

    /* ======================================================================
       12. CONTACT FORM
       ====================================================================== */
    function initForm() {
        var form = $('#contactForm');
        if (!form) return;

        var note = $('#formNote');
        var fields = ['cName', 'cEmail', 'cSubject', 'cMessage'];
        var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

        function validate(id) {
            var input = document.getElementById(id);
            var wrap = input.closest('.field');
            var msg = $('.field__error[data-for="' + id + '"]');
            var value = input.value.trim();
            var error = '';

            if (!value) {
                error = 'This field is required.';
            } else if (id === 'cEmail' && !EMAIL_RE.test(value)) {
                error = 'Enter a valid email address.';
            } else if (id === 'cMessage' && value.length < 10) {
                error = 'Please write at least 10 characters.';
            }

            wrap.classList.toggle('is-invalid', Boolean(error));
            if (msg) msg.textContent = error;
            return !error;
        }

        // Clear the error as soon as the visitor starts fixing it.
        fields.forEach(function (id) {
            var input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('blur', function () { validate(id); });
            input.addEventListener('input', function () {
                if (input.closest('.field').classList.contains('is-invalid')) validate(id);
            });
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var ok = fields.map(validate).every(Boolean);
            if (!ok) {
                if (note) { note.style.color = '#dc2626'; note.textContent = 'Please fix the highlighted fields.'; }
                var firstBad = $('.field.is-invalid input, .field.is-invalid textarea');
                if (firstBad) firstBad.focus();
                return;
            }

            var get = function (id) { return document.getElementById(id).value.trim(); };
            var body = 'Name: ' + get('cName') + '\nEmail: ' + get('cEmail') + '\n\n' + get('cMessage');

            window.location.href = 'mailto:vigneshsl.career@gmail.com'
                + '?subject=' + encodeURIComponent(get('cSubject'))
                + '&body=' + encodeURIComponent(body);

            if (note) {
                note.style.color = '';
                note.textContent = 'Opening your email app…';
            }
        });
    }

    /* ======================================================================
       13. CERTIFICATE LIGHTBOX
       ====================================================================== */
    function initCertificates() {
        var shots = $$('.cert-card__shot');
        if (!shots.length) return;

        var box = $('#lightbox');
        var img = $('#lightboxImg');
        var caption = $('#lightboxCaption');
        var close = $('#lightboxClose');
        var lastFocused = null;

        // Show the styled placeholder whenever a certificate file is not present yet.
        shots.forEach(function (shot) {
            var thumb = shot.querySelector('img');
            if (!thumb) return;

            var markMissing = function () { shot.closest('.cert-card').classList.add('is-missing'); };

            if (thumb.complete && thumb.naturalWidth === 0) markMissing();
            thumb.addEventListener('error', markMissing);
        });

        if (!box || !img || !caption) return;

        function open(shot) {
            lastFocused = document.activeElement;
            img.src = shot.dataset.full;
            img.alt = shot.querySelector('img') ? shot.querySelector('img').alt : '';
            caption.textContent = shot.dataset.caption || '';
            box.hidden = false;
            // Next frame so the opening transition can run.
            requestAnimationFrame(function () { box.classList.add('is-open'); });
            document.body.style.overflow = 'hidden';
            if (close) close.focus();
        }

        function hide() {
            box.classList.remove('is-open');
            document.body.style.overflow = '';
            setTimeout(function () {
                box.hidden = true;
                img.src = '';
            }, 300);
            if (lastFocused) lastFocused.focus();
        }

        shots.forEach(function (shot) {
            shot.addEventListener('click', function () {
                if (shot.closest('.cert-card').classList.contains('is-missing')) return;
                open(shot);
            });
        });

        if (close) close.addEventListener('click', hide);
        box.addEventListener('click', function (e) {
            if (e.target === box || e.target === box.querySelector('.lightbox__figure')) hide();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !box.hidden) hide();
        });
    }

    /* ======================================================================
       14. FOOTER YEAR
       ====================================================================== */
    function initYear() {
        var el = $('#year');
        if (el) el.textContent = String(new Date().getFullYear());
    }

    /* ======================================================================
       BOOTSTRAP
       ====================================================================== */
    function init() {
        initPreloader();
        initTheme();
        initNav();
        initSmoothScroll();
        initScrollState();
        initScrollSpy();
        initReveal();
        initHeroIdle();
        initTyping();
        initCounters();
        initOpenToWork();
        initTilt();
        initForm();
        initCertificates();
        initYear();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
