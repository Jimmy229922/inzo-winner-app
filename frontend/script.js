// 1. Global variable for Supabase client
let supabase = null;
let searchTimeout;

// Global function to set the active navigation link
function setActiveNav(activeLink) {
    // Deactivate all nav-links and dropdown-toggles
    document.querySelectorAll('.nav-link, .dropdown-item').forEach(link => {
        link.classList.remove('active');
    });

    if (activeLink) {
        activeLink.classList.add('active');

        // If the active link is a dropdown item, also activate the dropdown toggle
        const dropdown = activeLink.closest('.dropdown');
        if (dropdown) {
            dropdown.querySelector('.dropdown-toggle')?.classList.add('active');
        }
    }
}

// Helper function to update the visual status indicator
function updateStatus(status, message) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = `الحالة: ${message}`;
        statusElement.className = ''; // Reset classes
        statusElement.classList.add('status-' + status);
    }
}

async function logAgentActivity(agentId, actionType, description, metadata = {}) {
    if (!supabase) return;
    const { error } = await supabase.from('agent_logs').insert({
        agent_id: agentId,
        action_type: actionType,
        description: description,
        metadata: metadata
    });
    if (error) {
        console.error('Failed to log agent activity:', error);
    }
}

// NEW: Router function to handle page navigation based on URL hash
async function handleRouting() {
    showLoader();
    const hash = window.location.hash || '#home'; // Default to home
    const mainElement = document.querySelector('main');
    const appContent = document.getElementById('app-content');

    // Reset layout classes
    mainElement.classList.remove('full-width');
    appContent.classList.remove('full-height-content');

    let renderFunction;
    let navElement;

    // Basic routing
    const routes = {
        '#home': { func: renderHomePage, nav: 'nav-home' },
        '#tasks': { func: renderTasksPage, nav: 'nav-tasks' },
        '#manage-agents': { func: renderManageAgentsPage, nav: 'nav-manage-agents' },
        '#top-agents': { func: renderTopAgentsPage, nav: 'nav-top-agents' },
        '#competitions': { func: renderCompetitionsPage, nav: 'nav-competitions' },
        '#competition-templates': { func: renderCompetitionTemplatesPage, nav: 'nav-competition-templates' },
        '#archived-templates': { func: renderArchivedTemplatesPage, nav: 'nav-competitions-dropdown' },
        '#add-agent': { func: renderAddAgentForm, nav: null },
        '#activity-log': { func: renderActivityLogPage, nav: 'nav-activity-log' },
        '#calendar': { func: renderCalendarPage, nav: 'nav-calendar' },
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
    }
    
    if (hash.startsWith('#competitions/new') || hash === '#home' || hash === '#competition-templates' || hash === '#archived-templates' || hash === '#competitions' || hash === '#manage-agents' || hash === '#activity-log' || hash === '#top-agents') {
        mainElement.classList.add('full-width');
    } else if (hash === '#calendar') {
        mainElement.classList.add('full-width');
        appContent.classList.add('full-height-content');
    }

    setActiveNav(navElement);

    try {
        if (renderFunction) {
            await renderFunction();
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

        // NEW: Setup routing
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
    // Dark Mode Toggle Logic
    const themeBtn = document.getElementById('theme-toggle-btn');
    themeBtn.addEventListener('click', () => {
        if (document.body.classList.contains('dark-mode')) {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        }
    });

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
            searchResultsContainer.style.display = 'none';
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
                searchResultsContainer.style.display = 'block';

                // Add click listeners to new items
                searchResultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        const agentId = item.dataset.agentId;
                        // Use the router for navigation
                        window.location.hash = `profile/${agentId}`;
                        searchResultsContainer.style.display = 'none';
                        searchInput.value = '';
                        if (mainSearchClearBtn) mainSearchClearBtn.style.display = 'none';
                    });
                });
            } else {
                searchResultsContainer.innerHTML = '<div class="search-result-item" style="cursor: default;">لا توجد نتائج</div>';
                searchResultsContainer.style.display = 'block';
            }
        }, 300); // 300ms debounce
    });

    if (mainSearchClearBtn) {
        mainSearchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            document.getElementById('search-results').style.display = 'none';
            mainSearchClearBtn.style.display = 'none';
            searchInput.focus();
        });
    }


    // Navigation Logic
    const navHome = document.getElementById('nav-home');
    const navTasks = document.getElementById('nav-tasks');
    const navManageAgents = document.getElementById('nav-manage-agents');
    const navCompetitions = document.getElementById('nav-competitions');
    const navCompetitionTemplates = document.getElementById('nav-competition-templates');
    const navArchivedTemplates = document.getElementById('nav-archived-templates');
    const navCalendar = document.getElementById('nav-calendar');
    const navActivityLog = document.getElementById('nav-activity-log');
    const navTopAgents = document.getElementById('nav-top-agents');
    navLinks = [navHome, navTasks, navManageAgents, navTopAgents, navCompetitions, navCompetitionTemplates, navCalendar, navActivityLog];
    
    // NEW: Navigation listeners update the hash, which triggers the router
    navHome.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'home'; });
    navTasks.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'tasks'; });
    navManageAgents.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'manage-agents'; });
    navTopAgents.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'top-agents'; });
    navCompetitions.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'competitions'; });
    navArchivedTemplates.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'archived-templates'; });
    navCompetitionTemplates.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'competition-templates'; });
    navActivityLog.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'activity-log'; });
    navCalendar.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'calendar'; });

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            document.getElementById('search-results').style.display = 'none';
        }
    });
}

