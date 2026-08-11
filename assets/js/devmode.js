/**
 * devmode.js — Private certification manager.
 *
 * Holds no credentials and no tokens. Authentication is decided entirely by the
 * local Dev Mode server (server/devmode-server.js), which replies with an
 * HttpOnly cookie this script can neither read nor forge. Every mutating call
 * is rejected by that server unless the cookie is present and valid, so the
 * checks here are purely for UX.
 */

const API = {
    health: 'api/health',
    session: 'api/auth/session',
    login: 'api/auth/login',
    logout: 'api/auth/logout',
    password: 'api/auth/password',
    certificates: 'api/certificates',
    publish: 'api/publish'
};

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const state = {
    available: false,
    certificates: [],
    lastFocus: null,
    onRefresh: null
};

/* ------------------------------------------------------------------ helpers */

function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (value === undefined || value === null || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else node.setAttribute(key, value === true ? '' : String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
        if (child) node.appendChild(child);
    });
    return node;
}

async function api(path, { method = 'GET', body } = {}) {
    const response = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: {
            'X-Dev-Mode': '1',
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });

    let payload = {};
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok) {
        const error = new Error(payload.error || `Request failed (${response.status}).`);
        error.status = response.status;
        throw error;
    }
    return payload;
}

function setNote(node, message, type) {
    if (!node) return;
    node.textContent = message || '';
    node.className = `dm-note${type ? ` dm-note--${type}` : ''}`;
}

/* ------------------------------------------------------------------ overlay */

let openOverlay = null;

function closeOverlay() {
    if (!openOverlay) return;
    const node = openOverlay;
    openOverlay = null;
    if (node._onKeydown) document.removeEventListener('keydown', node._onKeydown);
    node.classList.remove('is-open');
    setTimeout(() => node.remove(), 200);
    document.body.style.overflow = '';
    document.getElementById('devModeToggle')?.setAttribute('aria-expanded', 'false');
    state.lastFocus?.focus();
}

function showOverlay(variant, panel, { label }) {
    if (openOverlay) {
        if (openOverlay._onKeydown) document.removeEventListener('keydown', openOverlay._onKeydown);
        openOverlay.remove();
        openOverlay = null;
    }

    const overlay = el('div', {
        class: `dm-overlay dm-overlay--${variant}`,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': label,
        tabindex: '-1'
    }, panel);

    overlay.addEventListener('mousedown', event => {
        if (event.target === overlay) closeOverlay();
    });

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    openOverlay = overlay;
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    // Escape is bound to the document, not the overlay. Saving or deleting
    // rebuilds the card list, which destroys the focused button and drops focus
    // back onto <body> — an overlay-scoped listener would stop hearing keys.
    overlay._onKeydown = event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeOverlay();
        }
    };
    document.addEventListener('keydown', overlay._onKeydown);

    // Focus trap, so keyboard users cannot tab out into the page behind.
    overlay.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;

        const focusable = [...overlay.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )].filter(node => node.offsetParent !== null);
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!overlay.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    overlay.querySelector('input, button, textarea')?.focus();
    return overlay;
}

/* -------------------------------------------------------------------- login */

