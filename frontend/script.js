// 1. Global variable for Supabase client
let supabase = null;
let searchTimeout;
let currentUserProfile = null; // NEW: To store the current user's profile with role
window.onlineUsers = new Map(); // NEW: Global map to track online users


// Global function to set the active navigation link
function setActiveNav(activeLink) {
    // Deactivate all nav-links, dropdown-toggles, and dropdown-items
    document.querySelectorAll('.nav-link, .dropdown-toggle, .dropdown-item').forEach(link => {
        link.classList.remove('active');
    });

    if (activeLink) {
        activeLink.classList.add('active');

        // تعديل: إذا كان الرابط النشط داخل قائمة منسدلة، قم بتنشيط القائمة الرئيسية أيضاً
        const dropdown = activeLink.closest('.dropdown');
        if (dropdown) {
            dropdown.querySelector('.dropdown-toggle')?.classList.add('active');
        }
    }
}

// Helper function to update the visual status indicator
function updateStatus(status, message) {
    const statusElement = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    const lastCheckTime = document.getElementById('last-check-time');

    if (!statusElement || !statusText || !lastCheckTime) return;

    // Update text and class
    statusText.textContent = message;
    statusElement.className = 'status-bar'; // Reset classes
    statusElement.classList.add('status-' + status);

    // Update timestamp
    const time = new Date().toLocaleTimeString('ar-EG');
    lastCheckTime.textContent = `آخر فحص: ${time}`;
}

async function logAgentActivity(agentId, actionType, description, metadata = {}) {
    if (!supabase || !currentUserProfile) return;
    const userName = currentUserProfile.full_name || currentUserProfile.email;
    const finalDescription = `${description} (بواسطة: ${userName})`;

    const { error } = await supabase.from('agent_logs').insert({
        agent_id: agentId,
        action_type: actionType,
        description: finalDescription,
        metadata: metadata
    });
    if (error) {
        console.error('Failed to log agent activity:', error);
    }
}

