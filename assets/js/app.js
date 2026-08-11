/**
 * app.js — Application entry point
 * Loads all HTML sections dynamically and orchestrates initialization
 */

import { initNavigation } from './navigation.js';
import { initAnimations } from './animations.js';
import { initCertificates, fetchCertificates, refreshCertificates } from './certificates.js';
import { initContact } from './contact.js';
import { initDevMode } from './devmode.js';

/**
 * Section loader configuration
 */
const sections = [
    { mount: 'site-header', file: 'sections/header.html' },
    { mount: 'hero', file: 'sections/hero.html' },
    { mount: 'about', file: 'sections/about.html' },
    { mount: 'skills', file: 'sections/skills.html' },
    { mount: 'achievements', file: 'sections/achievements.html' },
    { mount: 'companies', file: 'sections/companies.html' },
    { mount: 'experience', file: 'sections/experience.html' },
    { mount: 'projects', file: 'sections/projects.html' },
    { mount: 'education', file: 'sections/education.html' },
    { mount: 'certifications', file: 'sections/certifications.html' },
    { mount: 'info', file: 'sections/info.html' },
    { mount: 'contact', file: 'sections/contact.html' },
    { mount: 'site-footer', file: 'sections/footer.html' }
];

/**
 * Load a section HTML file and insert into DOM
 */
async function loadSection(sectionConfig) {
    try {
        const response = await fetch(sectionConfig.file);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const html = await response.text();
        const container = document.querySelector(`[data-mount="${sectionConfig.mount}"]`);
        if (container) {
            container.innerHTML = html;
        } else {
            console.warn(`Section container not found: ${sectionConfig.mount}`);
        }
    } catch (error) {
        console.error(`Failed to load section ${sectionConfig.file}:`, error);
        // Allow page to continue even if one section fails
    }
}

/**
 * Load all sections in parallel
 */
async function loadAllSections() {
    const promises = sections.map(section => loadSection(section));
    await Promise.allSettled(promises);
}

/**
 * Initialize the application
 */
async function init() {
    try {
        // Request the manifest up front so it downloads alongside the sections.
        const certificatesPending = fetchCertificates();

        await loadAllSections();

        await initCertificates(certificatesPending);

        initNavigation();
        initContact();
        initAnimations();
        initDevMode({ onRefresh: refreshCertificates });

        updateFooterYear();
        dismissPreloader();

    } catch (error) {
        console.error('Failed to initialize application:', error);
        dismissPreloader();
    }
}

/**
 * Update footer year to current year
 */
function updateFooterYear() {
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

/**
 * Dismiss preloader once everything is loaded
 */
function dismissPreloader() {
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.classList.add('is-done');
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
