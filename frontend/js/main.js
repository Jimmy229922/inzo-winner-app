// 1. Global variables
let searchTimeout;
let currentUserProfile = null; // NEW: To store the current user's profile with role
window.onlineUsers = new Map(); // NEW: Global map to track online users
window.appContent = null; // NEW: Make appContent globally accessible
let winnerRouletteFallbackInitialized = false; // Ensure we only wire the roulette page once when the module fails

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

// --- Use the shared utility for authenticated API calls ---
window.authedFetch = window.utils.authedFetch;

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

    // NEW: Show Question Suggestions links for all users
    // جميع المستخدمين (موظف، أدمن، سوبر أدمن) يمكنهم رؤية جميع الاقتراحات
    const navQuestionsDropdownContainer = document.getElementById('nav-questions-dropdown-container');
    const navAdminQuestionSuggestions = document.getElementById('nav-admin-question-suggestions');
    
    if (navQuestionsDropdownContainer) {
        navQuestionsDropdownContainer.style.display = 'block'; // Show dropdown for all users
    }
    
    if (navAdminQuestionSuggestions) {
        navAdminQuestionSuggestions.style.display = 'block'; // Show for all authenticated users
    }

    // NEW: Show Tasks & Calendar dropdown for all users (employees, admins, and super admins)
    const navTasksCalendarDropdownContainer = document.getElementById('nav-tasks-calendar-dropdown-container');
    if (navTasksCalendarDropdownContainer) {
        navTasksCalendarDropdownContainer.style.display = 'block'; // Show for all authenticated users
    }

    // Load global unread suggestions counter for all roles (Super Admin & Employees)
    if (currentUserProfile) {
        loadGlobalUnreadCount();
        // Live polling every 30 seconds
        if (!window._globalUnreadInterval) {
            window._globalUnreadInterval = setInterval(loadGlobalUnreadCount, 30000);
        }
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
        '#calendar': { func: renderCalendarPage, nav: 'nav-calendar' },
        '#activity-log': { func: renderActivityLogPage, nav: 'nav-activity-log' },
        '#analytics': { func: renderAnalyticsPage, nav: 'nav-analytics' },
        '#admin-suggestions': { func: renderAdminSuggestionsPage, nav: 'nav-admin-question-suggestions' },
        '#statistics': { func: renderStatisticsPage, nav: 'nav-statistics' },
        '#winner-roulette': { func: renderWinnerRoulettePage, nav: 'nav-winner-roulette' }
    };

    const routeKey = hash.split('/')[0].split('?')[0]; // Get base route e.g., #profile from #profile/123 or #competitions from #competitions/new?agentId=1
    const route = routes[routeKey] || routes['#home'];

    // Special layout for specific pages
    if (routeKey === '#winner-roulette') {
        appContent.classList.add('full-height-content');
        mainElement.classList.add('full-width');
    }

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

    if (hash.startsWith('#profile/') || hash.startsWith('#competitions/new') || hash.startsWith('#competitions/manage') || hash === '#home' || hash === '#competition-templates' || hash === '#archived-templates' || hash === '#competitions' || hash === '#manage-agents' || hash === '#activity-log' || hash === '#archived-competitions' || hash === '#users' || hash === '#top-agents' || hash === '#analytics' || hash === '#statistics' || hash === '#winner-roulette') {
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

// ==========================
// Admin Suggestions Page Loader
// ==========================
async function renderAdminSuggestionsPage() {
    if (!window.appContent) {
        console.error('app-content element not found!');
        return;
    }
    try {
        const response = await fetch('/pages/admin-question-suggestions.html');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        window.appContent.innerHTML = html;

        // Dynamically import and initialize the admin suggestions page script
        try {
            const adminModule = await import('/js/pages/admin-question-suggestions.js');
            if (adminModule && typeof adminModule.initAdminQuestionSuggestions === 'function') {
                // Ensure DOM is ready before init
                setTimeout(() => {
                    adminModule.initAdminQuestionSuggestions();
                }, 0);
            } else {
                console.warn('Admin suggestions initialization function not found, attempting fallback');
                // Fallback: if module exports default or different name
                if (adminModule && typeof adminModule.init === 'function') {
                    setTimeout(() => adminModule.init(), 0);
                }
            }
        } catch (e) {
            throw e;
        }
    } catch (error) {
        console.error('Failed to load admin suggestions page:', error);
        window.appContent.innerHTML = `<p class="error-message">فشل تحميل صفحة جميع الاقتراحات: ${error.message}</p>`;
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
    // console.log(`[FRONTEND LOG] ➡️ محاولة تسجيل نشاط: ${actionType} (Agent: ${agentId || 'N/A'})`);
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
        // console.log(`[FRONTEND LOG] ✅ تم إرسال النشاط بنجاح إلى الخادم.`);
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
    // NEW: Graceful degradation – allow skipping Telegram verification locally or if bot disabled.
    const skipReason = [];
    if (!agent.telegram_chat_id) skipReason.push('معرف الدردشة غير متوفر');
    if (!agent.telegram_group_name) skipReason.push('اسم المجموعة غير متوفر');

    // If essential fields missing, warn but do NOT block competition creation.
    if (skipReason.length) {
        showToast(`تخطي تحقق تلجرام: ${skipReason.join('، ')}`,'warning');
        return { verified: true, message: 'SKIPPED_MISSING_FIELDS' };
    }

    try {
        showToast('جاري التحقق من تطابق بيانات مجموعة التلجرام...','info');
        const response = await authedFetch(`/api/get-chat-info?chatId=${agent.telegram_chat_id}`);
        let data = {};
        try { data = await response.json(); } catch {}

        // If backend returns non-OK but we are in dev or bot disabled, treat as soft failure.
        if (!response.ok) {
            const msg = data.message || 'تعذر الوصول إلى خدمة تلجرام، تم التخطي.';
            showToast(msg,'warning');
            return { verified: true, message: 'SKIPPED_BACKEND_ERROR' };
        }

        const actualGroupName = (data.title || '').trim();
        const expectedName = (agent.telegram_group_name || '').trim();
        if (actualGroupName && expectedName && actualGroupName !== expectedName) {
            // Instead of blocking, just warn and continue.
            const warnMsg = `اسم المجموعة المسجل لا يطابق الفعلي (المسجل: ${expectedName} / الفعلي: ${actualGroupName}) – متابعة مع تحذير.`;
            showToast(warnMsg,'warning');
            return { verified: true, message: 'NAME_MISMATCH_WARN' };
        }
        return { verified: true, message: 'VERIFIED_OR_MATCHED' };
    } catch (error) {
        // Network / fetch error – warn and continue.
        showToast(`تخطي تحقق تلجرام بسبب خطأ: ${error.message}`,'warning');
        return { verified: true, message: 'SKIPPED_EXCEPTION' };
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
        // User is not authenticated (no token or invalid token) — redirect to login
        hideLoader();
        console.warn('[AUTH] No valid user session. Redirecting to login page.');
        window.location.replace('/login.html');
    }
}

/**
 * NEW: Sets up a listener for real-time messages from the server (e.g., via WebSocket).
 */
function setupRealtimeListeners() {
    console.log('[WebSocket] Initializing Realtime Listeners...');
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}`;
    console.log(`[WebSocket] Target URL: ${wsUrl}`);

    let ws;
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 5;
    let reconnectTimeout;

    function connect() {
        console.log('[WebSocket] Attempting to connect...');
        // Check if token exists before connecting
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn('[WebSocket] لا يوجد رمز مصادقة. تخطي الاتصال.');
            return;
        }

        try {
            ws = new WebSocket(wsUrl);
        } catch (err) {
            console.error('[WebSocket] Failed to create WebSocket instance:', err);
            return;
        }

        // Expose the active WebSocket so other modules (e.g., logout) can close it immediately
        try { window._realtimeWs = ws; } catch (e) { /* ignore in non-browser env */ }

        ws.onopen = () => {
            console.log('[WebSocket] Connection established successfully ✓');
            reconnectAttempts = 0; // Reset counter on successful connection
            const token = localStorage.getItem('authToken');
            if (token) {
                console.log('[WebSocket] Sending auth token...');
                ws.send(JSON.stringify({ type: 'auth', token }));
            } else {
                console.warn('[WebSocket] No auth token found in localStorage');
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                switch (message.type) {
                    case 'auth_error':
                        // Handle authentication error from server
                        console.warn('[WebSocket] Authentication failed:', message.error);
                        if (message.error && message.error.includes('expired')) {
                            // Token expired, redirect to login
                            localStorage.removeItem('authToken');
                            localStorage.removeItem('userProfile');
                            showToast('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.', 'warning');
                            setTimeout(() => {
                                window.location.replace('/login.html');
                            }, 2000);
                        }
                        return; // Don't try to reconnect
                    case 'agent_renewed':
                        showToast(`تم تجديد رصيد الوكيل ${message.data.agentName} تلقائياً.`, 'success');
                        break;
                    case 'bulk_renew_progress':
                        // Dispatch event for specific page handlers
                        window.dispatchEvent(new CustomEvent('bulk-renew-progress', { detail: message }));
                        break;
                    case 'presence_update':
                        // message.data should be an array of online user IDs
                        if (Array.isArray(message.data)) {
                            window.onlineUsers.clear();
                            message.data.forEach(userId => window.onlineUsers.set(userId, true));
                            // Add the current user to online list
                            const currentUserId = currentUserProfile?.userId || currentUserProfile?._id;
                            if (currentUserId) {
                                window.onlineUsers.set(currentUserId, true);
                            }
                            // Dispatch a global event that the user list can listen to
                            window.dispatchEvent(new CustomEvent('presence-update'));
                            // console.log('[WebSocket] تحديث الحالة المباشرة:', Array.from(window.onlineUsers.keys()));
                        }
                        break;
                    
                    case 'suggestion_update':
                    case 'new_suggestion':
                        // console.log('🔔 [WebSocket] Received suggestion update/new suggestion');
                        loadGlobalUnreadCount();
                        break;

                    case 'notification':
                        console.log('🔔 [WebSocket] Received notification:', message);
                        if (typeof showToast === 'function') {
                            showToast(message.message, message.level || 'info');
                        } else {
                            console.error('[WebSocket] showToast function is not defined!');
                            alert(message.message); // Fallback
                        }
                        break;

                    case 'global_notification':
                        console.log('🔔 [WebSocket] Received global notification:', message);
                        showToast(message.message, message.variant || 'info');
                        break;

                    case 'AUDITING_TOGGLED':
                        console.log('🔔 [WebSocket] Auditing toggled:', message.data);
                        // 1. Show toast
                        const statusText = message.data.isAuditingEnabled ? 'تفعيل' : 'إلغاء تفعيل';
                        showToast(`قام ${message.data.updatedBy} بـ ${statusText} التدقيق للوكيل ${message.data.agentName}`, 'info');
                        
                        // 2. Dispatch a custom event so specific pages can update their UI
                        window.dispatchEvent(new CustomEvent('agent-auditing-update', { detail: message.data }));
                        break;

                    case 'COMPETITION_CREATED':
                        console.log('🔔 [WebSocket] Competition created:', message.data);
                        showToast(`تم إنشاء مسابقة جديدة للوكيل ${message.data.agentName} بواسطة ${message.data.createdBy}`, 'success');
                        window.dispatchEvent(new CustomEvent('competition-update', { detail: { type: 'created', ...message.data } }));
                        break;

                    case 'COMPETITION_COMPLETED':
                        console.log('🔔 [WebSocket] Competition completed:', message.data);
                        showToast(`تم إنهاء مسابقة الوكيل ${message.data.competitionName || ''} بواسطة ${message.data.completedBy}`, 'info');
                        window.dispatchEvent(new CustomEvent('competition-update', { detail: { type: 'completed', ...message.data } }));
                        break;

                    // Add other message types here
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        ws.onclose = () => {
            console.log('[WebSocket] قطع الاتصال ✗');
            // Remove current user from online list
            const currentUserId = currentUserProfile?.userId || currentUserProfile?._id;
            if (currentUserId) {
                window.onlineUsers.delete(currentUserId);
            }
            // Clear the global reference when socket closes
            try { if (window._realtimeWs === ws) window._realtimeWs = null; } catch (e) { /* ignore */ }
            
            // Only reconnect if we haven't exceeded max attempts
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`[WebSocket] إعادة محاولة الاتصال (${reconnectAttempts}/${maxReconnectAttempts}) بعد 5 ثواني...`);
                reconnectTimeout = setTimeout(connect, 5000);
            } else {
                console.warn('[WebSocket] فشل الاتصال المباشر بعد عدة محاولات. يرجى تحديث الصفحة.');
            }
        };

        ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
            try { ws.close(); } catch (e) { /* ignore */ }
        };
    }

    // Function to stop reconnection attempts (e.g., on logout)
    window.stopWebSocketReconnect = function() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        reconnectAttempts = maxReconnectAttempts; // Prevent future reconnects
    };

    connect();
}

// --- UI Component Functions (Moved from script.js to main.js) ---

function showLoader() {
    document.getElementById('page-loader')?.classList.add('show');
}

function hideLoader() {
    document.getElementById('page-loader')?.classList.remove('show');
}

function showConfirmationModal(message, onConfirm, options = {}) {
    const {
        title = null,
        confirmText = 'تأكيد',
        cancelText = 'إلغاء',
        confirmClass = 'btn-primary',
        showCancel = true,
        hideCancel = undefined, // alias support
        modalClass = '',
        onRender = null,
        onCancel = null
    } = options;

    // Backward compatibility: if hideCancel is provided, it overrides showCancel
    const effectiveShowCancel = typeof hideCancel === 'boolean' ? !hideCancel : showCancel;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = `modal ${modalClass}`;
    modal.innerHTML = `
        ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
        <div class="modal-message">${message}</div>
        <div class="modal-actions">
            <button id="confirm-btn" class="${confirmClass}">${confirmText}</button>
            ${effectiveShowCancel ? `<button id="cancel-btn" class="btn-secondary">${cancelText}</button>` : ''}
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('confirm-btn').onclick = async () => {
        // FIX: Support async callbacks and allow them to prevent modal closing
        if (onConfirm) {
            const result = await Promise.resolve(onConfirm());
            // If callback returns false, don't close the modal
            if (result === false) return;
        }
        overlay.remove();
    
    };
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            if (onCancel) onCancel();
            overlay.remove();
        };
    }

    if (onRender) onRender(modal);
}
// Expose globally so console and other scripts can call it
try { window.showConfirmationModal = showConfirmationModal; } catch (e) { /* ignore in non-browser env */ }

