const LOGS_PER_PAGE = 25;
const LOG_ACTION_TYPES = {
    'USER_LOGIN': 'تسجيل دخول', 
    'USER_LOGOUT': 'تسجيل خروج',
    'AGENT_CREATED': 'إضافة وكيل جديد', 
    'AGENT_DELETED': 'حذف وكيل', 
    'AGENT_EDIT': 'تعديل بيانات وكيل',
    'COMPETITION_CREATED': 'إنشاء مسابقة جديدة', 
    'COMPETITION_UPDATE': 'تعديل مسابقة', 
    'COMPETITION_DELETED': 'حذف مسابقة',
    'COMPETITION_COMPLETED': 'انتهاء مسابقة',
    'DETAILS_UPDATE': 'تحديث تفاصيل',
    'RANK_CHANGE': 'تغيير المرتبة',
    'TASK_CREATED': 'إضافة مهمة جديدة', 
    'TASK_UPDATE': 'تعديل مهمة', 
    'TASK_DELETED': 'حذف مهمة',
    'TASK_COMPLETED': 'إكمال مهمة',
    'TASK_UNCOMPLETED': 'إلغاء إكمال مهمة',
    'USER_CREATED': 'إضافة مستخدم جديد', 
    'USER_UPDATED': 'تعديل بيانات مستخدم', 
    'USER_DELETED': 'حذف مستخدم',
    'MANUAL_RENEWAL': 'تجديد اشتراك يدوي', 
    'AUTO_RENEWAL': 'تجديد اشتراك تلقائي',
    'AGENT_BULK_RENEW': 'تجديد جماعي للوكلاء',
    'BULK_BROADCAST': 'إرسال رسالة جماعية',
    'TEMPLATE_UPDATED': 'تحديث قالب مسابقة',
    'SYSTEM_TASK': 'عملية نظام تلقائية', 
    'TELEGRAM_ERROR': 'خطأ في تيليجرام'
};

let activityLogViewMode = 'table'; // 'table' | 'timeline'
let activityLogCurrentPage = 1;
let activityLogTotalPages = 1;
let selectedLogIds = new Set();

