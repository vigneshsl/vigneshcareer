#!/usr/bin/env node
'use strict';

/**
 * devmode-server.js — Local authoring server for Dev Mode.
 *
 *   node server/devmode-server.js
 *   → http://127.0.0.1:4321
 *
 * The published site is static GitHub Pages, which cannot hold a secret or
 * authenticate anyone. So the write path runs here instead: the server binds to
 * loopback only, verifies a scrypt password hash that never leaves this machine,
 * writes certificates.json and certificates/ directly, and pushes with the
 * owner's existing git credentials. No token or password is ever sent to the
 * browser, and the public site keeps reading the same static JSON it always has.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { execFile } = require('child_process');

const auth = require('./lib/auth');
const store = require('./lib/certificates');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.DEVMODE_PORT) || 4321;
const HOST = '127.0.0.1';
const COOKIE_NAME = 'vs_devmode';
const MAX_BODY_BYTES = 12 * 1024 * 1024;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8'
};

/* ------------------------------------------------------------- primitives */

function sendJson(res, status, payload, headers = {}) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
        ...headers
    });
    res.end(body);
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];

        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new store.HttpError(413, 'Request body is too large.'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            if (!chunks.length) return resolve({});
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
                reject(new store.HttpError(400, 'Request body is not valid JSON.'));
            }
        });

        req.on('error', reject);
    });
}

