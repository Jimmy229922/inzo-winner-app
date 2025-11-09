// --- Main Router for Competitions/Templates Section ---
const COMPETITIONS_PER_PAGE = 10; // Changed to 10 for consistency
let competitionListCountdownInterval = null; // For the main list countdown
let selectedCompetitionIds = []; // For bulk actions


async function renderCompetitionsPage() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const agentId = urlParams.get('agentId');

    if (hash.startsWith('#competitions/new')) {
        await renderCompetitionCreatePage(agentId);
    } else if (hash.startsWith('#competitions/edit/')) {
        const compId = hash.split('/')[2];
        await renderCompetitionEditForm(compId);
    } else if (hash.startsWith('#archived-competitions')) {
        await renderArchivedCompetitionsPage();
    } else {
        // Default to #competitions
        await renderCompetitionManagementPage();
    }

    // Cleanup timer when navigating away
    window.addEventListener('hashchange', () => {
        if (competitionListCountdownInterval) clearInterval(competitionListCountdownInterval);
    });
}

// --- 0. All Competitions List Page (New Default) ---
async function renderCompetitionManagementPage() {
    const appContent = document.getElementById('app-content');
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
    const compsPerm = currentUserProfile?.permissions?.competitions?.manage_comps || 'none';
    const canView = isAdmin || compsPerm === 'full' || compsPerm === 'view';
    if (!canView) {
        appContent.innerHTML = `
            <div class="access-denied-container">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية وصول</h2>
                <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
            </div>`;
        return;
    }

    const canEdit = isAdmin || compsPerm === 'full';
    selectedCompetitionIds = []; // Reset selection on page render
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>إدارة المسابقات النشطة</h1>
            </div>
            <div class="filters-container">
                <div class="filter-search-container">
                    <input type="search" id="competition-search-input" placeholder="بحث باسم المسابقة أو الوكيل..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="competition-search-clear"></i>
                </div>
                <div class="filter-controls">
                    <div class="filter-group">
                        <label class="filter-label">فلترة حسب الحالة</label>
                        <div class="filter-buttons" data-filter-group="status">
                            <button class="filter-btn active" data-filter="all">الكل</button>
                            <button class="filter-btn" data-filter="active">نشطة</button>
                            <button class="filter-btn" data-filter="inactive">غير نشطة</button>
                        </div>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">فلترة حسب التصنيف</label>
                        <div class="filter-buttons" data-filter-group="classification">
                            <button class="filter-btn active" data-filter="all">الكل</button>
                            <button class="filter-btn" data-filter="R">R</button>
                            <button class="filter-btn" data-filter="A">A</button>
                            <button class="filter-btn" data-filter="B">B</button>
                            <button class="filter-btn" data-filter="C">C</button>
                        </div>
                    </div>
                </div>
                <div class="sort-container">
                    <label for="competition-sort-select">ترتيب حسب:</label>
                    <select id="competition-sort-select">
                        <option value="newest">الأحدث أولاً</option>
                        <option value="name_asc">اسم المسابقة (أ - ي)</option>
                        <option value="agent_asc">اسم الوكيل (أ - ي)</option>
                    </select>
                </div>
            </div>
        </div>
        <div id="bulk-action-bar" class="bulk-action-bar">
            <span id="bulk-action-count">0 عنصر محدد</span>
            ${canEdit ? `
                <div class="bulk-actions">
                    <button id="bulk-deactivate-btn" class="btn-secondary"><i class="fas fa-power-off"></i> تعطيل المحدد</button>
                    <button id="bulk-delete-btn" class="btn-danger"><i class="fas fa-trash-alt"></i> حذف المحدد</button>
                </div>
            ` : ''}
        </div>
        <div id="competitions-list-container"></div>
    `;

    const container = document.getElementById('competitions-list-container');

    // Use event delegation for delete buttons
    container.addEventListener('click', async (e) => { // Listen on a parent that persists
        if (!canEdit && (e.target.closest('.delete-competition-btn') || e.target.closest('#bulk-deactivate-btn') || e.target.closest('#bulk-delete-btn'))) {
            showToast('ليس لديك صلاحية للقيام بهذا الإجراء.', 'error');
            return;
        }
         const deleteBtn = e.target.closest('.delete-competition-btn');
        if (deleteBtn && canEdit) {
            const id = deleteBtn.dataset.id;
            if (!id) return;
            showConfirmationModal(
                'هل أنت متأكد من حذف هذه المسابقة؟<br><small>هذا الإجراء لا يمكن التراجع عنه.</small>',
                async () => {
                    const response = await authedFetch(`/api/competitions/${id}`, { method: 'DELETE' });
                    if (!response.ok) {
                        const result = await response.json();
                        showToast(`فشل حذف المسابقة: ${result.message}`, 'error');
                    } else {
                        showToast('تم حذف المسابقة بنجاح.', 'success');
                        await fetchAndDisplayCompetitions(1); // Refetch from server
                    }
                }, {
                    title: 'تأكيد حذف المسابقة',
                    confirmText: 'حذف',
                    confirmClass: 'btn-danger'
                });
        }
    });

    // Separate listener for status toggle to avoid complexity
    container.addEventListener('change', async (e) => {
        const statusToggle = e.target.closest('.competition-status-toggle');
        if (statusToggle) {
            if (!canEdit) {
                showToast('ليس لديك صلاحية لتغيير حالة المسابقة.', 'error');
                statusToggle.checked = !statusToggle.checked; // Revert UI
                return;
            }
            const id = statusToggle.dataset.id;
            const isActive = statusToggle.checked;

            const response = await authedFetch(`/api/competitions/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_active: isActive })
            });
            if (!response.ok) {
                showToast('فشل تحديث حالة المسابقة.', 'error');
                statusToggle.checked = !isActive; // Revert UI on error
            } else {
                showToast(`تم تحديث حالة المسابقة إلى "${isActive ? 'نشطة' : 'غير نشطة'}".`, 'success');
                // No need to refetch, UI is already updated.
            }
        }
    });
    // --- NEW: Attach bulk action listeners separately ---
    const bulkDeactivateBtn = document.getElementById('bulk-deactivate-btn');
    if (bulkDeactivateBtn && canEdit) {
        bulkDeactivateBtn.addEventListener('click', () => {
            showConfirmationModal(
                `هل أنت متأكد من تعطيل ${selectedCompetitionIds.length} مسابقة؟`,
                async () => {
                    const response = await authedFetch('/api/competitions/bulk-update', {
                        method: 'PUT',
                        body: JSON.stringify({ ids: selectedCompetitionIds, data: { is_active: false } })
                    });
                    if (!response.ok) {
                        const result = await response.json();
                        showToast(result.message || 'فشل تعطيل المسابقات المحددة.', 'error');
                    } else {
                        showToast('تم تعطيل المسابقات المحددة بنجاح.', 'success');
                        await fetchAndDisplayCompetitions(1);
                    }
                }, { title: 'تأكيد التعطيل' }
            );
        });
    }

    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    if (bulkDeleteBtn && canEdit) {
        bulkDeleteBtn.addEventListener('click', () => {
            showConfirmationModal(
                `هل أنت متأكد من حذف ${selectedCompetitionIds.length} مسابقة بشكل نهائي؟`,
                async () => {
                    const response = await authedFetch('/api/competitions/bulk-delete', {
                        method: 'DELETE',
                        body: JSON.stringify({ ids: selectedCompetitionIds })
                    });
                    if (!response.ok) {
                        const result = await response.json();
                        showToast(result.message || 'فشل حذف المسابقات المحددة.', 'error');
                    } else {
                        showToast('تم حذف المسابقات المحددة بنجاح.', 'success');
                        await fetchAndDisplayCompetitions(1);
                    }
                }, {
                    title: 'تأكيد الحذف',
                    confirmText: 'حذف',
                    confirmClass: 'btn-danger'
                }
            );
        });
    }

    // Initial fetch and setup
    setupCompetitionFilters();
    await fetchAndDisplayCompetitions(1);

    // FIX: Setup one-time global listener for this page
    setupCompetitionListGlobalListeners();
}

async function fetchAndDisplayCompetitions(page) {
    const container = document.getElementById('competitions-list-container');
    if (!container) return;
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    // Get filter and sort values from the UI
    const searchInput = document.getElementById('competition-search-input');
    const sortSelect = document.getElementById('competition-sort-select');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const statusFilter = document.querySelector('.filter-buttons[data-filter-group="status"] .filter-btn.active')?.dataset.filter || 'all';
    const classificationFilter = document.querySelector('.filter-buttons[data-filter-group="classification"] .filter-btn.active')?.dataset.filter || 'all';
    const sortValue = sortSelect ? sortSelect.value : 'newest';

    if (document.getElementById('competition-search-clear')) {
        document.getElementById('competition-search-clear').style.display = searchTerm ? 'block' : 'none';
    }

    const queryParams = new URLSearchParams({
        page: page,
        limit: COMPETITIONS_PER_PAGE,
        search: searchTerm,
        status: statusFilter,
        classification: classificationFilter,
        sort: sortValue,
        excludeStatus: 'completed' // Always exclude completed competitions
    });

    const response = await authedFetch(`/api/competitions?${queryParams.toString()}`);

    if (!response.ok) {
        console.error("Error fetching competitions:", await response.text());
        container.innerHTML = `<p class="error">حدث خطأ أثناء جلب المسابقات.</p>`;
        return;
    }

    const { data: competitions, count } = await response.json();

    displayCompetitionsPage(competitions || [], page, count || 0);
}