// --- NEW: Dedicated function for progress modals ---
function showProgressModal(title, content) {
    const existingOverlay = document.querySelector('.modal-overlay');
    if (existingOverlay) {
        // console.log('[showProgressModal] Closing existing modal to show new one.');
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

// Fallback toast helper: ensures a visible message even if the app's showToast is absent or hidden
function showFallbackToast(message, duration = 1600) {
    try {
        // Reuse existing global showToast if it exists but also show a DOM fallback to guarantee visibility
        if (typeof showToast === 'function') showToast(message, 'info');
    } catch (e) {
        // ignore
    }

    // Ensure only one fallback toast element
    let el = document.getElementById('global-fallback-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'global-fallback-toast';
        el.style.position = 'fixed';
        el.style.bottom = '24px';
        el.style.right = '24px';
        el.style.background = 'rgba(0,0,0,0.85)';
        el.style.color = '#fff';
        el.style.padding = '10px 14px';
        el.style.borderRadius = '8px';
        el.style.zIndex = '2147483647'; // very high so it appears above modals/overlays
        el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.3)';
        el.style.fontSize = '13px';
        el.style.opacity = '0';
        el.style.transition = 'opacity 160ms ease-in-out, transform 160ms ease-in-out';
        el.style.transform = 'translateY(6px)';
        document.body.appendChild(el);
    }
    el.textContent = message;
    // show
    requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    });
    // hide after duration
    clearTimeout(el._hideTimeout);
    el._hideTimeout = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(6px)';
    }, duration);
}
try { window.showFallbackToast = showFallbackToast; } catch (e) { /* ignore */ }