// NEW: Helper function to format numbers with commas
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// NEW: Function to fetch and store the current user's profile
async function fetchUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (data) currentUserProfile = data;
        else currentUserProfile = null;

        // NEW: Security check to block inactive users
        if (currentUserProfile && currentUserProfile.status === 'inactive') {
            console.warn(`[AUTH] Inactive user '${user.email}' attempted to login. Signing out.`);
            await supabase.auth.signOut(); // Force sign out
            // Redirect to login page with an error message
            const params = new URLSearchParams();
            params.set('error', 'account_disabled');
            params.set('message', 'تم تعطيل حسابك. يرجى التواصل مع المدير.');
            window.location.replace(`/login.html?${params.toString()}`);
            return; // Stop further execution
        }
        // NEW: Update UI with user info
        const settingsMenu = document.getElementById('settings-menu');
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        if (settingsMenu && userAvatar && userName && userEmail) {
            settingsMenu.style.display = 'flex';
            // Use a default avatar if none is set
            userAvatar.src = currentUserProfile?.avatar_url || `https://ui-avatars.com/api/?name=${user.email}&background=8A2BE2&color=fff`;
            userName.textContent = currentUserProfile?.full_name || user.email.split('@')[0];
            userEmail.textContent = user.email;

            // --- تعديل: إظهار زر "إدارة المستخدمين" فقط للمدير العام، وإظهار زر التحديث للجميع ---
            const isSuperAdmin = user?.email === 'ahmed12@inzo.com';
            document.querySelectorAll('[data-role="super-admin"]').forEach(el => {
                // هذا الشرط يضمن أن زر "إدارة المستخدمين" يظهر فقط للمدير العام
                // بينما أي عناصر أخرى ليس لها هذا الدور (مثل زر التحديث) لن تتأثر وستظل ظاهرة للجميع.
                el.style.display = isSuperAdmin ? 'flex' : 'none';
            });

            // NEW: Initialize presence tracking AFTER user profile is confirmed
            initializePresenceTracking();
        }
    } else {
        // Hide user menu if not logged in
        const settingsMenu = document.getElementById('settings-menu');
        // NEW: If no user is logged in, and we are not on the login page, redirect.
        if (!window.location.pathname.endsWith('login.html')) {
            console.log('[Auth] No active session found. Redirecting to login page.');
            window.location.replace('/login.html');
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
    const appContent = document.getElementById('app-content');
    mainElement.classList.add('page-loading');

    // Reset layout classes
    mainElement.classList.remove('full-width');
    appContent.classList.remove('full-height-content');

    let renderFunction;
    let navElement;

    // Basic routing
    const routes = {
        '#home': { func: renderHomePage, nav: 'nav-home' },
        '#tasks': { func: renderTasksPage, nav: 'nav-tasks' },
        '#manage-agents': { func: renderManageAgentsPage, nav: 'nav-manage-agents', adminOnly: false },
        '#competitions': { func: renderCompetitionsPage, nav: 'nav-manage-competitions' },
        '#archived-competitions': { func: renderCompetitionsPage, nav: 'nav-archived-competitions' },
        '#competition-templates': { func: renderCompetitionTemplatesPage, nav: 'nav-competition-templates' },
        '#archived-templates': { func: renderArchivedTemplatesPage, nav: 'nav-competitions-dropdown' },
        '#add-agent': { func: renderAddAgentForm, nav: null },
        '#users': { func: renderUsersPage, nav: 'nav-users', adminOnly: true }, // NEW: Users page, will be moved
        '#profile-settings': { func: renderProfileSettingsPage, nav: null }, // NEW: Profile settings page
        '#activity-log': { func: renderActivityLogPage, nav: 'nav-activity-log' },
        '#calendar': { func: renderCalendarPage, nav: 'nav-calendar' }
    };

    const routeKey = hash.split('/')[0].split('?')[0]; // Get base route e.g., #profile from #profile/123 or #competitions from #competitions/new?agentId=1
    const route = routes[routeKey] || routes['#home'];

    renderFunction = route.func;
    navElement = document.getElementById(route.nav);

    // Special handling for routes with parameters
    if (hash.startsWith('#profile/')) {
        const agentId = hash.split('/')[1];
        if (agentId) {
            renderFunction = () => renderAgentProfilePage(agentId);
            navElement = null; // No nav item is active on a profile page
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

    if (hash.startsWith('#profile/') || hash.startsWith('#competitions/new') || hash.startsWith('#competitions/manage') || hash === '#home' || hash === '#competition-templates' || hash === '#archived-templates' || hash === '#competitions' || hash === '#manage-agents' || hash === '#activity-log' || hash === '#archived-competitions' || hash === '#users') {
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

// 2. Function to initialize Supabase
async function initializeSupabase() {
    try {
        updateStatus('connecting', 'جاري الاتصال بالخادم...');
        const response = await fetch('/api/config'); // Fetch from our own server
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        const config = await response.json();
        
        if (!config.supabaseUrl || !config.supabaseKey) {
            throw new Error('Supabase configuration not found from server.');
        }

        // ⚠️ تحذير: لا تضع أبداً مفتاح "service_role" في كود الواجهة الأمامية!
        supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
        console.log('Supabase client configured.');
        updateStatus('connected', 'متصل وجاهز');

        // NEW: Fetch user profile and THEN handle routing
        await fetchUserProfile();
        window.addEventListener('hashchange', handleRouting);
        handleRouting(); // Initial route handling on page load

        // NEW: Listen for realtime notifications
        supabase.channel('public:realtime_notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'realtime_notifications' }, payload => {
                console.log('Realtime notification received:', payload.new);
                const { message, type, notification_type, agent_id } = payload.new;
                
                // Show the toast notification
                if (message) {
                    showToast(message, type || 'info');
                }

                // If it's a balance renewal and we are on the correct profile page, refresh the page content.
                if (notification_type === 'BALANCE_RENEWAL' && agent_id) {
                    const currentHash = window.location.hash;
                    if (currentHash === `#profile/${agent_id}` || currentHash.startsWith(`#profile/${agent_id}/`)) { //This check is important to avoid re-rendering wrong profiles
                        console.log(`Refreshing profile for agent ${agent_id} due to balance renewal.`);
                        renderAgentProfilePage(agent_id); // Re-render the profile page
                    }
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log('Subscribed to realtime notifications channel.');
                else console.warn('Failed to subscribe to realtime notifications:', status);
            });
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        updateStatus('error', 'فشل الاتصال بالخادم');
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = `<p class="error">فشل الاتصال بالخادم. تأكد من أن الخادم يعمل وأن الإعدادات صحيحة.</p>`;
        }
    }
}

// NEW: Separated presence tracking initialization
function initializePresenceTracking() {
    // Ensure this runs only once and if the user profile is available
    if (!supabase || !currentUserProfile || window.presenceChannel) {
        return;
    }

    window.presenceChannel = supabase.channel('online-users', {
        config: {
            presence: {
                key: currentUserProfile.id, // Use user ID as the unique key
            },
        },
    });

    window.presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const newState = window.presenceChannel.presenceState();
            window.onlineUsers.clear();
            for (const id in newState) {
                window.onlineUsers.set(id, newState[id][0]);
            }
            // If the user management page is active, update its indicators
            if (typeof window.updateUserPresenceIndicators === 'function') {
                window.updateUserPresenceIndicators();
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await window.presenceChannel.track({ online_at: new Date().toISOString() });
                console.log('[Presence] Successfully subscribed and tracking online status.');
            } else {
                console.warn('[Presence] Failed to subscribe:', status);
            }
        });
}

// --- UI Component Functions ---

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

    document.getElementById('confirm-btn').onclick = () => { if (onConfirm) { onConfirm(); } overlay.remove(); };
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => overlay.remove();

    if (onRender) onRender(modal);
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

    // Update App Button Logic
    const updateBtn = document.getElementById('update-app-btn');
    updateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showConfirmationModal(
            'هل أنت متأكد من رغبتك في تحديث التطبيق إلى آخر إصدار؟ سيتم إعادة تشغيل الخادم.',
            () => {
                // This function is called when the user confirms.
                // We will now show a new, more detailed modal for the update process.
                showUpdateProgressModal();
            }, 
            { title: 'تحديث التطبيق', confirmText: 'تحديث الآن', confirmClass: 'btn-primary' }
        );
    });

    // Logout Button Logic
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showConfirmationModal('هل أنت متأكد من رغبتك في تسجيل الخروج؟', async () => {
                await supabase.auth.signOut();
                window.location.replace('/login.html'); // Redirect to login
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
            if (!supabase) return;

            const { data: agents, error } = await supabase
                .from('agents')

                .select('id, name, agent_id, avatar_url, classification')
                .or(`name.ilike.%${searchTerm}%,agent_id.ilike.%${searchTerm}%`)
                .limit(5);

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
                    <div class="search-result-item" data-agent-id="${agent.id}">
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
                if (currentUserProfile && currentUserProfile.role === 'admin') {
                 const usersResultItem = document.createElement('div');
                    usersResultItem.className = "search-result-item";
                  usersResultItem.textContent = "إدارة المستخدمين";
                  searchResultsContainer.appendChild(usersResultItem)
                     usersResultItem.addEventListener('click', async () => {
                         window.location.hash = `users`;
                          searchResultsContainer.classList.remove('visible');
                           searchInput.value = '';
                    })
                }
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
    const navManageCompetitions = document.getElementById('nav-manage-competitions');
    const navArchivedCompetitions = document.getElementById('nav-archived-competitions');
    const navCompetitionTemplates = document.getElementById('nav-competition-templates');
    const navArchivedTemplates = document.getElementById('nav-archived-templates');
    const navCalendar = document.getElementById('nav-calendar');
    const navActivityLog = document.getElementById('nav-activity-log');
    const navUsers = document.getElementById('nav-users'); // NEW
    const navProfileSettings = document.getElementById('nav-profile-settings');
    navLinks = [navHome, navTasks, navManageAgents, navManageCompetitions, navArchivedCompetitions, navCompetitionTemplates, navCalendar, navActivityLog, navUsers, navProfileSettings, document.getElementById('logout-btn')];
    
    // NEW: Navigation listeners update the hash, which triggers the router
    if (navHome) navHome.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'home'; });
    if (navTasks) navTasks.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'tasks'; });
    if (navManageAgents) navManageAgents.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'manage-agents'; });
    if (navProfileSettings) navProfileSettings.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'profile-settings'; }); // NEW
    if (navManageCompetitions) navManageCompetitions.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'competitions'; });
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

// Main entry point when the page loads
document.addEventListener('DOMContentLoaded', () => {
    applyInitialTheme();
    setupNavbar();
    setupAutoHidingNavbar();
    initializeSupabase();

    // --- NEW: Listen for browser online/offline events ---
    window.addEventListener('offline', () => {
        updateStatus('error', 'غير متصل. تحقق من اتصالك بالإنترنت.');
    });

    window.addEventListener('online', () => {
        updateStatus('connecting', 'تم استعادة الاتصال. جاري إعادة المزامنة...');
        // If Supabase wasn't initialized, try again.
        if (!supabase) {
            initializeSupabase();
        } else {
            // If it was initialized, just update status. Supabase client handles reconnection.
            setTimeout(() => updateStatus('connected', 'متصل وجاهز'), 2000);
        }
    });
});