function openLogin() {
    const note = el('span', { class: 'dm-note', role: 'status', 'aria-live': 'polite' });
    const username = el('input', { type: 'text', id: 'dmUser', name: 'username', autocomplete: 'username', required: true, maxlength: '80' });
    const password = el('input', { type: 'password', id: 'dmPass', name: 'password', autocomplete: 'current-password', required: true, maxlength: '200' });
    const submit = el('button', { type: 'submit', class: 'dm-btn dm-btn--primary dm-btn--block', text: 'Login' });

    const form = el('form', { novalidate: true }, [
        el('div', { class: 'dm-field' }, [
            el('label', { for: 'dmUser', text: 'Username' }),
            username
        ]),
        el('div', { class: 'dm-field' }, [
            el('label', { for: 'dmPass', text: 'Password' }),
            password
        ]),
        submit,
        note
    ]);

    const panel = el('div', { class: 'dm-panel dm-login' }, [
        el('div', { class: 'dm-login__mark' }, el('i', { class: 'fa-solid fa-terminal', 'aria-hidden': 'true' })),
        el('p', { class: 'dm-login__title', text: 'Dev Mode' }),
        el('h2', { class: 'dm-login__sub', text: 'Certification Manager' }),
        el('p', { class: 'dm-login__hint', text: 'Authorised access only. There is no sign-up.' }),
        form
    ]);

    showOverlay('login', panel, { label: 'Dev Mode login' });

    if (!state.available) {
        username.disabled = true;
        password.disabled = true;
        submit.disabled = true;
        setNote(note, 'The Dev Mode service is not running. Start it with "node server/devmode-server.js" and open http://127.0.0.1:4321.', 'warn');
        return;
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        username.classList.remove('is-invalid');
        password.classList.remove('is-invalid');

        if (!username.value.trim() || !password.value) {
            setNote(note, 'Enter both a username and a password.', 'error');
            (username.value.trim() ? password : username).classList.add('is-invalid');
            return;
        }

        submit.disabled = true;
        setNote(note, 'Verifying…');

        try {
            const result = await api(API.login, {
                method: 'POST',
                body: { username: username.value.trim(), password: password.value }
            });
            password.value = '';
            openManager(result.usingDefaultPassword);
        } catch (error) {
            // The server never reveals which field was wrong; neither does this.
            submit.disabled = false;
            username.classList.add('is-invalid');
            password.classList.add('is-invalid');
            password.value = '';
            setNote(note, error.message, 'error');
            password.focus();
        }
    });
}

/* ------------------------------------------------------------------ manager */

async function openManager(usingDefaultPassword = false) {
    const note = el('span', { class: 'dm-note', role: 'status', 'aria-live': 'polite' });
    const list = el('div', { class: 'dm-list' });
    const count = el('p', { class: 'dm-count' });

    const addBtn = el('button', { type: 'button', class: 'dm-btn dm-btn--primary dm-btn--sm' }, [
        el('i', { class: 'fa-solid fa-plus', 'aria-hidden': 'true' }),
        el('span', { text: 'Add Certification' })
    ]);
    const publishBtn = el('button', { type: 'button', class: 'dm-btn dm-btn--ghost dm-btn--sm' }, [
        el('i', { class: 'fa-solid fa-cloud-arrow-up', 'aria-hidden': 'true' }),
        el('span', { text: 'Publish' })
    ]);
    const passwordBtn = el('button', { type: 'button', class: 'dm-btn dm-btn--ghost dm-btn--sm', title: 'Change password' },
        el('i', { class: 'fa-solid fa-key', 'aria-hidden': 'true' }));
    const logoutBtn = el('button', { type: 'button', class: 'dm-btn dm-btn--ghost dm-btn--sm', title: 'Log out' },
        el('i', { class: 'fa-solid fa-arrow-right-from-bracket', 'aria-hidden': 'true' }));
    const closeBtn = el('button', { type: 'button', class: 'dm-btn dm-btn--ghost dm-btn--sm', 'aria-label': 'Close Dev Mode' },
        el('i', { class: 'fa-solid fa-xmark', 'aria-hidden': 'true' }));

    const panel = el('div', { class: 'dm-panel dm-manager' }, [
        el('div', { class: 'dm-manager__head' }, [
            el('div', {}, [
                el('p', { class: 'dm-manager__eyebrow', text: 'Dev Mode' }),
                el('h2', { class: 'dm-manager__title', text: 'Certification Manager' }),
                el('p', { class: 'dm-manager__sub', text: 'Add, edit, replace and remove the certifications shown on your portfolio.' })
            ]),
            el('div', { class: 'dm-manager__tools' }, [passwordBtn, logoutBtn, closeBtn])
        ]),
        el('div', { class: 'dm-manager__body' }, [
            el('div', { class: 'dm-manager__bar' }, [count, el('div', { class: 'dm-manager__tools' }, [publishBtn, addBtn])]),
            list,
            note
        ])
    ]);

    showOverlay('manager', panel, { label: 'Certification Manager' });

    if (usingDefaultPassword) {
        setNote(note, 'You are still using the default development password. Change it with the key button.', 'warn');
    }

    addBtn.addEventListener('click', () => openEditor(null));
    closeBtn.addEventListener('click', closeOverlay);
    passwordBtn.addEventListener('click', openPasswordChange);

    logoutBtn.addEventListener('click', async () => {
        try {
            await api(API.logout, { method: 'POST' });
        } catch {
            // Cookie expiry already logs the session out.
        }
        closeOverlay();
    });

    publishBtn.addEventListener('click', async () => {
        publishBtn.disabled = true;
        setNote(note, 'Publishing to GitHub…');
        try {
            const result = await api(API.publish, { method: 'POST' });
            setNote(note, result.message, result.published ? 'success' : 'warn');
        } catch (error) {
            setNote(note, error.message, 'error');
        } finally {
            publishBtn.disabled = false;
        }
    });

    await renderList(list, count, note);
}