function displayCompetitionsPage(paginatedCompetitions, page, totalCount) {
    const container = document.getElementById('competitions-list-container');
    if (!container) return;

    page = parseInt(page);
    const totalPages = Math.ceil(totalCount / COMPETITIONS_PER_PAGE);

    const gridHtml = generateCompetitionGridHtml(paginatedCompetitions);

    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml += '<div class="pagination-container">';
        paginationHtml += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>السابق</button>`;
        for (let i = 1; i <= totalPages; i++) {
            paginationHtml += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        paginationHtml += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي</button>`;
        paginationHtml += '</div>';
    }

    // Improved empty state
    let finalHtml;
    if (paginatedCompetitions.length > 0) {
        const selectAllChecked = selectedCompetitionIds.length > 0 && paginatedCompetitions.every(c => selectedCompetitionIds.includes(c.id));
        const listHeader = `
            <div class="list-view-header">
                <label class="custom-checkbox">
                    <input type="checkbox" id="select-all-competitions" ${selectAllChecked ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
                <span class="header-name">المسابقة</span>
                <span class="header-status">الحالة</span>
                <span class="header-agent">الوكيل</span>
                <span class="header-actions">الإجراءات</span>
            </div>
        `;
        finalHtml = `${listHeader}<div class="competitions-list-view">${gridHtml}</div>${paginationHtml}`;
    } else {
        finalHtml = '<p class="no-results-message">لا توجد نتائج تطابق بحثك أو الفلتر الحالي.</p>';
    }
    container.innerHTML = finalHtml;

    // Attach event listeners for checkboxes and pagination
    attachCompetitionListListeners(paginatedCompetitions, totalCount);

    // Start the countdown timers for the newly rendered list
    startCompetitionListCountdowns();
}
function startCompetitionListCountdowns() {
    if (competitionListCountdownInterval) clearInterval(competitionListCountdownInterval);

    const updateTimers = () => {
        document.querySelectorAll('.competition-list-countdown').forEach(el => {
            updateCountdownTimer(el);
        });
    };
    updateTimers(); // Run once immediately
    competitionListCountdownInterval = setInterval(updateTimers, 1000);
}

function setupCompetitionListGlobalListeners() {
    const container = document.getElementById('app-content');
    container.addEventListener('click', (e) => { // Handle edit button clicks using event delegation
        const agentCell = e.target.closest('.table-agent-cell');
        if (agentCell) {
            const agentId = agentCell.dataset.agentId;
            if (agentId) window.location.hash = `#profile/${agentId}`;
        }
    });
}

