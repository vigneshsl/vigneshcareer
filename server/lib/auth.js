'use strict';

/**
 * auth.js — Credential storage, session signing and login rate limiting.
 *
 * The password is never stored, transmitted back, or embedded anywhere the
 * browser can read it. Only a scrypt hash lives on disk, in a gitignored file.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'devmode.config.json');

const DEFAULT_USERNAME = 'vicky';
const DEFAULT_PASSWORD = 'pass1';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

let config = null;

function scryptHash(password, saltHex) {
    const salt = Buffer.from(saltHex, 'hex');
    return crypto.scryptSync(password, salt, SCRYPT.keylen, {
        N: SCRYPT.N,
        r: SCRYPT.r,
        p: SCRYPT.p,
        maxmem: 64 * 1024 * 1024
    }).toString('hex');
}

function createConfig() {
    const salt = crypto.randomBytes(16).toString('hex');
    return {
        username: DEFAULT_USERNAME,
        passwordSalt: salt,
        passwordHash: scryptHash(DEFAULT_PASSWORD, salt),
        sessionSecret: crypto.randomBytes(48).toString('hex'),
        usingDefaultPassword: true,
        createdAt: new Date().toISOString()
    };
}

/**
 * A hosted deploy has no durable disk, so the credentials come from the
 * environment instead. Generate the values with `node scripts/hash-password.js`.
 */
function envConfig() {
    const passwordHash = process.env.DEVMODE_PASSWORD_HASH;
    const passwordSalt = process.env.DEVMODE_PASSWORD_SALT;
    const sessionSecret = process.env.DEVMODE_SESSION_SECRET;
    if (!passwordHash || !passwordSalt || !sessionSecret) return null;

    return {
        username: process.env.DEVMODE_USERNAME || DEFAULT_USERNAME,
        passwordSalt,
        passwordHash,
        sessionSecret,
        usingDefaultPassword: false,
        fromEnv: true
    };
}

function loadConfig() {
    if (config) return config;

    config = envConfig();
    if (config) return config;

    if (fs.existsSync(CONFIG_PATH)) {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return config;
    }

    config = createConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    return config;
}

function hasEnvCredentials() {
    return envConfig() !== null;
}

function saveConfig() {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

/** Compares two strings in constant time regardless of length. */
function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

/**
 * Always runs the full scrypt derivation, even for an unknown username, so a
 * wrong username and a wrong password cost the same amount of time.
 */
function verifyCredentials(username, password) {
    const cfg = loadConfig();
    const userOk = safeEqual(username, cfg.username);
    const hash = scryptHash(String(password ?? ''), cfg.passwordSalt);
    const passOk = safeEqual(hash, cfg.passwordHash);
    return userOk && passOk;
}

function changePassword(currentPassword, nextPassword) {
    const cfg = loadConfig();
    if (cfg.fromEnv) {
        return {
            ok: false,
            error: 'This deployment reads its password from the host configuration. Change it there.'
        };
    }
    if (!safeEqual(scryptHash(String(currentPassword ?? ''), cfg.passwordSalt), cfg.passwordHash)) {
        return { ok: false, error: 'Current password is incorrect.' };
    }
    if (typeof nextPassword !== 'string' || nextPassword.length < 8) {
        return { ok: false, error: 'New password must be at least 8 characters.' };
    }
    cfg.passwordSalt = crypto.randomBytes(16).toString('hex');
    cfg.passwordHash = scryptHash(nextPassword, cfg.passwordSalt);
    cfg.usingDefaultPassword = false;
    // Rotating the secret invalidates every session issued under the old password.
    cfg.sessionSecret = crypto.randomBytes(48).toString('hex');
    saveConfig();
    return { ok: true };
}

/* ---------------------------------------------------------------- sessions */

function b64url(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payloadB64) {
    return b64url(crypto.createHmac('sha256', loadConfig().sessionSecret).update(payloadB64).digest());
}

function createSession(username) {
    const payload = b64url(JSON.stringify({
        sub: username,
        exp: Date.now() + SESSION_TTL_MS,
        jti: crypto.randomBytes(12).toString('hex')
    }));
    return `${payload}.${sign(payload)}`;
}

function verifySession(token) {
    if (typeof token !== 'string' || !token.includes('.')) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expected = sign(payload);
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    try {
        const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
        if (typeof claims.exp !== 'number' || claims.exp < Date.now()) return null;
        return claims;
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------ rate limiter */

const attempts = new Map();

function loginBlockedFor(ip) {
    const record = attempts.get(ip);
    if (!record) return 0;
    if (record.until && record.until > Date.now()) return record.until - Date.now();
    if (record.until && record.until <= Date.now()) attempts.delete(ip);
    return 0;
}

function recordFailure(ip) {
    const record = attempts.get(ip) || { count: 0, until: 0 };
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) record.until = Date.now() + LOCKOUT_MS;
    attempts.set(ip, record);
}

function clearFailures(ip) {
    attempts.delete(ip);
}

module.exports = {
    CONFIG_PATH,
    SESSION_TTL_MS,
    loadConfig,
    hasEnvCredentials,
    verifyCredentials,
    changePassword,
    createSession,
    verifySession,
    loginBlockedFor,
    recordFailure,
    clearFailures
};
