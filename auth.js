document.addEventListener('DOMContentLoaded', () => {
    const authStatus = document.getElementById('authStatus');
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const dashboardLink = document.getElementById('dashboardLink');

    function setStatus(message, kind = '') {
        authStatus.textContent = message;
        authStatus.classList.toggle('error', kind === 'error');
        authStatus.classList.toggle('success', kind === 'success');
    }

    function showAuthenticatedUser(user) {
        setStatus(`Signed in as ${user.name || user.email}.`, 'success');
        loginForm.classList.add('hidden');
        dashboardLink.classList.remove('hidden');
    }

    async function readJson(response) {
        if (!response.headers.get('content-type')?.includes('application/json')) {
            throw new Error('The sign-in service returned an unexpected response. Please try again later.');
        }
        return response.json();
    }

    // Existing sessions are checked server-side; the browser never decides whether a password is valid.
    fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' })
        .then(async response => {
            if (response.status === 401) {
                setStatus('Sign in with your authorised work email and password.');
                return;
            }
            if (!response.ok) throw new Error('Unable to verify your sign-in. Please try again later.');
            showAuthenticatedUser(await readJson(response));
        })
        .catch(error => setStatus(error.message, 'error'));

    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!loginForm.reportValidity()) return;

        loginButton.disabled = true;
        loginButton.querySelector('span').textContent = 'Signing in…';
        setStatus('Verifying your credentials…');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('email').value.trim(),
                    password: document.getElementById('password').value
                })
            });
            const result = await readJson(response);
            if (!response.ok) {
                throw new Error(result.error || 'Invalid email or password.');
            }

            // The server sets an HttpOnly session cookie; do not put credentials or tokens in browser storage.
            setStatus('Sign-in successful.', 'success');
            window.location.assign('dashboard.html');
        } catch (error) {
            setStatus(error.message || 'Unable to sign in. Please try again.', 'error');
            loginButton.disabled = false;
            loginButton.querySelector('span').textContent = 'Sign In';
        }
    });
});
