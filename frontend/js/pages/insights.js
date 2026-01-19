// ============================================
// INSIGHTS PAGE - PROFESSIONAL DASHBOARD
// ============================================

// State Management
const insightsState = {
    autoRefresh: true,
    autoRefreshInterval: null,
    refreshIntervalMs: 30000, // 30 seconds
    lastFetchTime: null,
    currentTab: 'all',
    data: null
};

async function renderInsightsPage() {
    const appContent = document.getElementById('app-content');
    
    // Load HTML template
    try {
        const response = await fetch('pages/insights.html');
        const html = await response.text();
        appContent.innerHTML = html;
    } catch (error) {
        console.error('Error loading insights page:', error);
        appContent.innerHTML = '<p class="error">فشل تحميل الصفحة.</p>';
        return;
    }

    // Initialize
    initInsightsPage();
}

function initInsightsPage() {
    // Set up event listeners
    setupEventListeners();
    
    // Set up clickable elements (data-navigate and data-action)
    setupClickableElements();
    
    // Initial data fetch
    fetchInsightsData();
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Update time display
    updateLastUpdateTime();
}

// Setup clickable elements using data attributes
function setupClickableElements() {
    console.log('🔧 Setting up clickable elements...');
    
    // Handle data-navigate clicks
    document.querySelectorAll('[data-navigate]').forEach(el => {
        el.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-navigate');
            console.log('🚀 Navigate clicked:', target);
            window.location.hash = target;
        });
    });
    
    // Handle data-action clicks
    document.querySelectorAll('[data-action]').forEach(el => {
        el.addEventListener('click', function(e) {
            e.preventDefault();
            const action = this.getAttribute('data-action');
            console.log('⚡ Action clicked:', action);
            
            if (action === 'scroll-alerts') {
                const alertsSection = document.querySelector('.insights-section');
                if (alertsSection) {
                    alertsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });
    
    // Handle data-renew clicks (for renewal buttons)
    document.querySelectorAll('[data-renew]').forEach(el => {
        el.addEventListener('click', function(e) {
            e.preventDefault();
            const agentId = this.getAttribute('data-renew');
            const agentName = this.getAttribute('data-agent-name') || 'الوكيل';
            console.log('🔄 Renew clicked:', { agentId, agentName });
            handleRenewAgent(agentId, agentName);
        });
    });
    
    console.log('✅ Clickable elements setup complete');
}

function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-insights-btn');
    refreshBtn?.addEventListener('click', () => {
        refreshBtn.classList.add('loading');
        fetchInsightsData().finally(() => {
            setTimeout(() => refreshBtn.classList.remove('loading'), 500);
        });
    });
    
    // Auto-refresh toggle
    const autoRefreshBtn = document.getElementById('toggle-auto-refresh');
    autoRefreshBtn?.addEventListener('click', () => {
        insightsState.autoRefresh = !insightsState.autoRefresh;
        autoRefreshBtn.classList.toggle('active', insightsState.autoRefresh);
        
        if (insightsState.autoRefresh) {
            startAutoRefresh();
            showToast('تم تفعيل التحديث التلقائي', 'success');
        } else {
            stopAutoRefresh();
            showToast('تم إيقاف التحديث التلقائي', 'info');
        }
    });
    
    // Tab buttons
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            insightsState.currentTab = btn.dataset.tab;
            filterAlerts(insightsState.currentTab);
        });
    });
}

function startAutoRefresh() {
    if (insightsState.autoRefreshInterval) {
        clearInterval(insightsState.autoRefreshInterval);
    }
    
    if (insightsState.autoRefresh) {
        insightsState.autoRefreshInterval = setInterval(() => {
            fetchInsightsData(true); // silent refresh
        }, insightsState.refreshIntervalMs);
    }
}

function stopAutoRefresh() {
    if (insightsState.autoRefreshInterval) {
        clearInterval(insightsState.autoRefreshInterval);
        insightsState.autoRefreshInterval = null;
    }
}