// Centralized logout flow used by all logout triggers
function performLogoutFlow() {
    try { showFallbackToast('جاري تسجيل الخروج...', 800); } catch (e) { /* ignore */ }

    // Close realtime socket if present and stop reconnection attempts
    try {
        if (window._realtimeWs && typeof window._realtimeWs.close === 'function') {
            window._realtimeWs.close();
            window._realtimeWs = null;
        }
        if (typeof window.stopWebSocketReconnect === 'function') {
            window.stopWebSocketReconnect();
        }
    } catch (err) {
        console.warn('Failed to close realtime socket during logout:', err);
    }

    // Fire logout API call (fire-and-forget to log activity)
    const logoutTimeout = setTimeout(() => {
        console.warn('Logout API timeout - proceeding with client-side logout');
    }, 2000);
    try {
        authedFetch('/api/auth/logout', { method: 'POST' })
            .then(() => clearTimeout(logoutTimeout))
            .catch(err => {
                console.warn('Logout API call failed:', err);
                clearTimeout(logoutTimeout);
            });
    } catch (e) { 
        clearTimeout(logoutTimeout);
    }

    // Clear auth state immediately
    localStorage.removeItem('authToken');
    localStorage.removeItem('userProfile');

    try { showFallbackToast('تم تسجيل الخروج', 900); } catch (e) { /* ignore */ }

    // Redirect right away to the login page
    setTimeout(() => window.location.replace('/login.html'), 250);
}
try { window.performLogoutFlow = performLogoutFlow; } catch (e) { /* ignore */ }

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
            showConfirmationModal(
                'هل أنت متأكد أنك تريد تسجيل الخروج؟ سيتم إنهاء الجلسة وإغلاق الاتصال المباشر.',
                () => performLogoutFlow(),
                { title: 'تأكيد تسجيل الخروج', confirmText: 'تسجيل الخروج', cancelText: 'إلغاء', confirmClass: 'btn-danger' }
            );
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
    const navStatistics = document.getElementById('nav-statistics');
    const navAnalytics = document.getElementById('nav-analytics'); // NEW
    const navWinnerRoulette = document.getElementById('nav-winner-roulette');

    // NEW: Tasks & Calendar Dropdown Navigation (for admins only)
    const navTasksCalendarDropdownContainer = document.getElementById('nav-tasks-calendar-dropdown-container');
    const navTasksCalendarDropdown = document.getElementById('nav-tasks-calendar-dropdown');

    if (currentUserProfile && navTasksCalendarDropdownContainer) {
        const isAdmin = currentUserProfile.role === 'admin' || currentUserProfile.role === 'super_admin';
        navTasksCalendarDropdownContainer.style.display = isAdmin ? 'block' : 'none';
    }

    if (navTasksCalendarDropdown) {
        navTasksCalendarDropdown.addEventListener('click', (e) => {
            e.preventDefault();
        });
    }

    // NEW: Question Suggestions Dropdown Navigation
    const navQuestionsDropdownContainer = document.getElementById('nav-questions-dropdown-container');
    const navQuestionsDropdown = document.getElementById('nav-questions-dropdown');
    const navAdminQuestionSuggestionsMenu = document.getElementById('nav-admin-question-suggestions');

    // Show/Hide dropdown based on role
    if (currentUserProfile && navQuestionsDropdownContainer) {
        // const isAdmin = currentUserProfile.role === 'admin' || currentUserProfile.role === 'super_admin';
        
        navQuestionsDropdownContainer.style.display = 'block'; // Show dropdown for all employees
        
        if (navAdminQuestionSuggestionsMenu) {
            navAdminQuestionSuggestionsMenu.style.display = 'block'; // Show admin link for all employees
        }
    }

    // Prevent dropdown toggle from navigating
    if (navQuestionsDropdown) {
        navQuestionsDropdown.addEventListener('click', (e) => {
            e.preventDefault();
        });
    }

    navLinks = [navHome, navTasks, navManageAgents, navTopAgents, navManageCompetitions, navArchivedCompetitions, navCompetitionTemplates, navCalendar, navUsers, navProfileSettings, navActivityLog, navAnalytics, navWinnerRoulette, document.getElementById('logout-btn')];
    
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
    if (navAnalytics) navAnalytics.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'analytics'; }); // NEW
    if (navWinnerRoulette) navWinnerRoulette.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'winner-roulette'; });
    if (navStatistics) navStatistics.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'statistics'; });

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

