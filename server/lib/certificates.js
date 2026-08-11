'use strict';

/**
 * certificates.js — Persistence for assets/data/certificates.json and the
 * certificates/ image directory.
 *
 * Uploaded filenames are always regenerated from the certificate title plus a
 * random suffix, so a hostile filename can never influence the write path.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const github = require('./github-api');

const ROOT = path.join(__dirname, '..', '..');
const DATA_PATH = 'assets/data/certificates.json';
const IMAGE_PREFIX = 'certificates/';
const DATA_FILE = path.join(ROOT, 'assets', 'data', 'certificates.json');
const IMAGE_DIR = path.join(ROOT, 'certificates');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const IMAGE_TYPES = {
    'image/jpeg': { ext: '.jpg', magic: [[0xFF, 0xD8, 0xFF]] },
    'image/png': { ext: '.png', magic: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]] },
    'image/webp': { ext: '.webp', magic: [[0x52, 0x49, 0x46, 0x46]] }
};

const FIELD_LIMITS = {
    title: 160,
    issuer: 120,
    issueDate: 60,
    expirationDate: 60,
    credentialId: 120,
    credentialUrl: 500,
    description: 600
};

/* ------------------------------------------------------------- sanitising */

function clean(value, max) {
    return String(value ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, max);
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\+\+/g, 'pp')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'certificate';
}

function safeUrl(value) {
    const url = clean(value, FIELD_LIMITS.credentialUrl);
    if (!url) return '';
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
    } catch {
        return '';
    }
}

/* ------------------------------------------------------------------- model */

/** Fills in the extended fields while leaving the original four intact. */
function normalise(raw, index) {
    const image = clean(raw.image, 300);
    const issueDate = clean(raw.issueDate || raw.date, FIELD_LIMITS.issueDate);

    return {
        id: clean(raw.id, 80) || `${slugify(path.basename(image, path.extname(image)) || raw.title)}-${index}`,
        image,
        title: clean(raw.title, FIELD_LIMITS.title) || 'Certificate',
        issuer: clean(raw.issuer, FIELD_LIMITS.issuer),
        // `date` stays as the legacy display field the public renderer already reads.
        date: issueDate,
        issueDate,
        expirationDate: clean(raw.expirationDate, FIELD_LIMITS.expirationDate),
        credentialId: clean(raw.credentialId, FIELD_LIMITS.credentialId),
        credentialUrl: safeUrl(raw.credentialUrl),
        description: clean(raw.description, FIELD_LIMITS.description)
    };
}

/* ---------------------------------------------------------------- backend */

/**
 * Two interchangeable persistence backends. `github` is used whenever a token
 * is configured, because a cloud host's filesystem is wiped on every restart.
 */
const backend = github.isConfigured()
    ? {
        remote: true,
        async readText(relPath) {
            const file = await github.getFile(relPath);
            return file ? file.buffer.toString('utf8') : null;
        },
        async write(relPath, buffer, message) {
            await github.putFile(relPath, buffer, message);
        },
        async remove(relPath, message) {
            await github.deleteFile(relPath, message);
        }
    }
    : {
        remote: false,
        async readText(relPath) {
            const target = path.join(ROOT, relPath);
            return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
        },
        async write(relPath, buffer) {
            const target = path.join(ROOT, relPath);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, buffer);
        },
        async remove(relPath) {
            const target = path.resolve(ROOT, relPath);
            if (!target.startsWith(path.join(ROOT, 'certificates') + path.sep)) return;
            fs.rmSync(target, { force: true });
        }
    };

async function readAll() {
    const text = await backend.readText(DATA_PATH);
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) return [];
        const seen = new Set();
        return parsed.map(normalise).map(cert => {
            let id = cert.id;
            while (seen.has(id)) id = `${cert.id}-${crypto.randomBytes(2).toString('hex')}`;
            seen.add(id);
            return { ...cert, id };
        });
    } catch (error) {
        throw new Error(`certificates.json is not valid JSON: ${error.message}`);
    }
}

async function writeAll(certificates, message = 'chore(certificates): update via Dev Mode') {
    const body = Buffer.from(JSON.stringify(certificates, null, 4) + '\n');
    await backend.write(DATA_PATH, body, message);
}

