/**
 * certificates.js — Dynamic certificate gallery loading and management
 */

import { initScrollReveal } from './animations.js';

/**
 * Starts the manifest request early so it overlaps with section loading.
 */
export function fetchCertificates(bustCache = false) {
    const url = bustCache ? `assets/data/certificates.json?v=${Date.now()}` : 'assets/data/certificates.json';
    // GitHub Pages serves this with max-age=600, so without revalidation a
    // Dev Mode change stays invisible for ten minutes. ETags make it a 304.
    return fetch(url, { cache: 'no-cache' })
        .then(response => (response.ok ? response.json() : []))
        .catch(() => []);
}

/** Re-reads the manifest and repaints the gallery after a Dev Mode change. */
export function refreshCertificates() {
    return initCertificates(fetchCertificates(true));
}

export async function initCertificates(pending) {
    const gallery = document.getElementById('certificateGallery');
    if (!gallery) return;

    const certificates = await (pending || fetchCertificates());
    const list = Array.isArray(certificates) ? certificates : [];

    updateCertificateCount(list.length);

    if (list.length === 0) {
        gallery.innerHTML = '<p class="cert-empty">Certificates are being updated. Please check back soon.</p>';
        return;
    }

    renderCertificateGallery(gallery, list);
    initCertificateLightbox();
    initScrollReveal();
}

/**
 * Keeps the hero statistic in step with the manifest, so adding or deleting a
 * certificate in Dev Mode never leaves a stale number on the page.
 */
function updateCertificateCount(total) {
    const stat = document.querySelector('[data-count-source="certificates"]');
    if (!stat) return;

    stat.dataset.count = String(total);

    // The counter animation runs once on scroll. If it has already played, the
    // new total has to be written straight to the element.
    if (stat.dataset.counted) {
        stat.textContent = total + (stat.dataset.suffix || '');
    }
}

function renderCertificateGallery(gallery, certificates) {
    const fragment = document.createDocumentFragment();

    certificates.forEach((cert, index) => {
        const caption = buildCaption(cert);
        const displayDate = cert.date || cert.issueDate || '';
        const credentialUrl = safeCredentialUrl(cert.credentialUrl);
        const card = document.createElement('article');
        card.className = 'cert-card reveal';
        card.dataset.delay = String(Math.min(index + 1, 5));

        card.innerHTML = `
            <button class="cert-card__shot" type="button"
                data-full="${escapeHtml(cert.image)}"
                data-caption="${escapeHtml(caption)}">
                <img src="${escapeHtml(cert.image)}"
                    alt="${escapeHtml(cert.title || 'Certificate')}"
                    width="800" height="600"
                    loading="lazy" decoding="async">
                <span class="cert-card__fallback" aria-hidden="true">
                    <i class="fa-solid fa-certificate"></i><em>Certificate</em>
                </span>
                <span class="cert-card__zoom" aria-hidden="true">
                    <i class="fa-solid fa-magnifying-glass-plus"></i> View
                </span>
            </button>
            <div class="cert-card__body">
                <h3>${escapeHtml(cert.title || 'Certificate')}</h3>
                <p>
                    ${cert.issuer ? escapeHtml(cert.issuer) : ''}
                    ${displayDate ? ` · ${escapeHtml(displayDate)}` : ''}
                </p>
                ${cert.description ? `<p class="cert-card__desc">${escapeHtml(cert.description)}</p>` : ''}
                ${credentialUrl ? `<a class="cert-card__link" href="${escapeHtml(credentialUrl)}" target="_blank" rel="noopener noreferrer">
                    Verify credential <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                </a>` : ''}
            </div>
        `;

        // Swap to the icon fallback when an image path is wrong or missing.
        card.querySelector('img').addEventListener('error', () => {
            card.classList.add('is-missing');
        }, { once: true });

        fragment.appendChild(card);
    });

    gallery.replaceChildren(fragment);
}

function buildCaption(cert) {
    let caption = cert.title || 'Certificate';
    if (cert.issuer) caption += ` — ${cert.issuer}`;
    const date = cert.date || cert.issueDate;
    if (date) caption += `, ${date}`;
    return caption;
}

/** Blocks javascript: and data: URLs from reaching an href. */
function safeCredentialUrl(value) {
    if (!value) return '';
    try {
        const url = new URL(value, window.location.href);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch {
        return '';
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

let lightboxReady = false;

function initCertificateLightbox() {
    if (lightboxReady) return;

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxCaption = document.getElementById('lightboxCaption');
    const lightboxClose = document.getElementById('lightboxClose');
    if (!lightbox || !lightboxImg || !lightboxCaption) return;

    lightboxReady = true;
    let lastTrigger = null;

    function open(trigger) {
        lastTrigger = trigger;
        const caption = trigger.dataset.caption || '';

        lightboxImg.src = trigger.dataset.full;
        lightboxImg.alt = caption;
        lightboxCaption.textContent = caption;
        lightbox.hidden = false;
        document.body.style.overflow = 'hidden';

        // Let the browser paint the hidden -> visible switch before transitioning.
        requestAnimationFrame(() => lightbox.classList.add('is-open'));
        lightboxClose?.focus();
    }

    function close() {
        lightbox.classList.remove('is-open');
        lightbox.hidden = true;
        lightboxImg.removeAttribute('src');
        document.body.style.overflow = '';
        lastTrigger?.focus();
        lastTrigger = null;
    }

    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.cert-card__shot[data-full]');
        if (trigger) open(trigger);
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) close();
    });

    lightboxClose?.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !lightbox.hidden) close();
    });
}
