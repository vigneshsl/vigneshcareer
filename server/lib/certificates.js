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

const ROOT = path.join(__dirname, '..', '..');
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

function readAll() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
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

function writeAll(certificates) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(certificates, null, 4) + '\n');
}

/* ------------------------------------------------------------------ images */

function matchesMagic(buffer, type) {
    return IMAGE_TYPES[type].magic.some(sig => sig.every((byte, i) => buffer[i] === byte));
}

/**
 * Accepts a `data:` URL, verifies the bytes really are the declared image type
 * and writes it under a freshly generated name.
 */
function saveImage(dataUrl, titleForName) {
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

    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    const filename = `${slugify(titleForName)}-${crypto.randomBytes(3).toString('hex')}${type.ext}`;
    fs.writeFileSync(path.join(IMAGE_DIR, filename), buffer);
    return `certificates/${filename}`;
}

/** Removes an image once no certificate references it any more. */
function removeImageIfUnused(imagePath, certificates) {
    if (!imagePath || !imagePath.startsWith('certificates/')) return;
    if (certificates.some(cert => cert.image === imagePath)) return;

    const target = path.resolve(ROOT, imagePath);
    if (!target.startsWith(IMAGE_DIR + path.sep)) return;
    fs.rmSync(target, { force: true });
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

function create(body) {
    const title = validate(body, { requireImage: true });
    const certificates = readAll();

    const cert = normalise({
        ...body,
        title,
        id: `${slugify(title)}-${crypto.randomBytes(3).toString('hex')}`,
        image: saveImage(body.imageData, title)
    }, certificates.length);

    certificates.push(cert);
    writeAll(certificates);
    return cert;
}

function update(id, body) {
    const certificates = readAll();
    const index = certificates.findIndex(cert => cert.id === id);
    if (index === -1) throw new HttpError(404, 'Certificate not found.');

    const existing = certificates[index];
    const title = validate(body, { requireImage: false });
    const previousImage = existing.image;

    const image = body.imageData ? saveImage(body.imageData, title) : existing.image;

    // id and image stay under server control; everything else comes from the form.
    certificates[index] = normalise({
        ...body,
        title,
        id: existing.id,
        image
    }, index);

    writeAll(certificates);
    if (image !== previousImage) removeImageIfUnused(previousImage, certificates);
    return certificates[index];
}

function remove(id) {
    const certificates = readAll();
    const index = certificates.findIndex(cert => cert.id === id);
    if (index === -1) throw new HttpError(404, 'Certificate not found.');

    const [removed] = certificates.splice(index, 1);
    writeAll(certificates);
    removeImageIfUnused(removed.image, certificates);
    return removed;
}

module.exports = {
    HttpError,
    DATA_FILE,
    IMAGE_DIR,
    MAX_IMAGE_BYTES,
    readAll,
    writeAll,
    normalise,
    create,
    update,
    remove
};