async function renderList(list, count, note) {
    try {
        const { certificates } = await api(API.certificates);
        state.certificates = certificates;
    } catch (error) {
        setNote(note, error.message, 'error');
        return;
    }

    count.textContent = `${state.certificates.length} certification${state.certificates.length === 1 ? '' : 's'}`;
    list.replaceChildren();

    if (!state.certificates.length) {
        list.appendChild(el('p', { class: 'dm-empty', text: 'No certifications yet. Add your first one.' }));
        return;
    }

    const refresh = () => renderList(list, count, note);

    state.certificates.forEach(cert => {
        const shot = el('div', { class: 'dm-card__shot' });
        if (cert.image.startsWith('certificates/')) {
            shot.appendChild(el('img', { src: `${cert.image}?v=${Date.now()}`, alt: '', loading: 'lazy' }));
        }

        const meta = el('p', { class: 'dm-card__meta' });
        meta.append(cert.issuer || 'Unspecified issuer');
        if (cert.issueDate) meta.append(el('br'), document.createTextNode(cert.issueDate));

        const edit = el('button', { type: 'button', class: 'dm-btn dm-btn--ghost dm-btn--sm', text: 'Edit' });
        const replace = el('button', { type: 'button', class: 'dm-btn dm-btn--ghost dm-btn--sm', text: 'Replace' });
        const del = el('button', { type: 'button', class: 'dm-btn dm-btn--danger dm-btn--sm', text: 'Delete' });

        edit.addEventListener('click', () => openEditor(cert));
        replace.addEventListener('click', () => replaceImage(cert, note, refresh));
        del.addEventListener('click', () => confirmDelete(cert, note, refresh));

        list.appendChild(el('article', { class: 'dm-card' }, [
            shot,
            el('div', { class: 'dm-card__body' }, [
                el('h3', { text: cert.title }),
                meta
            ]),
            el('div', { class: 'dm-card__actions' }, [edit, replace, del])
        ]));
    });
}

/* ------------------------------------------------------------------- editor */

function readImageFile(file) {
    return new Promise((resolve, reject) => {
        if (!ACCEPTED_TYPES.includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
            reject(new Error('Choose a JPG, PNG or WebP image.'));
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            reject(new Error('Image must be 8 MB or smaller.'));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('That file could not be read.'));
        reader.readAsDataURL(file);
    });
}

function field(id, label, { type = 'text', value = '', optional = false, textarea = false, maxlength } = {}) {
    const control = textarea
        ? el('textarea', { id, name: id, rows: '3', maxlength: maxlength || '600' })
        : el('input', { id, name: id, type, maxlength: maxlength || '160' });
    control.value = value || '';

    // The "optional" hint is a CSS ::after, which browsers fold into the
    // accessible name — an explicit label keeps screen readers clean.
    if (optional) control.setAttribute('aria-label', label);

    return {
        control,
        node: el('div', { class: `dm-field${optional ? ' dm-field--optional' : ''}` }, [
            el('label', { for: id, text: label }),
            control
        ])
    };
}

