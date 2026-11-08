import { createSession, jsonResponse, sessionCookie, verifyPassword } from '../_auth.js';

export async function onRequestPost({ request, env }) {
    if (request.headers.get('Origin') !== new URL(request.url).origin) {
        return jsonResponse({ error: 'Invalid request origin.' }, 403);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid sign-in request.' }, 400);
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1 || password.length > 1024) {
        return jsonResponse({ error: 'Invalid email or password.' }, 400);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    const ipKey = [...new Uint8Array(ipHash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const attemptCount = await env.DB.prepare(`
        SELECT COUNT(*) AS count FROM login_attempts
        WHERE ip_hash = ? AND attempted_at > datetime('now', '-15 minutes')
    `).bind(ipKey).first();
    if ((attemptCount?.count || 0) >= 20) {
        return jsonResponse({ error: 'Too many sign-in attempts. Please wait and try again.' }, 429, { 'Retry-After': '900' });
    }

    const user = await env.DB.prepare(`
        SELECT id, email, name, password_hash FROM users
        WHERE email = ? AND active = 1 LIMIT 1
    `).bind(email).first();

    // Verify a fixed dummy hash for unknown accounts to reduce timing-based account discovery.
    const dummyHash = 'pbkdf2_sha256$310000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const passwordMatches = await verifyPassword(password, user?.password_hash || dummyHash);
    if (!user || !passwordMatches) {
        await env.DB.prepare('INSERT INTO login_attempts (ip_hash, attempted_at) VALUES (?, datetime(\'now\'))').bind(ipKey).run();
        return jsonResponse({ error: 'Invalid email or password.' }, 401);
    }

    await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash = ?').bind(ipKey).run();
    const token = await createSession(env, user.id);
    return jsonResponse({ email: user.email, name: user.name }, 200, { 'Set-Cookie': sessionCookie(token) });
}
