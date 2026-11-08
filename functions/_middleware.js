import { getSessionUser, jsonResponse } from './_auth.js';

export async function onRequest(context) {
    const { request, env, next } = context;
    const pathname = new URL(request.url).pathname;

    // Public entry point and login/status/logout handlers. Every other page and API
    // route requires a valid server-side session (including timetable API requests).
    const publicPaths = new Set(['/', '/index.html', '/auth.js', '/styles.css', '/api/login', '/api/me', '/api/logout']);
    if (publicPaths.has(pathname)) return next();

    const user = await getSessionUser(request, env);
    if (!user) {
        if (pathname.startsWith('/api/')) return jsonResponse({ error: 'Authentication required.' }, 401);
        return Response.redirect(new URL('/index.html', request.url), 302);
    }

    context.data.user = user;
    return next();
}
