export const SESSION_COOKIE = '__Host-cowan_session';
export const SESSION_DURATION_SECONDS = 60 * 60 * 12;
const PBKDF2_ITERATIONS = 310000;

export function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            ...extraHeaders
        }
    });
}

export function getCookie(request, name) {
    const cookieHeader = request.headers.get('Cookie') || '';
    for (const part of cookieHeader.split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0) continue;
        if (part.slice(0, separator).trim() === name) {
            return part.slice(separator + 1).trim();
        }
    }
    return null;
}

function base64UrlEncode(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export async function sha256Hex(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password, encodedHash) {
    try {
        const [algorithm, iterationsText, saltText, hashText] = encodedHash.split('$');
        const iterations = Number(iterationsText);
        if (algorithm !== 'pbkdf2_sha256' || iterations !== PBKDF2_ITERATIONS || !saltText || !hashText) return false;
        const salt = base64UrlDecode(saltText);
        const expected = base64UrlDecode(hashText);
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, expected.length * 8);
        const actual = new Uint8Array(bits);
        if (actual.length !== expected.length) return false;
        let difference = 0;
        for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
        return difference === 0;
    } catch {
        return false;
    }
}

export async function createSession(env, userId) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = base64UrlEncode(randomBytes);
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare(
        'INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime(\'now\', ?))'
    ).bind(tokenHash, userId, `+${SESSION_DURATION_SECONDS} seconds`).run();
    return token;
}

export function sessionCookie(token) {
    return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearedSessionCookie() {
    return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function getSessionUser(request, env) {
    const token = getCookie(request, SESSION_COOKIE);
    if (!token || token.length > 128) return null;
    const tokenHash = await sha256Hex(token);
    return env.DB.prepare(`
        SELECT users.id, users.email, users.name
        FROM auth_sessions
        JOIN users ON users.id = auth_sessions.user_id
        WHERE auth_sessions.token_hash = ?
          AND auth_sessions.expires_at > datetime('now')
          AND users.active = 1
        LIMIT 1
    `).bind(tokenHash).first();
}