function openEditor(cert) {
    const isEdit = Boolean(cert);
    const note = el('span', { class: 'dm-note', role: 'status', 'aria-live': 'polite' });

    const title = field('dmTitle', 'Certificate Title', { value: cert?.title });
    const issuer = field('dmIssuer', 'Issuing Organization', { value: cert?.issuer, maxlength: '120' });
    const issued = field('dmIssued', 'Issue Date', { value: cert?.issueDate, maxlength: '60' });
    const expires = field('dmExpires', 'Expiration Date', { value: cert?.expirationDate, optional: true, maxlength: '60' });
    const credId = field('dmCredId', 'Credential ID', { value: cert?.credentialId, optional: true, maxlength: '120' });
    const credUrl = field('dmCredUrl', 'Credential URL', { type: 'url', value: cert?.credentialUrl, optional: true, maxlength: '500' });
    const description = field('dmDescription', 'Description', { value: cert?.description, optional: true, textarea: true });

    const fileInput = el('input', { type: 'file', id: 'dmImage', accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp' });
    const preview = el('div', { class: 'dm-drop__preview' }, el('i', { class: 'fa-solid fa-image', 'aria-hidden': 'true' }));
    const fileName = el('span', { class: 'dm-drop__name' });

    if (isEdit && cert.image.startsWith('certificates/')) {
        preview.replaceChildren(el('img', { src: `${cert.image}?v=${Date.now()}`, alt: '' }));
        fileName.textContent = cert.image;
    }

    let imageData = null;

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
            imageData = await readImageFile(file);
            preview.replaceChildren(el('img', { src: imageData, alt: '' }));
            fileName.textContent = file.name;
            setNote(note, '');
        } catch (error) {
            imageData = null;
            fileInput.value = '';
            setNote(note, error.message, 'error');
        }
    });

    const save = el('button', { type: 'submit', class: 'dm-btn dm-btn--primary', text: 'Save Certification' });
    const cancel = el('button', { type: 'button', class: 'dm-btn dm-btn--ghost', text: 'Cancel' });

    const form = el('form', { novalidate: true }, [
        el('div', { class: 'dm-field' }, [
            el('label', { for: 'dmImage', text: 'Certificate Image' }),
            el('div', { class: 'dm-drop' }, [
                preview,
                el('div', { class: 'dm-drop__text' }, [
                    fileInput,
                    fileName
                ])
            ])
        ]),
        title.node,
        issuer.node,
        el('div', { class: 'dm-grid2' }, [issued.node, expires.node]),
        el('div', { class: 'dm-grid2' }, [credId.node, credUrl.node]),
        description.node,
        note,
        el('div', { class: 'dm-foot' }, [cancel, save])
    ]);

    const panel = el('div', { class: 'dm-panel dm-editor' }, [
        el('h2', { class: 'dm-editor__title', text: isEdit ? 'Edit Certification' : 'Add Certification' }),
        el('p', {
            class: 'dm-editor__sub',
            text: isEdit ? 'Changes update this certification in place.' : 'The image and title are required.'
        }),
        form
    ]);

    showOverlay('manager', panel, { label: isEdit ? 'Edit certification' : 'Add certification' });
    cancel.addEventListener('click', () => openManager());

    form.addEventListener('submit', async event => {
        event.preventDefault();
        title.control.classList.remove('is-invalid');

        if (!title.control.value.trim()) {
            title.control.classList.add('is-invalid');
            setNote(note, 'A certificate title is required.', 'error');
            title.control.focus();
            return;
        }
        if (!isEdit && !imageData) {
            setNote(note, 'Choose a certificate image.', 'error');
            fileInput.focus();
            return;
        }

        const body = {
            title: title.control.value.trim(),
            issuer: issuer.control.value.trim(),
            issueDate: issued.control.value.trim(),
            expirationDate: expires.control.value.trim(),
            credentialId: credId.control.value.trim(),
            credentialUrl: credUrl.control.value.trim(),
            description: description.control.value.trim()
        };
        if (imageData) body.imageData = imageData;

        save.disabled = true;
        setNote(note, 'Saving…');

        try {
            // PUT on the existing id, so editing can never create a duplicate.
            await api(isEdit ? `${API.certificates}/${encodeURIComponent(cert.id)}` : API.certificates, {
                method: isEdit ? 'PUT' : 'POST',
                body
            });
            await state.onRefresh?.();
            openManager();
        } catch (error) {
            save.disabled = false;
            setNote(note, error.message, 'error');
        }
    });
}

/* ------------------------------------------------- replace image / delete  */

