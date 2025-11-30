const LOGS_PER_PAGE = 25;
const LOG_ACTION_TYPES = {
    // Auth & Session
    'USER_LOGIN': 'تسجيل دخول',
    'USER_LOGOUT': 'تسجيل خروج',
    'LOGIN': 'تسجيل دخول',
    'LOGOUT': 'تسجيل خروج',
    
    // Agent Actions
    'AGENT_CREATED': 'إنشاء وكيل',
    'AGENT_DELETED': 'حذف وكيل',
    'AGENT_BULK_DELETE': 'حذف جماعي للوكلاء',
    'AGENT_EDIT': 'تعديل وكيل',
    'POST_AGENTS': 'إنشاء وكيل',
    'PUT_AGENTS': 'تحديث وكيل',
    'DELETE_AGENTS': 'حذف وكيل',
    
    // Profile & Details
    'PROFILE_UPDATE': 'تحديث ملف شخصي',
    'PROFILE_VIEW': 'عرض ملف شخصي',
    'DETAILS_UPDATE': 'تحديث تفاصيل',
    
    // Renewal
    'MANUAL_RENEWAL': 'تجديد رصيد يدوي',
    'AUTO_RENEWAL': 'تجديد رصيد تلقائي',
    'AGENT_BULK_RENEW': 'تجديد رصيد جماعي',
    
    // Competitions
    'COMPETITION_CREATED': 'إنشاء مسابقة',
    'COMPETITION_UPDATE': 'تحديث مسابقة',
    'COMPETITION_DELETED': 'حذف مسابقة',
    'COMPETITION_EXPIRED': 'انتهاء صلاحية مسابقة',
    'POST_COMPETITIONS': 'إنشاء مسابقة',
    'PUT_COMPETITIONS': 'تحديث مسابقة',
    'DELETE_COMPETITIONS': 'حذف مسابقة',
    
    // Tasks
    'TASK_UPDATE': 'تحديث مهمة',
    'TASK_CREATED': 'إنشاء مهمة',
    'TASK_DELETED': 'حذف مهمة',
    'POST_TASKS': 'إنشاء مهمة',
    'PUT_TASKS': 'تحديث مهمة',
    'DELETE_TASKS': 'حذف مهمة',
    'TASK_COMPLETED': 'مهمة مكتملة',
    'TASK_UNCOMPLETED': 'مهمة غير مكتملة',
    
    // Users
    'USER_CREATED': 'إنشاء مستخدم',
    'USER_UPDATED': 'تحديث مستخدم',
    'USER_DELETED': 'حذف مستخدم',
    'USER_VIEW': 'عرض مستخدم',
    'GET_USERS': 'عرض المستخدمين',
    'POST_USERS': 'إنشاء مستخدم',
    'PUT_USERS': 'تحديث مستخدم',
    'DELETE_USERS': 'حذف مستخدم',
    
    // Calendar
    'GET_CALENDAR': 'عرض التقويم',
    'GET_DATA': 'عرض البيانات',
    'POST_DATA': 'إضافة بيانات',
    'PUT_DATA': 'تحديث بيانات',
    'DELETE_DATA': 'حذف بيانات',
    'VIEW_DATA': 'عرض البيانات',
    
    // Templates
    'GET_TEMPLATES': 'عرض القوالب',
    'POST_TEMPLATES': 'إنشاء قالب',
    'PUT_TEMPLATES': 'تحديث قالب',
    'DELETE_TEMPLATES': 'حذف قالب',
    'TEMPLATE_CREATED': 'إنشاء قالب',
    'TEMPLATE_UPDATED': 'تحديث قالب',
    'TEMPLATE_DELETED': 'حذف قالب',
    
    // Stats & Analytics
    'GET_STATS': 'عرض الإحصائيات',
    'GET_ANALYTICS': 'عرض التحليلات',
    
    // System
    'SYSTEM_TASK': 'مهمة نظام',
    'TELEGRAM_ERROR': 'خطأ في التلجرام',
};