function updateLastUpdateTime() {
    const timeElement = document.getElementById('last-update-time');
    if (timeElement && insightsState.lastFetchTime) {
        const time = new Date(insightsState.lastFetchTime);
        timeElement.textContent = time.toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

async function fetchInsightsData(silent = false) {
    const containers = {
        urgent: document.getElementById('urgent-list'),
        renewal: document.getElementById('renewal-list'),
        competition: document.getElementById('competition-list'),
        balance: document.getElementById('balance-list'),
        timeline: document.getElementById('activity-timeline')
    };
    
    // Show loading only if not silent
    if (!silent) {
        Object.values(containers).forEach(el => {
            if (el) el.innerHTML = getLoadingHTML();
        });
    }

    try {
        const response = await authedFetch('/api/insights/dashboard');
        if (!response.ok) throw new Error('فشل جلب البيانات');
        
        const data = await response.json();
        console.log('Insights Data:', data); // Debug log
        insightsState.data = data;
        insightsState.lastFetchTime = new Date();
        
        // Render all sections
        renderStats(data);
        renderUrgentAlerts(data);
        renderRenewalList(data.renewals);
        renderCompetitionList(data.competitions);
        renderBalanceList(data.low_balance);
        renderActivityTimeline(data.recent_activity);
        renderTodaySummary(data);
        renderWeeklyChart(data);
        updateHealthStatus(data);
        
        // Update time
        updateLastUpdateTime();
        
        // Apply current filter
        filterAlerts(insightsState.currentTab);

    } catch (error) {
        console.error('Insights Error:', error);
        if (!silent) {
            showToast('فشل تحديث البيانات', 'error');
        }
        
        const errorHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>حدث خطأ في تحميل البيانات</p>
            </div>
        `;
        Object.values(containers).forEach(el => {
            if (el && !silent) el.innerHTML = errorHTML;
        });
    }
}

function getLoadingHTML() {
    return `
        <div class="loading-placeholder">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        </div>
    `;
}

function renderStats(data) {
    const { stats, renewals = [], competitions = [], low_balance = [] } = data;
    
    // Total Agents (العدد الكلي)
    const agentsEl = document.querySelector('#stat-active-agents .stat-number');
    if (agentsEl) animateNumber(agentsEl, stats?.total_agents || 0);
    
    // Update agents trend to show active count
    const agentsTrend = document.getElementById('stat-agents-trend');
    if (agentsTrend) {
        const activeCount = stats?.active_agents || 0;
        if (activeCount > 0) {
            agentsTrend.innerHTML = `<i class="fas fa-check-circle"></i> <span>${activeCount} نشط</span>`;
            agentsTrend.className = 'stat-trend up';
        } else {
            agentsTrend.innerHTML = `<i class="fas fa-minus-circle"></i> <span>لا يوجد نشط</span>`;
            agentsTrend.className = 'stat-trend';
        }
    }
    
    // Active Competitions
    const compsEl = document.querySelector('#stat-active-comps .stat-number');
    if (compsEl) animateNumber(compsEl, stats?.active_competitions || 0);
    
    // Competitions today badge
    const compsTodayEl = document.getElementById('stat-comps-today');
    if (compsTodayEl) compsTodayEl.textContent = `اليوم: ${stats?.competitions_today || 0}`;
    
    // Total Users
    const usersEl = document.querySelector('#stat-total-users .stat-number');
    if (usersEl) animateNumber(usersEl, stats?.total_users || 0);
    
    // Total Alerts
    const totalAlerts = renewals.length + competitions.length;
    const alertsEl = document.querySelector('#stat-total-alerts .stat-number');
    if (alertsEl) animateNumber(alertsEl, totalAlerts);
    
    // Urgent alerts badge
    const urgentBadge = document.getElementById('urgent-alerts-badge');
    const urgentCount = renewals.filter(r => r.days_remaining < 0).length;
    if (urgentBadge) {
        urgentBadge.textContent = urgentCount;
        urgentBadge.style.display = urgentCount > 0 ? 'flex' : 'none';
    }
    
    // Urgent count in stat
    const urgentStatEl = document.querySelector('#stat-urgent-count span');
    if (urgentStatEl) urgentStatEl.textContent = urgentCount;
    
    // Total Balance
    const balanceEl = document.querySelector('#stat-total-balance .stat-number');
    if (balanceEl) animateNumber(balanceEl, stats?.total_balance || 0);
    
    // Low balance count
    const lowBalanceEl = document.querySelector('#stat-low-balance-count span');
    if (lowBalanceEl) lowBalanceEl.textContent = low_balance.length;
    
    // Monthly Winners
    const winnersEl = document.querySelector('#stat-monthly-winners .stat-number');
    if (winnersEl) animateNumber(winnersEl, stats?.monthly_winners || 0);
}

function animateNumber(element, targetValue) {
    const duration = 800;
    const startValue = parseInt(element.textContent) || 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const currentValue = Math.round(startValue + (targetValue - startValue) * easeProgress);
        element.textContent = currentValue.toLocaleString('ar-EG');
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function renderUrgentAlerts(data) {
    const container = document.getElementById('urgent-list');
    const countEl = document.getElementById('urgent-count');
    
    // Get expired renewals (urgent)
    const urgentItems = (data.renewals || []).filter(r => r.days_remaining < 0);
    
    if (countEl) countEl.textContent = urgentItems.length;
    
    // Show/hide urgent group based on items
    const urgentGroup = document.getElementById('urgent-alerts-group');
    if (urgentGroup) {
        urgentGroup.style.display = urgentItems.length > 0 ? 'block' : 'none';
    }
    
    if (!container) return;
    
    if (urgentItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state success">
                <i class="fas fa-check-circle"></i>
                <p>لا توجد تنبيهات عاجلة</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = urgentItems.map(item => `
        <div class="alert-card urgent">
            <div class="alert-content">
                <h4><i class="fas fa-user-tie"></i> ${item.name}</h4>
                <p>
                    <i class="fas fa-exclamation-triangle"></i>
                    انتهى الاشتراك منذ ${Math.abs(item.days_remaining)} يوم
                </p>
            </div>
            <div class="alert-actions">
                <button class="btn-action success btn-renew" data-renew="${item._id}" data-agent-name="${item.name}">
                    <i class="fas fa-sync-alt"></i> تجديد فوري
                </button>
            </div>
        </div>
    `).join('');
    
    // Attach event listeners to renew buttons
    attachRenewListeners();
}

function renderRenewalList(items) {
    const container = document.getElementById('renewal-list');
    const countEl = document.getElementById('renewal-count');
    
    // Filter only soon (not expired - those are in urgent)
    const soonItems = (items || []).filter(r => r.days_remaining >= 0);
    
    if (countEl) countEl.textContent = soonItems.length;

    if (!container) return;
    
    if (soonItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state success">
                <i class="fas fa-check-circle"></i>
                <p>لا توجد تجديدات قريبة</p>
            </div>
        `;
        return;
    }

    container.innerHTML = soonItems.map(item => `
        <div class="alert-card warning">
            <div class="alert-content">
                <h4><i class="fas fa-user-tie"></i> ${item.name}</h4>
                <p>
                    <i class="fas fa-clock"></i>
                    ينتهي خلال ${item.days_remaining} ${item.days_remaining === 1 ? 'يوم' : 'أيام'}
                </p>
            </div>
            <div class="alert-actions">
                <button class="btn-action primary btn-renew" data-renew="${item._id}" data-agent-name="${item.name}">
                    <i class="fas fa-sync-alt"></i> تجديد
                </button>
            </div>
        </div>
    `).join('');
    
    // Attach event listeners to renew buttons
    attachRenewListeners();
}

function renderCompetitionList(items) {
    const container = document.getElementById('competition-list');
    const countEl = document.getElementById('competition-count');
    
    if (countEl) countEl.textContent = (items || []).length;

    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state success">
                <i class="fas fa-check-circle"></i>
                <p>لا توجد مسابقات معلقة</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const isApproval = item.type === 'approval_needed';
        const icon = isApproval ? 'hourglass-half' : 'trophy';
        const statusText = isApproval ? 'بانتظار الموافقة' : 'بانتظار اختيار الفائزين';
        const cardClass = isApproval ? 'info' : 'warning';
        const targetHash = isApproval ? `#competition-details/${item._id}` : '#winner-roulette';
        
        return `
            <div class="alert-card ${cardClass}">
                <div class="alert-content">
                    <h4><i class="fas fa-${icon}"></i> ${item.title}</h4>
                    <p><i class="fas fa-user-tie"></i> ${item.agent_name}</p>
                    <p style="font-size: 0.8rem; opacity: 0.8;">${statusText}</p>
                </div>
                <div class="alert-actions">
                    <button class="btn-action ${isApproval ? 'primary' : 'success'}" data-navigate="${targetHash}">
                        <i class="fas fa-${isApproval ? 'eye' : 'random'}"></i> 
                        ${isApproval ? 'مراجعة' : 'اختيار'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach navigation listeners
    attachNavigationListeners();
}

function renderBalanceList(items) {
    const container = document.getElementById('balance-list');
    const countEl = document.getElementById('balance-count');
    
    if (countEl) countEl.textContent = (items || []).length;

    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state success">
                <i class="fas fa-check-circle"></i>
                <p>جميع الأرصدة جيدة</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="balance-item">
            <div class="balance-info">
                <h4><i class="fas fa-user-tie"></i> ${item.name}</h4>
                <span class="balance-amount">${item.remaining_balance}$</span>
            </div>
            <button class="btn-action secondary" data-navigate="#agent-competitions">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    `).join('');
    
    // Attach navigation listeners
    attachNavigationListeners();
}

function renderActivityTimeline(items) {
    const container = document.getElementById('activity-timeline');
    
    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>لا يوجد نشاط حديث</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.slice(0, 6).map(item => {
        const icon = getActivityIcon(item.action);
        const timeAgo = getTimeAgo(item.time);
        
        return `
            <div class="timeline-item">
                <div class="timeline-icon">
                    <i class="fas fa-${icon}"></i>
                </div>
                <div class="timeline-content">
                    <h4>${formatActivityText(item)}</h4>
                    <p>${item.details || ''}</p>
                    <div class="timeline-meta">
                        <span><i class="fas fa-user"></i> ${item.user}</span>
                        <span>${timeAgo}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getActivityIcon(action) {
    const icons = {
        'POST_LOGIN': 'sign-in-alt',
        'POST_LOGOUT': 'sign-out-alt',
        'CREATE_COMPETITION': 'trophy',
        'APPROVE_COMPETITION': 'check-circle',
        'SELECT_WINNER': 'medal',
        'RENEW_AGENT': 'sync-alt',
        'GET_DASHBOARD': 'chart-line'
    };
    return icons[action] || 'circle';
}

function formatActivityText(log) {
    const actionMap = {
        'POST_LOGIN': 'تسجيل دخول',
        'POST_LOGOUT': 'تسجيل خروج',
        'CREATE_COMPETITION': 'إنشاء مسابقة',
        'APPROVE_COMPETITION': 'اعتماد مسابقة',
        'SELECT_WINNER': 'اختيار فائز',
        'RENEW_AGENT': 'تجديد اشتراك',
        'GET_DASHBOARD': 'عرض لوحة التحكم'
    };
    return actionMap[log.action] || log.action;
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    return `منذ ${diffDays} يوم`;
}

function renderTodaySummary(data) {
    // These would come from the API - for now using mock/derived data
    const summary = data.today_summary || {};
    
    const completedEl = document.getElementById('summary-completed');
    const pendingEl = document.getElementById('summary-pending');
    const winnersEl = document.getElementById('summary-winners');
    const renewalsEl = document.getElementById('summary-renewals');
    
    if (completedEl) completedEl.textContent = summary.completed_competitions || 0;
    if (pendingEl) pendingEl.textContent = (data.competitions || []).filter(c => c.type === 'approval_needed').length;
    if (winnersEl) winnersEl.textContent = summary.new_winners || 0;
    if (renewalsEl) renewalsEl.textContent = summary.renewals_today || 0;
}

function filterAlerts(tab) {
    const urgentGroup = document.getElementById('urgent-alerts-group');
    const renewalGroup = document.getElementById('renewal-alerts-group');
    const competitionGroup = document.getElementById('competition-alerts-group');
    
    switch(tab) {
        case 'urgent':
            if (urgentGroup) urgentGroup.style.display = 'block';
            if (renewalGroup) renewalGroup.style.display = 'none';
            if (competitionGroup) competitionGroup.style.display = 'none';
            break;
        case 'renewals':
            if (urgentGroup) urgentGroup.style.display = 'none';
            if (renewalGroup) renewalGroup.style.display = 'block';
            if (competitionGroup) competitionGroup.style.display = 'none';
            break;
        case 'competitions':
            if (urgentGroup) urgentGroup.style.display = 'none';
            if (renewalGroup) renewalGroup.style.display = 'none';
            if (competitionGroup) competitionGroup.style.display = 'block';
            break;
        default: // 'all'
            // Show urgent only if there are items
            const hasUrgent = parseInt(document.getElementById('urgent-count')?.textContent || 0) > 0;
            if (urgentGroup) urgentGroup.style.display = hasUrgent ? 'block' : 'none';
            if (renewalGroup) renewalGroup.style.display = 'block';
            if (competitionGroup) competitionGroup.style.display = 'block';
    }
}

// Attach event listeners to renew buttons (called after rendering)
function attachRenewListeners() {
    document.querySelectorAll('.btn-renew[data-renew]').forEach(btn => {
        // Remove old listener first to avoid duplicates
        btn.removeEventListener('click', handleRenewClick);
        btn.addEventListener('click', handleRenewClick);
    });
}

// Handle renew button click
function handleRenewClick(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const agentId = btn.getAttribute('data-renew');
    const agentName = btn.getAttribute('data-agent-name') || 'الوكيل';
    console.log('🔄 Renew clicked:', { agentId, agentName });
    handleRenewAgent(agentId, agentName);
}

// Attach navigation listeners to dynamically created elements
function attachNavigationListeners() {
    document.querySelectorAll('[data-navigate]').forEach(el => {
        // Check if listener already attached
        if (!el.hasAttribute('data-listener-attached')) {
            el.setAttribute('data-listener-attached', 'true');
            el.addEventListener('click', function(e) {
                e.preventDefault();
                const target = this.getAttribute('data-navigate');
                console.log('🚀 Navigate clicked:', target);
                window.location.hash = target;
            });
        }
    });
}

// Handle agent renewal
async function handleRenewAgent(id, name) {
    console.log('🔄 handleRenewAgent called:', { id, name });
    
    const confirmed = await showConfirmDialog(
        'تجديد الاشتراك',
        `هل أنت متأكد من تجديد اشتراك الوكيل "${name}"؟`,
        'تجديد',
        'إلغاء'
    );
    
    console.log('📋 Confirm dialog result:', confirmed);
    
    if (!confirmed) return;

    try {
        console.log('📡 Sending renew request to:', `/api/agents/${id}/renew`);
        const response = await authedFetch(`/api/agents/${id}/renew`, {
            method: 'POST'
        });

        console.log('📥 Renew response status:', response.status);
        
        if (response.ok) {
            showToast('تم تجديد الاشتراك بنجاح', 'success');
            fetchInsightsData(); // Refresh
        } else {
            const data = await response.json();
            console.error('❌ Renew failed:', data);
            showToast(data.message || 'فشل التجديد', 'error');
        }
    } catch (error) {
        console.error('❌ Renew Error:', error);
        showToast('حدث خطأ أثناء التجديد', 'error');
    }
}

// Confirm Dialog Helper
function showConfirmDialog(title, message, confirmText, cancelText) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(4px);
        `;
        
        overlay.innerHTML = `
            <div style="
                background: linear-gradient(145deg, #1e293b, #0f172a);
                border: 1px solid #334155;
                border-radius: 16px;
                padding: 24px;
                max-width: 400px;
                width: 90%;
                text-align: center;
            ">
                <h3 style="color: #f1f5f9; margin: 0 0 12px 0; font-size: 1.2rem;">${title}</h3>
                <p style="color: #94a3b8; margin: 0 0 24px 0;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="confirm-yes" style="
                        padding: 10px 24px;
                        background: linear-gradient(135deg, #10b981, #059669);
                        border: none;
                        border-radius: 8px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                    ">${confirmText}</button>
                    <button id="confirm-no" style="
                        padding: 10px 24px;
                        background: rgba(51, 65, 85, 0.8);
                        border: 1px solid #334155;
                        border-radius: 8px;
                        color: #94a3b8;
                        font-weight: 600;
                        cursor: pointer;
                    ">${cancelText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        overlay.querySelector('#confirm-yes').addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });
        
        overlay.querySelector('#confirm-no').addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
    });
}

// Cleanup when leaving page
function cleanupInsightsPage() {
    stopAutoRefresh();
}

// Render Weekly Chart (with sample data for now)
function renderWeeklyChart(data) {
    const chartGroups = document.querySelectorAll('.chart-bar-group');
    if (!chartGroups.length) return;
    
    // Sample weekly data - ideally this would come from API
    const weeklyData = data?.weekly_stats || [
        { competitions: 3, winners: 5 },
        { competitions: 5, winners: 8 },
        { competitions: 2, winners: 3 },
        { competitions: 7, winners: 12 },
        { competitions: 4, winners: 6 },
        { competitions: 6, winners: 10 },
        { competitions: 8, winners: 15 }
    ];
    
    // Find max for scaling
    const maxComps = Math.max(...weeklyData.map(d => d.competitions), 1);
    const maxWinners = Math.max(...weeklyData.map(d => d.winners), 1);
    const maxValue = Math.max(maxComps, maxWinners);
    
    chartGroups.forEach((group, index) => {
        if (weeklyData[index]) {
            const compBar = group.querySelector('.bar.competitions');
            const winnerBar = group.querySelector('.bar.winners');
            
            if (compBar) {
                const compHeight = (weeklyData[index].competitions / maxValue) * 100;
                setTimeout(() => {
                    compBar.style.height = `${Math.max(compHeight, 5)}%`;
                }, index * 100);
            }
            
            if (winnerBar) {
                const winnerHeight = (weeklyData[index].winners / maxValue) * 100;
                setTimeout(() => {
                    winnerBar.style.height = `${Math.max(winnerHeight, 5)}%`;
                }, index * 100 + 50);
            }
        }
    });
}

// Update System Health Status
function updateHealthStatus(data) {
    const healthEl = document.getElementById('system-health');
    const healthTimeEl = document.getElementById('health-time');
    const indicator = healthEl?.querySelector('.health-indicator');
    
    if (!healthEl || !indicator) return;
    
    // Determine health based on data
    const hasUrgent = (data?.renewals || []).filter(r => r.days_remaining < 0).length > 0;
    const hasLowBalance = (data?.low_balance || []).length > 3;
    
    indicator.classList.remove('healthy', 'warning', 'error');
    
    if (hasUrgent) {
        indicator.classList.add('warning');
        indicator.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>يوجد تنبيهات تحتاج اهتمام</span>
        `;
        healthEl.style.background = 'linear-gradient(145deg, rgba(245, 158, 11, 0.1), transparent)';
        healthEl.style.borderColor = 'rgba(245, 158, 11, 0.2)';
    } else if (hasLowBalance) {
        indicator.classList.add('warning');
        indicator.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>بعض الوكلاء لديهم رصيد منخفض</span>
        `;
        healthEl.style.background = 'linear-gradient(145deg, rgba(99, 102, 241, 0.1), transparent)';
        healthEl.style.borderColor = 'rgba(99, 102, 241, 0.2)';
    } else {
        indicator.classList.add('healthy');
        indicator.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>النظام يعمل بشكل طبيعي</span>
        `;
        healthEl.style.background = 'linear-gradient(145deg, rgba(16, 185, 129, 0.1), transparent)';
        healthEl.style.borderColor = 'rgba(16, 185, 129, 0.2)';
    }
    
    // Update time
    if (healthTimeEl) {
        const now = new Date();
        healthTimeEl.textContent = `آخر فحص: ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    }
}

// Export for router
window.cleanupInsightsPage = cleanupInsightsPage;