async function renderStatisticsPage() {
    if (!window.appContent) {
        console.error("app-content element not found!");
        return;
    }
    try {
        const response = await fetch('/pages/statistics.html');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        window.appContent.innerHTML = html;
        // Dynamically import and initialize the page's script
            const statsModule = await import('/js/pages/statistics.js');
        if (statsModule && typeof statsModule.init === 'function') {
            statsModule.init();
        } else {
            console.warn('Statistics initialization function not found.');
        }
    } catch (error) {
        console.error("Failed to load statistics page:", error);
        window.appContent.innerHTML = `<p class="error-message">فشل تحميل صفحة الإحصائيات: ${error.message}</p>`;
    }
}

async function renderAnalyticsPage() {
    if (!window.appContent) {
        console.error("app-content element not found!");
        return;
    }
    try {
        const response = await fetch('/pages/analytics.html');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        window.appContent.innerHTML = html;
        // Dynamically import and initialize the analytics page script
        try {
            const analyticsModule = await import('/js/pages/analytics.js');
            if (analyticsModule && typeof analyticsModule.init === 'function') {
                // Defer initialization to ensure DOM is ready
                setTimeout(() => {
                    analyticsModule.init();
                }, 0);
            } else {
                throw new Error('Analytics dashboard initialization function not found');
            }
        } catch (e) {
            // Re-throw to be caught by outer catch and displayed to the user
            throw e;
        }
    } catch (error) {
        console.error("Failed to load analytics page:", error);
        window.appContent.innerHTML = `<p class="error-message">فشل تحميل صفحة التحليلات: ${error.message}</p>`;
    }
}

