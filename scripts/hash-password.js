#!/usr/bin/env node
'use strict';

/**
 * hash-password.js — Prints the environment variables a hosted Dev Mode needs.
 *
 *   node scripts/hash-password.js
 *
 * The password is typed here and hashed here. Only the hash is printed, so the
 * password itself is never stored in the repository or in the host's settings.
 */

const crypto = require('crypto');
const readline = require('readline');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    // Suppress echo so the password is not left visible in the scrollback.
    const onKeypress = () => {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(question);
    };
    process.stdin.on('data', onKeypress);

    return new Promise(resolve => {
        rl.question(question, answer => {
            process.stdin.removeListener('data', onKeypress);
            rl.close();
            process.stdout.write('\n');
            resolve(answer);
        });
    });
}

(async () => {
    const username = (await ask('Username (default "vicky"): ')).trim() || 'vicky';
    const password = await ask('Password (at least 12 characters): ');

    if (password.length < 12) {
        console.error('\n  Too short. A password facing the internet needs at least 12 characters.\n');
        process.exit(1);
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, Buffer.from(salt, 'hex'), SCRYPT.keylen, {
        N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024
    }).toString('hex');

    console.log('\n  Add these to your host\'s environment variables:\n');
    console.log(`  DEVMODE_USERNAME=${username}`);
    console.log(`  DEVMODE_PASSWORD_SALT=${salt}`);
    console.log(`  DEVMODE_PASSWORD_HASH=${hash}`);
    console.log(`  DEVMODE_SESSION_SECRET=${crypto.randomBytes(48).toString('hex')}`);
    console.log('\n  Keep this output private, and do not commit it.\n');
})();