function replaceImage(cert, note, refresh) {
    const picker = el('input', { type: 'file', accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp' });

    picker.addEventListener('change', async () => {
        const file = picker.files?.[0];
        if (!file) return;
        setNote(note, 'Uploading replacement…');
        try {
            const imageData = await readImageFile(file);
            // Every metadata field is sent back unchanged; only the image moves.
            await api(`${API.certificates}/${encodeURIComponent(cert.id)}`, {
                method: 'PUT',
                body: {
                    title: cert.title,
                    issuer: cert.issuer,
                    issueDate: cert.issueDate,
                    expirationDate: cert.expirationDate,
                    credentialId: cert.credentialId,
                    credentialUrl: cert.credentialUrl,
                    description: cert.description,
                    imageData
                }
            });
            await state.onRefresh?.();
            await refresh();
            setNote(note, `Image replaced for "${cert.title}".`, 'success');
        } catch (error) {
            setNote(note, error.message, 'error');
        }
    });

    picker.click();
}

function confirmDelete(cert, note, refresh) {
    const cancel = el('button', { type: 'button', class: 'dm-btn dm-btn--ghost', text: 'Cancel' });
    const remove = el('button', { type: 'button', class: 'dm-btn dm-btn--danger', text: 'Delete' });

    const panel = el('div', { class: 'dm-panel dm-confirm' }, [
        el('h2', { class: 'dm-confirm__title', text: 'Delete Certification?' }),
        el('p', { class: 'dm-confirm__text', text: `"${cert.title}" will be removed from the portfolio.` }),
        el('div', { class: 'dm-foot' }, [cancel, remove])
    ]);

    const previous = openOverlay;
    const overlay = showOverlay('login', panel, { label: 'Confirm deletion' });

    function restore() {
        overlay.remove();
        openOverlay = previous;
        document.body.appendChild(previous);
        previous.classList.add('is-open');
    }

    cancel.addEventListener('click', restore);

    remove.addEventListener('click', async () => {
        remove.disabled = true;
        try {
            await api(`${API.certificates}/${encodeURIComponent(cert.id)}`, { method: 'DELETE' });
            restore();
            await state.onRefresh?.();
            await refresh();
            setNote(note, `"${cert.title}" was deleted.`, 'success');
        } catch (error) {
            restore();
            setNote(note, error.message, 'error');
        }
    });
}

/* ---------------------------------------------------------- password change */

function openPasswordChange() {
    const note = el('span', { class: 'dm-note', role: 'status', 'aria-live': 'polite' });
    const current = field('dmCurrentPass', 'Current Password', { type: 'password', maxlength: '200' });
    const next = field('dmNextPass', 'New Password', { type: 'password', maxlength: '200' });

    const save = el('button', { type: 'submit', class: 'dm-btn dm-btn--primary', text: 'Update Password' });
    const cancel = el('button', { type: 'button', class: 'dm-btn dm-btn--ghost', text: 'Cancel' });

    const form = el('form', { novalidate: true }, [
        current.node,
        next.node,
        note,
        el('div', { class: 'dm-foot' }, [cancel, save])
    ]);

    showOverlay('login', el('div', { class: 'dm-panel dm-editor' }, [
        el('h2', { class: 'dm-editor__title', text: 'Change Password' }),
        el('p', { class: 'dm-editor__sub', text: 'At least 8 characters. Every active session is signed out afterwards.' }),
        form
    ]), { label: 'Change Dev Mode password' });

    cancel.addEventListener('click', () => openManager());

    form.addEventListener('submit', async event => {
        event.preventDefault();
        save.disabled = true;
        setNote(note, 'Updating…');
        try {
            await api(API.password, {
                method: 'POST',
                body: { currentPassword: current.control.value, newPassword: next.control.value }
            });
            setNote(note, 'Password updated. Please log in again.', 'success');
            setTimeout(closeOverlay, 1400);
        } catch (error) {
            save.disabled = false;
            setNote(note, error.message, 'error');
        }
    });
}

/* --------------------------------------------------------------------- init */

export function initDevMode({ onRefresh } = {}) {
    const trigger = document.getElementById('devModeToggle');
    if (!trigger) return;

    state.onRefresh = onRefresh;

    // A 404 here simply means the site is being served statically, with no
    // authoring service behind it — the expected state on GitHub Pages.
    fetch(API.health, { headers: { 'X-Dev-Mode': '1' } })
        .then(response => (response.ok ? response.json() : null))
        .then(payload => {
            state.available = Boolean(payload?.devMode);
            trigger.classList.toggle('is-live', state.available);
        })
        .catch(() => {
            state.available = false;
        });

    trigger.addEventListener('click', async () => {
        state.lastFocus = trigger;
        trigger.setAttribute('aria-expanded', 'true');

        if (!state.available) {
            openLogin();
            return;
        }

        try {
            await api(API.session);
            openManager();
        } catch {
            openLogin();
        }
    });
}