async function renderWinnerRoulettePage() {
    if (!window.appContent) {
        console.error("app-content element not found!");
        return;
    }
    // Force inline HTML to avoid blank page issues
    window.appContent.innerHTML = getWinnerRouletteInlineHTML();
    
    // Check if winner-roulette init is available (from bundled JS)
    setTimeout(() => {
        if (typeof window.winnerRouletteInit === 'function') {
            // console.log('[winner-roulette] Initializing from bundled code');
            window.winnerRouletteInit();
            winnerRouletteFallbackInitialized = true;
        } else {
            console.warn('[winner-roulette] Init function not found, using fallback');
            initWinnerRouletteFallback('init not available');
        }
    }, 100);

    // Log screen size for debugging
    /*
    console.log('Winner Roulette Page Loaded - Screen Size:', {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        appContent: window.appContent ? window.appContent.offsetWidth + 'x' + window.appContent.offsetHeight : 'not found'
    });
    */
}

function getWinnerRouletteInlineHTML(minimal = false, errMsg = '') {
        if (minimal) {
                return `<section class=\"page-section\"><h1>اختيار الفائزين</h1><p style='color:#f87171'>تعذر تحميل الصفحة الأصلية: ${errMsg}</p>${baseRouletteMarkup()}</section>`;
        }
        return `<section class=\"page-section\">${baseRouletteMarkup()}</section>`;
}