async function renderActivityLogPage() {
    const appContent = document.getElementById('app-content');
    selectedLogIds.clear();
    
    // 1. Permission Check
    let profile = window.currentUserProfile;
    
    // Fallback: check if currentUserProfile is defined in the scope (from main.js)
    if (!profile && typeof currentUserProfile !== 'undefined') {
        profile = currentUserProfile;
    }

    if (!profile) {
        try {
            profile = await fetchUserProfile();
        } catch (e) {
            console.error('Failed to fetch profile', e);
        }
    }
    
    // If still no profile, try localStorage as last resort
    if (!profile) {
        try {
            const cached = localStorage.getItem('userProfile');
            if (cached) profile = JSON.parse(cached);
        } catch (e) {}
    }

    const role = (profile?.role || '').toLowerCase();
    console.log('[ActivityLog] Permission check. Role:', role);

    if (!['admin', 'super_admin', 'superadmin'].includes(role)) {
        appContent.innerHTML = `<div class="access-denied-container"><h2>⛔ ليس لديك صلاحية</h2><p>Role detected: ${role || 'None'}</p></div>`;
        return;
    }

    // 2. Fetch Stats
    let stats = { todayCount: 0, criticalCount: 0, topUser: null, topAction: null };
    try {
        const statsResp = await authedFetch('/api/logs/stats');
        if (statsResp.ok) stats = await statsResp.json();
    } catch (e) { console.warn('Failed to load stats', e); }

    // 3. Render Layout
    appContent.innerHTML = `
        <div class="page-header">
            <h1><i class="fas fa-history"></i> سجل نشاط الموقع</h1>
            <div class="header-actions">
                <button id="refresh-logs-btn" class="btn-secondary"><i class="fas fa-sync-alt"></i> تحديث</button>
            </div>
        </div>

        <!-- Analytics Dashboard -->
        <div class="log-stats-grid animate-fade-in">
            <div class="log-stat-card">
                <div class="log-stat-icon"><i class="fas fa-calendar-day"></i></div>
                <div class="log-stat-info">
                    <span class="log-stat-value">${stats.todayCount}</span>
                    <span class="log-stat-label">نشاط اليوم</span>
                </div>
            </div>
            <div class="log-stat-card">
                <div class="log-stat-icon danger"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="log-stat-info">
                    <span class="log-stat-value">${stats.criticalCount}</span>
                    <span class="log-stat-label">عمليات خطرة</span>
                </div>
            </div>
            <div class="log-stat-card">
                <div class="log-stat-icon success"><i class="fas fa-user-shield"></i></div>
                <div class="log-stat-info">
                    <span class="log-stat-value">${stats.topUser?.name || '—'}</span>
                    <span class="log-stat-label">الأنشط اليوم (${stats.topUser?.count || 0})</span>
                </div>
            </div>
            <div class="log-stat-card">
                <div class="log-stat-icon warning"><i class="fas fa-bolt"></i></div>
                <div class="log-stat-info">
                    <span class="log-stat-value">${LOG_ACTION_TYPES[stats.topAction?._id] || stats.topAction?._id || '—'}</span>
                    <span class="log-stat-label">الأكثر تكراراً</span>
                </div>
            </div>
        </div>

        <!-- Filters & Controls -->
        <div class="log-filters-bar animate-fade-in" style="animation-delay: 0.1s">
            <div class="log-filter-group">
                <label>بحث نصي</label>
                <input type="text" id="log-search" class="log-filter-input" placeholder="ابحث في الوصف...">
            </div>
            <div class="log-filter-group">
                <label>المستخدم</label>
                <select id="log-user-filter" class="log-filter-input"><option value="all">الكل</option></select>
            </div>
            <div class="log-filter-group">
                <label>نوع الإجراء</label>
                <select id="log-action-filter" class="log-filter-input">
                    <option value="all">الكل</option>
                    ${Object.entries(LOG_ACTION_TYPES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
                </select>
            </div>
            <div class="log-actions-row">
                <button id="delete-selected-logs-btn" class="btn-danger" style="display:none; margin-inline-end: 10px;">
                    <i class="fas fa-trash"></i> حذف المحدد (<span id="selected-count">0</span>)
                </button>
                <button class="view-mode-btn active" data-mode="table"><i class="fas fa-table"></i></button>
                <button class="view-mode-btn" data-mode="timeline"><i class="fas fa-stream"></i></button>
                <button id="export-logs-btn" class="btn-secondary"><i class="fas fa-file-export"></i> تصدير</button>
            </div>
        </div>

        <!-- Content Area -->
        <div id="activity-log-content" class="animate-fade-in" style="animation-delay: 0.2s">
            <div class="loader-container"><div class="spinner"></div></div>
        </div>

        <!-- Diff Modal -->
        <div id="log-diff-modal" class="log-diff-modal" tabindex="-1">
            <div class="log-diff-card">
                <div class="log-diff-header">
                    <h3><i class="fas fa-info-circle"></i> تفاصيل السجل</h3>
                    <button class="modal-close" id="close-diff-modal-btn">&times;</button>
                </div>
                <div class="log-diff-body" id="log-diff-content"></div>
            </div>
        </div>
    `;

    // Populate Users
    loadUserFilter();

    // Modal Logic
    const modal = document.getElementById('log-diff-modal');
    const closeBtn = document.getElementById('close-diff-modal-btn');
    const closeModal = () => modal.classList.remove('active');

    if(closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
        });
    }

    modal.addEventListener('click', (e) => {
        // Close if clicking on backdrop (not inside the card)
        if (!e.target.closest('.log-diff-card')) {
            closeModal();
        }
    });

    modal.addEventListener('keydown', (e) => {
        if(e.key === 'Escape') closeModal();
    });

    // Event Listeners
    document.getElementById('refresh-logs-btn').onclick = () => fetchAndDisplayLogs(1);
    document.getElementById('delete-selected-logs-btn').onclick = deleteSelectedLogs;
    document.getElementById('log-search').oninput = debounce(() => fetchAndDisplayLogs(1), 500);
    document.getElementById('log-user-filter').onchange = () => fetchAndDisplayLogs(1);
    document.getElementById('log-action-filter').onchange = () => fetchAndDisplayLogs(1);
    
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            activityLogViewMode = e.currentTarget.dataset.mode;
            fetchAndDisplayLogs(1);
        };
    });

    fetchAndDisplayLogs(1);
}