function generateCompetitionGridHtml(competitions) {
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const compsPerm = currentUserProfile?.permissions?.competitions?.manage_comps;
    const canEdit = isSuperAdmin || compsPerm === 'full';

    if (competitions.length === 0) return ''; // Let displayCompetitionsPage handle the empty message
    return competitions.map(comp => { // The agent object is now nested under 'agent' not 'agents'
        const isSelected = selectedCompetitionIds.includes(comp.id);
        const agent = comp.agents;
        const agentInfoHtml = agent
            ? `<a href="#profile/${agent._id}" class="table-agent-cell" data-agent-id="${agent._id}">
                    ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Agent Avatar" class="avatar-small" loading="lazy">` : `<div class="avatar-placeholder-small"><i class="fas fa-user"></i></div>`}
                    <div class="agent-details">
                        <span>${agent.name}</span>
                        ${agent.classification ? `<span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>` : ''}
                    </div>
               </a>`
            : `<div class="table-agent-cell"><span>(وكيل محذوف أو غير مرتبط)</span></div>`;

        let countdownHtml = '';
        if (comp.ends_at && comp.status !== 'completed' && comp.status !== 'awaiting_winners') {
            const endDate = new Date(comp.ends_at);
            const formattedDate = endDate.toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric' });
            countdownHtml = `
                <div class="competition-timing-info">
                    <div class="competition-list-countdown" data-end-date="${comp.ends_at}"><i class="fas fa-hourglass-half"></i> <span>جاري الحساب...</span></div>
                    <div class="competition-end-date"><i class="fas fa-calendar-check"></i> <span>تنتهي في: ${formattedDate}</span></div>
                </div>
            `;
        }

        return `
        <div class="competition-card ${isSelected ? 'selected' : ''}" data-id="${comp.id}">
            <label class="custom-checkbox row-checkbox">
                <input type="checkbox" class="competition-select-checkbox" data-id="${comp.id}" ${isSelected ? 'checked' : ''}>
                <span class="checkmark"></span>
            </label>
            <div class="competition-card-name">
                <h3>${comp.name}</h3>
                ${countdownHtml}
            </div>
            <div class="competition-card-status">
                <label class="custom-checkbox toggle-switch small-toggle" title="${comp.is_active ? 'تعطيل' : 'تفعيل'}" ${!canEdit ? 'style="cursor:not-allowed;"' : ''}>
                    <input type="checkbox" class="competition-status-toggle" data-id="${comp.id}" ${comp.is_active ? 'checked' : ''} ${!canEdit ? 'disabled' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>
            ${agentInfoHtml}
            <div class="competition-card-footer">
                <button class="btn-danger delete-competition-btn" title="حذف" data-id="${comp.id}"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
        `;
    }).join('');
}

function setupCompetitionFilters() {
    const searchInput = document.getElementById('competition-search-input');
    const clearBtn = document.getElementById('competition-search-clear');
    const sortSelect = document.getElementById('competition-sort-select');

    const triggerFetch = () => {
        fetchAndDisplayCompetitions(1); // Always go to page 1 when filters change
    };

    if (searchInput) {
        // Use a debounce to avoid fetching on every keystroke
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(triggerFetch, 300); // 300ms delay
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput.value) {
                searchInput.value = '';
                triggerFetch();
                searchInput.focus();
            }
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', triggerFetch);
    }

    document.querySelectorAll('.filter-buttons').forEach(group => {
        group.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                group.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                triggerFetch();
            }
        });
    });
}

// New helper functions for bulk actions
function attachCompetitionListListeners(paginatedList, totalCount) {
    const container = document.getElementById('competitions-list-container');
    if (!container) return;

    // Pagination
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newPage = parseInt(e.currentTarget.dataset.page);
            if (newPage) fetchAndDisplayCompetitions(newPage);
        });
    });

    // Individual checkboxes
    container.querySelectorAll('.competition-select-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            if (e.target.checked) {
                if (!selectedCompetitionIds.includes(id)) {
                    selectedCompetitionIds.push(id);
                }
            } else {
                selectedCompetitionIds = selectedCompetitionIds.filter(selectedId => selectedId !== id);
            }
            updateBulkActionBar(paginatedList.length);
            // Also update the row's selected class
            e.target.closest('.competition-card').classList.toggle('selected', e.target.checked);
        });
    });

    // Select All checkbox
    const selectAllCheckbox = document.getElementById('select-all-competitions');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const paginatedIds = paginatedList.map(c => c.id);
            if (e.target.checked) {
                // Add only the ones not already selected
                paginatedIds.forEach(id => {
                    if (!selectedCompetitionIds.includes(id)) {
                        selectedCompetitionIds.push(id);
                    }
                });
            } else {
                // Remove all from the current page
                selectedCompetitionIds = selectedCompetitionIds.filter(id => !paginatedIds.includes(id));
            }
            const currentPage = document.querySelector('.pagination-container .page-btn.active')?.dataset.page || 1;
            // Re-render the current page to update checkbox states
            fetchAndDisplayCompetitions(currentPage);
            updateBulkActionBar(paginatedList.length);
        });
    }
}

function updateBulkActionBar(currentPageItemCount) {
    const bar = document.getElementById('bulk-action-bar');
    const countSpan = document.getElementById('bulk-action-count');
    const selectAllCheckbox = document.getElementById('select-all-competitions');

    if (selectedCompetitionIds.length > 0) {
        bar.classList.add('visible');
        countSpan.textContent = `${selectedCompetitionIds.length} عنصر محدد`;
    } else {
        bar.classList.remove('visible');
    }

    if (selectAllCheckbox) {
        const paginatedIds = Array.from(document.querySelectorAll('.competition-select-checkbox')).map(cb => parseInt(cb.dataset.id));
        const allOnPageSelected = currentPageItemCount > 0 && paginatedIds.every(id => selectedCompetitionIds.includes(id));
        selectAllCheckbox.checked = allOnPageSelected;
    }
}

async function renderCompetitionCreatePage(agentId) {
    const appContent = document.getElementById('app-content');
    let competitionImageFile = null; // Variable to hold the new image file

    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const canCreate = isSuperAdmin || currentUserProfile?.permissions?.competitions?.can_create;
    if (!canCreate) {
        appContent.innerHTML = `
            <div class="access-denied-container">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية لإنشاء مسابقة</h2>
                <p>أنت لا تملك الصلاحية اللازمة للوصول إلى هذه الصفحة. يرجى التواصل مع المدير.</p>
            </div>`;
        return;
    }

    if (!agentId) { // If no agent is selected, do not render the form.
        appContent.innerHTML = `<p class="error">تم إلغاء هذه الصفحة. لا يمكن إنشاء مسابقة بدون تحديد وكيل أولاً.</p>`;
        return;
    }

    // Fetch agent and template data
    const agentResponse = await authedFetch(`/api/agents/${agentId}`);
    if (!agentResponse.ok) {
        appContent.innerHTML = `<p class="error">لم يتم العثور على الوكيل.</p>`;
        return;
    }
    const { data: agent } = await agentResponse.json();

    const agentClassification = agent.classification || 'R'; // Default to R if not set
    const templatesResponse = await authedFetch(`/api/templates/available?classification=${agentClassification}`);

    if (!templatesResponse.ok) {
        appContent.innerHTML = `<p class="error">حدث خطأ أثناء جلب قوالب المسابقات.</p>`;
        return;
    }
    const { data: templates } = await templatesResponse.json();
    
    appContent.innerHTML = `
        <div class="page-header"><h1><i class="fas fa-magic"></i> إنشاء وإرسال مسابقة</h1></div>
        <p class="page-subtitle">للعميل: <a href="#profile/${agent._id}" class="agent-name-link-subtitle"><strong>${agent.name}</strong></a>. قم بتعديل تفاصيل المسابقة أدناه وسيتم تحديث الكليشة تلقائياً.</p>
        
        <div class="create-competition-layout-v3">
            <!-- Agent Info Column -->
            <div class="agent-info-v3 card-style-container">
                <h3><i class="fas fa-user-circle"></i> بيانات الوكيل</h3>
                <div class="agent-info-grid">
                    <div class="action-info-card"><i class="fas fa-star"></i><div class="info"><label>المرتبة</label><p>${agent.rank || 'غير محدد'}</p></div></div>                    <div class="action-info-card"><i class="fas fa-tag"></i><div class="info"><label>التصنيف</label><p>${agent.classification}</p></div></div>
                    <div class="action-info-card" id="balance-card"><i class="fas fa-wallet"></i><div class="info"><label>الرصيد المتبقي</label><p id="agent-remaining-balance">${agent.remaining_balance || 0}</p></div></div>
                    <div class="action-info-card" id="bonus-card"><i class="fas fa-gift"></i><div class="info"><label>بونص إيداع متبقي</label><p id="agent-remaining-deposit-bonus">${agent.remaining_deposit_bonus || 0} مرات</p></div></div>
                    <div class="action-info-card"><i class="fas fa-percent"></i><div class="info"><label>نسبة بونص الإيداع</label><p>${agent.deposit_bonus_percentage || 0}%</p></div></div>
                </div>
            </div>

            <!-- Variables Column -->
            <div class="variables-v3 card-style-container">
                <h3><i class="fas fa-cogs"></i> 1. تعديل المتغيرات</h3>
                <div class="form-group">
                    <label for="competition-template-select">المسابقات المقترحة</label>
                    <select id="competition-template-select" required>
                        <option value="" disabled selected>-- اختار مسابقة --</option>
                        ${templates.map(t => `<option value="${t._id}">${t.question}</option>`).join('')}
                    </select>
                    <div id="template-usage-info" class="form-hint" style="display: none;"></div>
                </div>
                <div class="override-fields-grid">
                    <div class="form-group">
                        <label for="override-trading-winners">عدد الفائزين (تداولي)</label>
                        <input type="number" id="override-trading-winners" value="${agent.winners_count || 0}">
                    </div>
                    <div class="form-group">
                        <label for="override-prize">الجائزة لكل فائز ($)</label>
                        <input type="number" id="override-prize" step="0.01" value="${parseFloat(agent.prize_per_winner || 0).toFixed(2)}">
                    </div>
                    <div class="form-group">
                        <label for="override-deposit-winners">عدد الفائزين (إيداع)</label>
                        <input type="number" id="override-deposit-winners" value="${agent.deposit_bonus_winners_count || 0}">
                    </div>
                    <div class="form-group">
                        <label for="override-duration">مدة المسابقة</label>
                        <select id="override-duration">
                            <option value="" disabled>-- اختر مدة --</option>
                            <option value="1d" ${agent.competition_duration === '24h' || !agent.competition_duration || (agent.competition_duration !== '48h' && agent.competition_duration !== '168h') ? 'selected' : ''}>يوم واحد</option>
                            <option value="2d" ${agent.competition_duration === '48h' ? 'selected' : ''}>يومين</option>
                            <option value="1w" ${agent.competition_duration === '168h' ? 'selected' : ''}>أسبوع</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1; background-color: var(--bg-color); padding: 10px 15px; border-radius: 6px; margin-top: 10px;">
                        <label for="winner-selection-date-preview" style="color: var(--primary-color);"><i class="fas fa-calendar-alt"></i> تاريخ اختيار الفائز المتوقع</label>
                        <p id="winner-selection-date-preview" class="summary-preview-text"></p>
                    </div>
                </div>
                <div class="form-group" style="margin-top: 15px;">
                    <label for="override-correct-answer">الإجابة الصحيحة للمسابقة</label>
                    <input type="text" id="override-correct-answer" placeholder="اكتب الإجابة الصحيحة هنا" required>
                </div>
                <div class="form-group" style="margin-top: 15px; background-color: var(--bg-color); padding: 10px; border-radius: 6px; display: none;">
                    <label style="color: var(--primary-color);"><i class="fas fa-key"></i> الإجابة الصحيحة</label>
                    <p id="correct-answer-display" class="summary-preview-text" style="color: var(--text-color);"></p>
                </div>
                <div id="validation-messages" class="validation-messages" style="margin-top: 20px;"></div>
            </div>
            
            <!-- Preview Column -->
            <div class="preview-v3 card-style-container">
                <form id="competition-form">
                    <h3><i class="fab fa-telegram-plane"></i> 2. معاينة وإرسال</h3>
                    <div class="telegram-preview-wrapper">
                        <div class="telegram-preview-header">
                            <div class="header-left"><i class="fab fa-telegram"></i><span>معاينة الرسالة</span></div>
                        </div>
                        <div class="telegram-preview-body">
                            <textarea id="competition-description" rows="15" required readonly></textarea>
                        </div>
                        <div id="telegram-image-preview-container" class="telegram-image-preview-container" style="display: none;">
                            <img id="telegram-image-preview" src="" alt="Competition Image Preview">
                        </div>
                        <div class="image-actions" style="margin-top: 10px;">
                            <input type="file" id="competition-image-upload" accept="image/*" style="display: none;">
                            <button type="button" id="change-competition-image-btn" class="btn-secondary btn-small"><i class="fas fa-edit"></i> تغيير الصورة</button>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary btn-send-telegram"><i class="fas fa-paper-plane"></i> إرسال إلى تلجرام الآن</button>
                        <button type="button" id="cancel-competition-form" class="btn-secondary">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const form = document.getElementById('competition-form');
    const templateSelect = document.getElementById('competition-template-select');
    const descInput = document.getElementById('competition-description');
    const tradingWinnersInput = document.getElementById('override-trading-winners');
    const prizeInput = document.getElementById('override-prize');
    const depositWinnersInput = document.getElementById('override-deposit-winners');
    const durationInput = document.getElementById('override-duration');
    const imagePreviewContainer = document.getElementById('telegram-image-preview-container');
    const imagePreview = document.getElementById('telegram-image-preview');
    const imageUploadInput = document.getElementById('competition-image-upload');
    const changeImageBtn = document.getElementById('change-competition-image-btn');

    changeImageBtn.addEventListener('click', () => imageUploadInput.click());

    imageUploadInput.addEventListener('change', () => {
        const file = imageUploadInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
            competitionImageFile = file;
        }
    });

    async function checkExistingCompetition(agentId, templateId) {
        const templateUsageInfo = document.getElementById('template-usage-info');
        templateUsageInfo.style.display = 'none';
        templateUsageInfo.classList.remove('error-text');
        if (!agentId || !templateId) return;
        try {
            const response = await authedFetch(`/api/competitions/check-existence?agent_id=${agentId}&template_id=${templateId}`);
            if (response.ok) {
                const { exists } = await response.json();
                if (exists) {
                    templateUsageInfo.innerHTML = `<i class="fas fa-exclamation-triangle"></i> تم إرسال هذه المسابقة لهذا الوكيل من قبل.`;
                    templateUsageInfo.style.display = 'block';
                    templateUsageInfo.classList.add('error-text');
                }
            }
        } catch (error) { console.error('Failed to check for existing competition:', error); }
    }

    function updateDescriptionAndPreview(event = {}) {
        const selectedId = templateSelect.value;
        const selectedTemplate = templates.find(t => String(t._id) === selectedId);

        if (!selectedTemplate) {
            descInput.value = 'الرجاء اختيار قالب مسابقة أولاً لعرض المعاينة.';
            return;
        }

        // --- REVISED: Image Handling ---
        // Image is now always set from the template when the template is selected.
        if (event.target && event.target.id === 'competition-template-select') {
            const imageUrl = selectedTemplate.image_url || 'images/competition_bg.jpg';
            imagePreview.src = imageUrl;
            imagePreviewContainer.style.display = 'block';
            competitionImageFile = null; // Reset custom image when template changes
        }

        if (event.target && event.target.id === 'competition-template-select') {
            checkExistingCompetition(agent._id, selectedId);
            if (selectedTemplate.usage_limit !== null) {
                const remaining = Math.max(0, selectedTemplate.usage_limit - (selectedTemplate.usage_count || 0));
                const message = `مرات الاستخدام المتبقية لهذا القالب: ${remaining}`;
                if (remaining === 1) showToast(message, 'error');
                else if (remaining <= 3) showToast(message, 'warning');
                else showToast(message, 'info');
            }
        }

        const correctAnswerDisplay = document.getElementById('correct-answer-display');
        correctAnswerDisplay.textContent = selectedTemplate.correct_answer || 'غير محددة';
        correctAnswerDisplay.parentElement.style.display = 'block';

        const correctAnswerInput = document.getElementById('override-correct-answer');
        if (correctAnswerInput) correctAnswerInput.value = selectedTemplate.correct_answer || '';

        const originalTemplateContent = selectedTemplate.content;
        const selectedTemplateQuestion = selectedTemplate.question;

        const tradingWinners = parseInt(tradingWinnersInput.value) || 0;
        const depositWinners = parseInt(depositWinnersInput.value) || 0;
        const prize = parseInt(prizeInput.value || 0);
        const duration = durationInput.value;
        const depositBonusPerc = agent.deposit_bonus_percentage || 0;
        
        function numberToArPlural(num) {
            const words = { 3: 'ثلاث', 4: 'أربع', 5: 'خمس', 6: 'ست', 7: 'سبع', 8: 'ثماني', 9: 'تسع', 10: 'عشر' };
            return words[num] || num.toString();
        }
        
        let prizeDetailsText = '';
        if (tradingWinners === 1) prizeDetailsText = `${prize}$ لفائز واحد فقط.`;
        else if (tradingWinners === 2) prizeDetailsText = `${prize}$ لفائزين اثنين فقط.`;
        else if (tradingWinners >= 3 && tradingWinners <= 10) prizeDetailsText = `${prize}$ لـ ${numberToArPlural(tradingWinners)} فائزين فقط.`;
        else if (tradingWinners > 10) prizeDetailsText = `${prize}$ لـ ${tradingWinners} فائزاً فقط.`;
        else if (tradingWinners > 0) prizeDetailsText = `${prize}$ لـ ${tradingWinners} فائزاً فقط.`;

        let depositBonusPrizeText = '';
        if (depositWinners > 0 && depositBonusPerc > 0) {
            if (depositWinners === 1) depositBonusPrizeText = `${depositBonusPerc}% بونص إيداع لفائز واحد فقط.`;
            else if (depositWinners === 2) depositBonusPrizeText = `${depositBonusPerc}% بونص إيداع لفائزين اثنين فقط.`;
            else if (depositWinners >= 3 && depositWinners <= 10) depositBonusPrizeText = `${depositBonusPerc}% بونص إيداع لـ ${numberToArPlural(depositWinners)} فائزين فقط.`;
            else if (depositWinners > 10) depositBonusPrizeText = `${depositBonusPerc}% بونص إيداع لـ ${depositWinners} فائزاً فقط.`;
        }

        let content = originalTemplateContent;
        content = content.replace(/{{agent_name}}/g, agent.name || 'الوكيل');
        if (prizeDetailsText) content = content.replace(/{{prize_details}}/g, prizeDetailsText);
        else content = content.replace(/^.*{{prize_details}}.*\n?/gm, '');

        if (depositBonusPrizeText) content = content.replace(/{{deposit_bonus_prize_details}}/g, depositBonusPrizeText);
        else content = content.replace(/^.*{{deposit_bonus_prize_details}}.*\n?/gm, '');

        let displayDuration = '';
        if (duration) {
            const endDate = new Date();
            let daysToAdd = 0;
            if (duration === '1d') daysToAdd = 1;
            else if (duration === '2d') daysToAdd = 2;
            else if (duration === '1w') daysToAdd = 7;
            endDate.setDate(endDate.getDate() + daysToAdd);
            const formattedEndDate = endDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            displayDuration = `من تاريخ اليوم وحتى نهاية يوم ${formattedEndDate}`;
        }

        if (displayDuration) content = content.replace(/⏳ مدة المسابقة: {{competition_duration}}/g, `⏳ مدة المسابقة:\n${displayDuration}`);
        else content = content.replace(/^.*⏳ مدة المسابقة: {{competition_duration}}.*\n?/gm, '');
        
        content = content.replace(/{{question}}/g, selectedTemplateQuestion || '');
        content = content.replace(/{{remaining_deposit_bonus}}/g, agent.remaining_deposit_bonus || 0);
        content = content.replace(/{{deposit_bonus_percentage}}/g, agent.deposit_bonus_percentage || 0);
        content = content.replace(/{{winners_count}}/g, tradingWinners);
        content = content.replace(/{{prize_per_winner}}/g, prize);
        descInput.value = content;

        const totalCost = tradingWinners * prize;
        const newRemainingBalance = (agent.remaining_balance || 0) - totalCost;
        const newRemainingDepositBonus = (agent.remaining_deposit_bonus || 0) - depositWinners;
        const balanceEl = document.getElementById('agent-remaining-balance');
        const bonusEl = document.getElementById('agent-remaining-deposit-bonus');
        const validationContainer = document.getElementById('validation-messages');
        balanceEl.textContent = `${newRemainingBalance.toFixed(2)}`;
        bonusEl.textContent = `${newRemainingDepositBonus} مرات`;

        let validationMessages = '';
        if (newRemainingBalance < 0) {
            validationMessages += `<div class="validation-error"><i class="fas fa-exclamation-triangle"></i> الرصيد غير كافٍ. التكلفة (${totalCost.toFixed(2)}$) تتجاوز الرصيد المتاح (${(agent.remaining_balance || 0).toFixed(2)}$).</div>`;
        }
        if (newRemainingDepositBonus < 0) {
            validationMessages += `<div class="validation-error"><i class="fas fa-exclamation-triangle"></i> عدد مرات بونص الإيداع غير كافٍ (المتاح: ${agent.remaining_deposit_bonus || 0}).</div>`;
        }
        const templateUsageInfo = document.getElementById('template-usage-info');
        if (templateUsageInfo.style.display === 'block' && templateUsageInfo.classList.contains('error-text')) {
            // Message is already displayed
        }
        validationContainer.innerHTML = validationMessages;
        document.getElementById('balance-card').classList.toggle('invalid', newRemainingBalance < 0);
        document.getElementById('bonus-card').classList.toggle('invalid', newRemainingDepositBonus < 0);

        const winnerDatePreview = document.getElementById('winner-selection-date-preview');
        if (duration) {
            let daysToAdd = 0;
            switch (duration) {
                case '1d': daysToAdd = 1; break;
                case '2d': daysToAdd = 2; break;
                case '1w': daysToAdd = 7; break;
            }
            const localToday = new Date();
            localToday.setHours(0, 0, 0, 0);
            localToday.setDate(localToday.getDate() + daysToAdd + 1);
            winnerDatePreview.innerHTML = `سيتم إرسال طلب اختيار الفائزين في بداية يوم <br><strong>${localToday.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>`;
            winnerDatePreview.parentElement.style.display = 'block';
        } else {
            winnerDatePreview.parentElement.style.display = 'none';
        }
    }

    [templateSelect, tradingWinnersInput, prizeInput, depositWinnersInput, durationInput].forEach(input => {
        input.addEventListener('change', updateDescriptionAndPreview);
    });

    imagePreviewContainer.addEventListener('click', (e) => {
        if (document.querySelector('.image-modal-overlay')) return;
        const imgSrc = imagePreview.src;
        if (imgSrc) { // Allow modal for all image sources, including data: URLs
            const modalOverlay = document.createElement('div');
            modalOverlay.className = 'image-modal-overlay';
            modalOverlay.setAttribute('role', 'dialog');
            modalOverlay.setAttribute('aria-modal', 'true');
            modalOverlay.setAttribute('aria-label', 'معاينة الصورة بحجم كبير');
            modalOverlay.innerHTML = `<img src="${imgSrc}" class="image-modal-content" alt="معاينة الصورة">`;
            const closeModal = () => {
                modalOverlay.remove();
                document.removeEventListener('keydown', handleEsc);
            };
            const handleEsc = (event) => {
                if (event.key === 'Escape') closeModal();
            };
            modalOverlay.addEventListener('click', closeModal);
            document.addEventListener('keydown', handleEsc);
            document.body.appendChild(modalOverlay);
        }
    });

    document.getElementById('cancel-competition-form').addEventListener('click', () => {
        window.location.hash = `profile/${agent.id}`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sendBtn = e.target.querySelector('.btn-send-telegram');
        const originalBtnHtml = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق والإرسال...';

        try {
            const selectedTemplateId = templateSelect.value;
            const selectedTemplate = templates.find(t => t._id == selectedTemplateId);
            if (!selectedTemplate) throw new Error('يرجى اختيار قالب مسابقة صالح.');

            const winnersCount = parseInt(document.getElementById('override-trading-winners').value) || 0;
            const prizePerWinner = parseFloat(document.getElementById('override-prize').value) || 0;
            const depositWinnersCount = parseInt(document.getElementById('override-deposit-winners').value) || 0;
            const totalCost = winnersCount * prizePerWinner;

            if (totalCost > (agent.remaining_balance || 0) || depositWinnersCount > (agent.remaining_deposit_bonus || 0)) {
                throw new Error('الرصيد أو عدد مرات البونص غير كافٍ.');
            }

            const verification = await verifyTelegramChat(agent);
            if (!verification.verified) throw new Error('فشل التحقق من بيانات التلجرام.');

            let finalImageUrl = selectedTemplate.image_url || '/images/competition_bg.jpg'; // Default to template image

            // --- FIX: Handle absolute localhost URLs from old templates ---
            if (finalImageUrl && finalImageUrl.startsWith('http://localhost')) {
                try {
                    const url = new URL(finalImageUrl);
                    finalImageUrl = url.pathname; // Convert to relative path
                } catch (e) {
                    console.error('Could not parse template image URL, leaving as is:', e);
                }
            }
            // --- End of FIX ---

            if (competitionImageFile) {
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الصورة...';
                const formData = new FormData();
                formData.append('image', competitionImageFile);

                const uploadResponse = await authedFetch('/api/competitions/upload-image', { method: 'POST', body: formData });

                if (!uploadResponse.ok) {
                    throw new Error('فشل رفع الصورة.');
                }
                
                const uploadResult = await uploadResponse.json();
                finalImageUrl = uploadResult.imageUrl;
            }



            console.log(`The image URL being sent is: ${finalImageUrl}`);

            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

            // --- FIX: Map frontend duration values to backend-expected values ---
            const durationMapping = {
                '1d': '24h',
                '2d': '48h',
                '1w': '168h' // Assuming 1 week is 168 hours for the backend
            };
            const backendDuration = durationMapping[durationInput.value] || durationInput.value;

            const competitionPayload = {
                name: selectedTemplate.question,
                description: descInput.value,
                is_active: true,
                classification: agent.classification,
                status: 'sent',
                agent_id: agent._id,
                duration: backendDuration,
                total_cost: totalCost,
                deposit_winners_count: depositWinnersCount,
                correct_answer: document.getElementById('override-correct-answer').value,
                winners_count: winnersCount,
                prize_per_winner: prizePerWinner,
                template_id: selectedTemplate._id,
                image_url: finalImageUrl
            };

            const compResponse = await authedFetch('/api/competitions', {
                method: 'POST',
                body: JSON.stringify(competitionPayload)
            });

            if (!compResponse.ok) {
                if (compResponse.status === 409) throw new Error('فشل الإرسال: تم إرسال هذه المسابقة لهذا الوكيل من قبل.');
                const result = await compResponse.json();
                throw new Error(result.message || 'فشل حفظ المسابقة.');
            }

            // --- FIX: Re-add Telegram sending logic after successful save ---
            const telegramResponse = await authedFetch('/api/post-announcement', {
                method: 'POST',
                body: JSON.stringify({
                    message: competitionPayload.description,
                    chatId: agent.telegram_chat_id,
                    imageUrl: finalImageUrl
                })
            });

            if (!telegramResponse.ok) {
                const result = await telegramResponse.json();
                // Even if Telegram fails, the competition is saved. Log it and inform the user.
                console.error(`فشل الإرسال إلى تلجرام لكن تم حفظ المسابقة: ${result.message}`);
                showToast(`تم حفظ المسابقة، لكن فشل الإرسال إلى تلجرام: ${result.message}`, 'warning');
            } else {
                showToast('تم حفظ المسابقة وإرسالها بنجاح.', 'success');
                // --- NEW: Automatically toggle the competition icon on success ---
                const todayDayIndex = new Date().getDay();
                window.taskStore.updateTaskStatus(agent._id, todayDayIndex, 'competition_sent', true);
            }
            // --- End of FIX ---

            // --- NEW: Use the correct PUT endpoint to update the agent's balance and deposit bonus ---
            const newRemainingBalance = (agent.remaining_balance || 0) - totalCost;
            const newConsumedBalance = (agent.consumed_balance || 0) + totalCost;
            const newRemainingDepositBonus = (agent.remaining_deposit_bonus || 0) - depositWinnersCount;
            const newUsedDepositBonus = (agent.used_deposit_bonus || 0) + depositWinnersCount;

            const updatePayload = {
                remaining_balance: newRemainingBalance,
                consumed_balance: newConsumedBalance,
                remaining_deposit_bonus: newRemainingDepositBonus,
                used_deposit_bonus: newUsedDepositBonus
            };

            const balanceUpdateResponse = await authedFetch(`/api/agents/${agent._id}`, {
                method: 'PUT',
                body: JSON.stringify(updatePayload)
            });

            if (!balanceUpdateResponse.ok) {
                const result = await balanceUpdateResponse.json();
                // Log the error and perhaps show a warning to the user that the balance deduction failed
                console.error(`فشل خصم الرصيد أو البونص: ${result.message}`);
                showToast(`تم إرسال المسابقة، لكن فشل تحديث الرصيد أو البونص: ${result.message}`, 'warning');
            } else {
                showToast('تم خصم التكاليف من الرصيد والبونص بنجاح.', 'success');
            }

            // --- FIX: Force a full page reload to show updated balance ---
            // Using .hash only changes the URL fragment without reloading, which can show stale cached data.
            // Using .assign() reloads the page, ensuring the latest agent data (with deducted balance) is fetched from the server.
            showToast('اكتملت العملية. جاري الانتقال لصفحة الوكيل...', 'info');
            window.location.assign(`/#profile/${agent._id}`);

        } catch (error) {
            showToast(error.message, 'error');
            console.error('Competition creation failed:', error);
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalBtnHtml;
        }
    });
}

async function renderArchivedCompetitionsPage() {
    const appContent = document.getElementById('app-content');
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
    const compsPerm = currentUserProfile?.permissions?.competitions?.manage_comps || 'none';
    const canView = isAdmin || templatesPerm === 'full' || templatesPerm === 'view';

    if (!canView) {
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
                <h1><i class="fas fa-archive"></i> المسابقات المنتهية</h1>
            </div>
            <div class="filters-container">
                <div class="filter-search-container">
                    <input type="search" id="archive-comp-search-input" placeholder="بحث باسم المسابقة أو الوكيل..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="archive-comp-search-clear"></i>
                </div>
                <div class="sort-container">
                    <label for="archive-comp-sort-select">ترتيب حسب:</label>
                    <select id="archive-comp-sort-select">
                        <option value="newest">الأحدث أولاً</option>
                        <option value="name_asc">اسم المسابقة (أ - ي)</option>
                        <option value="agent_asc">اسم الوكيل (أ - ي)</option>
                    </select>
                </div>
            </div>
        </div>
        <div id="archived-competitions-list-container"></div>
    `;

    let allArchivedCompetitions = [];

    async function loadArchivedCompetitions() {
        const response = await authedFetch('/api/competitions?status=completed&sort=newest');

        if (!response.ok) {
            document.getElementById('archived-competitions-list-container').innerHTML = '<p class="error">فشل تحميل المسابقات المنتهية.</p>';
            return;
        }

        const { data } = await response.json();
        allArchivedCompetitions = data || [];
        applyFiltersAndSort();
    }

    function displayArchived(competitions) {
        const container = document.getElementById('archived-competitions-list-container');
        if (competitions.length === 0) {
            container.innerHTML = '<p class="no-results-message">لا توجد مسابقات منتهية.</p>';
            return;
        }
        container.innerHTML = `
            <div class="competitions-list-view">
                ${competitions.map(comp => {
                    const agent = comp.agents;
                    const agentInfoHtml = agent
                        ? `<a href="#profile/${agent.id}" class="table-agent-cell">
                                ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Agent Avatar" class="avatar-small" loading="lazy">` : `<div class="avatar-placeholder-small"><i class="fas fa-user"></i></div>`}
                                <div class="agent-details"><span>${agent.name}</span></div>
                           </a>`
                        : `<div><span>(وكيل محذوف)</span></div>`;

                    return `
                    <div class="competition-card" data-id="${comp.id}">
                        <div class="competition-card-name"><h3>${comp.name}</h3></div>
                        <div class="competition-card-status"><span class="status-badge-v2 status-completed">مكتملة</span></div>
                        ${agentInfoHtml}
                        <div class="competition-card-footer">
                            <button class="btn-danger delete-competition-btn" title="حذف" data-id="${comp._id}"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `;
    }

    function applyFiltersAndSort() {
        const searchInput = document.getElementById('archive-comp-search-input');
        const sortSelect = document.getElementById('archive-comp-sort-select');
        const searchTerm = searchInput.value.toLowerCase().trim();
        const sortValue = sortSelect.value;

        let filtered = allArchivedCompetitions.filter(comp => {
            const name = comp.name.toLowerCase();
            const agentName = comp.agents ? comp.agents.name.toLowerCase() : '';
            return searchTerm === '' || name.includes(searchTerm) || agentName.includes(searchTerm);
        });

        filtered.sort((a, b) => {
            switch (sortValue) {
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'agent_asc': return (a.agents?.name || '').localeCompare(b.agents?.name || '');
                default: return new Date(b.created_at) - new Date(a.created_at);
            }
        });

        displayArchived(filtered);
    }

    document.getElementById('archive-comp-search-input').addEventListener('input', applyFiltersAndSort);
    document.getElementById('archive-comp-sort-select').addEventListener('change', applyFiltersAndSort);
    document.getElementById('archive-comp-search-clear').addEventListener('click', () => {
        const searchInput = document.getElementById('archive-comp-search-input');
        searchInput.value = '';
        applyFiltersAndSort();
    });

    // --- NEW: Add event listener for delete buttons ---
    const container = document.getElementById('archived-competitions-list-container');
    container.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-competition-btn');
        if (deleteBtn) {
            const isSuperAdmin = currentUserProfile?.role === 'super_admin';
            const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
            const compsPerm = currentUserProfile?.permissions?.competitions?.manage_comps || 'none';
            const canEdit = isAdmin || compsPerm === 'full';

            if (!canEdit) {
                showToast('ليس لديك صلاحية لحذف المسابقات.', 'error');
                return;
            }

            const id = deleteBtn.dataset.id;
            showConfirmationModal(
                'هل أنت متأكد من حذف هذه المسابقة نهائياً؟',
                async () => {
                    const response = await authedFetch(`/api/competitions/${id}`, { method: 'DELETE' });
                    if (!response.ok) {
                        showToast('فشل حذف المسابقة.', 'error');
                    } else {
                        showToast('تم حذف المسابقة بنجاح.', 'success');
                        await loadArchivedCompetitions(); // Refresh the list
                    }
                }, { title: 'تأكيد الحذف', confirmText: 'حذف', confirmClass: 'btn-danger' });
        }
    });

    await loadArchivedCompetitions();
}

// --- 3. Edit Existing Competition Form ---

async function renderCompetitionEditForm(compId) {
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const canEdit = isSuperAdmin || (currentUserProfile?.permissions?.competitions?.manage_comps === 'full');
    if (!canEdit) {
        document.getElementById('app-content').innerHTML = `
            <div class="access-denied-container">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية لتعديل المسابقات</h2>
                <p>أنت لا تملك الصلاحية اللازمة للوصول إلى هذه الصفحة. يرجى التواصل مع المدير.</p>
            </div>`;
        return;
    }
    appContent.innerHTML = `
        <div class="form-container">
            <h2>تعديل المسابقة: ${competition.name}</h2>
            <form id="competition-form" class="form-layout">
                <div class="form-group"><label for="competition-name">اسم المسابقة</label><input type="text" id="competition-name" value="${competition.name}" required></div>
                <div class="form-group"><label for="competition-description">الوصف</label><textarea id="competition-description" rows="3">${competition.description || ''}</textarea></div>
                <div class="form-group"><label class="custom-checkbox toggle-switch"><input type="checkbox" id="competition-active" ${competition.is_active ? 'checked' : ''}> <span class="slider"></span><span class="label-text">نشطة</span></label></div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">حفظ التعديلات</button>
                    <button type="button" id="cancel-competition-form" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('cancel-competition-form').addEventListener('click', () => { window.location.hash = 'competitions'; });

    document.getElementById('competition-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            name: document.getElementById('competition-name').value,
            description: document.getElementById('competition-description').value,
            is_active: document.getElementById('competition-active').checked,
        };

        const response = await authedFetch(`/api/competitions/${compId}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            showToast('فشل حفظ التعديلات.', 'error');
        } else {
            showToast('تم حفظ التعديلات بنجاح.', 'success');
            window.location.hash = 'competitions';
        }
    });
}

// --- 4. Competition Templates Page ---

async function renderCompetitionTemplatesPage() {
    // --- NEW: Permission Check ---
    const appContent = document.getElementById('app-content');
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
    const templatesPerm = currentUserProfile?.permissions?.competitions?.manage_templates || 'none';
    const canView = isAdmin || templatesPerm === 'full' || templatesPerm === 'view';

    if (!canView) {
        appContent.innerHTML = `
            <div class="access-denied-container">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية وصول</h2>
                <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
            </div>`;
        return;
    }

    const canEdit = isAdmin || templatesPerm === 'full'; // إصلاح: تعريف الصلاحية بعد التحقق من العرض
    document.querySelector('main').classList.add('full-width');

    const defaultTemplateContent = `مسابقة جديدة من شركة إنزو للتداول 🏆

✨ هل تملك عينًا خبيرة في قراءة الشارتات؟ اختبر نفسك واربح!

💰 الجائزة: {{prize_details}}
                 {{deposit_bonus_prize_details}}

❓ سؤال المسابقة:
{{question}}

📝 كيفية المشاركة:
ضع تعليقك على منشور المسابقة بالقناة باستخدام حسابك الشخصي على تليجرام.

يجب أن يتضمن تعليقك:
• إجابتك على السؤال.
• اسمك الثلاثي المسجل بالوثائق.
• رقم الحساب التداولي.

يُمنع تعديل التعليق بعد نشره، وأي تعليق مُعدل سيتم استبعاده مباشرة.

⏳ مدة المسابقة: {{competition_duration}}

📚 يمكنك معرفة الإجابة وتعلّم المزيد عن النماذج الفنية وأساليب التحليل مع الكورس المجاني المقدم من الخبير العالمي أ. شريف خورشيد على موقع إنزو. 🆓

✨ لا تفوت الفرصة!
جاوب صح، اختبر معرفتك، وكن الفائز مع إنزو 🎁`;

    appContent.innerHTML = `
        <div class="page-header">
            <div class="header-top-row">
                <h1><i class="fas fa-file-alt"></i> إدارة قوالب المسابقات</h1>
                <button id="show-template-form-btn" class="btn-primary"><i class="fas fa-plus-circle"></i> إنشاء قالب جديد</button>
            </div>
            <div class="template-filters">
                <div class="filter-search-container">
                    <input type="search" id="template-search-input" placeholder="بحث باسم القالب..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="template-search-clear"></i>
                </div>
                <div class="filter-buttons" data-filter-group="classification">
                    <button class="filter-btn active" data-filter="all">الكل</button>
                    <button class="filter-btn" data-filter="R">R</button>
                    <button class="filter-btn" data-filter="A">A</button>
                    <button class="filter-btn" data-filter="B">B</button>
                    <button class="filter-btn" data-filter="C">C</button>
                    <button class="filter-btn" data-filter="All">عام</button>
                </div>
            </div>
        </div>
        <div class="templates-list-container">
            <div id="templates-list" class="templates-list-grouped"></div>
        </div>
    `;

    const templatesListDiv = document.getElementById('templates-list');
    const showFormBtn = document.getElementById('show-template-form-btn');

    if (showFormBtn) {
        if (canEdit) {
            showFormBtn.addEventListener('click', () => renderCreateTemplateModal(defaultTemplateContent, loadTemplates));
        } else {
            showFormBtn.addEventListener('click', () => showToast('ليس لديك صلاحية لإنشاء قوالب.', 'error'));
        }
    }

    async function loadTemplates() {
        const response = await authedFetch('/api/templates?archived=false');

        if (!response.ok) {
            console.error('Error fetching templates:', await response.text());
            templatesListDiv.innerHTML = '<p class="error">فشل تحميل القوالب.</p>';
            return;
        }

        const { data: templates } = await response.json();
        // Sort templates by classification R, A, B, C, then All
        const classificationOrder = { 'R': 1, 'A': 2, 'B': 3, 'C': 4, 'All': 5 };
        templates.sort((a, b) => {
            const orderA = classificationOrder[a.classification] || 99;
            const orderB = classificationOrder[b.classification] || 99;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            // Secondary sort by question name alphabetically
            // --- FIX: Add a fallback for templates that might not have a name ---
            return (a.name || '').localeCompare(b.name || '');
        });

        if (templates.length === 0) {
            templatesListDiv.innerHTML = '<p class="no-results-message">لا توجد قوالب محفوظة بعد.</p>';
        } else {
            const groupedTemplates = templates.reduce((acc, template) => {
            const key = template.classification || 'All'; // Ensure key exists
                if (!acc[key]) acc[key] = [];
                acc[key].push(template);
                return acc;
        }, {}); // Initialize with an empty object

            const classificationOrder = ['R', 'A', 'B', 'C', 'All'];
            let groupsHtml = '';

            for (const classification of classificationOrder) {
                if (groupedTemplates[classification]) {
                    const group = groupedTemplates[classification];
                    groupsHtml += `
                        <details class="template-group" data-classification-group="${classification}" open>
                            <summary class="template-group-header">
                                <h2>تصنيف ${classification === 'All' ? 'عام' : classification}</h2>
                                <span class="template-count">${group.length} قوالب</span>
                            </summary>
                            <div class="template-group-content">
                                ${group.map(template => `
                                <div class="template-card" data-id="${template._id}" data-question="${(template.name || '').toLowerCase()}" data-classification="${template.classification || 'All'}">
                                        <div class="template-card-header">
                                        <h4>${template.name || 'قالب بدون اسم'}</h4>
                                        </div>
                                        <div class="template-card-body">
                                            <p>${template.content.substring(0, 120)}...</p>
                                        </div>
                                        <div class="template-card-footer">
                                            <button class="btn-secondary edit-template-btn" data-id="${template._id}"><i class="fas fa-edit"></i> تعديل</button>
                                            <button class="btn-danger delete-template-btn" data-id="${template._id}"><i class="fas fa-trash-alt"></i> حذف</button>
                                        </div> 
                                    </div>
                                `).join('')}
                            </div>
                        </details>
                    `;
                }
            }
            templatesListDiv.innerHTML = groupsHtml;
        }
    }

    templatesListDiv.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-template-btn');
        if (editBtn) {
            if (!canEdit) {
                showToast('ليس لديك صلاحية لتعديل القوالب.', 'error'); // Corrected permission check
                return;
            }
            const id = editBtn.dataset.id; // This is the Supabase ID, which is correct for fetching
            const response = await authedFetch(`/api/templates/${id}`);
            const { data: template } = await response.json();
            
            if (!response.ok || !template) {
                showToast('فشل العثور على القالب.', 'error');
                return;
            }
            
            renderEditTemplateModal(template, loadTemplates);
        }

        const deleteBtn = e.target.closest('.delete-template-btn');
        if (deleteBtn) {
            if (!canEdit) {
                showToast('ليس لديك صلاحية لحذف القوالب.', 'error');
                return;
            }
            const templateId = deleteBtn.dataset.id; // This is the MongoDB _id string
            showConfirmationModal(
                'هل أنت متأكد من حذف هذا القالب؟<br><small>لا يمكن التراجع عن هذا الإجراء.</small>',
                async () => {
                    const response = await authedFetch(`/api/templates/${templateId}/archive`, { method: 'PATCH' });
                    if (!response.ok) {
                        const result = await response.json();
                        showToast(result.message || 'فشل حذف القالب.', 'error');
                    } else {
                        showToast('تم حذف القالب بنجاح.', 'success');
                        await loadTemplates();
                    }
                },
                { title: 'تأكيد حذف القالب', confirmText: 'حذف', confirmClass: 'btn-danger' }
            );
        }
    });

    await loadTemplates();
    setupTemplateFilters();
}

function renderCreateTemplateModal(defaultContent, onSaveCallback) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    let templateImageFile = null; // Variable to hold the new image file

    const modal = document.createElement('div');
    modal.className = 'form-modal-content modal-fullscreen'; // Use existing style from components.css
    
    modal.innerHTML = `
        <div class="form-modal-header">
            <h2><i class="fas fa-plus-circle"></i> إنشاء قالب مسابقة جديد</h2>
            <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
        </div>
        <div class="form-modal-body">
            <form id="create-template-form" class="template-form-grid">
                <div class="template-form-fields">
                    <h3 class="details-section-title" style="margin-top: 0;"><i class="fas fa-info-circle"></i> الحقول الأساسية</h3>
                    <div class="form-group">
                        <label for="create-template-question">السؤال (سيكون اسم المسابقة)</label>
                        <textarea id="create-template-question" rows="3" required></textarea>
                        <div id="template-question-validation" class="validation-error" style="display: none; margin-top: 8px; font-size: 0.9em;"></div>
                    </div>
                    <div class="form-group">
                        <label for="create-template-correct-answer">الإجابة الصحيحة</label>
                        <textarea id="create-template-correct-answer" rows="2" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="create-template-classification">التصنيف (لمن سيظهر هذا القالب)</label>
                        <select id="create-template-classification" required>
                            <option value="All" selected>عام (يظهر للجميع)</option>
                            <option value="R">R</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="create-template-usage-limit">عدد مرات الاستخدام (اتركه فارغاً للاستخدام غير المحدود)</label>
                        <input type="number" id="create-template-usage-limit" min="1" placeholder="مثال: 5">
                    </div>
                </div>
                <div class="template-form-content">
                    <h3 class="details-section-title" style="margin-top: 0;"><i class="fas fa-file-alt"></i> محتوى المسابقة</h3>
                    <!-- NEW: Image Preview Section with upload button -->
                    <div class="form-group">
                        <label>صورة القالب</label>
                        <div class="image-preview-container">
                            <img id="create-template-image-preview" src="images/competition_bg.jpg" alt="صورة القالب" class="image-preview">
                        </div>
                        <input type="file" id="create-template-image-upload" accept="image/*" style="display: none;">
                        <button type="button" id="change-template-image-btn" class="btn-secondary btn-small" style="margin-top: 10px;"><i class="fas fa-edit"></i> تغيير الصورة</button>
                    </div>
                    <div class="form-group">
                        <label for="create-template-content">نص المسابقة</label>
                        <textarea id="create-template-content" rows="15" required>${defaultContent}</textarea>
                    </div>
                </div>
                <div class="form-actions template-form-actions">
                    <button type="submit" class="btn-primary"><i class="fas fa-save"></i> حفظ القالب</button>
                    <button type="button" id="cancel-create-modal" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    // --- NEW: Event Listeners for Image Manipulation ---
    const imageUploadInput = document.getElementById('create-template-image-upload');
    const changeImageBtn = document.getElementById('change-template-image-btn');
    const imagePreview = document.getElementById('create-template-image-preview');

    changeImageBtn.addEventListener('click', () => imageUploadInput.click());

    imageUploadInput.addEventListener('change', () => {
        const file = imageUploadInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
            templateImageFile = file;
        }
    });

    // --- NEW: Live validation for template question ---
    const questionInput = document.getElementById('create-template-question');
    const validationDiv = document.getElementById('template-question-validation');
    let debounceTimeout;

    questionInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
            const questionText = questionInput.value.trim();
            if (questionText) {
                try {
                    const response = await authedFetch(`/api/templates/check-existence?question=${encodeURIComponent(questionText)}`);
                    if (response.ok) {
                        const { exists, archived } = await response.json();
                        if (exists) {
                            if (archived) {
                                validationDiv.innerHTML = 'هذا السؤال موجود في قالب محذوف. يمكنك <a href="#archived-templates">استعادته من الأرشيف</a>.';
                            } else {
                                validationDiv.textContent = 'هذا السؤال مستخدم بالفعل في قالب آخر.';
                            }
                            validationDiv.style.display = 'block';
                        } else {
                            validationDiv.style.display = 'none';
                        }
                    } else {
                        validationDiv.style.display = 'none'; // Hide on error
                    }
                } catch (error) {
                    console.error('Error checking template existence:', error);
                    validationDiv.style.display = 'none'; // Hide on error
                }
            } else {
                validationDiv.style.display = 'none';
            }
        }, 500); // 500ms debounce delay
    });


    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-create-modal').addEventListener('click', closeModal);
    
    document.getElementById('create-template-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        // --- NEW: Prevent submission if validation error is visible ---
        if (validationDiv.style.display === 'block') {
            showToast('لا يمكن حفظ القالب لأن السؤال مستخدم بالفعل.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;

        const questionText = document.getElementById('create-template-question').value.trim();        
        if (!questionText) {
            showToast('حقل السؤال مطلوب.', 'error');
            submitBtn.disabled = false;
            return;
        }

        try {
            let finalImageUrl = '/images/competition_bg.jpg'; // Default image

            if (templateImageFile) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الصورة...';
                const formData = new FormData();
                formData.append('image', templateImageFile);

                // Re-using the competition image upload endpoint
                const uploadResponse = await authedFetch('/api/competitions/upload-image', { method: 'POST', body: formData });

                if (!uploadResponse.ok) {
                    throw new Error('فشل رفع الصورة.');
                }
                
                const uploadResult = await uploadResponse.json();
                finalImageUrl = uploadResult.imageUrl; // The backend should return the relative path
            }
            
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري حفظ القالب...';

            const formData = {
                name: questionText,
                classification: document.getElementById('create-template-classification').value,
                content: document.getElementById('create-template-content').value.trim(),
                correct_answer: document.getElementById('create-template-correct-answer').value.trim(),
                usage_limit: document.getElementById('create-template-usage-limit').value ? parseInt(document.getElementById('create-template-usage-limit').value, 10) : null,
                usage_count: 0,
                is_archived: false,
                image_url: finalImageUrl // Add the image URL to the payload
            };

            console.log('Creating template with data:', formData);

            const response = await authedFetch('/api/templates', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('Template creation failed:', result);
                throw new Error(result.message || 'فشل حفظ القالب.');
            }
            
            console.log('Template created successfully:', result);
            showToast('تم حفظ القالب بنجاح.', 'success');
            closeModal();
            if (onSaveCallback) onSaveCallback();

        } catch (error) {
            showToast(error.message, 'error');
            console.error('Template creation failed:', error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    });
}

function setupTemplateFilters() {
    const searchInput = document.getElementById('template-search-input');
    const clearBtn = document.getElementById('template-search-clear');
    const filterButtons = document.querySelectorAll('.template-filters .filter-btn');

    if (!searchInput) return;

    const applyFilters = () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeFilter = document.querySelector('.template-filters .filter-btn.active').dataset.filter;

        const allGroups = document.querySelectorAll('.template-group'); // Corrected selector
        let hasResults = false;

        allGroups.forEach(group => {
            const cards = group.querySelectorAll('.template-card');
            let visibleCardsInGroup = 0;

            cards.forEach(card => {
                const question = card.dataset.question || ''; // Add fallback for safety
                const classification = card.dataset.classification;

                const matchesSearch = searchTerm === '' || question.includes(searchTerm);
                const matchesFilter = activeFilter === 'all' || classification === activeFilter;

                const isVisible = matchesSearch && matchesFilter;
                card.style.display = isVisible ? '' : 'none';
                if (isVisible) {
                    visibleCardsInGroup++;
                }
            });

            // Hide the entire group if no cards are visible
            group.style.display = visibleCardsInGroup > 0 ? '' : 'none';
            if (visibleCardsInGroup > 0) {
                hasResults = true;
            }
        });
    };

    searchInput.addEventListener('input', applyFilters);
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            applyFilters();
            searchInput.focus();
        });
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            applyFilters();
        });
    });
}