// Map common API endpoints + methods to friendly Arabic labels
function mapEndpointToArabic(method, endpoint) {
    if (!method || !endpoint) return '';
    const clean = endpoint.split('?')[0].replace(/\/$/, '');
    const parts = clean.split('/').filter(Boolean); // ['api','users', ...]

    // direct special cases
    if (/\/api\/auth\/login$/i.test(clean)) return 'تسجيل دخول';
    if (/\/api\/auth\/logout$/i.test(clean)) return 'تسجيل خروج';

    const joinLastTwo = parts.slice(-2).join('/');
    const last = parts.slice(-1)[0] || '';

    const resourceMap = {
        'agents': 'وكيل', 'agent': 'وكيل',
        'users': 'مستخدم', 'user': 'مستخدم',
        'competitions': 'مسابقة', 'competition': 'مسابقة',
        'templates': 'قالب', 'template': 'قالب',
        'tasks': 'مهمة', 'task': 'مهمة',
        'logs': 'سجل',
    };

    const pick = (key) => resourceMap[key] || null;

    let resWord = pick(joinLastTwo) || pick(last);

    // If resource not found, try some educated guesses
    if (!resWord && last) {
        // crude singularization for english plurals
        const singular = last.replace(/s$/i, '');
        resWord = pick(singular) || null;
    }

    if (resWord) {
        if (method === 'POST') return `إنشاء ${resWord}`;
        if (method === 'DELETE') return `حذف ${resWord}`;
        if (method === 'GET') return `جلب ${resWord}${['مستخدم','وكيل'].includes(resWord) ? 'ين' : 'ات'}`;
        if (method === 'PUT' || method === 'PATCH') return `تحديث ${resWord}`;
    }

    // Generic fallback by method
    if (method === 'GET') return 'جلب بيانات';
    if (method === 'POST') return 'إرسال بيانات';
    if (method === 'DELETE') return 'حذف بيانات';
    if (method === 'PUT' || method === 'PATCH') return 'تحديث بيانات';
    return '';
}

// Utility function for HTML escaping
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let activityLogViewMode = 'table'; // 'table' | 'cards' | 'timeline'
// Infinite scroll state (for cards & timeline)
let activityLogCurrentPage = 1;
let activityLogTotalPages = 1;
let activityLogAllLogs = [];
let activityLogObserver = null;
const activityLogDebouncers = {};

function debounceActivityLog(key, fn, delay = 400) {
    if (activityLogDebouncers[key]) clearTimeout(activityLogDebouncers[key]);
    activityLogDebouncers[key] = setTimeout(fn, delay);
}

function resetActivityLogState() {
    activityLogCurrentPage = 1;
    activityLogTotalPages = 1;
    activityLogAllLogs = [];
    if (activityLogObserver) {
        activityLogObserver.disconnect();
        activityLogObserver = null;
    }
}

