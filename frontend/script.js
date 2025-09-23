// 1. Global variable for Supabase client
let supabase = null;
let searchTimeout;
let navLinks = []; // Global array for navigation links

// Global function to set the active navigation link
function setActiveNav(activeLink) {
    navLinks.forEach(link => {
        link.classList.toggle('active', link === activeLink);
    });
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
        '#competitions': { func: renderCompetitionsPage, nav: 'nav-competitions' },
        '#add-agent': { func: renderAddAgentForm, nav: null },
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
        const response = await fetch('/config'); // Fetch from our own server
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

function showConfirmationModal(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <p>${message}</p>
        <div class="modal-actions">
            <button id="confirm-btn" class="btn-danger">تأكيد الحذف</button>
            <button id="cancel-btn" class="btn-secondary">إلغاء</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('confirm-btn').onclick = () => { onConfirm(); overlay.remove(); };
    document.getElementById('cancel-btn').onclick = () => overlay.remove();
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

    // Date Display
    const dateDisplay = document.getElementById('date-display');
    const today = new Date();
    // Using 'ar-EG' for Arabic-Egypt locale for date formatting
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.textContent = today.toLocaleDateString('ar-EG', options);

    // Placeholder for search functionality
    const searchInput = document.querySelector('.search-input');
    searchInput.addEventListener('input', () => {
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
                .select('id, name, agent_id')
                .or(`name.ilike.%${searchTerm}%,agent_id.ilike.%${searchTerm}%`)
                .limit(5);

            if (error) {
                console.error('Search error:', error);
                return;
            }

            if (agents.length > 0) {
                searchResultsContainer.innerHTML = agents.map(agent => `
                    <div class="search-result-item" data-agent-id="${agent.id}">
                        <p class="agent-name">${agent.name}</p>
                        <p class="agent-id">#${agent.agent_id}</p>
                    </div>
                `).join('');
                searchResultsContainer.style.display = 'block';

                // Add click listeners to new items
                searchResultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        const agentId = item.dataset.agentId;
                        // Use the router for navigation
                        window.location.hash = `profile/${agentId}`;
                        searchResultsContainer.style.display = 'none';
                        searchInput.value = '';
                    });
                });
            } else {
                searchResultsContainer.innerHTML = '<div class="search-result-item" style="cursor: default;">لا توجد نتائج</div>';
                searchResultsContainer.style.display = 'block';
            }
        }, 300); // 300ms debounce
    });

    // Navigation Logic
    const navHome = document.getElementById('nav-home');
    const navTasks = document.getElementById('nav-tasks');
    const navManageAgents = document.getElementById('nav-manage-agents');
    const navCompetitions = document.getElementById('nav-competitions');
    const navCalendar = document.getElementById('nav-calendar');
    navLinks = [navHome, navTasks, navManageAgents, navCompetitions, navCalendar]; // Assign to global array
    
    // NEW: Navigation listeners update the hash, which triggers the router
    navHome.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'home'; });
    navTasks.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'tasks'; });
    navManageAgents.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'manage-agents'; });
    navCompetitions.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'competitions'; });
    navCalendar.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'calendar'; });

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            document.getElementById('search-results').style.display = 'none';
        }
    });
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