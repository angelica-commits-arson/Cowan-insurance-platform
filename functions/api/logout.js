import { clearedSessionCookie, getCookie, jsonResponse, SESSION_COOKIE, sha256Hex } from '../_auth.js';

export async function onRequestPost({ request, env }) {
    if (request.headers.get('Origin') !== new URL(request.url).origin) {
        return jsonResponse({ error: 'Invalid request origin.' }, 403);
    }
    const token = getCookie(request, SESSION_COOKIE);
    if (token) {
        await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
    }
    return jsonResponse({ ok: true }, 200, { 'Set-Cookie': clearedSessionCookie() });
}