// Expose function for pagination
window.fetchAndDisplayLogs = fetchAndDisplayLogs;

async function loadUserFilter() {
    try {
        const resp = await authedFetch('/api/users?limit=100');
        if(resp.ok) {
            const { users } = await resp.json();
            const select = document.getElementById('log-user-filter');
            if(select && Array.isArray(users)) {
                users.forEach(u => select.add(new Option(u.full_name, u._id)));
            }
        }
    } catch(e) {}
}

async function fetchAndDisplayLogs(page) {
    const container = document.getElementById('activity-log-content');
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    const search = document.getElementById('log-search').value;
    const user = document.getElementById('log-user-filter').value;
    const action = document.getElementById('log-action-filter').value;

    const params = new URLSearchParams({ page, limit: LOGS_PER_PAGE, sort: 'newest', populate: 'user' });
    if(search) params.set('q', search);
    if(user !== 'all') params.set('user_id', user);
    if(action !== 'all') params.set('action_type', action);

    try {
        const resp = await authedFetch(`/api/logs?${params}`);
        const { data, count } = await resp.json();
        
        // Auto-navigate to previous page if current page is empty after deletion
        if (data.length === 0 && page > 1) {
            fetchAndDisplayLogs(page - 1);
            return;
        }

        activityLogTotalPages = Math.ceil(count / LOGS_PER_PAGE);
        activityLogCurrentPage = page;

        if (activityLogViewMode === 'table') renderTable(data, container);
        else renderTimeline(data, container);

    } catch (e) {
        container.innerHTML = `<div class="error-message">فشل تحميل السجلات: ${e.message}</div>`;
    }
}

function getActionName(type) {
    if (LOG_ACTION_TYPES[type]) return LOG_ACTION_TYPES[type];
    
    if (type.startsWith('PUT_')) return 'تعديل (API)';
    if (type.startsWith('DELETE_')) return 'حذف (API)';
    if (type.startsWith('POST_')) return 'إنشاء (API)';
    if (type.startsWith('GET_')) return 'عرض (API)';
    
    return type;
}

