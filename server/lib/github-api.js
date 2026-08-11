'use strict';

/**
 * github-api.js — Minimal GitHub Contents API client.
 *
 * A cloud host gives every deploy a fresh, empty filesystem, so anything the
 * server writes locally disappears on the next restart. When a token is
 * configured the store commits straight to the repository instead, which makes
 * the server stateless: any instance can serve any request, and a restart loses
 * nothing.
 *
 * The token is read from the environment and never leaves this process.
 */

const https = require('https');

const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPO || '';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const AUTHOR = process.env.GITHUB_COMMIT_AUTHOR || 'Dev Mode';
const EMAIL = process.env.GITHUB_COMMIT_EMAIL || 'dev-mode@users.noreply.github.com';

function isConfigured() {
    return Boolean(TOKEN && /^[\w.-]+\/[\w.-]+$/.test(REPO));
}

function request(method, pathname, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? Buffer.from(JSON.stringify(body)) : null;

        const req = https.request({
            hostname: 'api.github.com',
            path: pathname,
            method,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'vigneshcareer-devmode',
                ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {})
            }
        }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let json = null;
                try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
                resolve({ status: res.statusCode, json, text });
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function contentsPath(filePath) {
    const encoded = filePath.split('/').map(encodeURIComponent).join('/');
    return `/repos/${REPO}/contents/${encoded}`;
}

/** Returns null when the file does not exist, rather than throwing. */
async function getFile(filePath) {
    const res = await request('GET', `${contentsPath(filePath)}?ref=${encodeURIComponent(BRANCH)}`);
    if (res.status === 404) return null;
    if (res.status !== 200) {
        throw new Error(`GitHub read failed (${res.status}): ${res.json?.message || res.text}`);
    }
    return {
        sha: res.json.sha,
        buffer: Buffer.from(res.json.content || '', 'base64')
    };
}

async function putFile(filePath, buffer, message) {
    const existing = await getFile(filePath);
    const res = await request('PUT', contentsPath(filePath), {
        message,
        content: Buffer.from(buffer).toString('base64'),
        branch: BRANCH,
        committer: { name: AUTHOR, email: EMAIL },
        ...(existing ? { sha: existing.sha } : {})
    });

    if (res.status !== 200 && res.status !== 201) {
        throw new Error(`GitHub write failed (${res.status}): ${res.json?.message || res.text}`);
    }
}

async function deleteFile(filePath, message) {
    const existing = await getFile(filePath);
    if (!existing) return;

    const res = await request('DELETE', contentsPath(filePath), {
        message,
        sha: existing.sha,
        branch: BRANCH,
        committer: { name: AUTHOR, email: EMAIL }
    });

    if (res.status !== 200) {
        throw new Error(`GitHub delete failed (${res.status}): ${res.json?.message || res.text}`);
    }
}

module.exports = { isConfigured, getFile, putFile, deleteFile, REPO, BRANCH };