function baseRouletteMarkup() {
    return `
        <section class=\"page-section\" id=\"winner-roulette-page\">
            <div class=\"page-header\">
                <h1><i class=\"fas fa-random\"></i> اختيار الفائزين لمسابقات الوكيل</h1>
                <p class=\"page-subtitle\">أضِف أو الصِق أسماء المشاركين مع أرقام حساباتهم ثم دوّر العجلة لاختيار فائز عشوائي بكل شفافية.</p>
                <div class=\"wr-agent-selector\">
                    <label for=\"agent-select\"><i class=\"fas fa-user-tie\"></i> اختر الوكيل:</label>
                    <select id=\"agent-select\" class=\"wr-agent-dropdown\">
                        <option value=\"\">-- اختر الوكيل --</option>
                    </select>
                    <span id=\"agent-selection-status\" class=\"wr-agent-status\"></span>
                </div>
            </div>
            <div class=\"wr-layout\">
                <div class=\"wr-panel\" id=\"wr-left-panel\">
                    <div class=\"wr-panel-header\"><h3><i class=\"fas fa-list\"></i> إدخال المشاركين</h3></div>
                    <small>مثال لكل سطر: <code>الاسم الثلاثي — 3191848</code></small>
                    <textarea id=\"participants-input\" class=\"wr-textarea\" placeholder=\"1- ابتسام قاسم هاني — 3191848\n2- رامي عبد الباسط — 3219692\n3- اواب خالد سلام — 3232334\n4- حسين خالد عودة — 3257071\n5- حنين عماد مطر — 3240004\n6- شيرين عبد الله سعود — 3076887\n7- علي محمد ناصر — 3235758\n8- عمر مجمل قاسم — 3245457\"></textarea>
                    <h4 class=\"wr-section-title\">المشاركون</h4>
                    <div class=\"wr-tools-row\">
                        <input id=\"participants-search\" type=\"text\" class=\"wr-search-input\" placeholder=\"بحث...\" />
                        <div class=\"wr-counts\">
                          <span>الإجمالي: <strong id=\"participants-count-total\">0</strong></span>
                          <span>المتبقي: <strong id=\"participants-count-remaining\">0</strong></span>
                          <span>الفائزون: <strong id=\"winners-count\">0</strong></span>
                        </div>
                        <button id=\"refresh-participants\" class=\"wr-btn wr-btn-primary wr-btn-small\"><i class=\"fas fa-sync-alt\"></i> تحديث</button>
                        <button id=\"reset-winners\" class=\"wr-btn wr-btn-secondary wr-btn-small\"><i class=\"fas fa-trash\"></i> مسح المشاركين</button>
                    </div>
                    <div id=\"participants-list\" class=\"wr-scroll-box\"></div>
                </div>
                <div class=\"wr-panel\" id=\"wr-right-panel\">
                    <div class=\"wr-panel-header\"><h3><i class=\"fas fa-sync-alt\"></i> عجلة الاختيار</h3></div>
                    <div id=\"agent-info-box\" class=\"wr-agent-info-box\" style=\"display:none;\">
                        <div class=\"wr-agent-info-header\"><i class=\"fas fa-user-tie\"></i> بيانات الوكيل</div>
                        <div class=\"wr-agent-info-row\"><strong>الاسم:</strong> <span id=\"agent-info-name\">—</span></div>
                        <div class=\"wr-agent-info-row\"><strong>رقم الوكالة:</strong> <span id=\"agent-info-id\">—</span></div>
                        <div class=\"wr-agent-info-divider\"></div>
                        <div class=\"wr-agent-info-header\"><i class=\"fas fa-trophy\"></i> المسابقة النشطة</div>
                        <div id=\"agent-competition-info\">
                            <div class=\"wr-agent-info-empty\">لا توجد مسابقة نشطة</div>
                        </div>
                    </div>
                    <div class=\"wr-settings-grid\">
                        <div class=\"wr-setting\"><label>إستبعاد بعد الفوز</label><div class=\"wr-checkbox-row\"><input type=\"checkbox\" id=\"exclude-winner\" checked><span style=\"font-size:.7rem;color:var(--wr-text-dim);\">إزالة الاسم</span></div></div>
                        <div class=\"wr-setting\"><label>عدد اختيارات</label><input type=\"number\" id=\"batch-count\" min=\"1\" value=\"1\"></div>
                    </div>
                    <div class=\"wr-wheel-wrapper\">
                        <div class=\"wr-pointer\"></div>
                        <canvas id=\"winner-roulette-wheel\"></canvas>
                        <div class=\"wr-actions-row\">
                            <button id=\"auto-pick-btn\" class=\"wr-btn wr-btn-secondary wr-btn-large\"><i class=\"fas fa-forward\"></i> متتالي</button>
                        </div>
                    </div>
                    <small style=\"text-align:center;color:var(--wr-text-dim);\">اختيار عشوائي دون تحيز.</small>
                </div>
            </div>
            <div class=\"wr-winners-section\">
                <div class=\"wr-winners-header\">
                    <h3><i class=\"fas fa-trophy\"></i> قائمة الفائزين</h3>
                    <div class=\"wr-winners-actions\">
                        <button id=\"export-winners-bottom\" class=\"wr-btn wr-btn-success wr-btn-small\"><i class=\"fas fa-download\"></i> تصدير</button>
                        <button id=\"reset-winners-bottom\" class=\"wr-btn wr-btn-secondary wr-btn-small\"><i class=\"fas fa-trash\"></i> مسح الفائزين</button>
                    </div>
                </div>
                <div id=\"winners-list-bottom\" class=\"wr-winners-grid\"></div>
            </div>
        </section>
                <!-- Simplified winner modal layout to ensure email field clickable -->
                <div id="winner-modal" class="wr-celebration-modal" style="display:none;">
                  <div class="wr-celebration-content" role="dialog" aria-modal="true" aria-label="تسجيل الفائز">
                    <div class="wr-winner-name" id="celebration-winner-name">—</div>
                    <div class="wr-winner-account" id="celebration-winner-account">—</div>
                    <label for="winner-email" class="wr-label">البريد الإلكتروني</label>
                    <input type="email" id="winner-email" class="wr-form-input" placeholder="أدخل البريد الإلكتروني للفائز" autocomplete="email" required tabindex="0" />
                    <div id="winner-email-error" class="wr-error-msg" style="display:none;color:#f87171;font-size:.75rem;margin-top:4px;">البريد غير صالح أو فارغ</div>
                    <div class="wr-prize-type" id="celebration-prize-type">نوع الجائزة</div>
                    <div class="wr-prize-value" id="celebration-prize-value">—</div>
                    <button id="confirm-winner" class="wr-confirm-btn"><i class="fas fa-check-circle"></i> تجهيز فائز</button>
                  </div>
                </div>
<canvas id=\"wr-confetti-canvas\"></canvas>`;
}

