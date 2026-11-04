document.addEventListener('DOMContentLoaded', async () => {
    const authStatus = document.getElementById('authStatus');
    const dashboardLink = document.getElementById('dashboardLink');

    try {
        const response = await fetch('/api/me', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(response.status === 401
                ? 'Your Cloudflare Access session could not be verified. Sign in with an authorised work email and reload.'
                : 'Unable to verify your sign-in. Please try again later.');
        }
        if (!response.headers.get('content-type')?.includes('application/json')) {
            throw new Error('Your Cloudflare Access session could not be verified. Reload and sign in again.');
        }

        const identity = await response.json();
        authStatus.textContent = `Signed in as ${identity.name || identity.email}.`;
        dashboardLink.classList.remove('hidden');
    } catch (error) {
        authStatus.textContent = error.message;
        authStatus.classList.add('error');
    }
});