/* ------------------------------------------------------------------ images */

function matchesMagic(buffer, type) {
    return IMAGE_TYPES[type].magic.some(sig => sig.every((byte, i) => buffer[i] === byte));
}

/**
 * Accepts a `data:` URL, verifies the bytes really are the declared image type
 * and writes it under a freshly generated name.
 */
async function saveImage(dataUrl, titleForName) {
    const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ''));
    if (!match) throw new HttpError(400, 'Image must be a base64 data URL.');

    const [, mime, base64] = match;
    const type = IMAGE_TYPES[mime.toLowerCase()];
    if (!type) throw new HttpError(415, 'Only JPG, PNG and WebP images are allowed.');

    const buffer = Buffer.from(base64.replace(/\s/g, ''), 'base64');
    if (buffer.length === 0) throw new HttpError(400, 'Image file is empty.');
    if (buffer.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Image must be 8 MB or smaller.');
    if (!matchesMagic(buffer, mime.toLowerCase())) {
        throw new HttpError(415, 'File contents do not match the declared image type.');
    }
    if (mime.toLowerCase() === 'image/webp' && buffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
        throw new HttpError(415, 'File contents do not match the declared image type.');
    }

    const filename = `${slugify(titleForName)}-${crypto.randomBytes(3).toString('hex')}${type.ext}`;
    const relPath = `${IMAGE_PREFIX}${filename}`;
    await backend.write(relPath, buffer, `chore(certificates): add ${filename}`);
    return relPath;
}

/** Removes an image once no certificate references it any more. */
async function removeImageIfUnused(imagePath, certificates) {
    if (!imagePath || !imagePath.startsWith(IMAGE_PREFIX)) return;
    if (imagePath.includes('..')) return;
    if (certificates.some(cert => cert.image === imagePath)) return;

    await backend.remove(imagePath, `chore(certificates): remove ${path.basename(imagePath)}`);
}

/* ------------------------------------------------------------------- CRUD  */

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function validate(body, { requireImage }) {
    const title = clean(body.title, FIELD_LIMITS.title);
    if (!title) throw new HttpError(400, 'Certificate title is required.');
    if (requireImage && !body.imageData) throw new HttpError(400, 'A certificate image is required.');
    return title;
}

async function create(body) {
    const title = validate(body, { requireImage: true });
    const certificates = await readAll();

    const cert = normalise({
        ...body,
        title,
        id: `${slugify(title)}-${crypto.randomBytes(3).toString('hex')}`,
        image: await saveImage(body.imageData, title)
    }, certificates.length);

    certificates.push(cert);
    await writeAll(certificates, `chore(certificates): add ${cert.title}`);
    return cert;
}

async function update(id, body) {
    const certificates = await readAll();
    const index = certificates.findIndex(cert => cert.id === id);
    if (index === -1) throw new HttpError(404, 'Certificate not found.');

    const existing = certificates[index];
    const title = validate(body, { requireImage: false });
    const previousImage = existing.image;

    const image = body.imageData ? await saveImage(body.imageData, title) : existing.image;

    // id and image stay under server control; everything else comes from the form.
    certificates[index] = normalise({
        ...body,
        title,
        id: existing.id,
        image
    }, index);

    await writeAll(certificates, `chore(certificates): update ${certificates[index].title}`);
    if (image !== previousImage) await removeImageIfUnused(previousImage, certificates);
    return certificates[index];
}

async function remove(id) {
    const certificates = await readAll();
    const index = certificates.findIndex(cert => cert.id === id);
    if (index === -1) throw new HttpError(404, 'Certificate not found.');

    const [removed] = certificates.splice(index, 1);
    await writeAll(certificates, `chore(certificates): remove ${removed.title}`);
    await removeImageIfUnused(removed.image, certificates);
    return removed;
}

module.exports = {
    HttpError,
    DATA_FILE,
    IMAGE_DIR,
    MAX_IMAGE_BYTES,
    isRemote: backend.remote,
    readAll,
    writeAll,
    normalise,
    create,
    update,
    remove
};