/**
 * Lightweight inline setup so the roulette page still works if the dedicated module fails to load.
 * Shows the wheel, loads agents, and renders participant chips.
 */
function initWinnerRouletteFallback(reason = '') {
    if (winnerRouletteFallbackInitialized) return;
    const canvas = document.getElementById('winner-roulette-wheel');
    const agentSelect = document.getElementById('agent-select');
    const participantsInput = document.getElementById('participants-input');
    if (!canvas || !agentSelect || !participantsInput) return;

    winnerRouletteFallbackInitialized = true;
    if (reason) console.warn(`[winner-roulette:fallback] using inline setup: ${reason}`);

    const state = { entries: [], winners: [] };
    const ctx = canvas.getContext('2d');
    const colors = ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

    const updateCounts = () => {
        const totalEl = document.getElementById('participants-count-total');
        const remainingEl = document.getElementById('participants-count-remaining');
        const winnersEl = document.getElementById('winners-count');
        if (totalEl) totalEl.textContent = state.entries.length;
        if (remainingEl) remainingEl.textContent = Math.max(state.entries.length - state.winners.length, 0);
        if (winnersEl) winnersEl.textContent = state.winners.length;
    };

    const renderParticipantsList = () => {
        const listEl = document.getElementById('participants-list');
        if (!listEl) return;
        if (!state.entries.length) {
            listEl.innerHTML = '<div class="wr-agent-info-empty">أضف المشاركين ليظهروا هنا</div>';
            return;
        }
        listEl.innerHTML = state.entries
            .map(e => `<div class="wr-chip"><span>${e.name}</span><small>#${e.account || '-'}</small></div>`)
            .join('');
    };

    const renderWinnersList = () => {
        const winnersEl = document.getElementById('winners-list-bottom');
        if (!winnersEl) return;
        if (!state.winners.length) {
            winnersEl.innerHTML = '<div class="wr-agent-info-empty">لا يوجد فائزون بعد</div>';
            return;
        }
        winnersEl.innerHTML = state.winners
            .map((w, i) => `<div class="wr-card"><div class="wr-card-title">${i + 1}- ${w.name}</div><div class="wr-card-sub">${w.account || ''}</div></div>`)
            .join('');
    };

    const drawWheel = () => {
        const width = canvas.width = 500;
        const height = canvas.height = 500;
        const center = { x: width / 2, y: height / 2 };
        const items = state.entries.length ? state.entries : [{ name: 'أضف المشاركين', account: '' }];
        const slice = (Math.PI * 2) / items.length;

        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(center.x, center.y);

        items.forEach((item, idx) => {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.fillStyle = colors[idx % colors.length];
            ctx.arc(0, 0, 220, idx * slice, (idx + 1) * slice);
            ctx.fill();
            ctx.save();
            ctx.rotate(idx * slice + slice / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            ctx.font = '16px Cairo, Arial, sans-serif';
            const label = (item.name || '').slice(0, 18) || 'مشارك';
            ctx.fillText(label, 200, 6);
            ctx.restore();
        });

        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Cairo, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('INZO', 0, 6);

        ctx.restore();
    };

    const parseParticipants = () => {
        const lines = participantsInput.value.split('\n');
        state.entries = lines
            .map(l => l.trim())
            .filter(Boolean)
            .map((line, idx) => {
                const parts = line.split('-').map(p => p.trim()).filter(Boolean);
                const name = parts.slice(0, parts.length - 1).join(' ') || line;
                const account = parts.slice(-1)[0] || '';
                return { id: `p_${idx}`, name, account };
            });
        renderParticipantsList();
        updateCounts();
    };

    participantsInput.addEventListener('input', () => {
        parseParticipants();
        drawWheel();
    });

    const updateAgentStatus = (name, agentId) => {
        const status = document.getElementById('agent-selection-status');
        if (!status) return;
        if (name && agentId) {
            status.textContent = `${name} (#${agentId})`;
            status.className = 'wr-agent-status selected';
        } else {
            status.textContent = '';
            status.className = 'wr-agent-status';
        }
    };

    agentSelect.addEventListener('change', () => {
        const selected = agentSelect.options[agentSelect.selectedIndex];
        updateAgentStatus(selected?.textContent || '', selected?.dataset.agentId || '');
    });

    const loadAgents = async () => {
        try {
            const response = await authedFetch('/api/agents?limit=1000');
            const result = await response.json();
            const agents = result.data || [];
            agents.forEach(agent => {
                const option = document.createElement('option');
                option.value = agent._id;
                option.textContent = `${agent.name} (#${agent.agent_id})`;
                option.dataset.agentId = agent.agent_id;
                agentSelect.appendChild(option);
            });
        } catch (e) {
            console.warn('[winner-roulette:fallback] Failed to load agents', e);
        }
    };

    parseParticipants();
    drawWheel();
    renderWinnersList();
    loadAgents();
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

// Fallback: ensure logout button always opens confirmation modal.
// This adds a non-destructive listener after DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
    try {
        const btn = document.getElementById('logout-btn');
        if (!btn) return;
        // Replace the node with a clone to remove any previously attached listeners
        const clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
        // Attach a single, authoritative handler to the cloned element
        clone.addEventListener('click', (e) => {
            if (document.querySelector('.modal-overlay')) return; // Avoid stacking modals
            e.preventDefault();
            showConfirmationModal(
                'هل أنت متأكد أنك تريد تسجيل الخروج؟ سيتم إنهاء الجلسة وإغلاق الاتصال المباشر.',
                () => performLogoutFlow(),
                { title: 'تأكيد تسجيل الخروج', confirmText: 'تسجيل الخروج', cancelText: 'إلغاء', confirmClass: 'btn-danger' }
            );
        }, { passive: false });
    } catch (e) {
        console.error('Failed to attach fallback logout handler', e);
    }
});

