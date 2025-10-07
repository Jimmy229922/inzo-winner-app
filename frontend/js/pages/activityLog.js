const LOGS_PER_PAGE = 25;
const LOG_ACTION_TYPES = {
    'AGENT_CREATED': 'إنشاء وكيل',
    'AGENT_DELETED': 'حذف وكيل',
    'AGENT_BULK_DELETE': 'حذف جماعي للوكلاء',
    'PROFILE_UPDATE': 'تحديث ملف شخصي',
    'DETAILS_UPDATE': 'تحديث تفاصيل',
    'MANUAL_RENEWAL': 'تجديد رصيد يدوي',
    'AUTO_RENEWAL': 'تجديد رصيد تلقائي',
    'AGENT_BULK_RENEW': 'تجديد رصيد جماعي',
    'COMPETITION_CREATED': 'إنشاء مسابقة',
    'COMPETITION_UPDATE': 'تحديث مسابقة',
    'COMPETITION_DELETED': 'حذف مسابقة',
    'COMPETITION_EXPIRED': 'انتهاء صلاحية مسابقة',
    'TASK_UPDATE': 'تحديث مهمة',
};

async function renderActivityLogPage() {
    const appContent = document.getElementById('app-content');
    
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';

    // --- FIX: Allow all users to view the page as per previous request ---
    // if (!isAdmin) {
    //     appContent.innerHTML = `
    //         <div class="access-denied-container">
    //             <i class="fas fa-lock"></i>
    //             <h2>ليس لديك صلاحية وصول</h2>
    //             <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
    //         </div>`;
    //     return;
    // }

    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1><i class="fas fa-history"></i> سجل نشاط الموقع</h1>
            </div>
            <div class="filters-container">
                <div class="filter-group">
                    <label for="log-user-filter">فلترة حسب المستخدم:</label>
                    <select id="log-user-filter">
                        <option value="all">كل المستخدمين</option>
                        <!-- User options will be populated here -->
                    </select>
                </div>
                <div class="filter-group">
                    <label for="log-action-filter">فلترة حسب الإجراء:</label>
                    <select id="log-action-filter">
                        <option value="all">كل الإجراءات</option>
                        ${Object.entries(LOG_ACTION_TYPES).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}
                    </select>
                </div>
                <div class="sort-container">
                    <label for="log-sort-select">ترتيب حسب:</label>
                    <select id="log-sort-select">
                        <option value="newest">الأحدث أولاً</option>
                        <option value="oldest">الأقدم أولاً</option>
                    </select>
                </div>
                <div class="filter-actions">
                    <button id="apply-log-filters" class="btn-primary"><i class="fas fa-filter"></i> تطبيق</button>
                    <button id="reset-log-filters" class="btn-secondary"><i class="fas fa-undo"></i> إعادة تعيين</button>
                </div>
            </div>
        </div>
        <div id="activity-log-container">
            <div class="loader-container"><div class="spinner"></div></div>
        </div>
    `;

    document.getElementById('apply-log-filters').addEventListener('click', () => fetchAndDisplayLogs(1));
    document.getElementById('reset-log-filters').addEventListener('click', () => {
        ['log-user-filter', 'log-action-filter', 'log-sort-select'].forEach(id => document.getElementById(id).selectedIndex = 0);
        fetchAndDisplayLogs(1);
    });
    await fetchAndDisplayLogs(1);
}

async function fetchAndDisplayLogs(page) {
    const container = document.getElementById('activity-log-container');
    if (!container) return;
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    const sortValue = document.getElementById('log-sort-select')?.value || 'newest';
    const userFilter = document.getElementById('log-user-filter')?.value || 'all';
    const actionFilter = document.getElementById('log-action-filter')?.value || 'all';

    try {
        const queryParams = new URLSearchParams({
            page: page,
            limit: LOGS_PER_PAGE,
            sort: sortValue,
            user_id: userFilter,
            action_type: actionFilter,
            populate: 'user' // Request user data to be populated
        });

        const response = await authedFetch(`/api/logs?${queryParams.toString()}`);
        if (!response.ok) {
            throw new Error('فشل جلب بيانات السجل.');
        }
        const { data: logs, count } = await response.json();

        displayLogsPage(logs || [], page, count || 0);

        // --- NEW: Populate user filter if not already populated ---
        const userFilterSelect = document.getElementById('log-user-filter');
        if (userFilterSelect && userFilterSelect.options.length <= 1) {
            const usersResponse = await authedFetch('/api/users?limit=1000&select=full_name');
            if (usersResponse.ok) {
                const { data: users } = await usersResponse.json();
                // Add a "System" option
                userFilterSelect.innerHTML += `<option value="system">النظام (تلقائي)</option>`;
                // --- FIX: Ensure 'users' is an array before iterating ---
                if (Array.isArray(users)) {
                    users.forEach(user => {
                        const option = new Option(user.full_name, user._id);
                        userFilterSelect.add(option);
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error fetching logs:", error);
        container.innerHTML = `<p class="error">${error.message}</p>`;
    }
}

function displayLogsPage(logs, page, totalCount) {
    const container = document.getElementById('activity-log-container');
    if (!container) return;

    page = parseInt(page);
    const totalPages = Math.ceil(totalCount / LOGS_PER_PAGE);

    // Reuse the existing log HTML generator from profile.js
    const logHtml = logs.length > 0 ? generateActivityLogHTML(logs) : '<p class="no-results-message">لا توجد سجلات لعرضها.</p>';

    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml = '<div class="pagination-container">';
        const maxVisiblePages = 5; // Max number of page links to show
        let startPage, endPage;

        if (totalPages <= maxVisiblePages) {
            startPage = 1;
            endPage = totalPages;
        } else {
            const maxPagesBeforeCurrent = Math.floor(maxVisiblePages / 2);
            const maxPagesAfterCurrent = Math.ceil(maxVisiblePages / 2) - 1;
            if (page <= maxPagesBeforeCurrent) {
                startPage = 1;
                endPage = maxVisiblePages;
            } else if (page + maxPagesAfterCurrent >= totalPages) {
                startPage = totalPages - maxVisiblePages + 1;
                endPage = totalPages;
            } else {
                startPage = page - maxPagesBeforeCurrent;
                endPage = page + maxPagesAfterCurrent;
            }
        }

        paginationHtml += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i> السابق</button>`;

        if (startPage > 1) {
            paginationHtml += `<button class="page-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                paginationHtml += `<span class="page-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        paginationHtml += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي <i class="fas fa-chevron-left"></i></button>`;
        paginationHtml += '</div>';
    }

    container.innerHTML = `${logHtml}${paginationHtml}`;

    // Attach pagination listeners
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newPage = e.currentTarget.dataset.page;
            if (newPage) {
                fetchAndDisplayLogs(parseInt(newPage));
            }
        });
    });
}

