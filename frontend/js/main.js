// 1. Global variables
let searchTimeout;
let currentUserProfile = null; // NEW: To store the current user's profile with role
window.onlineUsers = new Map(); // NEW: Global map to track online users
window.appContent = null; // NEW: Make appContent globally accessible

// --- NEW: Global Error Catcher ---
// This will catch any unhandled errors on the page and send them to the backend for logging.
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

// --- NEW: Centralized helper function for authenticated API calls ---
async function authedFetch(url, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = new Headers(options.headers || {});

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers });

    // Handle token expiration/invalidation globally
    if (response.status === 401 && !url.includes('/api/auth/login')) {
        console.warn('[AUTH] Token is invalid or expired. Redirecting to login.');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userProfile');
        window.location.replace('/login.html');
        // Throw an error to stop further execution in the calling function
        throw new Error('Unauthorized');
    }

    return response;
}

// Helper function to update the visual status indicator
function updateStatus(status, message) {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;
    statusElement.className = 'status-bar'; // Reset classes
    const lastCheckTime = document.getElementById('last-check-time'); // إصلاح: تعريف المتغير
    statusElement.classList.add('status-' + status);

    // Update timestamp
    const time = new Date().toLocaleTimeString('ar-EG');
    lastCheckTime.textContent = `آخر فحص: ${time}`;
}


// NEW: Helper function to format numbers with commas
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * NEW: Global helper to update a single countdown timer element.
 * @param {HTMLElement} el The element containing the data-end-date attribute.
 */
function updateCountdownTimer(el) {
    const endDateStr = el.dataset.endDate;
    if (!endDateStr) {
        el.innerHTML = ''; // Clear if no date
        return;
    }

    const endDate = new Date(endDateStr);
    const diffTime = endDate.getTime() - Date.now();

    if (diffTime <= 0) {
        el.innerHTML = `<i class="fas fa-hourglass-end"></i> <span>في انتظار المعالجة...</span>`;
        el.classList.add('expired');
    } else {
        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

        let parts = [];
        if (days > 0) parts.push(`${days} يوم`);
        if (hours > 0) parts.push(`${hours} ساعة`);
        if (minutes > 0 && days === 0) parts.push(`${minutes} دقيقة`); // Show minutes only if less than a day

        if (parts.length === 0 && diffTime > 0) {
            parts.push('أقل من دقيقة');
        }
        el.innerHTML = `<i class="fas fa-hourglass-half"></i> <span>متبقي: ${parts.join(' و ')}</span>`;
    }
}

// NEW: Function to fetch and store the current user's profile
async function fetchUserProfile() {
    try {
        // Use the /me endpoint to get the current user's profile
        const response = await authedFetch('/api/auth/me');
        if (!response.ok) {
            // If token is invalid/expired, server will return 401
            throw new Error(`Authentication check failed with status: ${response.status}`);
        }
        currentUserProfile = await response.json();
        localStorage.setItem('userProfile', JSON.stringify(currentUserProfile)); // Cache the profile
        return currentUserProfile;
    } catch (error) {
        // --- تعديل: إضافة سجل واضح لسبب إعادة التوجيه ---
        console.error(`%c[AUTH-FAIL] Could not fetch user profile. Reason: ${error.message}`, 'color: red; font-weight: bold;');
        return null;
    }
}