// ==========================
// Global Unread Suggestions Counter
// ==========================
async function loadGlobalUnreadCount() {
    try {
        let endpoint = '';
        if (currentUserProfile.role === 'super_admin') {
            endpoint = '/api/question-suggestions/unread-count';
        } else {
            endpoint = '/api/question-suggestions/employee-unread-count';
        }

        const response = await window.utils.authedFetch(endpoint);

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (data.success) {
            const unreadCount = data.data.unreadCount || 0;
            displayGlobalUnreadCount(unreadCount);
        }
    } catch (error) {
        console.error('❌ [Global Unread Count] Error loading unread count:', error);
    }
}

function displayGlobalUnreadCount(count) {
    const globalUnreadCountElement = document.getElementById('globalUnreadCount');

    if (globalUnreadCountElement) {
        if (count > 0) {
            globalUnreadCountElement.textContent = count;
            globalUnreadCountElement.style.display = 'inline-block';
            
            // Update click handler based on role
            const badgeLink = globalUnreadCountElement.closest('a');
            if (badgeLink) {
                badgeLink.onclick = (e) => {
                    e.preventDefault();
                    if (currentUserProfile.role === 'super_admin') {
                        window.location.href = '/pages/admin-question-suggestions.html';
                    } else {
                        window.location.href = '/pages/question-suggestions.html';
                    }
                };
            }
        } else {
            globalUnreadCountElement.style.display = 'none';
        }
    }
}