async function renderArchivedTemplatesPage() {
    const appContent = document.getElementById('app-content');
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
    const templatesPerm = currentUserProfile?.permissions?.competitions?.manage_templates || 'none';
    const canView = isAdmin || templatesPerm === 'full' || templatesPerm === 'view';

    if (!canView) {
        appContent.innerHTML = ` <div class="access-denied-container">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية وصول</h2>
                <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
            </div>`;
        return;
    }
    document.querySelector('main').classList.add('full-width');

    appContent.innerHTML = `
        <div class="page-header">
            <div class="header-top-row">
                <h1><i class="fas fa-archive"></i> أرشيف قوالب المسابقات</h1>
            </div>
            <div class="template-filters">
                <div class="filter-search-container">
                    <input type="search" id="archive-search-input" placeholder="بحث باسم القالب..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="archive-search-clear"></i>
                </div>
                <div class="filter-buttons" data-filter-group="classification">
                    <button class="filter-btn active" data-filter="all">الكل</button>
                    <button class="filter-btn" data-filter="R">R</button>
                    <button class="filter-btn" data-filter="A">A</button>
                    <button class="filter-btn" data-filter="B">B</button>
                    <button class="filter-btn" data-filter="C">C</button>
                    <button class="filter-btn" data-filter="All">عام</button>
                </div>
            </div>
        </div>
        <p class="page-subtitle" style="text-align: right; margin-top: 0;">القوالب التي وصلت إلى الحد الأقصى من الاستخدام. يمكنك إعادة تفعيلها من هنا.</p>
        <div id="archived-templates-list" class="table-responsive-container">
            <p>جاري تحميل الأرشيف...</p>
        </div>
    `;

    const listDiv = document.getElementById('archived-templates-list');
    let allArchivedTemplates = [];

    function displayArchived(templatesToDisplay) {
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
        const templatesPerm = currentUserProfile?.permissions?.competitions?.manage_templates || 'none';
        const canEdit = isAdmin || templatesPerm === 'full';
        if (templatesToDisplay.length === 0) {
            listDiv.innerHTML = '<p class="no-results-message">لا توجد قوالب في الأرشيف تطابق بحثك.</p>';
        } else { // Corrected logic
            listDiv.innerHTML = `
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>اسم القالب (السؤال)</th>
                            <th>التصنيف</th>
                            <th>مرات الاستخدام</th>
                            <th class="actions-column">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${templatesToDisplay.map(template => `
                            <tr data-question="${(template.name || '').toLowerCase()}" data-classification="${template.classification || 'All'}">
                                <td data-label="اسم القالب">${template.name || 'قالب بدون اسم'}</td>
                                <td data-label="التصنيف"><span class="classification-badge classification-${(template.classification || 'all').toLowerCase()}">${template.classification || 'الكل'}</span></td>
                                <td data-label="مرات الاستخدام">${template.usage_count} / ${template.usage_limit}</td>
                                <td class="actions-cell">
                                    <button class="btn-primary reactivate-template-btn btn-small" data-id="${template._id}"><i class="fas fa-undo"></i> إعادة تفعيل</button>
                                    ${canEdit ? `<button class="btn-danger delete-template-btn btn-small" data-id="${template._id}"><i class="fas fa-trash-alt"></i> حذف نهائي</button>` : ''}
                                </td> 
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }

    function setupArchiveFilters() {
        const searchInput = document.getElementById('archive-search-input');
        const clearBtn = document.getElementById('archive-search-clear');
        const filterButtons = document.querySelectorAll('.template-filters .filter-btn');

        const applyFilters = () => {
            if (clearBtn) clearBtn.style.display = searchInput.value ? 'block' : 'none';
            const searchTerm = searchInput.value.toLowerCase().trim();
            const activeFilter = document.querySelector('.template-filters .filter-btn.active').dataset.filter;

            const filtered = allArchivedTemplates.filter(template => {
                const matchesSearch = searchTerm === '' || template.name.toLowerCase().includes(searchTerm);
                const matchesFilter = activeFilter === 'all' || (template.classification || 'All') === activeFilter;
                return matchesSearch && matchesFilter;
            });
            displayArchived(filtered);
        };

        searchInput.addEventListener('input', applyFilters);
        clearBtn.addEventListener('click', () => { searchInput.value = ''; applyFilters(); });
        filterButtons.forEach(btn => btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilters();
        }));
    }

    async function loadAndDisplayArchived() {
        const response = await authedFetch('/api/templates?archived=true');

        if (!response.ok) {
            listDiv.innerHTML = `<p class="error">فشل تحميل الأرشيف.</p>`;
            console.error('Archive fetch error:', await response.text());
            return;
        }
        const { data } = await response.json();
        allArchivedTemplates = data || [];
        displayArchived(allArchivedTemplates || []);
        setupArchiveFilters();
    }

    listDiv.addEventListener('click', async (e) => {
        const reactivateBtn = e.target.closest('.reactivate-template-btn');
        const deleteBtn = e.target.closest('.delete-template-btn');

        if (reactivateBtn) {
            const id = reactivateBtn.dataset.id;
            showConfirmationModal('هل أنت متأكد من إعادة تفعيل هذا القالب؟<br><small>سيتم إعادة تعيين عداد استخدامه إلى الصفر.</small>', async () => {
                const response = await authedFetch(`/api/templates/${id}/reactivate`, { method: 'PUT' });
                if (!response.ok) {
                    const result = await response.json();
                    showToast(result.message || 'فشل إعادة تفعيل القالب.', 'error');
                } else {
                    showToast('تم إعادة تفعيل القالب بنجاح.', 'success');
                    await loadAndDisplayArchived();
                }
            }, { title: 'تأكيد إعادة التفعيل' });
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            showConfirmationModal('هل أنت متأكد من الحذف النهائي لهذا القالب؟<br><small>هذا الإجراء لا يمكن التراجع عنه.</small>', async () => {
                const response = await authedFetch(`/api/templates/${id}`, { method: 'DELETE' });
                if (!response.ok) {
                    const result = await response.json();
                    showToast(result.message || 'فشل حذف القالب.', 'error');
                } else {
                    showToast('تم حذف القالب نهائياً.', 'success');
                    await loadAndDisplayArchived();
                }
            }, { title: 'تأكيد الحذف النهائي', confirmText: 'حذف نهائي', confirmClass: 'btn-danger' });
        }
    });

    await loadAndDisplayArchived();
}