/**
 * Generates the HTML for a list of activity logs, grouped by date.
 * This function is now self-contained within this file.
 * @param {Array} logs - The array of log objects.
 * @returns {string} The generated HTML string.
 */
function generateActivityLogHTML(logs) {
    const getLogIconDetails = (actionType) => {
        if (actionType.includes('CREATED')) return { icon: 'fa-user-plus', colorClass: 'log-icon-create' };
        if (actionType.includes('DELETED')) return { icon: 'fa-user-slash', colorClass: 'log-icon-delete' };
        if (actionType.includes('PROFILE_UPDATE')) return { icon: 'fa-user-edit', colorClass: 'log-icon-profile' };
        if (actionType.includes('MANUAL_RENEWAL')) return { icon: 'fa-sync-alt', colorClass: 'log-icon-renewal' };
        if (actionType.includes('DETAILS_UPDATE')) return { icon: 'fa-cogs', colorClass: 'log-icon-details' };
        if (actionType.includes('COMPETITION_CREATED')) return { icon: 'fa-trophy', colorClass: 'log-icon-competition' };
        if (actionType.includes('WINNERS_SELECTION_REQUESTED')) return { icon: 'fa-question-circle', colorClass: 'log-icon-telegram' };
        return { icon: 'fa-history', colorClass: 'log-icon-generic' };
    };

    const groupLogsByDate = (logs) => {
        const groups = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const todayStr = today.toISOString().split('T')[0];
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        logs.forEach(log => {
            try {
                if (!log.createdAt) {
                    console.warn('Log entry missing createdAt:', log);
                    return;
                }
                const logDate = new Date(log.createdAt);
                if (isNaN(logDate.getTime())) {
                    console.warn('Invalid date in log:', log.createdAt);
                    return;
                }
                const logDateStr = logDate.toISOString().split('T')[0];
                let dateKey;
                if (logDateStr === todayStr) dateKey = 'اليوم';
                else if (logDateStr === yesterdayStr) dateKey = 'الأمس';
                else dateKey = logDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                if (!groups[dateKey]) groups[dateKey] = [];
                groups[dateKey].push(log);
            } catch (error) {
                console.error('Error processing log entry:', error, log);
            }
        });
        return groups;
    };

    const groupedLogs = groupLogsByDate(logs);
    let html = '<div class="log-timeline-v2" id="site-log-timeline">';

    for (const date in groupedLogs) {
        html += `
            <div class="log-date-group">
                <div class="log-date-header">${date}</div>
                ${groupedLogs[date].map(log => `
                    <div class="log-item-v2">
                        <div class="log-item-icon-v2 ${getLogIconDetails(log.action_type).colorClass}"><i class="fas ${getLogIconDetails(log.action_type).icon}"></i></div>
                        <div class="log-item-content-v2">
                            <p class="log-description">${log.description}</p>
                            <p class="log-timestamp">
                                <i class="fas fa-user"></i> ${log.user_name || 'نظام'}
                                <span class="log-separator"></span>
                                <i class="fas fa-clock"></i> ${new Date(log.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    html += '</div>';
    return html;
}