function showUpdateProgressModal() {
    let currentStep = 0;
    const steps = [
        { text: 'جاري الاتصال بالخادم...', duration: 1000 },
        { text: 'جاري سحب آخر التحديثات من Git...', duration: 3000 },
        { text: 'جاري تطبيق التغييرات...', duration: 2000 },
        { text: 'سيتم إعادة تشغيل الخادم الآن...', duration: 1500 }
    ];

    const modalContent = `
        <div class="update-progress-container">
            <i class="fas fa-rocket update-icon"></i>
            <h3 id="update-status-text">جاري التهيئة...</h3>
            <div class="progress-bar-outer">
                <div id="update-progress-bar-inner" class="progress-bar-inner"></div>
            </div>
        </div>
    `;

    showConfirmationModal(modalContent, null, {
        title: 'جاري تحديث النظام',
        showCancel: false, // Hide cancel button
        showConfirm: false, // Hide confirm button
        modalClass: 'modal-no-actions'
    });

    const statusText = document.getElementById('update-status-text');
    const progressBar = document.getElementById('update-progress-bar-inner');

    function nextStep() {
        if (currentStep >= steps.length) {
            // This is where the actual API call happens, after the visual steps.
            fetch('/api/update-app', { method: 'POST' })
                .then(response => response.json())
                .then(result => {
                    if (!result.needsRestart) {
                        showToast(result.message || 'أنت تستخدم بالفعل آخر إصدار.', 'success');
                        document.querySelector('.modal-overlay')?.remove();
                    } else {
                        statusText.textContent = 'اكتمل التحديث! سيتم إعادة تحميل الصفحة.';
                        progressBar.style.width = '100%';
                        setTimeout(() => window.location.reload(), 2000);
                    }
                }).catch(err => {
                    showToast(`فشل التحديث: ${err.message}`, 'error');
                    document.querySelector('.modal-overlay')?.remove();
                });
            return;
        }
        const step = steps[currentStep];
        statusText.textContent = step.text;
        progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
        currentStep++;
        setTimeout(nextStep, step.duration);
    }

    nextStep(); // Start the process
}

// Function to create shooting stars dynamically
function createShootingStars() {
    const container = document.getElementById('animated-bg');
    if (!container) return;
    const numStars = 10;
    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'shooting-star';
        container.appendChild(star);
    }
}

// Main entry point when the page loads
document.addEventListener('DOMContentLoaded', () => {
    applyInitialTheme();
    createShootingStars();
    setupNavbar();
    initializeSupabase();
});