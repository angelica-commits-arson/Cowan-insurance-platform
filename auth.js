document.addEventListener('DOMContentLoaded', async () => {
    const authStatus = document.getElementById('authStatus');
    const dashboardLink = document.getElementById('dashboardLink');
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.querySelector('.toggle-password');

    function setAuthMessage(message, isError = false) {
        authStatus.textContent = message;
        authStatus.classList.toggle('error', isError);
        authStatus.classList.remove('success');
    }

    function setAuthSuccess(message) {
        authStatus.textContent = message;
        authStatus.classList.remove('error');
        authStatus.classList.add('success');
    }

    function revealPassword() {
        const hidden = passwordInput.type === 'password';
        passwordInput.type = hidden ? 'text' : 'password';
        const icon = passwordToggle.querySelector('i');
        icon.classList.toggle('fa-eye', !hidden);
        icon.classList.toggle('fa-eye-slash', hidden);
    }

    if (passwordToggle) {
        passwordToggle.addEventListener('click', revealPassword);
    }

    async function checkCloudflareSession() {
        try {
            const response = await fetch('/api/me', { cache: 'no-store' });

            if (!response.ok) {
                if (response.status === 401) return null;
                throw new Error('Unable to verify your sign-in.');
            }

            if (!response.headers.get('content-type')?.includes('application/json')) {
                throw new Error('Your session could not be verified.');
            }

            const identity = await response.json();
            return identity;
        } catch (error) {
            return null;
        }
    }

    async function attemptManualLogin(event) {
        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            setAuthMessage('Please enter both your work email and password.', true);
            return;
        }

        loginButton.disabled = true;
        loginButton.innerHTML = '<span>Signing In...</span>';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Invalid email or password.');
            }

            setAuthSuccess(`Signed in as ${data.name || email}.`);
            localStorage.setItem('staffSession', JSON.stringify({
                email: data.email || email,
                name: data.name || email,
                authorised: true
            }));

            window.location.href = 'dashboard.html';
        } catch (error) {
            setAuthMessage(error.message, true);
            loginButton.disabled = false;
            loginButton.innerHTML = '<span>Sign In</span><i class="fa-solid fa-arrow-right"></i>';
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', attemptManualLogin);
    }

    const identity = await checkCloudflareSession();

    if (identity && identity.email) {
        setAuthSuccess(`Signed in as ${identity.name || identity.email}.`);
        dashboardLink.classList.remove('hidden');
        return;
    }

    setAuthMessage('Please sign in with your authorised work email and password.');
});
