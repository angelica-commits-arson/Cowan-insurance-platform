import { getSessionUser, jsonResponse } from '../_auth.js';

export async function onRequestGet({ request, env }) {
    const user = await getSessionUser(request, env);
    if (!user) return jsonResponse({ error: 'Not signed in.' }, 401);
    return jsonResponse({ email: user.email, name: user.name });
}
