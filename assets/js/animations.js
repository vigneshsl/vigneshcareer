/**
 * animations.js — Scroll reveal, counters, typing effect
 */

export function initAnimations() {
    initScrollReveal();
    initCounters();
    initTypingEffect();
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll reveal animation. Safe to call again after new content is injected —
 * already-revealed elements are skipped.
 */
export function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal:not(.is-visible)');
    if (reveals.length === 0) return;

    if (reduceMotion) {
        reveals.forEach(el => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    reveals.forEach(el => observer.observe(el));
}

/**
 * Animated number counters
 */
function initCounters() {
    const counters = document.querySelectorAll('.count');
    if (counters.length === 0) return;

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.counted) {
                animateCounter(entry.target);
                entry.target.dataset.counted = 'true';
                counterObserver.unobserve(entry.target);
            }
        });
    });

    counters.forEach(el => counterObserver.observe(el));
}

function animateCounter(element) {
    const suffix = element.dataset.suffix || '';
    const duration = 2000;
    const startTime = Date.now();

    function update() {
        // Re-read every frame: the certification total arrives asynchronously
        // and can change while this animation is still running.
        const target = parseInt(element.dataset.count, 10) || 0;
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        element.textContent = Math.floor(target * progress) + suffix;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    update();
}

/**
 * Typing effect for hero role
 */
function initTypingEffect() {
    const typedElement = document.getElementById('typed');
    if (!typedElement) return;

    const roles = [
        'C++ Software Engineer',
        'Industrial Automation Specialist',
        'Developer Tooling & Automation'
    ];

    let roleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    if (reduceMotion) {
        typedElement.textContent = roles[0];
        return;
    }

    function type() {
        const currentRole = roles[roleIndex];

        if (!isDeleting) {
            charIndex++;
            typedElement.textContent = currentRole.slice(0, charIndex);

            if (charIndex === currentRole.length) {
                isDeleting = true;
                setTimeout(type, 2000);
                return;
            }
            setTimeout(type, 55);
            return;
        }

        charIndex--;
        typedElement.textContent = currentRole.slice(0, charIndex);

        if (charIndex === 0) {
            isDeleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            setTimeout(type, 350);
            return;
        }
        setTimeout(type, 30);
    }

    type();
}
