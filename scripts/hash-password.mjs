import { pbkdf2Sync, randomBytes } from 'node:crypto';

// Read the password from stdin so it is not embedded in source or passed as a command-line argument.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const password = input.replace(/[\r\n]+$/, '');
if (password.length < 12 || password.length > 1024) {
    console.error('Use a password between 12 and 1024 characters.');
    process.exit(1);
}
const iterations = 310000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const base64url = value => value.toString('base64url');
process.stdout.write(`pbkdf2_sha256$${iterations}$${base64url(salt)}$${base64url(hash)}\n`);
