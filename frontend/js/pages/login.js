// --- NEW: Global Error Catcher for the login page ---
// This ensures errors are caught even before the main application script is loaded.
window.onerror = function(message, source, lineno, colno, error) {
    const errorData = {
        message: message,
        source: source,
        lineno: lineno,
        colno: colno,
        error: error ? { message: error.message, stack: error.stack } : null,
        url: window.location.href,
    };

    // Use sendBeacon for reliability, especially during page unloads/redirects.
    const blob = new Blob([JSON.stringify(errorData)], { type: 'application/json' });
    navigator.sendBeacon('/api/log-error', blob);
};

// NEW: Toggle password visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.querySelector('#password-toggle i'); // More specific selector
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    }
}

function setupEventListeners() {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const emailInput = document.getElementById('email');
    const rememberMeCheckbox = document.getElementById('remember-me');

    // Populate email from localStorage if "Remember Me" was checked
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
        emailInput.value = savedEmail;
        rememberMeCheckbox.checked = true;
    }

    // Password toggle
    const passwordToggle = document.getElementById('password-toggle');
    if (passwordToggle) {
        passwordToggle.addEventListener('click', togglePasswordVisibility);
    }

    // Form submission
    loginForm.addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const spinner = loginBtn.querySelector('.fa-spinner');
    const errorMessageEl = document.getElementById('error-message');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('remember-me');

    errorMessageEl.textContent = '';
    loginBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showLoginError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
        loginBtn.disabled = false;
        btnText.style.display = 'inline-block';
        emailInput.focus();
        return;
    }

    // --- FIX: Clear old user profile before attempting a new login ---
    localStorage.removeItem('userProfile');

    // --- NEW: Call the dedicated API function ---
    try {
        // The loginUser function now handles token and profile storage
        const userProfile = await loginUser(email, password);

        if (rememberMeCheckbox.checked) {
            localStorage.setItem('rememberedEmail', email);
        } else {
            localStorage.removeItem('rememberedEmail');
        }
        // --- FIX: Use location.href to force a full page reload, ensuring main.js reads the new cached profile ---
        // This is more robust than location.replace() for clearing cached states.
        window.location.href = '/'; 
    } catch (error) {
        console.error('[Login] Login attempt failed:', error.message);
        showLoginError(error.message);
    } finally {
        loginBtn.disabled = false;
        btnText.style.display = 'inline-block';
        spinner.style.display = 'none';
    }
}

// --- NEW: Dedicated function for API communication ---
async function loginUser(email, password) {
    // Clear any existing auth data before login attempt
    localStorage.removeItem('authToken');
    localStorage.removeItem('userProfile');

    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    console.log('[Login] Server Response:', { 
        status: response.status, 
        ok: response.ok, 
        hasToken: !!result.token,
        hasUser: !!result.user
    });

    if (!response.ok) {
        throw new Error(result.message || 'فشل تسجيل الدخول.');
    }

    if (!result.token) {
        throw new Error('لم يتم استلام رمز المصادقة من الخادم.');
    }

    // Store the token first
    localStorage.setItem('authToken', result.token);

    // Store initial user data from login response
    if (result.user) {
        localStorage.setItem('userProfile', JSON.stringify({
            ...result.user,
            _id: result.user._id,
            userId: result.user._id
        }));
    }

    // Verify token by fetching profile
    const profileResponse = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${result.token}` }
    });

    if (!profileResponse.ok) {
        throw new Error('تم تسجيل الدخول ولكن فشل جلب بيانات الملف الشخصي.');
    }

    const userProfile = await profileResponse.json();
    localStorage.setItem('userProfile', JSON.stringify(userProfile));

    // Return the profile so the caller can use it if needed
    return userProfile;
}

function showLoginError(message) {
    const errorMessageEl = document.getElementById('error-message');
    errorMessageEl.textContent = message;
    errorMessageEl.className = 'error-message visible';
}

function showLoginMessage(message, type = 'info') {
    const messageEl = document.getElementById('error-message');
    messageEl.textContent = message;
    messageEl.className = `error-message visible ${type}`;
}

function displayUrlErrors() {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const message = params.get('message');

    if (error && message) {
        showLoginError(message);
        // Clean the URL to avoid showing the message on refresh
        window.history.replaceState({}, document.title, "/login.html");
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Apply theme from localStorage
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // NEW: Check if user is already logged in
    const token = localStorage.getItem('authToken');
    if (token) {
        window.location.replace('/'); // Redirect to home page if already logged in
        return;
    }

    displayUrlErrors();
    setupEventListeners();
});