function parseCookies(header) {
    const jar = {};
    String(header || '').split(';').forEach(part => {
        const index = part.indexOf('=');
        if (index < 0) return;
        jar[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    });
    return jar;
}

function sessionCookie(value, maxAgeSeconds) {
    return [
        `${COOKIE_NAME}=${value}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        `Max-Age=${maxAgeSeconds}`
    ].join('; ');
}

function requireSession(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    const claims = auth.verifySession(token);
    if (!claims) throw new store.HttpError(401, 'Not authenticated.');
    return claims;
}

/**
 * Loopback + SameSite=Strict already block cross-site writes; the custom header
 * requirement blocks the remaining simple-request vectors (forms, img, etc.).
 */
function assertSameOrigin(req) {
    if (req.headers['x-dev-mode'] !== '1') {
        throw new store.HttpError(403, 'Missing Dev Mode request header.');
    }
    const origin = req.headers.origin;
    if (origin && origin !== `http://${HOST}:${PORT}` && origin !== `http://localhost:${PORT}`) {
        throw new store.HttpError(403, 'Cross-origin request rejected.');
    }
}

/* ------------------------------------------------------------------ routes */

async function handleApi(req, res, url) {
    const route = `${req.method} ${url.pathname}`;

    if (route === 'GET /api/health') {
        const cfg = auth.loadConfig();
        return sendJson(res, 200, {
            devMode: true,
            usingDefaultPassword: cfg.usingDefaultPassword === true
        });
    }

    if (route === 'POST /api/auth/login') {
        assertSameOrigin(req);
        const ip = req.socket.remoteAddress || 'unknown';

        const blockedFor = auth.loginBlockedFor(ip);
        if (blockedFor > 0) {
            return sendJson(res, 429, {
                error: `Too many attempts. Try again in ${Math.ceil(blockedFor / 60000)} minute(s).`
            });
        }

        const body = await readJsonBody(req);
        if (!auth.verifyCredentials(body.username, body.password)) {
            auth.recordFailure(ip);
            // Deliberately identical for an unknown user and a wrong password.
            return sendJson(res, 401, { error: 'Invalid credentials.' });
        }

        auth.clearFailures(ip);
        const cfg = auth.loadConfig();
        return sendJson(res, 200,
            { user: cfg.username, usingDefaultPassword: cfg.usingDefaultPassword === true },
            { 'Set-Cookie': sessionCookie(auth.createSession(cfg.username), auth.SESSION_TTL_MS / 1000) }
        );
    }

    if (route === 'POST /api/auth/logout') {
        assertSameOrigin(req);
        return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
    }

    if (route === 'GET /api/auth/session') {
        const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
        const claims = auth.verifySession(token);
        return sendJson(res, claims ? 200 : 401,
            claims ? { user: claims.sub, expiresAt: claims.exp } : { error: 'Not authenticated.' });
    }

    if (route === 'POST /api/auth/password') {
        assertSameOrigin(req);
        requireSession(req);
        const body = await readJsonBody(req);
        const result = auth.changePassword(body.currentPassword, body.newPassword);
        if (!result.ok) return sendJson(res, 400, { error: result.error });
        return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
    }

    if (route === 'GET /api/certificates') {
        requireSession(req);
        return sendJson(res, 200, { certificates: store.readAll() });
    }

    if (route === 'POST /api/certificates') {
        assertSameOrigin(req);
        requireSession(req);
        return sendJson(res, 201, { certificate: store.create(await readJsonBody(req)) });
    }

    const itemMatch = /^\/api\/certificates\/([A-Za-z0-9._-]{1,120})$/.exec(url.pathname);
    if (itemMatch) {
        assertSameOrigin(req);
        requireSession(req);
        const id = itemMatch[1];

        if (req.method === 'PUT') {
            return sendJson(res, 200, { certificate: store.update(id, await readJsonBody(req)) });
        }
        if (req.method === 'DELETE') {
            return sendJson(res, 200, { certificate: store.remove(id) });
        }
        throw new store.HttpError(405, 'Method not allowed.');
    }

    if (route === 'POST /api/publish') {
        assertSameOrigin(req);
        requireSession(req);
        return sendJson(res, 200, await publish());
    }

    throw new store.HttpError(404, 'Unknown endpoint.');
}

/* ----------------------------------------------------------------- publish */

function git(args) {
    return new Promise(resolve => {
        // execFile without a shell: arguments can never be reinterpreted as commands.
        execFile('git', args, { cwd: ROOT, windowsHide: true }, (error, stdout, stderr) => {
            resolve({ ok: !error, out: `${stdout || ''}${stderr || ''}`.trim() });
        });
    });
}

/**
 * Commits and pushes with the owner's own git credentials. No personal access
 * token is stored by, or passes through, this server.
 */
async function publish() {
    const staged = await git(['add', 'assets/data/certificates.json', 'certificates']);
    if (!staged.ok) return { published: false, message: `git add failed: ${staged.out}` };

    const pending = await git(['diff', '--cached', '--quiet']);
    if (pending.ok) return { published: false, message: 'Nothing new to publish.' };

    const committed = await git(['commit', '-m', 'chore(certificates): update via Dev Mode']);
    if (!committed.ok) return { published: false, message: `git commit failed: ${committed.out}` };

    const pushed = await git(['push']);
    if (!pushed.ok) {
        return { published: false, message: `Committed locally, but push failed: ${pushed.out}` };
    }
    return { published: true, message: 'Pushed. GitHub Pages will redeploy shortly.' };
}

/* ------------------------------------------------------------ static files */

function serveStatic(req, res, url) {
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(ROOT, relative);

    // Anything resolving outside the repository is refused.
    if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
        return sendJson(res, 403, { error: 'Forbidden.' });
    }

    let filePath = target;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found');
    }

    res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
}

/* ------------------------------------------------------------------ server */

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return sendJson(res, 405, { error: 'Method not allowed.' });
        }
        return serveStatic(req, res, url);
    }

    try {
        await handleApi(req, res, url);
    } catch (error) {
        const status = error.status || 500;
        if (status >= 500) console.error('[dev-mode]', error);
        sendJson(res, status, { error: status >= 500 ? 'Internal server error.' : error.message });
    }
});

server.listen(PORT, HOST, () => {
    const cfg = auth.loadConfig();
    console.log('');
    console.log('  Dev Mode server running');
    console.log(`  →  http://${HOST}:${PORT}`);
    console.log('');
    console.log(`  Credentials file: ${path.relative(ROOT, auth.CONFIG_PATH)} (gitignored)`);
    if (cfg.usingDefaultPassword) {
        console.log('  !  Still using the default development password.');
        console.log('     Change it from the Dev Mode panel before using this anywhere but localhost.');
    }
    console.log('');
});