// --- NEW: Function to update UI elements after successful login ---
function updateUIAfterLogin(user) {
    if (!user) return;

    // --- DEBUG: Log the user profile being used to update the UI ---
    console.log(
        `%c[UI Update] Updating interface for user: "${user.full_name}" with role: "${user.role}"`,
        'color: #28a745; font-weight: bold; border: 1px solid #28a745; padding: 2px 5px; border-radius: 3px;'
    );

    const settingsMenu = document.getElementById('settings-menu');
    const userNameDisplay = document.getElementById('user-name');
    const userEmailDisplay = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');
    const usersNavItem = document.getElementById('nav-users');
    const activityLogNavItem = document.getElementById('nav-activity-log');

    if (settingsMenu) settingsMenu.style.display = 'block';
    if (userNameDisplay) userNameDisplay.textContent = user.full_name;
    if (userEmailDisplay) userEmailDisplay.textContent = user.email;
    if (userAvatar) {
        userAvatar.src = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=random`;
    }

    // --- MODIFICATION: Show activity log link only to admins and super admins ---
    if (activityLogNavItem) {
        const canViewLogs = user.role === 'super_admin' || user.role === 'admin';
        activityLogNavItem.style.display = canViewLogs ? 'block' : 'none';
    }

    // Show admin-only links if the user is a super_admin or admin
    // --- MODIFICATION: Allow admins to see the users link as well ---
    if (usersNavItem && (user.role === 'super_admin' || user.role === 'admin')) {
        usersNavItem.style.display = 'block';
    }
}
// NEW: Router function to handle page navigation based on URL hash
async function handleRouting() {
    showLoader(); // إضافة: إظهار شاشة التحميل في بداية كل عملية تنقل
    // Scroll to the top of the page on every navigation
    window.scrollTo(0, 0);

    const hash = window.location.hash || '#home'; // Default to home
    const mainElement = document.querySelector('main');
    window.appContent = document.getElementById('app-content'); // Assign to global
    mainElement.classList.add('page-loading');

    // Reset layout classes
    mainElement.classList.remove('full-width');
    appContent.classList.remove('full-height-content');

    let renderFunction;
    let navElement;

    // Basic routing
    const routes = {
        '#home': { func: renderHomePage, nav: 'nav-home' }, // This should be a class instance call in the future
        '#tasks': { 
            func: async () => {
                if (window.currentTasksPageInstance) window.currentTasksPageInstance.destroy();
                window.currentTasksPageInstance = new TasksPage(window.appContent);
                await window.currentTasksPageInstance.render();
            }, 
            nav: 'nav-tasks' 
        },
        '#add-agent': { func: renderAddAgentForm, nav: null }, // إصلاح: إضافة المسار المفقود
        '#top-agents': { func: renderTopAgentsPage, nav: 'nav-top-agents' }, // NEW: Top Agents page
        '#manage-agents': { func: renderManageAgentsPage, nav: 'nav-manage-agents', adminOnly: false },
        '#competitions/edit': { func: () => {}, nav: 'nav-manage-competitions' }, // Placeholder: Actual function is in competitions.js
        '#competitions': { func: renderCompetitionsPage, nav: 'nav-manage-competitions' },
        '#archived-competitions': { func: renderCompetitionsPage, nav: 'nav-archived-competitions' },
        '#competition-templates': { func: renderCompetitionTemplatesPage, nav: 'nav-competition-templates' },
        '#archived-templates': { func: renderArchivedTemplatesPage, nav: 'nav-competition-templates' }, // Corrected nav item
        '#users': { func: renderUsersPage, nav: 'nav-users', adminOnly: true },
        '#profile-settings': { func: renderProfileSettingsPage, nav: null }, // NEW: Profile settings page
        '#calendar': { func: renderCalendarPage, nav: 'nav-calendar' },'#activity-log': { func: renderActivityLogPage, nav: 'nav-activity-log' }
    };

    const routeKey = hash.split('/')[0].split('?')[0]; // Get base route e.g., #profile from #profile/123 or #competitions from #competitions/new?agentId=1
    const route = routes[routeKey] || routes['#home'];

    renderFunction = route.func;
    navElement = document.getElementById(route.nav);

    // Special handling for routes with parameters
    if (hash.startsWith('#profile/')) {
        const agentId = hash.split('/')[1];
        if (agentId) {
            if (typeof renderAgentProfilePage !== 'undefined') {
                renderFunction = () => renderAgentProfilePage(agentId);
            }
            navElement = null; // No nav item is active on a profile page
        }
    } else if (hash.startsWith('#competitions/edit/')) {
        const competitionId = hash.split('/')[2];
        if (competitionId) {
            renderFunction = () => renderCompetitionEditForm(competitionId);
            navElement = document.getElementById('nav-manage-competitions');
        }
    } else {
        // If we are navigating away from a profile page, stop its countdown timer.
        if (typeof stopRenewalCountdown === 'function') {
            stopRenewalCountdown();
        }
        if (typeof stopCompetitionCountdowns === 'function') {
            stopCompetitionCountdowns();
        }
    }

    if (hash.startsWith('#profile/') || hash.startsWith('#competitions/new') || hash.startsWith('#competitions/manage') || hash === '#home' || hash === '#competition-templates' || hash === '#archived-templates' || hash === '#competitions' || hash === '#manage-agents' || hash === '#activity-log' || hash === '#archived-competitions' || hash === '#users' || hash === '#top-agents') {
        mainElement.classList.add('full-width');
    } else if (hash === '#calendar') {
        mainElement.classList.add('full-width');
        appContent.classList.add('full-height-content');
    }

    setActiveNav(navElement);

    try {
        if (renderFunction) {
            await renderFunction();
            mainElement.classList.remove('page-loading');
        }
    } catch (err) {
        console.error("Routing error:", err);
    } finally {
        hideLoader();
    }
}

// --- إصلاح: إضافة الدالة المفقودة ---
function setActiveNav(activeElement) {
    // إزالة 'active' من جميع الروابط
    document.querySelectorAll('.nav-link, .dropdown-item').forEach(link => {
        link.classList.remove('active');
    });

    if (activeElement) {
        activeElement.classList.add('active');
        // إذا كان الرابط داخل قائمة منسدلة، قم بتحديد القائمة الرئيسية أيضاً
        const parentDropdown = activeElement.closest('.dropdown');
        parentDropdown?.querySelector('.dropdown-toggle')?.classList.add('active');
    }
}

async function logAgentActivity(userId, agentId, actionType, description, metadata = {}) {
    // This function will be reimplemented later using our own backend.
    console.log(`[FRONTEND LOG] ➡️ محاولة تسجيل نشاط: ${actionType} (Agent: ${agentId || 'N/A'})`);
    try {
        const payload = {
            user_id: userId || currentUserProfile?._id, // Default to current user if not provided
            action_type: actionType,
            description,
            metadata
        };

        // Only add agent_id to the payload if it's a valid, non-null value.
        if (agentId) {
            payload.agent_id = agentId;
        }

        const response = await authedFetch('/api/logs', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        console.log(`[FRONTEND LOG] ✅ تم إرسال النشاط بنجاح إلى الخادم.`);
    } catch (error) {
        console.error(`[FRONTEND LOG] ❌ فشل إرسال النشاط إلى الخادم:`, error);
    }
}

/**
 * NEW: Verifies that the agent's stored Telegram chat ID and group name match the actual data on Telegram.
 * @param {object} agent The agent object containing telegram_chat_id and telegram_group_name.
 * @returns {Promise<{verified: boolean, message: string}>} An object indicating if verification passed.
 */
async function verifyTelegramChat(agent) {
    if (!agent.telegram_chat_id) {
        const message = 'لا يمكن الإرسال. معرف دردشة التلجرام غير مسجل لهذا الوكيل.';
        showToast(message, 'error');
        return { verified: false, message };
    }
    if (!agent.telegram_group_name) {
        const message = 'لا يمكن الإرسال. اسم مجموعة التلجرام غير مسجل لهذا الوكيل.';
        showToast(message, 'error');
        return { verified: false, message };
    }

    try {
        showToast('جاري التحقق من تطابق بيانات مجموعة التلجرام...', 'info');
        const response = await authedFetch(`/api/get-chat-info?chatId=${agent.telegram_chat_id}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.message || 'فشل التحقق من بيانات مجموعة التلجرام.');

        const actualGroupName = data.title;
        if (actualGroupName.trim() !== agent.telegram_group_name.trim()) {
            const errorMessage = `<b>خطأ في التحقق:</b> اسم المجموعة المسجل (<b>${agent.telegram_group_name}</b>) لا يطابق الاسم الفعلي (<b>${actualGroupName}</b>). يرجى تصحيح البيانات.`;
            showToast(errorMessage, 'error');
            return { verified: false, message: errorMessage };
        }
        return { verified: true, message: 'تم التحقق من المجموعة بنجاح.' };
    } catch (error) {
        showToast(`فشل التحقق من المجموعة: ${error.message}`, 'error');
        return { verified: false, message: error.message };
    }
}

