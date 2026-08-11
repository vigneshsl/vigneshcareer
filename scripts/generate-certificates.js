#!/usr/bin/env node

/**
 * generate-certificates.js
 * Reconciles certificates/ with assets/data/certificates.json.
 *
 *   node scripts/generate-certificates.js
 *
 * certificates.json is the source of truth for metadata — Dev Mode and manual
 * edits both write there. This script only reconciles the two: it appends image
 * files that no entry references yet, and drops entries whose image file has
 * been deleted. It never overwrites a field somebody filled in.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CERT_DIR = path.join(ROOT, 'certificates');
const OUTPUT_FILE = path.join(ROOT, 'assets', 'data', 'certificates.json');
const METADATA_FILE = path.join(CERT_DIR, 'metadata.json');

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Convert filename to readable title
 * Example: cpp-essential-training.jpg → "C++ Essential Training"
 */
function filenameToTitle(filename) {
    return filename
        .replace(/\.[^.]+$/, '')
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => {
            if (word.toLowerCase() === 'cpp') return 'C++';
            if (word.toLowerCase() === 'mfc') return 'MFC';
            if (word.toLowerCase() === 'qml') return 'QML';
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\+\+/g, 'pp')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'certificate';
}

/** Optional certificates/metadata.json, keyed by filename. */
function loadMetadata() {
    try {
        if (fs.existsSync(METADATA_FILE)) {
            return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        }
    } catch (error) {
        console.warn('Warning: Could not load metadata.json:', error.message);
    }
    return {};
}

function loadExisting() {
    try {
        if (fs.existsSync(OUTPUT_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (error) {
        console.warn('Warning: Could not parse certificates.json:', error.message);
    }
    return [];
}

/** Fills the extended fields without discarding anything already present. */
function normalise(entry, index) {
    const image = String(entry.image || '');
    const issueDate = entry.issueDate || entry.date || '';

    return {
        id: entry.id || `${slugify(path.basename(image, path.extname(image)) || entry.title)}-${index}`,
        image,
        title: entry.title || 'Certificate',
        issuer: entry.issuer || '',
        date: issueDate,
        issueDate,
        expirationDate: entry.expirationDate || '',
        credentialId: entry.credentialId || '',
        credentialUrl: entry.credentialUrl || '',
        description: entry.description || ''
    };
}

function reconcile() {
    if (!fs.existsSync(CERT_DIR)) {
        console.error(`Error: Certificates directory not found: ${CERT_DIR}`);
        process.exit(1);
    }

    const metadata = loadMetadata();
    const onDisk = fs.readdirSync(CERT_DIR)
        .filter(file => SUPPORTED_EXTENSIONS.includes(path.extname(file).toLowerCase()));
    const onDiskSet = new Set(onDisk.map(file => `certificates/${file}`));

    const kept = [];
    const dropped = [];
    const referenced = new Set();

    loadExisting().forEach((entry, index) => {
        const image = String(entry.image || '');
        if (!onDiskSet.has(image)) {
            dropped.push(image || '(no image)');
            return;
        }
        referenced.add(image);
        kept.push(normalise(entry, index));
    });

    const added = [];
    onDisk.sort().forEach(file => {
        const image = `certificates/${file}`;
        if (referenced.has(image)) return;

        const meta = metadata[file] || {};
        added.push(normalise({
            image,
            title: meta.title || filenameToTitle(file),
            issuer: meta.issuer || '',
            date: meta.date || '',
            description: meta.description || ''
        }, kept.length + added.length));
    });

    return { certificates: kept.concat(added), added, dropped };
}

function write(certificates) {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(certificates, null, 4) + '\n');
}

try {
    const { certificates, added, dropped } = reconcile();
    write(certificates);

    console.log(`\u2713 ${certificates.length} certificate(s) in manifest`);
    if (added.length) console.log(`  + added ${added.length} new image(s)`);
    if (dropped.length) console.log(`  - removed ${dropped.length} entry/entries with no image file`);
    console.log(`\u2713 Written to: ${OUTPUT_FILE}`);

    if (certificates.length === 0) {
        console.warn('Warning: No certificates found in certificates/ directory');
    }
} catch (error) {
    console.error('Error generating certificates:', error.message);
    process.exit(1);
}