function renderTable(logs, container) {
    if(!logs.length) { container.innerHTML = '<div class="empty-state">لا توجد سجلات</div>'; return; }

    const rows = logs.map(log => {
        const actionName = getActionName(log.action_type);
        const badgeClass = getBadgeClass(log.action_type);
        const user = log.user_id?.full_name || 'النظام';
        const date = new Date(log.createdAt).toLocaleString('ar-EG');
        
        // Construct rich data object for modal
        const modalData = {
            'رقم السجل': log._id,
            'توقيت الحدث': date,
            'نوع الإجراء': actionName,
            'المستخدم': user,
            'الوصف': log.description,
            ...(log.metadata || {})
        };
        const meta = encodeURIComponent(JSON.stringify(modalData));
        const isSelected = selectedLogIds.has(log._id);

        return `
            <tr class="${isSelected ? 'selected-row' : ''}">
                <td>
                    <input type="checkbox" class="log-select-checkbox" value="${log._id}" ${isSelected ? 'checked' : ''}>
                </td>
                <td>
                    <div class="log-user-cell">
                        <div class="log-user-avatar"><i class="fas fa-user"></i></div>
                        ${user}
                    </div>
                </td>
                <td><span class="log-action-badge ${badgeClass}">${actionName}</span></td>
                <td class="log-desc-cell" title="${log.description}">${log.description}</td>
                <td>${date}</td>
                <td>
                    <button class="btn-secondary btn-sm view-details-btn" data-meta="${meta}">
                        <i class="fas fa-eye"></i> تفاصيل
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    const allSelected = logs.length > 0 && logs.every(l => selectedLogIds.has(l._id));

    container.innerHTML = `
        <div class="log-table-container">
            <table class="log-table">
                <thead>
                    <tr>
                        <th style="width: 40px;"><input type="checkbox" id="select-all-logs" ${allSelected ? 'checked' : ''}></th>
                        <th>المستخدم</th>
                        <th>الإجراء</th>
                        <th>الوصف</th>
                        <th>التوقيت</th>
                        <th>التفاصيل</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        ${renderPagination()}
    `;
    
    attachDetailsListeners(container);
    attachCheckboxListeners(container);
    attachPaginationListeners(container);
    updateDeleteButtonState();
}

function attachCheckboxListeners(container) {
    // Individual Checkboxes
    container.querySelectorAll('.log-select-checkbox').forEach(cb => {
        cb.addEventListener('change', function() {
            const id = this.value;
            if (this.checked) selectedLogIds.add(id);
            else selectedLogIds.delete(id);
            
            // Update row style
            const row = this.closest('tr');
            if(row) {
                if(this.checked) row.classList.add('selected-row');
                else row.classList.remove('selected-row');
            }

            updateDeleteButtonState();
            
            // Update "Select All" state
            const allCheckboxes = container.querySelectorAll('.log-select-checkbox');
            const allChecked = Array.from(allCheckboxes).every(c => c.checked);
            const selectAll = container.querySelector('#select-all-logs');
            if(selectAll) selectAll.checked = allChecked;
        });
    });

    // Select All Checkbox
    const selectAll = container.querySelector('#select-all-logs');
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            const isChecked = this.checked;
            container.querySelectorAll('.log-select-checkbox').forEach(cb => {
                cb.checked = isChecked;
                if (isChecked) selectedLogIds.add(cb.value);
                else selectedLogIds.delete(cb.value);
                
                const row = cb.closest('tr');
                if(row) {
                    if(isChecked) row.classList.add('selected-row');
                    else row.classList.remove('selected-row');
                }
            });
            updateDeleteButtonState();
        });
    }
}

// Removed global window functions to avoid scope issues
// window.toggleLogSelection = ...
// window.toggleSelectAllLogs = ...

function updateDeleteButtonState() {
    const btn = document.getElementById('delete-selected-logs-btn');
    const countSpan = document.getElementById('selected-count');
    if (btn && countSpan) {
        countSpan.textContent = selectedLogIds.size;
        btn.style.display = selectedLogIds.size > 0 ? 'inline-flex' : 'none';
    }
}

async function deleteSelectedLogs() {
    if (selectedLogIds.size === 0) return;
    
    if (!confirm(`هل أنت متأكد من حذف ${selectedLogIds.size} سجل؟ لا يمكن التراجع عن هذا الإجراء.`)) return;

    try {
        const resp = await authedFetch('/api/logs', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedLogIds) })
        });

        if (resp.ok) {
            showToast('تم حذف السجلات بنجاح', 'success');
            selectedLogIds.clear();
            fetchAndDisplayLogs(activityLogCurrentPage);
        } else {
            const err = await resp.json();
            showToast(err.message || 'فشل الحذف', 'error');
        }
    } catch (e) {
        showToast('حدث خطأ أثناء الحذف', 'error');
    }
}

function renderTimeline(logs, container) {
    if(!logs.length) { container.innerHTML = '<div class="empty-state">لا توجد سجلات</div>'; return; }

    const items = logs.map(log => {
        const actionName = getActionName(log.action_type);
        const icon = getIcon(log.action_type);
        const user = log.user_id?.full_name || 'النظام';
        const time = new Date(log.createdAt).toLocaleTimeString('ar-EG');
        const date = new Date(log.createdAt).toLocaleDateString('ar-EG');
        
        // Construct rich data object for modal
        const modalData = {
            'رقم السجل': log._id,
            'توقيت الحدث': new Date(log.createdAt).toLocaleString('ar-EG'),
            'نوع الإجراء': actionName,
            'المستخدم': user,
            'الوصف': log.description,
            ...(log.metadata || {})
        };
        const meta = encodeURIComponent(JSON.stringify(modalData));

        return `
            <div class="log-timeline-item">
                <div class="log-timeline-icon"><i class="fas ${icon}"></i></div>
                <div class="log-timeline-content">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.85rem;color:#94a3b8;">
                        <span><i class="fas fa-calendar"></i> ${date} ${time}</span>
                        <span><i class="fas fa-user"></i> ${user}</span>
                    </div>
                    <h4 style="margin:0 0 4px;color:#f1f5f9;">${actionName}</h4>
                    <p style="margin:0 0 10px;color:#cbd5e1;font-size:0.9rem;">${log.description}</p>
                    <button class="btn-secondary btn-sm view-details-btn" data-meta="${meta}">
                        <i class="fas fa-eye"></i> عرض التفاصيل
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="log-timeline">${items}</div>${renderPagination()}`;
    
    attachDetailsListeners(container);
    attachPaginationListeners(container);
}

function attachDetailsListeners(container) {
    container.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const meta = this.getAttribute('data-meta');
            showDiffModal(meta);
        });
    });
}

function renderPagination() {
    if(activityLogTotalPages <= 1) return '';
    return `
        <div class="pagination-container" style="margin-top:20px;justify-content:center;">
            <button class="page-btn pagination-prev" ${activityLogCurrentPage===1?'disabled':''}>السابق</button>
            <span style="color:white;padding:0 10px;">صفحة ${activityLogCurrentPage} من ${activityLogTotalPages}</span>
            <button class="page-btn pagination-next" ${activityLogCurrentPage===activityLogTotalPages?'disabled':''}>التالي</button>
        </div>
    `;
}

function attachPaginationListeners(container) {
    const prevBtn = container.querySelector('.pagination-prev');
    const nextBtn = container.querySelector('.pagination-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (activityLogCurrentPage > 1) {
                fetchAndDisplayLogs(activityLogCurrentPage - 1);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (activityLogCurrentPage < activityLogTotalPages) {
                fetchAndDisplayLogs(activityLogCurrentPage + 1);
            }
        });
    }
}

window.showDiffModal = function(encodedMeta) {
    let data = {};
    try {
        data = JSON.parse(decodeURIComponent(encodedMeta));
    } catch (e) {
        console.error('Failed to parse metadata', e);
        data = {};
    }

    const modal = document.getElementById('log-diff-modal');
    const content = document.getElementById('log-diff-content');
    
    // Remove Copy Button if exists (cleanup from previous version)
    const header = modal.querySelector('.log-diff-header');
    const existingCopyBtn = header.querySelector('.modal-copy-btn');
    if (existingCopyBtn) existingCopyBtn.remove();

    // Check if empty
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        content.innerHTML = `
            <div style="text-align:center;padding:40px;color:var(--log-text-muted)">
                <i class="fas fa-info-circle" style="font-size:2rem;margin-bottom:10px;display:block"></i>
                لا توجد تفاصيل إضافية لهذا السجل
            </div>
        `;
        modal.classList.add('active');
        modal.focus();
        return;
    }

    // Simple Render - No Tabs, No Raw JSON, No Tech Details Section
    content.innerHTML = `
        <div class="log-simple-details">
            ${renderMetaTable(data)}
        </div>
    `;
    
    modal.classList.add('active');
    modal.focus();
};

window.switchLogTab = function(btn, tabId) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.diff-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const container = parent.nextElementSibling.parentElement; // log-diff-content
    container.querySelectorAll('.diff-tab-content').forEach(c => c.classList.remove('active'));
    container.querySelector(`#tab-${tabId}`).classList.add('active');
};

function renderMetaTable(obj) {
    if (typeof obj !== 'object' || obj === null) return String(obj);
    
    const rows = Object.entries(obj).map(([key, val]) => {
        let displayVal = val;
        let displayKey = key;

        // --- Custom Formatting based on Key ---
        const keyMap = {
            'ip': 'عنوان IP',
            'status': 'الحالة',
            'duration': 'المدة المستغرقة',
            'method': 'طريقة الطلب',
            'url': 'الرابط',
            'body': 'البيانات المرسلة',
            'views_count': 'عدد المشاهدات',
            'reactions_count': 'عدد التفاعلات',
            'participants_count': 'عدد المشاركين',
            'params': 'المعاملات (Params)',
            'query': 'استعلام (Query)',
            'name': 'اسم الوكيل',
            'agent_id': 'رقم الوكيل',
            'classification': 'التصنيف',
            'rank': 'المرتبة',
            'avatar_url': 'رابط الصورة الرمزية',
            'telegram_channel_url': 'رابط قناة تيليجرام',
            'telegram_group_url': 'رابط مجموعة تيليجرام',
            'telegram_chat_id': 'معرف المحادثة (Chat ID)',
            'telegram_group_name': 'اسم مجموعة تيليجرام',
            'renewal_period': 'فترة التجديد',
            'audit_days': 'أيام التدقيق',
            'competition_duration': 'مدة المسابقة',
            'competitions_per_week': 'عدد المسابقات أسبوعياً',
            'competition_bonus': 'بونص المسابقة',
            'deposit_bonus_percentage': 'نسبة بونص الإيداع',
            'deposit_bonus_count': 'عدد مرات بونص الإيداع',
            'remaining_balance': 'الرصيد المتبقي',
            'consumed_balance': 'الرصيد المستهلك',
            'remaining_deposit_bonus': 'بونص الإيداع المتبقي',
            'used_deposit_bonus': 'بونص الإيداع المستخدم',
            'single_competition_balance': 'رصيد المسابقة الواحدة',
            'winners_count': 'عدد الفائزين',
            'prize_per_winner': 'الجائزة لكل فائز',
            'deposit_bonus_winners_count': 'عدد الفائزين ببونص الإيداع',
            'last_renewal_date': 'تاريخ آخر تجديد',
            'last_competition_date': 'تاريخ آخر مسابقة',
            'winner_selection_date': 'تاريخ اختيار الفائز',
            'is_auditing_enabled': 'التدقيق مفعل',
            '_id': 'المعرف الفريد (ID)',
            'createdAt': 'تاريخ الإنشاء',
            'updatedAt': 'تاريخ التحديث',
            '__v': 'النسخة'
        };

        if (keyMap[key]) displayKey = keyMap[key];

        // --- Value Formatting ---
        if (val === null || val === 'null') {
            displayVal = '<span style="color:#94a3b8;font-style:italic">غير محدد</span>';
        } else if (key === 'ip' && (val === '::1' || val === '127.0.0.1')) {
            displayVal = '<span style="color:#93c5fd"><i class="fas fa-laptop-code"></i> جهاز محلي (Localhost)</span>';
        } else if (key === 'status') {
            const status = parseInt(val);
            if (!isNaN(status)) {
                if (status >= 200 && status < 300) displayVal = `<span style="color:#86efac"><i class="fas fa-check-circle"></i> ناجح (${val})</span>`;
                else if (status >= 400) displayVal = `<span style="color:#fca5a5"><i class="fas fa-times-circle"></i> خطأ (${val})</span>`;
            }
        } else if (key === 'duration') {
            displayVal = `${val} مللي ثانية`;
        } else if (key === 'method') {
            displayVal = `<span style="font-family:monospace;background:#334155;padding:2px 6px;border-radius:4px">${val}</span>`;
        } else if (key === 'audit_days' && typeof val === 'object') {
             // Format audit days array/object to readable days
             const daysMap = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
             const days = Object.values(val).map(d => daysMap[d] || d);
             displayVal = days.join('، ');
        } else if (key.includes('date') || key.includes('At')) {
             // Try to format dates
             const date = new Date(val);
             if (!isNaN(date.getTime())) {
                 displayVal = date.toLocaleString('ar-EG');
             }
        } else if (key === 'is_auditing_enabled') {
             displayVal = (val === true || val === 'true' || val === 'نعم') ? '<span style="color:#86efac">نعم</span>' : '<span style="color:#fca5a5">لا</span>';
        }

        if (typeof val === 'object' && val !== null && key !== 'audit_days') {
            displayVal = `<div style="margin-top:5px;border-right:2px solid var(--log-border);padding-right:10px">
                ${renderMetaTable(val)}
            </div>`;
        } else if (typeof val === 'boolean') {
            displayVal = val ? '<span style="color:#86efac">نعم</span>' : '<span style="color:#fca5a5">لا</span>';
        }
        
        return `
            <tr>
                <td class="meta-key-cell">${displayKey}</td>
                <td class="meta-val-cell">${displayVal}</td>
            </tr>
        `;
    }).join('');

    return `<table class="meta-table"><tbody>${rows}</tbody></table>`;
}

function renderDiffView(meta) {
    const oldVal = meta.oldValue || meta.before || {};
    const newVal = meta.newValue || meta.after || {};
    
    return `
        <div class="log-diff-grid">
            <div class="log-diff-col">
                <div class="diff-col-header old"><i class="fas fa-history"></i> قبل التعديل</div>
                <div class="log-diff-box old">${renderMetaTable(oldVal)}</div>
            </div>
            <div class="log-diff-col">
                <div class="diff-col-header new"><i class="fas fa-check"></i> بعد التعديل</div>
                <div class="log-diff-box new">${renderMetaTable(newVal)}</div>
            </div>
        </div>
        ${renderDiffSummary(oldVal, newVal)}
    `;
}

function formatJSON(obj) {
    if (obj === null) return '<span class="json-null">null</span>';
    if (typeof obj === 'number') return `<span class="json-number">${obj}</span>`;
    if (typeof obj === 'boolean') return `<span class="json-boolean">${obj}</span>`;
    if (typeof obj === 'string') return `<span class="json-string">"${obj}"</span>`;
    
    if (Array.isArray(obj)) {
        if (obj.length === 0) return '<span class="json-bracket">[]</span>';
        const items = obj.map(item => formatJSON(item)).join(', ');
        return `<span class="json-bracket">[</span>${items}<span class="json-bracket">]</span>`;
    }
    
    if (typeof obj === 'object') {
        if (Object.keys(obj).length === 0) return '<span class="json-bracket">{}</span>';
        const props = Object.keys(obj).map(key => {
            return `<div style="padding-left:20px"><span class="json-key">"${key}"</span>: ${formatJSON(obj[key])}</div>`;
        }).join('');
        return `<span class="json-bracket">{</span>${props}<span class="json-bracket">}</span>`;
    }
    
    return String(obj);
}

function renderDiffSummary(oldVal, newVal) {
    // Find keys that actually changed
    const changes = [];
    const allKeys = new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})]);
    
    allKeys.forEach(key => {
        const v1 = oldVal?.[key];
        const v2 = newVal?.[key];
        // Simple comparison for primitives, JSON stringify for objects
        if (JSON.stringify(v1) !== JSON.stringify(v2)) {
            changes.push({ key, v1, v2 });
        }
    });

    if (changes.length === 0) return '';

    const rows = changes.map(c => {
        const v1Str = typeof c.v1 === 'object' ? '...' : String(c.v1 ?? 'غير موجود');
        const v2Str = typeof c.v2 === 'object' ? '...' : String(c.v2 ?? 'محذوف');
        return `
        <div class="diff-row">
            <div class="diff-key">${c.key}</div>
            <div class="diff-val changed">
                <span style="color:#fca5a5;text-decoration:line-through;margin-left:8px">${v1Str}</span>
                <i class="fas fa-arrow-left" style="font-size:0.8em;color:#94a3b8;margin:0 5px"></i>
                <span style="color:#86efac">${v2Str}</span>
            </div>
        </div>
    `}).join('');

    return `
        <div style="margin-top:20px;border-top:1px solid var(--log-border);padding-top:15px">
            <h4 style="color:var(--log-text-muted);margin-bottom:10px"><i class="fas fa-highlighter"></i> ملخص التغييرات</h4>
            <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid var(--log-border)">
                ${rows}
            </div>
        </div>
    `;
}

function getBadgeClass(type) {
    if(/CREATE|POST/.test(type)) return 'create';
    if(/DELETE|REMOVE/.test(type)) return 'delete';
    if(/UPDATE|EDIT/.test(type)) return 'update';
    return 'warning';
}

function getIcon(type) {
    if(/CREATE|POST/.test(type)) return 'fa-plus';
    if(/DELETE|REMOVE/.test(type)) return 'fa-trash';
    if(/UPDATE|EDIT/.test(type)) return 'fa-pen';
    if(/LOGIN/.test(type)) return 'fa-sign-in-alt';
    return 'fa-info';
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