// 2. Function to initialize the application session
async function initializeApp() {
    updateStatus('connected', 'متصل وجاهز');
    showLoader(); // إظهار شاشة التحميل هنا لضمان تغطية عملية التحقق الأولية

    // ARCHITECTURAL FIX: Wait for the central store to be ready before proceeding.
    await new Promise(resolve => {
        window.addEventListener('storeReady', resolve, { once: true });
    });

    const userProfile = await fetchUserProfile();
    if (userProfile) {
        window.addEventListener('hashchange', handleRouting);
        updateUIAfterLogin(userProfile); // FIX: Pass the fetched user profile to the UI update function
        handleRouting(); // Initial route handling
    } else {
        // --- تعديل: التعامل مع فشل المصادقة الأولية ---
        // إذا فشل جلب ملف المستخدم، فهذا يعني وجود مشكلة في الخادم أو الاتصال بقاعدة البيانات
        hideLoader(); // إخفاء شاشة التحميل
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = `
                <div class="error-page-container">
                    <i class="fas fa-server fa-3x"></i>
                    <h1>خطأ في الاتصال بالخادم</h1>
                    <p>لا يمكن الوصول إلى بيانات المستخدم. قد يكون الخادم متوقفاً أو هناك مشكلة في الاتصال بقاعدة البيانات.</p>
                    <p><strong>الحل المقترح:</strong> يرجى مراجعة مسؤول النظام والتأكد من أن الخادم يعمل بشكل صحيح وأن رابط قاعدة البيانات (MONGODB_URI) في ملف <code>.env</code> صحيح.</p>
                    <button onclick="location.reload()" class="btn-primary">إعادة المحاولة</button>
                </div>
            `;
        }
    }
}

