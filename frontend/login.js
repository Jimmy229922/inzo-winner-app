let supabase = null;

async function initializeSupabase() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to fetch config');
        const config = await response.json();
        if (!config.supabaseUrl || !config.supabaseKey) throw new Error('Supabase config missing');
        supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
        return true;
    } catch (error) {
        console.error('Initialization failed:', error);
        const errorMsg = document.getElementById('error-message');
        if (errorMsg) {
            errorMsg.textContent = 'خطأ في الاتصال بالخادم.';
        }
        return false;
    }
}

// NEW: Toggle password visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.querySelector('.eye-icon');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.add('fa-eye');
        eyeIcon.classList.remove('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.add('fa-eye-slash');
        eyeIcon.classList.remove('fa-eye');
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
        emailInput.focus();
        return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        showLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    } else {
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('status')
            .eq('id', data.user.id)
            .single();

        if (profileError || profile?.status === 'inactive') {
            showLoginError('تم تعطيل حسابك. يرجى التواصل مع المدير.');
            await supabase.auth.signOut();
        } else {
            if (rememberMeCheckbox.checked) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }
            window.location.replace('/');
        }
    }

    loginBtn.disabled = false;
    btnText.style.display = 'inline-block';
    spinner.style.display = 'none';
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

    const isInitialized = await initializeSupabase();
    if (!isInitialized) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.replace('/');
        return;
    }

    displayUrlErrors();
    setupEventListeners();
});