function renderEditTemplateModal(template, onSaveCallback) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    let templateImageFile = null; // Variable to hold the new image file

    const modal = document.createElement('div');
    modal.className = 'form-modal-content modal-fullscreen'; // Use fullscreen for consistency

    modal.innerHTML = `
        <div class="form-modal-header">
            <h2><i class="fas fa-edit"></i> تعديل قالب مسابقة</h2>
            <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
        </div>
        <div class="form-modal-body">
            <form id="edit-template-form" class="template-form-grid">
                <div class="template-form-fields">
                    <h3 class="details-section-title" style="margin-top: 0;"><i class="fas fa-info-circle"></i> الحقول الأساسية</h3>
                    <div class="form-group">
                        <label for="edit-template-question">السؤال (سيكون اسم المسابقة)</label>
                        <textarea id="edit-template-question" rows="3" required>${template.name}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="edit-template-correct-answer">الإجابة الصحيحة</label>
                        <textarea id="edit-template-correct-answer" rows="2" required>${template.correct_answer || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="edit-template-classification">التصنيف</label>
                        <select id="edit-template-classification" required>
                            <option value="All" ${template.classification === 'All' ? 'selected' : ''}>عام</option>
                            <option value="R" ${template.classification === 'R' ? 'selected' : ''}>R</option>
                            <option value="A" ${template.classification === 'A' ? 'selected' : ''}>A</option>
                            <option value="B" ${template.classification === 'B' ? 'selected' : ''}>B</option>
                            <option value="C" ${template.classification === 'C' ? 'selected' : ''}>C</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-template-usage-limit">
                            عدد مرات الاستخدام (اتركه فارغاً للاستخدام غير المحدود)
                            <small style="display: block; color: var(--text-secondary-color);">المستخدم حالياً: ${template.usage_count || 0}</small>
                        </label>
                        <input type="number" id="edit-template-usage-limit" min="1" placeholder="مثال: 5" value="${template.usage_limit || ''}">
                    </div>
                </div>
                <div class="template-form-content">
                    <h3 class="details-section-title" style="margin-top: 0;"><i class="fas fa-file-alt"></i> محتوى المسابقة</h3>
                    <div class="form-group">
                        <label>صورة القالب</label>
                        <div class="image-preview-container">
                            <img id="edit-template-image-preview" src="${template.image_url || 'images/competition_bg.jpg'}" alt="صورة القالب" class="image-preview">
                        </div>
                        <input type="file" id="edit-template-image-upload" accept="image/*" style="display: none;">
                        <button type="button" id="change-template-image-btn" class="btn-secondary btn-small" style="margin-top: 10px;"><i class="fas fa-edit"></i> تغيير الصورة</button>
                    </div>
                    <div class="form-group">
                        <label for="edit-template-content">نص المسابقة</label>
                        <textarea id="edit-template-content" rows="15" required>${template.content}</textarea>
                    </div>
                </div>
                <div class="form-actions template-form-actions">
                    <button type="submit" class="btn-primary"><i class="fas fa-save"></i> حفظ التعديلات</button>
                    <button type="button" id="cancel-edit-modal" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    // Image manipulation listeners
    const imageUploadInput = document.getElementById('edit-template-image-upload');
    const changeImageBtn = document.getElementById('change-template-image-btn');
    const imagePreview = document.getElementById('edit-template-image-preview');

    changeImageBtn.addEventListener('click', () => imageUploadInput.click());

    imageUploadInput.addEventListener('change', () => {
        const file = imageUploadInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
            templateImageFile = file;
        }
    });

    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-edit-modal').addEventListener('click', closeModal);

    document.getElementById('edit-template-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        console.log('Edit template form submitted.');

        try {
            let finalImageUrl = template.image_url; // Start with the existing image URL

            // Defensively strip origin if it's a localhost URL
            if (finalImageUrl && finalImageUrl.startsWith('http://localhost')) {
                try {
                    const url = new URL(finalImageUrl);
                    finalImageUrl = url.pathname;
                } catch (e) {
                    console.error('Could not parse existing template image URL:', e);
                }
            }

            console.log('Initial image URL:', finalImageUrl);
            console.log('templateImageFile:', templateImageFile);

            if (templateImageFile) {
                console.log('New template image file detected. Uploading...');
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الصورة...';
                const formData = new FormData();
                formData.append('image', templateImageFile);

                const uploadResponse = await authedFetch('/api/competitions/upload-image', { method: 'POST', body: formData });

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    console.error('Image upload failed. Status:', uploadResponse.status, 'Response:', errorText);
                    throw new Error('فشل رفع الصورة.');
                }
                
                const uploadResult = await uploadResponse.json();
                finalImageUrl = uploadResult.imageUrl;
                console.log('Image uploaded successfully. New image URL:', finalImageUrl);
            } else {
                console.log('No new image file. Keeping existing URL.');
            }
            
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري حفظ التعديلات...';

            const updatedData = {
                name: document.getElementById('edit-template-question').value.trim(),
                classification: document.getElementById('edit-template-classification').value,
                content: document.getElementById('edit-template-content').value.trim(),
                correct_answer: document.getElementById('edit-template-correct-answer').value.trim(),
                usage_limit: document.getElementById('edit-template-usage-limit').value ? parseInt(document.getElementById('edit-template-usage-limit').value, 10) : null,
                image_url: finalImageUrl // Use the new or existing image URL
            };

            console.log('Submitting updated template data:', updatedData);

            const response = await authedFetch(`/api/templates/${template._id}`, {
                method: 'PUT',
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) {
                const result = await response.json();
                console.error('Failed to save template:', result);
                throw new Error(result.message || 'فشل حفظ التعديلات.');
            }
            
            showToast('تم حفظ التعديلات بنجاح.', 'success');
            closeModal();
            if (onSaveCallback) onSaveCallback();

        } catch (error) {
            showToast(error.message, 'error');
            console.error('Template edit failed:', error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    });
}

// New function to display competition details in a dedicated section
function displayCompetitionDetails(competition) {
    const detailsContainer = document.getElementById('competition-details-container');
    if (!detailsContainer) return;

    // Basic info
    detailsContainer.innerHTML = `
        <h2>تفاصيل المسابقة: ${competition.name}</h2>
        <p><strong>الوصف:</strong> ${competition.description || 'لا يوجد وصف متاح.'}</p>
        <p><strong>الحالة:</strong> ${competition.is_active ? 'نشطة' : 'غير نشطة'}</p>
        <p><strong>تاريخ البدء:</strong> ${new Date(competition.starts_at).toLocaleString('ar-EG')}</p>
        <p><strong>تاريخ الانتهاء:</strong> ${new Date(competition.ends_at).toLocaleString('ar-EG')}</p>
    `;

    // Agent info
    if (competition.agents) {
        const agent = competition.agents;
        detailsContainer.innerHTML += `
            <div class="agent-info-card">
                <h3>بيانات الوكيل</h3>
                <p><strong>الاسم:</strong> ${agent.name}</p>
                <p><strong>التصنيف:</strong> ${agent.classification || 'غير محدد'}</p>
                <p><strong>الرصيد المتبقي:</strong> $${agent.remaining_balance || 0}</p>
            </div>
        `;
    }

    // --- FIX: Display the actual winner selection request date from `processed_at` ---
    const winnerDateElement = document.querySelector('.competition-winner-date');
    if (winnerDateElement) {
        let winnerDateHtml = '<strong>تاريخ إرسال طلب اختيار الفائز:</strong> ';
        if (competition.processed_at) {
            const formattedWinnerDate = new Intl.DateTimeFormat('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(new Date(competition.processed_at));
            winnerDateHtml += `<span class="date-value">${formattedWinnerDate}</span>`;
        } else {
            winnerDateHtml += `<span class="date-value" style="color: var(--warning-color);">لم يتم الإرسال بعد</span>`;
        }
        winnerDateElement.innerHTML = winnerDateHtml;
    }
    
    console.log('Competition Processed At:', competition.processed_at);
}