/**
 * NEW: Sets up a listener for real-time messages from the server (e.g., via WebSocket).
 */
function setupRealtimeListeners() {
    const protocol = window.location.protocol === 'https' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}`;
    let ws;

    function connect() {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[WebSocket] Connected to server.');
            const token = localStorage.getItem('authToken');
            if (token) {
                ws.send(JSON.stringify({ type: 'auth', token }));
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                switch (message.type) {
                    case 'agent_renewed':
                        showToast(`تم تجديد رصيد الوكيل ${message.data.agentName} تلقائياً.`, 'success');
                        break;
                    case 'presence_update':
                        // message.data should be an array of online user IDs
                        if (Array.isArray(message.data)) {
                            window.onlineUsers.clear();
                            message.data.forEach(userId => window.onlineUsers.set(userId, true));
                            // Dispatch a global event that the user list can listen to
                            window.dispatchEvent(new CustomEvent('presence-update'));
                        }
                        break;
                    // Add other message types here
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        ws.onclose = () => {
            console.log('[WebSocket] Disconnected. Attempting to reconnect in 5 seconds...');
            setTimeout(connect, 5000); // Attempt to reconnect after 5 seconds
        };

        ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
            ws.close();
        };
    }

    connect();
}

// --- UI Component Functions (Moved from script.js to main.js) ---

function showLoader() {
    document.getElementById('page-loader')?.classList.add('show');
}

function hideLoader() {
    document.getElementById('page-loader')?.classList.remove('show');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconClass = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
    toast.innerHTML = `<i class="fas ${iconClass}"></i> ${message}`;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000); // Remove after 5 seconds
}

function showConfirmationModal(message, onConfirm, options = {}) {
    const {
        title = null,
        confirmText = 'تأكيد',
        cancelText = 'إلغاء',
        confirmClass = 'btn-primary',
        showCancel = true,
        modalClass = '',
        onRender = null
    } = options;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = `modal ${modalClass}`;
    modal.innerHTML = `
        ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
        <div class="modal-message">${message}</div>
        <div class="modal-actions">
            <button id="confirm-btn" class="${confirmClass}">${confirmText}</button>
            ${showCancel ? `<button id="cancel-btn" class="btn-secondary">${cancelText}</button>` : ''}
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('confirm-btn').onclick = () => {
        // FIX: Execute the callback *before* removing the modal.
        // This ensures that any inputs inside the modal are still accessible to the callback.
        if (onConfirm) onConfirm();
        overlay.remove(); // Now remove the modal.
    };
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => overlay.remove();

    if (onRender) onRender(modal);
}

