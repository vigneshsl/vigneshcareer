/**
 * navigation.js — Navigation, menu, scrollspy, and scroll behavior
 */

export function initNavigation() {
    initMobileNav();
    initSmoothScroll();
    initScrollEffects();
    initOpenToWork();
}

/**
 * Mobile navigation burger menu
 */
function initMobileNav() {
    const burger = document.getElementById('burger');
    const navList = document.getElementById('navList');
    if (!burger || !navList) return;

    function setOpen(open) {
        navList.classList.toggle('is-open', open);
        burger.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    burger.addEventListener('click', () => {
        setOpen(!navList.classList.contains('is-open'));
    });

    // Close menu when a link is clicked
    navList.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
            setOpen(false);
        }
    });

    // Close menu when pressing Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navList.classList.contains('is-open')) {
            setOpen(false);
        }
    });
}

/**
 * Smooth scrolling for anchor links
 */
function initSmoothScroll() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (href === '#') return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();

        const navHeight = document.querySelector('.nav')?.offsetHeight || 0;
        const topOffset = target.getBoundingClientRect().top + window.scrollY - navHeight;

        window.scrollTo({
            top: topOffset,
            behavior: 'smooth'
        });
    });
}

/**
 * Scrollspy, header shadow, progress bar and back-to-top.
 * One rAF-throttled listener with cached offsets, so scrolling never forces
 * a synchronous layout.
 */
function initScrollEffects() {
    const navLinks = Array.from(document.querySelectorAll('.nav__link'));
    const nav = document.querySelector('.nav');
    const toTop = document.getElementById('toTop');
    const progressBar = document.getElementById('scrollProgress');

    const sections = ['home', 'about', 'skills', 'achievements', 'companies', 'experience', 'projects', 'education', 'certifications', 'info', 'contact']
        .map(id => document.getElementById(id))
        .filter(Boolean);

    let offsets = [];
    let maxScroll = 1;
    let ticking = false;
    let activeId = '';

    function measure() {
        offsets = sections.map(el => ({
            id: el.id,
            top: el.getBoundingClientRect().top + window.scrollY
        }));
        maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    }

    function update() {
        ticking = false;
        const y = window.scrollY;

        nav?.classList.toggle('is-scrolled', y > 12);
        toTop?.classList.toggle('is-visible', y > 400);

        if (progressBar) {
            progressBar.style.width = `${Math.min(y / maxScroll, 1) * 100}%`;
        }

        let current = offsets.length ? offsets[0].id : '';
        for (const section of offsets) {
            if (section.top <= y + 120) current = section.id;
        }

        if (current !== activeId) {
            activeId = current;
            navLinks.forEach(link => {
                link.classList.toggle('is-active', link.getAttribute('href') === `#${current}`);
            });
        }
    }

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
        measure();
        onScroll();
    }, { passive: true });
    window.addEventListener('load', measure);

    toTop?.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    measure();
    update();
}

/**
 * "Open to work" badge toggle
 */
function initOpenToWork() {
    const btn = document.getElementById('owtToggle');
    const badge = document.getElementById('availability');
    if (!btn || !badge) return;

    const KEY = 'vs-owt';

    let state = false;
    try {
        state = localStorage.getItem(KEY) === 'true';
    } catch (e) {
        // Ignore
    }

    function setState(value) {
        state = value;
        badge.hidden = !value;
        btn.setAttribute('aria-pressed', String(value));
        btn.setAttribute('aria-label', `Open to work badge is ${value ? 'on' : 'off'}`);
        try {
            localStorage.setItem(KEY, String(value));
        } catch (e) {
            // Ignore
        }
    }

    btn.addEventListener('click', () => setState(!state));
    setState(state);
}