async function renderActivityLogPage() {
    const appContent = document.getElementById('app-content');
    // Ensure user profile is loaded (fallback if navigation is early)
    if (!window.currentUserProfile) {
        try {
            const cached = localStorage.getItem('userProfile');
            if (cached) {
                window.currentUserProfile = JSON.parse(cached);
            } else {
                const resp = await authedFetch('/api/auth/me');
                if (resp.ok) {
                    window.currentUserProfile = await resp.json();
                    localStorage.setItem('userProfile', JSON.stringify(window.currentUserProfile));
                }
            }
        } catch (e) {
            console.warn('[ActivityLog] Failed to hydrate user profile early:', e.message);
        }
    }

    // --- Permission Check ---
    const currentRoleRaw = window.currentUserProfile?.role;
    console.debug('[ActivityLog] Detected current user role:', currentRoleRaw);
    // Support multiple casing / legacy variants just in case
    const normalizedRole = typeof currentRoleRaw === 'string' ? currentRoleRaw.trim().toLowerCase() : '';
    const isSuperAdmin = ['super_admin', 'superadmin', 'owner'].includes(normalizedRole);
    const isAdmin = isSuperAdmin || normalizedRole === 'admin';

    // --- MODIFICATION: Restrict access to Admins and Super Admins only ---
    if (!isAdmin) {
        appContent.innerHTML = `
            <div class="access-denied-container">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية وصول</h2>
                <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
            </div>`;
        return;
    }

    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1><i class="fas fa-history"></i> سجل نشاط الموقع</h1>
                <div class="view-mode-switch">
                    <button id="view-table-btn" class="view-mode-btn active" data-mode="table" title="عرض جدولي"><i class="fas fa-table"></i></button>
                </div>
            </div>
            <div class="filters-container">
                <div class="filter-group">
                    <label for="log-user-filter">فلترة حسب المستخدم</label>
                    <select id="log-user-filter">
                        <option value="all">كل المستخدمين</option>
                        <!-- User options will be populated here -->
                    </select>
                </div>
                <div class="filter-group">
                    <label for="log-action-filter">فلترة حسب الإجراء</label>
                    <select id="log-action-filter">
                        <option value="all">كل الإجراءات</option>
                        ${Object.entries(LOG_ACTION_TYPES).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label for="log-sort-select">ترتيب حسب</label>
                    <select id="log-sort-select">
                        <option value="newest">الأحدث أولاً</option>
                        <option value="oldest">الأقدم أولاً</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="log-date-from">من تاريخ</label>
                    <input type="date" id="log-date-from">
                </div>
                <div class="filter-group">
                    <label for="log-date-to">إلى تاريخ</label>
                    <input type="date" id="log-date-to">
                </div>
                <div class="filter-group">
                    <label for="log-search-text">بحث نصي</label>
                    <input type="search" id="log-search-text" placeholder="ابحث في الوصف...">
                </div>
                <div class="filter-actions">
                    <button id="apply-log-filters" class="btn-primary"><i class="fas fa-filter"></i> تطبيق</button>
                    <button id="reset-log-filters" class="btn-secondary"><i class="fas fa-undo"></i> إعادة تعيين</button>
                    <button id="export-log-csv" class="btn-secondary"><i class="fas fa-file-csv"></i> تصدير CSV</button>
                    <button id="bulk-delete-logs-btn" class="btn-danger" style="display:none;"><i class="fas fa-trash-alt"></i> حذف المحدد</button>
                    <label class="auto-refresh-label"><input type="checkbox" id="auto-refresh-logs"> تحديث تلقائي</label>
                    ${isSuperAdmin ? '<button id="purge-all-logs-btn" class="btn-danger" style="margin-inline-start:8px;"><i class="fas fa-exclamation-triangle"></i> حذف كل السجلات</button>' : ''}
                </div>
            </div>
        </div>
        <div id="activity-log-container">
            <div class="loader-container"><div class="spinner"></div></div>
        </div>

        <!-- Purge Confirmation Modal -->
        <div id="purge-confirm-modal" class="modal" style="display:none;">
            <div class="modal-content" style="max-width:500px;">
                <div class="modal-header" style="background:#dc3545;color:white;">
                    <h2><i class="fas fa-exclamation-triangle"></i> تحذير شديد</h2>
                    <button class="modal-close" id="purge-modal-close">&times;</button>
                </div>
                <div class="modal-body" style="padding:30px;text-align:center;">
                    <i class="fas fa-exclamation-circle" style="font-size:60px;color:#dc3545;margin-bottom:20px;"></i>
                    <h3 style="color:#dc3545;margin-bottom:15px;">سيتم حذف كل السجلات نهائياً</h3>
                    <p style="font-size:16px;margin-bottom:20px;color:#666;">هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع سجلات النشاط من قاعدة البيانات بشكل دائم.</p>
                    <div style="background:#fff3cd;border:1px solid #ffc107;padding:15px;border-radius:8px;margin-bottom:20px;">
                        <p style="margin:0;font-weight:bold;color:#856404;">للتأكيد، اكتب النص التالي:</p>
                        <p style="margin:10px 0;font-size:18px;color:#dc3545;font-weight:bold;">DELETE ALL</p>
                    </div>
                    <input type="text" id="purge-confirm-input" placeholder="اكتب DELETE ALL هنا" style="width:100%;padding:12px;font-size:16px;border:2px solid #ddd;border-radius:6px;text-align:center;margin-bottom:20px;">
                    <div style="display:flex;gap:10px;justify-content:center;">
                        <button id="purge-confirm-btn" class="btn-danger" style="padding:12px 30px;font-size:16px;">
                            <i class="fas fa-trash-alt"></i> تأكيد الحذف النهائي
                        </button>
                        <button id="purge-cancel-btn" class="btn-secondary" style="padding:12px 30px;font-size:16px;">
                            <i class="fas fa-times"></i> إلغاء
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    // View mode listeners
    appContent.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const mode = e.currentTarget.dataset.mode;
            if (mode && ['table','cards','timeline'].includes(mode)) {
                activityLogViewMode = mode;
                resetActivityLogState();
                appContent.querySelectorAll('.view-mode-btn').forEach(b=>b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                fetchAndDisplayLogs(1);
            }
        });
    });
    document.getElementById('apply-log-filters').addEventListener('click', () => { resetActivityLogState(); fetchAndDisplayLogs(1); });
    document.getElementById('reset-log-filters').addEventListener('click', () => {
        ['log-user-filter', 'log-action-filter', 'log-sort-select'].forEach(id => document.getElementById(id).selectedIndex = 0);
        resetActivityLogState();
        const searchInput = document.getElementById('log-search-text'); if (searchInput) searchInput.value = '';
        fetchAndDisplayLogs(1);
    });
    // Bulk delete listener
    document.getElementById('bulk-delete-logs-btn').addEventListener('click', async () => {
        const selected = Array.from(document.querySelectorAll('.log-select-checkbox:checked')).map(cb => cb.dataset.logId).filter(Boolean);
        if (selected.length === 0) return;
        if (!confirm(`هل تريد حذف ${selected.length} سجل/سجلات؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
        try {
            const resp = await authedFetch('/api/logs', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selected })
            });
            if (!resp.ok) throw new Error('فشل حذف السجلات');
            const result = await resp.json();
            showToast(`${result.deletedCount || selected.length} سجل/سجلات حذفت بنجاح.`, 'success');
            fetchAndDisplayLogs(1);
        } catch (err) {
            console.error('Bulk delete error', err);
            showToast('فشل حذف السجلات.', 'error');
        }
    });

    // Purge ALL logs (Super Admin only)
    const purgeBtn = document.getElementById('purge-all-logs-btn');
    if (purgeBtn) {
        purgeBtn.addEventListener('click', () => {
            // Show custom modal instead of browser confirm
            const modal = document.getElementById('purge-confirm-modal');
            const input = document.getElementById('purge-confirm-input');
            if (modal) {
                modal.style.display = 'flex';
                if (input) {
                    input.value = '';
                    setTimeout(() => input.focus(), 100);
                }
            }
        });
    }

    // Purge modal handlers
    const purgeModal = document.getElementById('purge-confirm-modal');
    const purgeConfirmBtn = document.getElementById('purge-confirm-btn');
    const purgeCancelBtn = document.getElementById('purge-cancel-btn');
    const purgeModalClose = document.getElementById('purge-modal-close');
    const purgeInput = document.getElementById('purge-confirm-input');

    const closePurgeModal = () => {
        if (purgeModal) purgeModal.style.display = 'none';
        if (purgeInput) purgeInput.value = '';
    };

    if (purgeCancelBtn) purgeCancelBtn.addEventListener('click', closePurgeModal);
    if (purgeModalClose) purgeModalClose.addEventListener('click', closePurgeModal);
    if (purgeModal) {
        purgeModal.addEventListener('click', (e) => {
            if (e.target === purgeModal) closePurgeModal();
        });
    }

    if (purgeConfirmBtn) {
        purgeConfirmBtn.addEventListener('click', async () => {
            const phrase = purgeInput?.value?.trim();
            if (phrase !== 'DELETE ALL') {
                showToast('يجب كتابة "DELETE ALL" بشكل صحيح للتأكيد', 'error');
                if (purgeInput) purgeInput.focus();
                return;
            }
            closePurgeModal();
            try {
                const resp = await authedFetch('/api/logs/purge', { method: 'DELETE' });
                if (!resp.ok) throw new Error('فشل الحذف الكامل.');
                const result = await resp.json();
                showToast(`تم حذف جميع السجلات (${result.deletedCount || 0}).`, 'success');
                resetActivityLogState();
                fetchAndDisplayLogs(1);
            } catch (e) {
                console.error('[PurgeLogs] error', e);
                showToast('حدث خطأ أثناء الحذف الكامل.', 'error');
            }
        });
    }
    // Debounced search
    const searchInput = document.getElementById('log-search-text');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            debounceActivityLog('search', () => { resetActivityLogState(); fetchAndDisplayLogs(1); }, 450);
        });
    }

    await fetchAndDisplayLogs(1);

    // Fallback: If user just became super admin after initial render or role loaded late, ensure button exists
    if (isSuperAdmin && !document.getElementById('purge-all-logs-btn')) {
        const actionsBar = document.querySelector('.filters-container .filter-actions');
        if (actionsBar) {
            const btn = document.createElement('button');
            btn.id = 'purge-all-logs-btn';
            btn.className = 'btn-danger';
            btn.style.marginInlineStart = '8px';
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> حذف كل السجلات';
            actionsBar.appendChild(btn);
            console.debug('[ActivityLog] Purge button injected via fallback logic');
            // Attach listener immediately
            btn.addEventListener('click', () => {
                const modal = document.getElementById('purge-confirm-modal');
                const input = document.getElementById('purge-confirm-input');
                if (modal) {
                    modal.style.display = 'flex';
                    if (input) {
                        input.value = '';
                        setTimeout(() => input.focus(), 100);
                    }
                }
            });
        }
    }

    // Modal close listeners
    const modal = document.getElementById('activity-log-modal');
    const modalClose = document.getElementById('modal-close');
    if (modal && modalClose) {
        modalClose.addEventListener('click', () => modal.classList.remove('show'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }
}

async function fetchAndDisplayLogs(page) {
    const container = document.getElementById('activity-log-container');
    if (!container) return;
    const isAppend = (activityLogViewMode !== 'table' && page > 1);
    if (!isAppend) {
        container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    }

    const sortValue = document.getElementById('log-sort-select')?.value || 'newest'; // This element is duplicated, but we handle it.
    const userFilter = document.getElementById('log-user-filter')?.value || 'all';
    const actionFilter = document.getElementById('log-action-filter')?.value || 'all';

    try {
        const dateFrom = document.getElementById('log-date-from')?.value;
        const dateTo = document.getElementById('log-date-to')?.value;
        const searchQ = document.getElementById('log-search-text')?.value || '';

        // Build query params safely: only include keys with defined values
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', LOGS_PER_PAGE);
        params.set('sort', sortValue);
        // only send filters when the user actually selected a value other than 'all'
        if (userFilter && userFilter !== 'all') params.set('user_id', userFilter);
        if (actionFilter && actionFilter !== 'all') params.set('action_type', actionFilter);
        params.set('populate', 'user'); // Request user data to be populated
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        if (searchQ) params.set('q', searchQ);

        const response = await authedFetch(`/api/logs?${params.toString()}`);
        if (!response.ok) {
            throw new Error('فشل جلب بيانات السجل.');
        }
        const { data: logs, count } = await response.json();

        activityLogTotalPages = Math.ceil((count || 0) / LOGS_PER_PAGE);
        activityLogCurrentPage = page;
        if (isAppend) {
            activityLogAllLogs = activityLogAllLogs.concat(logs || []);
        } else {
            activityLogAllLogs = logs || [];
        }

        displayLogsPage(activityLogAllLogs, activityLogCurrentPage, count || 0, isAppend);

        // --- NEW: Populate user filter if not already populated ---
        const userFilterSelect = document.getElementById('log-user-filter');
        if (userFilterSelect && userFilterSelect.options.length <= 1) {
            const usersResponse = await authedFetch('/api/users?limit=1000&select=full_name,_id');
            if (usersResponse.ok) {
                const { users } = await usersResponse.json(); // The endpoint returns { users: [...] }
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

// Export visible logs (fetch a large set) as CSV
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'export-log-csv') {
        try {
            const params = new URLSearchParams({ limit: 10000, sort: 'newest', populate: 'user' });
            const dateFrom = document.getElementById('log-date-from')?.value;
            const dateTo = document.getElementById('log-date-to')?.value;
            const searchQ = document.getElementById('log-search-text')?.value || '';
            const userFilter = document.getElementById('log-user-filter')?.value || 'all';
            const actionFilter = document.getElementById('log-action-filter')?.value || 'all';
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            if (searchQ) params.set('q', searchQ);
            if (userFilter) params.set('user_id', userFilter);
            if (actionFilter) params.set('action_type', actionFilter);

            const resp = await authedFetch(`/api/logs?${params.toString()}`);
            if (!resp.ok) throw new Error('فشل تحميل السجلات لتصديرها');
            const { data: logs } = await resp.json();
            const rows = logs.map(l => ({
                createdAt: new Date(l.createdAt).toLocaleString('ar-EG'),
                user: l.user_name || 'النظام',
                action_type: l.action_type,
                description: l.description,
                metadata: JSON.stringify(l.metadata || {})
            }));
            const header = Object.keys(rows[0] || {}).join(',') + '\n';
            const csv = header + rows.map(r => Object.values(r).map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `activity_logs_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed', err);
            showToast('فشل تصدير السجلات.', 'error');
        }
    }
});

