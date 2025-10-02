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

// NEW: Apply theme from localStorage on page load for login page
function applyLoginTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

// NEW: Function to create floating particles for the login background
function createLoginFloatingParticles() {
    const container = document.getElementById('login-animated-bg');
    if (!container) return;
    const numParticles = 500;
    const colors = ['color-1', 'color-2', 'color-3'];
    for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 3 + 1;
        particle.classList.add(colors[Math.floor(Math.random() * colors.length)]);
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 20}s`;
        particle.style.animationDuration = `${Math.random() * 15 + 10}s`;
        container.appendChild(particle);
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

document.addEventListener('DOMContentLoaded', async () => {
    applyLoginTheme(); // Apply theme first
    const isInitialized = await initializeSupabase();
    if (!isInitialized) return;

    // If user is already logged in, redirect to main app
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.replace('/'); // Use replace to avoid back button issues
        return;
    }
    createLoginFloatingParticles(); // Create animated background particles

    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const spinner = loginBtn.querySelector('.fa-spinner');
    const errorMessage = document.getElementById('error-message');
    const passwordInput = document.getElementById('password');
    const emailInput = document.getElementById('email');
    const rememberMeCheckbox = document.getElementById('remember-me');

    // Populate email from localStorage if "Remember Me" was checked
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
        emailInput.value = savedEmail;
        rememberMeCheckbox.checked = true;
    }

    // NEW: Add eye icon and event listener for password toggle
    const passwordWrapper = document.createElement('div');
    passwordWrapper.className = 'password-wrapper';
    passwordInput.parentNode.insertBefore(passwordWrapper, passwordInput);
    passwordWrapper.appendChild(passwordInput);
    const eyeIcon = document.createElement('i');
    eyeIcon.className = 'eye-icon fa-solid fa-eye-slash'; // Using Font Awesome
    passwordWrapper.appendChild(eyeIcon);
    eyeIcon.addEventListener('click', togglePasswordVisibility);

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.textContent = '';
        loginBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.style.display = 'inline-block';

        const email = emailInput.value.trim();
        const password = document.getElementById('password').value;

        // --- NEW: Basic client-side validation ---
        if (!email || !password) {
            errorMessage.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.';
            loginBtn.disabled = false;
            btnText.style.display = 'inline-block';
            spinner.style.display = 'none';
            document.getElementById('email').focus();
            return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            errorMessage.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.';
        } else {
            // NEW: Check user status before redirecting
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('status')
                .eq('id', data.user.id)
                .single();

            if (profileError || profile?.status === 'inactive') {
                errorMessage.textContent = 'تم تعطيل حسابك. يرجى التواصل مع المدير.';
                await supabase.auth.signOut(); // Log the user out immediately
            } else {
                // Handle "Remember Me" functionality
                if (rememberMeCheckbox.checked) {
                    localStorage.setItem('rememberedEmail', email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }
                // On successful login and active status, redirect to the main page
                window.location.replace('/');
            }
        }

        loginBtn.disabled = false;
        btnText.style.display = 'inline-block';
        spinner.style.display = 'none';
    });
});