// --- NEW: Dedicated function for progress modals ---
function showProgressModal(title, content) {
    const existingOverlay = document.querySelector('.modal-overlay');
    if (existingOverlay) {
        console.warn('[showProgressModal] A modal is already open. Removing it.');
        existingOverlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal modal-no-actions'; // Use the class for modals without buttons
    modal.innerHTML = `
        ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
        <div class="modal-message">${content}</div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    console.log('[showProgressModal] Progress modal has been appended to the body.');

    return overlay; // Return the overlay so it can be closed later
}

function setupAutoHidingNavbar() {
    let lastScrollTop = 0;
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    window.addEventListener('scroll', () => {
        // We use pageYOffset for broader browser support
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Add a small threshold (e.g., 10px) to prevent hiding on minor scrolls
        if (scrollTop > lastScrollTop && scrollTop > navbar.offsetHeight) {
            // Scrolling Down
            navbar.classList.add('navbar-hidden');
        } else {
            // Scrolling Up
            navbar.classList.remove('navbar-hidden');
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // For Mobile or negative scrolling
    }, { passive: true }); // Use passive listener for better scroll performance
}
// --- New Functions for UI Enhancements ---

// --- NEW: Function to create floating particles for the main app background ---
function createFloatingParticles() {
    const container = document.getElementById('main-animated-bg');
    if (!container) return;
    // Reduce particle count for better performance inside the app
    const numParticles = 150; 
    const colors = ['color-1', 'color-2', 'color-3'];
    for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 2 + 1; // Smaller particles
        particle.classList.add(colors[Math.floor(Math.random() * colors.length)]);
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        // Slower and longer animations
        particle.style.animationDelay = `${Math.random() * 30}s`;
        particle.style.animationDuration = `${Math.random() * 20 + 15}s`;
        container.appendChild(particle);
    }
}

// Apply theme from localStorage on page load
function applyInitialTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

// Setup listeners and dynamic content for the navbar
function setupNavbar() {
    // NEW: Dark Mode Toggle Logic from dropdown
    const themeToggleHandler = (e) => {
        e.preventDefault(); // Prevent navigation
        if (document.body.classList.contains('dark-mode')) {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        }
    };
    const themeBtnDropdown = document.getElementById('theme-toggle-btn-dropdown');
    if (themeBtnDropdown) themeBtnDropdown.addEventListener('click', themeToggleHandler);

    // Logout Button Logic
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showConfirmationModal('هل أنت متأكد من رغبتك في تسجيل الخروج؟', async () => {
                try {
                    // استدعاء الواجهة الخلفية لتسجيل الخروج (للتوافقية المستقبلية)
                    await authedFetch('/api/auth/logout', { method: 'POST' });
                } catch (error) {
                    console.warn('Logout API call failed, but proceeding with client-side logout.', error);
                }
                localStorage.removeItem('authToken');
                localStorage.removeItem('userProfile');
                window.location.replace('/login.html');
            }, { title: 'تأكيد تسجيل الخروج' });
        });
    }

    // Date Display
    const dateDisplay = document.getElementById('date-display');
    const today = new Date();
    // Using 'ar-EG' for Arabic-Egypt locale for date formatting
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.textContent = today.toLocaleDateString('ar-EG', options);

    // Placeholder for search functionality
    const searchInput = document.getElementById('main-search-input');
    const mainSearchClearBtn = document.getElementById('main-search-clear');

    searchInput.addEventListener('input', () => {
        if (mainSearchClearBtn) {
            mainSearchClearBtn.style.display = searchInput.value ? 'block' : 'none';
        }

        clearTimeout(searchTimeout);
        const searchTerm = searchInput.value.trim();
        const searchResultsContainer = document.getElementById('search-results');

        if (searchTerm.length < 2) { // Don't search for less than 2 characters
            searchResultsContainer.classList.remove('visible');
            return;
        }

        searchTimeout = setTimeout(async () => {
            // TODO: Replace this with a call to our own backend search endpoint
            const response = await authedFetch(`/api/agents?search=${searchTerm}&limit=5`);
            const { data: agents, error } = await response.json();

            if (error) {
                console.error('Search error:', error);
                return;
            }

            if (agents.length > 0) {
                searchResultsContainer.innerHTML = agents.map(agent => {
                    const avatarHtml = agent.avatar_url
                        ? `<img src="${agent.avatar_url}" alt="Avatar" class="search-result-avatar">`
                        : `<div class="search-result-avatar-placeholder"><i class="fas fa-user"></i></div>`;
                    return `
                    <div class="search-result-item" data-agent-id="${agent._id}">
                        ${avatarHtml}
                        <div class="search-result-info">
                            <p class="agent-name">${agent.name}</p>
                            <p class="agent-id">#${agent.agent_id}</p>
                        </div>
                        <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                    </div>
                `}).join('');
                searchResultsContainer.classList.add('visible');

                // Add click listeners to new items
                searchResultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        const agentId = item.dataset.agentId;
                        // Use the router for navigation
                        window.location.hash = `profile/${agentId}`;
                        searchResultsContainer.classList.remove('visible');
                        searchInput.value = '';
                        if (mainSearchClearBtn) mainSearchClearBtn.style.display = 'none';
                    });
                });
            } else {
                searchResultsContainer.innerHTML = '<div class="search-result-item" style="cursor: default;">لا توجد نتائج</div>';
                searchResultsContainer.classList.add('visible');
            }
        }, 300); // 300ms debounce
    });

    if (mainSearchClearBtn) {
        mainSearchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            document.getElementById('search-results').classList.remove('visible');
            mainSearchClearBtn.style.display = 'none';
            searchInput.focus();
        });
    }


    // Navigation Logic
    const navHome = document.getElementById('nav-home');
    const navTasks = document.getElementById('nav-tasks');
    const navManageAgents = document.getElementById('nav-manage-agents');
    const navTopAgents = document.getElementById('nav-top-agents'); // NEW
    const navManageCompetitions = document.getElementById('nav-manage-competitions');
    const navArchivedCompetitions = document.getElementById('nav-archived-competitions');
    const competitionsDropdown = document.getElementById('nav-competitions-dropdown');
    const navCompetitionTemplates = document.getElementById('nav-competition-templates');
    const navArchivedTemplates = document.getElementById('nav-archived-templates');
    const navCalendar = document.getElementById('nav-calendar');
    const navActivityLog = document.getElementById('nav-activity-log');
    const navUsers = document.getElementById('nav-users'); // NEW
    const navProfileSettings = document.getElementById('nav-profile-settings'); // This is a dropdown item

    navLinks = [navHome, navTasks, navManageAgents, navTopAgents, navManageCompetitions, navArchivedCompetitions, navCompetitionTemplates, navCalendar, navUsers, navProfileSettings, navActivityLog, document.getElementById('logout-btn')];
    
    // NEW: Navigation listeners update the hash, which triggers the router
    if (navHome) navHome.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'home'; });
    if (navTasks) navTasks.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'tasks'; });
    if (navTopAgents) navTopAgents.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'top-agents'; });
    if (navManageAgents) navManageAgents.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'manage-agents'; });
    if (navProfileSettings) navProfileSettings.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'profile-settings'; }); // NEW
    if (navManageCompetitions) navManageCompetitions.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#competitions'; });
    if (navArchivedCompetitions) navArchivedCompetitions.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'archived-competitions'; });
    if (navArchivedTemplates) navArchivedTemplates.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'archived-templates'; });
    if (navCompetitionTemplates) navCompetitionTemplates.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'competition-templates'; });
    if (navActivityLog) navActivityLog.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'activity-log'; });
    if (navUsers) navUsers.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'users'; }); // NEW

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        const searchContainer = e.target.closest('.search-container');
        const userDropdownContainer = e.target.closest('.nav-item.dropdown');

        if (!searchContainer) {
            document.getElementById('search-results').classList.remove('visible');
        }

    });    

    // NEW: Prevent settings dropdown toggle from navigating
    const settingsToggle = document.getElementById('nav-settings-dropdown');
    if (settingsToggle) {
        settingsToggle.addEventListener('click', (e) => {
            e.preventDefault(); // يمنع الرابط من تغيير الـ hash والانتقال للصفحة الرئيسية
        });
    }
}

function renderAddUserForm() {
    const isSuperAdmin = currentUserProfile && currentUserProfile.role === 'super_admin';

    const formHtml = `
        <form id="add-user-form" class="styled-form">
            <div class="form-group">
                <label for="full_name">الاسم الكامل</label>
                <input type="text" id="full_name" name="full_name" required>
            </div>
            <div class="form-group">
                <label for="email">البريد الإلكتروني</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
                <label for="password">كلمة المرور</label>
                <input type="password" id="password" name="password" required>
            </div>
            ${isSuperAdmin ? `
                <div class="form-group">
                    <label for="role">الدور</label>
                    <select id="role" name="role"><option value="employee">موظف</option><option value="admin">مسؤول</option></select>
                </div>
            ` : '<input type="hidden" id="role" name="role" value="employee">'}
        </form>
    `;

    showConfirmationModal(formHtml, () => {
        const form = document.getElementById('add-user-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Handle user creation logic here
        console.log('Creating user with data:', data);

    }, {
        title: 'إضافة موظف جديد',
        confirmText: 'إنشاء',
        cancelText: 'إلغاء'
    });
}

// Main entry point when the page loads
document.addEventListener('DOMContentLoaded', () => {
    applyInitialTheme();
    setupNavbar();
    setupAutoHidingNavbar();
    initializeApp();
    // NEW: Initialize the real-time listener. This function needs to be
    // implemented with your actual WebSocket logic.
    setupRealtimeListeners();
    createFloatingParticles(); // --- NEW: Add animated background to the main app ---

    // --- NEW: Listen for browser online/offline events ---
    window.addEventListener('offline', () => {
        updateStatus('error', 'غير متصل. تحقق من اتصالك بالإنترنت.');
    });

    window.addEventListener('online', () => {
        updateStatus('connecting', 'تم استعادة الاتصال. جاري إعادة المزامنة...');
        // Attempt to re-initialize the session
        initializeApp();
    });
});