// Auto-refresh handling
let activityLogAutoRefreshInterval = null;
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'auto-refresh-logs') {
        const checked = e.target.checked;
        if (checked) {
            activityLogAutoRefreshInterval = setInterval(() => fetchAndDisplayLogs(1), 15000); // refresh every 15s
        } else {
            if (activityLogAutoRefreshInterval) clearInterval(activityLogAutoRefreshInterval);
        }
    }
});

function setupInfiniteScroll() {
    const sentinel = document.getElementById('log-scroll-sentinel');
    if (!sentinel) return;
    if (activityLogObserver) activityLogObserver.disconnect();
    activityLogObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (activityLogCurrentPage < activityLogTotalPages) {
                    activityLogObserver.disconnect();
                    fetchAndDisplayLogs(activityLogCurrentPage + 1);
                }
            }
        });
    }, { rootMargin: '200px' });
    activityLogObserver.observe(sentinel);
}

function displayLogsPage(logs, page, totalCount, isAppend = false) {
    const container = document.getElementById('activity-log-container');
    if (!container) return;

    page = parseInt(page);
    const totalPages = Math.ceil(totalCount / LOGS_PER_PAGE);

    let logHtml = logs.length > 0 ? generateActivityLogHTML(logs, activityLogViewMode) : '<p class="no-results-message">لا توجد سجلات لعرضها.</p>';

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

    // For infinite modes remove pagination & add sentinel
    if (activityLogViewMode !== 'table') {
        paginationHtml = '';
        // Provide summary stats
        const summary = (() => {
            if (!Array.isArray(logs) || !logs.length) return '';
            const counts = logs.reduce((acc,l)=>{ acc[l.action_type] = (acc[l.action_type]||0)+1; return acc; },{});
            const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>`<span class="log-stat-chip">${esc(LOG_ACTION_TYPES[k]||k)}: ${v}</span>`).join('');
            return `<div class="log-stats-bar">${top}</div>`;
        })();
        container.innerHTML = summary + logHtml + `<div id="log-scroll-sentinel" class="scroll-sentinel">${page < activityLogTotalPages ? '<div class="loader-inline"><div class="spinner"></div> تحميل المزيد ...</div>' : '<div class="end-of-results">انتهت السجلات</div>'}</div>`;
        if (page < activityLogTotalPages) setupInfiniteScroll();
    } else {
        container.innerHTML = `${logHtml}${paginationHtml}`;
    }

    // Setup selection behavior: select-all and per-row checkboxes
    const selectAll = container.querySelector('#select-all-logs');
    const bulkBtn = document.getElementById('bulk-delete-logs-btn');

    const updateBulkVisibility = () => {
        const any = container.querySelectorAll('.log-select-checkbox:checked').length > 0;
        if (bulkBtn) bulkBtn.style.display = any ? 'inline-flex' : 'none';
        if (selectAll) selectAll.checked = container.querySelectorAll('.log-select-checkbox').length > 0 && any && (container.querySelectorAll('.log-select-checkbox:checked').length === container.querySelectorAll('.log-select-checkbox').length);
    };

    container.querySelectorAll('.log-select-checkbox').forEach(cb => {
        cb.addEventListener('change', () => updateBulkVisibility());
    });

    if (selectAll) {
        selectAll.addEventListener('change', (e) => {
            const checked = e.target.checked;
            container.querySelectorAll('.log-select-checkbox').forEach(cb => { cb.checked = checked; });
            updateBulkVisibility();
        });
    }

    if (activityLogViewMode === 'table') {
        container.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newPage = e.currentTarget.dataset.page;
                if (newPage) {
                    fetchAndDisplayLogs(parseInt(newPage));
                }
            });
        });
    }

    // Attach meta toggle listeners
    container.querySelectorAll('.log-meta-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            toggleMeta(e.currentTarget);
        });
    });

    // Attach copy endpoint listeners
    container.querySelectorAll('.api-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            copyEndpoint(e.currentTarget);
        });
    });

    // Attach copy meta listeners
    container.querySelectorAll('.log-meta-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            copyMeta(e.currentTarget);
        });
    });
}

