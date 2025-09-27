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

document.addEventListener('DOMContentLoaded', async () => {
    const isInitialized = await initializeSupabase();
    if (!isInitialized) return;

    // If user is already logged in, redirect to main app
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.replace('/'); // Use replace to avoid back button issues
        return;
    }

    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const spinner = loginBtn.querySelector('.fa-spinner');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.textContent = '';
        loginBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.style.display = 'inline-block';

        const email = document.getElementById('email').value;
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
                // On successful login and active status, redirect to the main page
                window.location.replace('/');
            }
        }

        loginBtn.disabled = false;
        btnText.style.display = 'inline-block';
        spinner.style.display = 'none';
    });
});