/**
 * Generates the HTML for a list of activity logs using a card-based design.
 * @param {Array} logs - The array of log objects.
 * @returns {string} The generated HTML string.
 */
function generateActivityLogHTML(logs, mode='table') {
    const getActionDetails = (actionType) => {
        if (!actionType) return { group: 'unknown', icon: 'fa-question-circle', color: '#6c757d' };
        const upper = actionType.toUpperCase();
        if (upper.includes('CREATE') || upper.startsWith('POST ')) return { group: 'create', icon: 'fa-plus', color: '#28a745' };
        if (upper.includes('DELETE') || upper.startsWith('DELETE ')) return { group: 'delete', icon: 'fa-trash', color: '#dc3545' };
        if (upper.includes('UPDATE') || upper.startsWith('PUT ') || upper.startsWith('PATCH ')) return { group: 'update', icon: 'fa-edit', color: '#007bff' };
        if (upper.includes('RENEW')) return { group: 'renew', icon: 'fa-redo', color: '#ffc107' };
        if (upper.includes('EXPIRE')) return { group: 'expire', icon: 'fa-clock', color: '#6c757d' };
        if (upper.startsWith('GET ')) return { group: 'read', icon: 'fa-eye', color: '#17a2b8' };
        return { group: 'other', icon: 'fa-info', color: '#17a2b8' };
    };

    // Helper function for HTML escaping (moved to top)

    // Group by date for timeline/cards
    const byDate = {};
    logs.forEach(l => {
        const d = l.createdAt ? new Date(l.createdAt) : null;
        const key = d ? d.toISOString().slice(0,10) : 'unknown';
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(l);
    });

    if (mode === 'cards') {
        return `<div class="activity-log-cards">${logs.map(log => {
            const { group, icon, color } = getActionDetails(log.action_type);
            const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}) : '-';
            const date = log.createdAt ? new Date(log.createdAt).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'}) : '-';
            const userName = log.user?.full_name || log.user_name || 'النظام';
            let description = log.description || '';
            let actionText = LOG_ACTION_TYPES[log.action_type] || mapEndpointToArabic('', log.action_type) || log.action_type;
            if (!description.trim()) description = actionText;
            let metaObj = null; try { metaObj = log.metadata && Object.keys(log.metadata).length ? log.metadata : null; } catch(e){ metaObj=null; }
            const encodedMeta = metaObj ? encodeURIComponent(JSON.stringify(metaObj)) : '';
            return `<div class="activity-log-card" data-action-group="${group}">
                <div class="log-card-header">
                    <span class="log-badge badge-${group}"><i class="fas ${icon}"></i></span>
                    <div class="log-card-time">
                        <span class="log-time-hm">${esc(time)}</span>
                        <span class="log-time-date">${esc(date)}</span>
                    </div>
                    <div class="log-card-user"><i class="fas fa-user"></i> ${esc(userName)}</div>
                </div>
                <div class="log-card-body">
                    <p class="log-card-desc">${esc(description)}</p>
                    <div class="log-card-meta-actions">
                        ${metaObj ? `<button class="log-meta-toggle small" data-toggle="meta" data-meta="${encodedMeta}"><i class="fas fa-info-circle"></i> تفاصيل</button>` : ''}
                    </div>
                </div>
                <div class="log-card-footer">${esc(actionText)}</div>
                <div class="log-card-select"><input type="checkbox" class="log-select-checkbox" data-log-id="${esc(log._id || '')}" aria-label="اختر السجل"></div>
            </div>`;
        }).join('')}</div>`;
    }

    if (mode === 'timeline') {
        return `<div class="activity-log-timeline">${Object.entries(byDate).sort((a,b)=> a[0]<b[0]?1:-1).map(([day, items])=>{
            return `<div class="timeline-day"><div class="timeline-day-header"><i class="fas fa-calendar-day"></i> ${day}</div>
            <div class="timeline-items">${items.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)).map(log=>{
                const { group, icon } = getActionDetails(log.action_type);
                const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}) : '-';
                const userName = log.user?.full_name || log.user_name || 'النظام';
                let description = log.description || '';
                let actionText = LOG_ACTION_TYPES[log.action_type] || log.action_type;
                if (!description.trim()) description = actionText;
                let metaObj = null; try { metaObj = log.metadata && Object.keys(log.metadata).length ? log.metadata : null; } catch(e){ metaObj=null; }
                const encodedMeta = metaObj ? encodeURIComponent(JSON.stringify(metaObj)) : '';
                return `<div class="timeline-item" data-action-group="${group}">
                    <div class="timeline-marker"><i class="fas ${icon}"></i></div>
                    <div class="timeline-content">
                        <div class="timeline-meta"><span class="timeline-time">${esc(time)}</span><span class="timeline-user"><i class="fas fa-user"></i> ${esc(userName)}</span></div>
                        <div class="timeline-desc">${esc(description)}</div>
                        <div class="timeline-actions">${metaObj ? `<button class="log-meta-toggle tiny" data-toggle="meta" data-meta="${encodedMeta}"><i class="fas fa-info-circle"></i></button>` : ''}
                        <input type="checkbox" class="log-select-checkbox" data-log-id="${esc(log._id || '')}" aria-label="اختر السجل"></div>
                    </div>
                </div>`;
            }).join('')}</div></div>`;
        }).join('')}</div>`;
    }

    // Default (table) legacy path
    const logRows = logs.map(log => {
        const { group, icon } = getActionDetails(log.action_type);
        const time = log.createdAt ? new Date(log.createdAt).toLocaleString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';
        const userName = log.user?.full_name || log.user_name || 'النظام';
        
        // Use description from backend (already in Arabic) as primary display text
        let description = log.description || '';
        
        // Fallback: translate action_type to Arabic if description is missing
        let actionText = '';
        if (LOG_ACTION_TYPES[log.action_type]) {
            actionText = LOG_ACTION_TYPES[log.action_type];
        } else {
            // Comprehensive translation of English action types to Arabic
            actionText = log.action_type
                // HTTP Methods
                .replace(/^GET[_\s]+/i, 'عرض ')
                .replace(/^POST[_\s]+/i, 'إنشاء ')
                .replace(/^PUT[_\s]+/i, 'تحديث ')
                .replace(/^PATCH[_\s]+/i, 'تعديل ')
                .replace(/^DELETE[_\s]+/i, 'حذف ')
                // Common Resources
                .replace(/\bDATA\b/gi, 'البيانات')
                .replace(/\bCALENDAR\b/gi, 'التقويم')
                .replace(/\bAGENTS?\b/gi, 'الوكلاء')
                .replace(/\bUSERS?\b/gi, 'المستخدمين')
                .replace(/\bCOMPETITIONS?\b/gi, 'المسابقات')
                .replace(/\bTASKS?\b/gi, 'المهام')
                .replace(/\bTEMPLATES?\b/gi, 'القوالب')
                .replace(/\bLOGS?\b/gi, 'السجلات')
                .replace(/\bSTATS?\b/gi, 'الإحصائيات')
                .replace(/\bANALYTICS?\b/gi, 'التحليلات')
                // Actions
                .replace(/\bVIEW\b/gi, 'عرض')
                .replace(/\bCREATED?\b/gi, 'إنشاء')
                .replace(/\bUPDATED?\b/gi, 'تحديث')
                .replace(/\bDELETED?\b/gi, 'حذف')
                .replace(/\bARCHIVED?\b/gi, 'أرشفة')
                .replace(/\bRESTORED?\b/gi, 'استعادة')
                // Clean up
                .replace(/_/g, ' ')
                .trim();
        }
        
        let metaObj = null;
        try { metaObj = log.metadata && Object.keys(log.metadata).length ? log.metadata : null; } catch (e) { metaObj = null; }

        // Encode metadata for modal
        const encodedMeta = metaObj ? encodeURIComponent(JSON.stringify(metaObj)) : '';

        // Build description HTML - prioritize backend description (already Arabic)
        let descriptionHtml = '';
        
        // If description exists and is already in Arabic (from backend), use it directly
        if (description && description.trim()) {
            descriptionHtml = esc(description);
        } else {
            // Fallback to translated action text
            descriptionHtml = esc(actionText);
        }

        // Render metadata as key/value list when available
        let metaHtml = '';
        if (metaObj) {
            const entries = Object.entries(metaObj).map(([k, v]) => {
                const val = (typeof v === 'object') ? JSON.stringify(v) : String(v);
                return `<div class="log-meta-item"><div class="meta-key">${esc(k)}</div><div class="meta-val">${esc(val)}</div></div>`;
            }).join('');
            // include encoded full JSON for easy copying
            metaHtml = `<div class="log-meta-copy-wrap"><button class="log-meta-copy" data-copy="meta" data-meta="${encodedMeta}"><i class="fas fa-copy"></i> نسخ البيانات</button></div><div class="log-meta-list">${entries}</div>`;
        }

        return `
            <tr class="log-row" data-action-group="${group}" data-log-id="${esc(log._id || '')}">
                <td><input type="checkbox" class="log-select-checkbox" data-log-id="${esc(log._id || '')}" aria-label="اختر السجل"></td>
                <td class="log-icon-cell"><i class="fas ${icon}" data-action-group="${group}"></i></td>
                <td class="log-description-cell">${descriptionHtml}</td>
                <td class="log-action-cell">${esc(actionText)}</td>
                <td class="log-user-cell">${esc(userName)}</td>
                <td class="log-time-cell">${esc(time)}</td>
                <td class="log-details-cell">
                    ${metaObj ? `<button class="log-meta-toggle" data-toggle="meta" data-meta="${encodedMeta}">عرض التفاصيل</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    // Add a header for the select-all checkbox
    const tableHeader = `
        <thead>
            <tr>
                <th><input type="checkbox" id="select-all-logs" aria-label="اختر كل السجلات">
                    <label for="select-all-logs">اختر الكل</label></th>
                <th>الأيقونة</th>
                <th>الوصف</th>
                <th>الإجراء</th>
                <th>المستخدم</th>
                <th>التاريخ والوقت</th>
                <th>التفاصيل</th>
            </tr>
        </thead>
    `;

    return `<div class="activity-log-table-container">
        <table class="activity-log-table">
            ${tableHeader}
            <tbody>${logRows}</tbody>
        </table>
    </div>`;
}

function toggleMeta(button) {
    const enc = button.dataset.meta || '';
    if (!enc) return;
    const meta = decodeURIComponent(enc);
    const modal = document.getElementById('activity-log-modal');
    const modalBody = document.getElementById('modal-body');
    if (modal && modalBody) {
        // Parse and display metadata
        try {
            const metaObj = JSON.parse(meta);
            const entries = Object.entries(metaObj).map(([k, v]) => {
                const val = (typeof v === 'object') ? JSON.stringify(v) : String(v);
                return `<div class="log-meta-item"><div class="meta-key">${esc(k)}</div><div class="meta-val">${esc(val)}</div></div>`;
            }).join('');
            modalBody.innerHTML = `<div class="log-meta-list">${entries}</div>`;
        } catch (e) {
            modalBody.innerHTML = `<pre>${esc(meta)}</pre>`;
        }
        modal.classList.add('show');
    }
}

// Copy endpoint (from API-like descriptions)
function copyEndpoint(button) {
    const endpoint = button.dataset.endpoint || '';
    if (!endpoint) return;
    navigator.clipboard.writeText(endpoint).then(() => {
        if (typeof showToast === 'function') showToast('تم نسخ المسار إلى الحافظة', 'info');
        else alert('تم نسخ المسار');
    }).catch(() => {
        if (typeof showToast === 'function') showToast('فشل نسخ المسار', 'error');
        else alert('فشل نسخ المسار');
    });
}

// Copy full metadata JSON
function copyMeta(button) {
    const enc = button.dataset.meta || '';
    if (!enc) return;
    const meta = decodeURIComponent(enc);
    navigator.clipboard.writeText(meta).then(() => {
        if (typeof showToast === 'function') showToast('تم نسخ البيانات بنجاح', 'info');
        else alert('تم نسخ البيانات');
    }).catch(() => {
        if (typeof showToast === 'function') showToast('فشل نسخ البيانات', 'error');
        else alert('فشل نسخ البيانات');
    });
}