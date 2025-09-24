// --- Main Router for Competitions/Templates Section ---
let allCompetitionsData = [];
const COMPETITIONS_PER_PAGE = 9;
let selectedCompetitionIds = []; // For bulk actions

async function renderCompetitionsPage() {
    const appContent = document.getElementById('app-content');
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const agentId = urlParams.get('agentId');

    if (hash.startsWith('#competitions/new')) {
        await renderCompetitionCreatePage(agentId);
    } else if (hash.startsWith('#competitions/edit/')) {
        const compId = hash.split('/')[2];
        await renderCompetitionEditForm(compId);
    } else {
        await renderAllCompetitionsListPage();
    }
}

// --- 0. All Competitions List Page (New Default) ---
async function renderAllCompetitionsListPage() {
    selectedCompetitionIds = []; // Reset selection on page render
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>إدارة المسابقات</h1>
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
                            <button class="filter-btn active" data-filter="all">كل التصنيفات</button>
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
            <div class="bulk-actions">
                <button id="bulk-deactivate-btn" class="btn-secondary"><i class="fas fa-power-off"></i> تعطيل المحدد</button>
                <button id="bulk-delete-btn" class="btn-danger"><i class="fas fa-trash-alt"></i> حذف المحدد</button>
            </div>
        </div>
        <div id="competitions-list-container"></div>
    `;

    const container = document.getElementById('competitions-list-container');

    // Use event delegation for delete buttons
    appContent.addEventListener('click', async (e) => { // Listen on a parent that persists
        const deleteBtn = e.target.closest('.delete-competition-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (!id) return;
            showConfirmationModal(
                'هل أنت متأكد من حذف هذه المسابقة؟<br><small>هذا الإجراء لا يمكن التراجع عنه.</small>',
                async () => {
                    const { error } = await supabase.from('competitions').delete().eq('id', id);
                    if (error) {
                        showToast('فشل حذف المسابقة.', 'error');
                        console.error('Delete competition error:', error);
                    } else {
                        showToast('تم حذف المسابقة بنجاح.', 'success');
                        await refreshCompetitionsList(true);
                    }
                }, {
                    title: 'تأكيد حذف المسابقة',
                    confirmText: 'حذف',
                    confirmClass: 'btn-danger'
                });
        }

        // Bulk Deactivate
        if (e.target.closest('#bulk-deactivate-btn')) {
            showConfirmationModal(
                `هل أنت متأكد من تعطيل ${selectedCompetitionIds.length} مسابقة؟`,
                async () => {
                    const { error } = await supabase.from('competitions').update({ is_active: false }).in('id', selectedCompetitionIds);
                    if (error) {
                        showToast('فشل تعطيل المسابقات المحددة.', 'error');
                    } else {
                        showToast('تم تعطيل المسابقات المحددة بنجاح.', 'success');
                        await refreshCompetitionsList();
                    }
                }, { title: 'تأكيد التعطيل' }
            );
        }

        // Bulk Delete
        if (e.target.closest('#bulk-delete-btn')) {
            showConfirmationModal(
                `هل أنت متأكد من حذف ${selectedCompetitionIds.length} مسابقة بشكل نهائي؟`,
                async () => {
                    const { error } = await supabase.from('competitions').delete().in('id', selectedCompetitionIds);
                    if (error) {
                        showToast('فشل حذف المسابقات المحددة.', 'error');
                    } else {
                        showToast('تم حذف المسابقات المحددة بنجاح.', 'success');
                        await refreshCompetitionsList(true); // Pass true to refetch from DB
                    }
                }, {
                    title: 'تأكيد الحذف',
                    confirmText: 'حذف',
                    confirmClass: 'btn-danger'
                }
            );
        }

        // New: Handle competition status toggle
        const statusToggle = e.target.closest('.competition-status-toggle');
        if (statusToggle) {
            const id = parseInt(statusToggle.dataset.id, 10);
            const isActive = statusToggle.checked;

            // 1. Update Supabase
            const { error } = await supabase
                .from('competitions')
                .update({ is_active: isActive })
                .eq('id', id);

            if (error) {
                showToast('فشل تحديث حالة المسابقة.', 'error');
                console.error('Competition status update error:', error);
                statusToggle.checked = !isActive; // Revert UI on error
            } else {
                showToast(`تم تحديث حالة المسابقة إلى "${isActive ? 'نشطة' : 'غير نشطة'}".`, 'success');
                // 2. Update local cache
                const competitionInCache = allCompetitionsData.find(c => c.id === id);
                if (competitionInCache) {
                    competitionInCache.is_active = isActive;
                }
                // 3. Re-apply filters to reflect the change instantly
                setupCompetitionFilters(allCompetitionsData);
            }
        }
    });

    // Caching: If we already have the data, don't fetch it again.
    if (allCompetitionsData.length > 0) {
        displayCompetitionsPage(allCompetitionsData, 1);
        setupCompetitionFilters(allCompetitionsData);
    } else {
        const { data: competitions, error } = await supabase
            .from('competitions')
            .select('*, agents(id, name, classification, avatar_url)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching competitions:", error);
            container.innerHTML = `<p class="error">حدث خطأ أثناء جلب المسابقات.</p>`;
            return;
        }
        allCompetitionsData = competitions;
        displayCompetitionsPage(allCompetitionsData, 1);
        setupCompetitionFilters(allCompetitionsData);
    }
}

function displayCompetitionsPage(competitionsList, page) {
    const container = document.getElementById('competitions-list-container');
    if (!container) return;

    page = parseInt(page);
    const totalPages = Math.ceil(competitionsList.length / COMPETITIONS_PER_PAGE);
    const startIndex = (page - 1) * COMPETITIONS_PER_PAGE;
    const endIndex = startIndex + COMPETITIONS_PER_PAGE;
    const paginatedCompetitions = competitionsList.slice(startIndex, endIndex);

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
    if (competitionsList.length > 0) {
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
        if (allCompetitionsData.length === 0) {
            finalHtml = '<p class="no-results-message">لا توجد مسابقات حالياً. يمكنك إنشاء واحدة من صفحة الوكيل.</p>';
        } else {
            finalHtml = '<p class="no-results-message">لا توجد نتائج تطابق بحثك أو الفلتر الحالي.</p>';
        }
    }
    container.innerHTML = finalHtml;

    // Attach event listeners for checkboxes and pagination
    attachCompetitionListListeners(competitionsList, paginatedCompetitions);
}

function generateCompetitionGridHtml(competitions) {
    if (competitions.length === 0) return ''; // Let displayCompetitionsPage handle the empty message
    return competitions.map(comp => {
        const isSelected = selectedCompetitionIds.includes(comp.id);
        const agent = comp.agents;
        const agentInfoHtml = agent
            ? `<a href="#profile/${agent.id}" class="table-agent-cell">
                    ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Agent Avatar" class="avatar-small" loading="lazy">` : `<div class="avatar-placeholder-small"><i class="fas fa-user"></i></div>`}
                    <div class="agent-details">
                        <span>${agent.name}</span>
                        ${agent.classification ? `<span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>` : ''}
                    </div>
               </a>`
            : `<div class="competition-card-agent-info"><span>(وكيل محذوف أو غير مرتبط)</span></div>`;

        return `
        <div class="competition-card ${isSelected ? 'selected' : ''}" data-id="${comp.id}">
            <label class="custom-checkbox row-checkbox">
                <input type="checkbox" class="competition-select-checkbox" data-id="${comp.id}" ${isSelected ? 'checked' : ''}>
                <span class="checkmark"></span>
            </label>
            <div class="competition-card-name">
                <h3>${comp.name}</h3>
            </div>
            <div class="competition-card-status">
                <label class="custom-checkbox toggle-switch small-toggle" title="${comp.is_active ? 'تعطيل' : 'تفعيل'}">
                    <input type="checkbox" class="competition-status-toggle" data-id="${comp.id}" ${comp.is_active ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>
            ${agentInfoHtml}
            <div class="competition-card-footer">
                <button class="btn-secondary edit-btn" title="تعديل" onclick="window.location.hash='#competitions/edit/${comp.id}'"><i class="fas fa-edit"></i></button>
                <button class="btn-danger delete-competition-btn" title="حذف" data-id="${comp.id}"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
        `;
    }).join('');
}

function setupCompetitionFilters(allCompetitions) {
    const searchInput = document.getElementById('competition-search-input');
    const clearBtn = document.getElementById('competition-search-clear');
    const filterButtons = document.querySelectorAll('.agent-filters .filter-btn');
    const sortSelect = document.getElementById('competition-sort-select'); // New

    const applyFilters = () => {
        if (!searchInput) return;
        if (clearBtn) {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        }
        
        const searchTerm = searchInput.value.toLowerCase().trim();
        const statusFilter = document.querySelector('.filter-buttons[data-filter-group="status"] .filter-btn.active').dataset.filter;
        const classificationFilter = document.querySelector('.filter-buttons[data-filter-group="classification"] .filter-btn.active').dataset.filter;
        const sortValue = sortSelect.value; // New

        let filteredCompetitions = allCompetitions.filter(comp => {
            const name = comp.name.toLowerCase();
            const agentName = comp.agents ? comp.agents.name.toLowerCase() : '';
            const status = comp.is_active ? 'active' : 'inactive';
            const classification = comp.agents?.classification;

            const matchesSearch = searchTerm === '' || name.includes(searchTerm) || agentName.includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || status === statusFilter;
            const matchesClassification = classificationFilter === 'all' || classification === classificationFilter;
            return matchesSearch && matchesStatus && matchesClassification;
        });
        
        // New Sorting Logic
        filteredCompetitions.sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            const agentNameA = a.agents?.name.toLowerCase() || '';
            const agentNameB = b.agents?.name.toLowerCase() || '';

            switch (sortValue) {
                case 'name_asc':
                    return nameA.localeCompare(nameB);
                case 'agent_asc':
                    return agentNameA.localeCompare(agentNameB);
                case 'newest':
                default:
                    return new Date(b.created_at) - new Date(a.created_at);
            }
        });

        displayCompetitionsPage(filteredCompetitions, 1);
    };

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            applyFilters();
            searchInput.focus();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', applyFilters);
    }

    document.querySelectorAll('.filter-buttons').forEach(group => {
        group.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                group.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                applyFilters();
            }
        });
    });
}

// New helper functions for bulk actions
function attachCompetitionListListeners(fullList, paginatedList) {
    const container = document.getElementById('competitions-list-container');
    if (!container) return;

    // Pagination
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newPage = e.currentTarget.dataset.page;
            if (newPage) displayCompetitionsPage(fullList, newPage);
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
            // Re-render the current page to update checkbox states
            displayCompetitionsPage(fullList, document.querySelector('.pagination-container .page-btn.active')?.dataset.page || 1);
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

async function refreshCompetitionsList(forceRefetch = false) {
    if (forceRefetch) {
        allCompetitionsData = []; // Clear cache to force refetch
    }
    selectedCompetitionIds = []; // Clear selection
    updateBulkActionBar(0);
    await renderAllCompetitionsListPage();
}

async function renderCompetitionCreatePage(agentId) {
    const appContent = document.getElementById('app-content');

    if (!agentId) { // If no agent is selected, do not render the form.
        appContent.innerHTML = `<p class="error">تم إلغاء هذه الصفحة. لا يمكن إنشاء مسابقة بدون تحديد وكيل أولاً.</p>`;
        return;
    }

    // Fetch agent and template data
    const agentResult = await supabase.from('agents').select('*').eq('id', agentId).single();
    const agent = agentResult.data;
    if (!agent) {
        appContent.innerHTML = `<p class="error">لم يتم العثور على الوكيل.</p>`;
        return;
    }

    const agentClassification = agent.classification || 'R'; // Default to R if not set
    const { data: templates, error: templatesError } = await supabase
        .from('competition_templates')
        .select('*');

    if (templatesError) {
        appContent.innerHTML = `<p class="error">حدث خطأ أثناء جلب قوالب المسابقات.</p>`;
        return;
    }
    
    // New V2 Layout
    appContent.innerHTML = `
        <div class="page-header"><h1><i class="fas fa-magic"></i> إنشاء وإرسال مسابقة</h1></div>
        <p class="page-subtitle">للعميل: <strong>${agent.name}</strong>. قم بتعديل تفاصيل المسابقة أدناه وسيتم تحديث الكليشة تلقائياً.</p>
        
        <div class="create-competition-layout-v3">
            <!-- Agent Info Column -->
            <div class="agent-info-v3 card-style-container">
                <h3><i class="fas fa-user-circle"></i> بيانات الوكيل</h3>
                <div class="agent-info-grid">
                    <div class="action-info-card"><i class="fas fa-star"></i><div class="info"><label>المرتبة</label><p>${agent.rank || 'غير محدد'}</p></div></div>
                    <div class="action-info-card"><i class="fas fa-tag"></i><div class="info"><label>التصنيف</label><p>${agent.classification}</p></div></div>
                    <div class="action-info-card"><i class="fas fa-wallet"></i><div class="info"><label>الرصيد المتبقي</label><p>$${agent.remaining_balance || 0}</p></div></div>
                    <div class="action-info-card"><i class="fas fa-gift"></i><div class="info"><label>بونص إيداع متبقي</label><p>${agent.remaining_deposit_bonus || 0} مرات</p></div></div>
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
                        ${templates.map(t => `<option value="${t.id}">${t.question}</option>`).join('')}
                    </select>
                    <div id="template-usage-info" class="form-hint" style="display: none;">
                        <!-- Usage info will be displayed here -->
                    </div>
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
                        <input type="number" id="override-deposit-winners" value="0">
                    </div>
                    <div class="form-group">
                        <label for="override-duration">مدة المسابقة</label>
                        <input type="text" id="override-duration" value="${agent.competition_duration || 'غير محدد'}">
                    </div>
                </div>
            </div>

            <!-- Preview Column -->
            <div class="preview-v3 card-style-container">
                <form id="competition-form">
                    <h3><i class="fab fa-telegram-plane"></i> 2. معاينة وإرسال</h3>
                    <div class="telegram-preview-wrapper">
                        <div class="telegram-preview-header">
                            <div class="header-left">
                                <i class="fab fa-telegram"></i>
                                <span>معاينة الرسالة</span>
                            </div>
                        </div>
                        <div class="telegram-preview-body">
                            <textarea id="competition-description" rows="15" required readonly></textarea>
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

    function numberToArPlural(num) {
        const words = {
            3: 'ثلاث', 4: 'أربع', 5: 'خمس', 6: 'ست', 7: 'سبع', 8: 'ثماني', 9: 'تسع', 10: 'عشر'
        };
        return words[num] || num.toString();
    }

    function updateDescriptionAndPreview() {
        console.log('[Debug] updateDescriptionAndPreview called.');
        const selectedId = templateSelect.value;
        const selectedTemplate = templates.find(t => t.id == selectedId);

        if (!selectedTemplate) {
            console.log('[Debug] No template selected or found.');
            descInput.value = ''; // Clear preview if no template is selected
            return;
        }

        console.log('[Debug] Selected Template:', selectedTemplate);

        // NEW: Show usage limit info
        if (selectedTemplate.usage_limit !== null) {
            const remaining = Math.max(0, selectedTemplate.usage_limit - (selectedTemplate.usage_count || 0));
            console.log(`[Debug] Usage Limit: ${selectedTemplate.usage_limit}, Usage Count: ${selectedTemplate.usage_count}, Remaining: ${remaining}`);
            const message = `مرات الاستخدام المتبقية لهذا القالب: ${remaining}`;
            if (remaining <= 3) {
                console.log('[Debug] Remaining uses <= 3, adding warning class.');
                showToast(message, 'warning');
            } else {
                showToast(message, 'info');
            }
        }

        const originalTemplateContent = selectedTemplate.content;
        const selectedTemplateQuestion = selectedTemplate.question;

        const tradingWinners = parseInt(tradingWinnersInput.value) || 0;
        const depositWinners = parseInt(depositWinnersInput.value) || 0;
        const prize = parseFloat(prizeInput.value || 0).toFixed(2);
        const duration = durationInput.value;
        const depositBonusPerc = agent.deposit_bonus_percentage || 0;
        
        // Create a formatted prize string
        let prizeDetailsText = '';
        if (tradingWinners === 1) {
            prizeDetailsText = `${prize}$ لفائز واحد فقط.`;
        } else if (tradingWinners === 2) {
            prizeDetailsText = `${prize}$ لفائزين اثنين فقط.`;
        } else if (tradingWinners >= 3 && tradingWinners <= 10) {
            const numberInArabic = numberToArPlural(tradingWinners);
            prizeDetailsText = `${prize}$ لـ ${numberInArabic} فائزين فقط.`;
        } else if (tradingWinners > 10) {
            prizeDetailsText = `${prize}$ لـ ${tradingWinners} فائزاً فقط.`;
        }

        // Create deposit bonus prize string
        let depositBonusPrizeText = '';
        if (depositWinners > 0 && depositBonusPerc > 0) {
            if (depositWinners === 1) {
                depositBonusPrizeText = `${depositBonusPerc}% لفائز واحد.`;
            } else if (depositWinners === 2) {
                depositBonusPrizeText = `${depositBonusPerc}% لفائزين اثنين.`;
            } else if (depositWinners >= 3 && depositWinners <= 10) {
                depositBonusPrizeText = `${depositBonusPerc}% لـ ${numberToArPlural(depositWinners)} فائزين.`;
            } else if (depositWinners > 10) {
                depositBonusPrizeText = `${depositBonusPerc}% لـ ${depositWinners} فائزاً.`;
            }
        }

        let content = originalTemplateContent;
        content = content.replace(/{{agent_name}}/g, agent.name || '');
        
        if (prizeDetailsText) {
            content = content.replace(/{{prize_details}}/g, prizeDetailsText);
        } else {
            content = content.replace(/^.*{{prize_details}}.*\n?/gm, '');
        }

        if (depositBonusPrizeText) {
            content = content.replace(/{{deposit_bonus_prize_details}}/g, depositBonusPrizeText);
        } else {
            content = content.replace(/^.*{{deposit_bonus_prize_details}}.*\n?/gm, '');
        }

        if (duration && duration.trim() !== '' && duration.trim() !== 'غير محدد') {
            content = content.replace(/{{competition_duration}}/g, duration);
        } else {
            content = content.replace(/^.*{{competition_duration}}.*\n?/gm, '');
        }

        content = content.replace(/{{question}}/g, selectedTemplateQuestion || '');
        content = content.replace(/{{remaining_deposit_bonus}}/g, agent.remaining_deposit_bonus || 0);
        content = content.replace(/{{deposit_bonus_percentage}}/g, agent.deposit_bonus_percentage || 0);
        content = content.replace(/{{winners_count}}/g, tradingWinners);
        content = content.replace(/{{prize_per_winner}}/g, prize);
        
        descInput.value = content;
    }

    [templateSelect, tradingWinnersInput, prizeInput, depositWinnersInput, durationInput].forEach(input => {
        input.addEventListener('change', updateDescriptionAndPreview);
    });

    document.getElementById('cancel-competition-form').addEventListener('click', () => {
        window.location.hash = `profile/${agent.id}`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sendBtn = e.target.querySelector('.btn-send-telegram');
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

        const selectedTemplateId = templateSelect.value;
        const selectedTemplate = templates.find(t => t.id == selectedTemplateId);
        if (!selectedTemplate) {
            showToast('يرجى اختيار قالب مسابقة صالح.', 'error');
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال إلى تلجرام الآن';
            return;
        }

        const finalDescription = descInput.value;
        const winnersCount = parseInt(tradingWinnersInput.value) || 0;
        const prizePerWinner = parseFloat(prizeInput.value) || 0;
        const depositWinnersCount = parseInt(depositWinnersInput.value) || 0;
        const totalCost = winnersCount * prizePerWinner;

        if (totalCost > agent.remaining_balance) {
            showToast(`رصيد الوكيل المتبقي (${agent.remaining_balance}$) غير كافٍ لتغطية تكلفة المسابقة (${totalCost.toFixed(2)}$).`, 'error');
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال إلى تلجرام الآن';
            return;
        }

        try {
            // 1. Save the competition
            const { data: newCompetition, error: competitionError } = await supabase
                .from('competitions')
                .insert({
                    name: selectedTemplate.question,
                    description: finalDescription,
                    is_active: true,
                    agent_id: agent.id,
                    total_cost: totalCost,
                    deposit_winners_count: depositWinnersCount
                })
                .select()
                .single();

            if (competitionError) throw new Error(`فشل حفظ المسابقة: ${competitionError.message}`);

            // 2. Deduct balance
            // NEW: Increment template usage count
            if (selectedTemplate.id) {
                const { error: incrementError } = await supabase.rpc('increment_usage_count', {
                    template_id: selectedTemplate.id
                });
                if (incrementError) {
                    // This is not a critical error, so we just log it and continue
                    console.warn('Could not increment template usage count:', incrementError.message);
                }
            }

            // 2. Deduct balance
            const newConsumed = (agent.consumed_balance || 0) + totalCost;
            const newRemaining = (agent.competition_bonus || 0) - newConsumed;
            const newUsedDepositBonus = (agent.used_deposit_bonus || 0) + depositWinnersCount;
            const newRemainingDepositBonus = (agent.deposit_bonus_count || 0) - newUsedDepositBonus;

            const { error: agentError } = await supabase
                .from('agents')
                .update({ consumed_balance: newConsumed, remaining_balance: newRemaining, used_deposit_bonus: newUsedDepositBonus, remaining_deposit_bonus: newRemainingDepositBonus })
                .eq('id', agent.id);
            
            if (agentError) throw new Error(`فشل تحديث رصيد الوكيل: ${agentError.message}`);

            // 3. Send to Telegram
            const telegramResponse = await fetch('/api/post-announcement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: finalDescription })
            });

            if (!telegramResponse.ok) {
                const result = await telegramResponse.json();
                throw new Error(`فشل الإرسال إلى تلجرام: ${result.message}`);
            }

            // 4. Log activity
            await logAgentActivity(agent.id, 'COMPETITION_CREATED', `تم إنشاء وإرسال مسابقة "${selectedTemplate.question}" بتكلفة ${totalCost.toFixed(2)}$ و ${depositWinnersCount} بونص إيداع.`);
            
            // 5. Success
            showToast('تم حفظ المسابقة وإرسالها وخصم الرصيد بنجاح.', 'success');
            window.location.hash = `profile/${agent.id}`;

        } catch (error) {
            showToast(error.message, 'error');
            console.error('Competition creation failed:', error);
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال إلى تلجرام الآن';
        }
    });
}

// --- 3. Edit Existing Competition Form ---

async function renderCompetitionEditForm(compId) {
    const appContent = document.getElementById('app-content');
    const { data: competition, error } = await supabase.from('competitions').select('*, agents(*)').eq('id', compId).single();
    
    if (error || !competition) {
        showToast('لم يتم العثور على المسابقة.', 'error');
        window.location.hash = 'competitions';
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

        const { error } = await supabase.from('competitions').update(formData).eq('id', compId);

        if (error) {
            showToast('فشل حفظ التعديلات.', 'error');
        } else {
            showToast('تم حفظ التعديلات بنجاح.', 'success');
            if (competition.agent_id) {
                window.location.hash = `profile/${competition.agent_id}`;
            } else {
                window.location.hash = 'competitions';
            }
        }
    });
}

// --- 4. Competition Templates Page ---

async function renderCompetitionTemplatesPage() {
    const appContent = document.getElementById('app-content');
    document.querySelector('main').classList.add('full-width');

    const defaultTemplateContent = `مسابقة جديدة من شركة إنزو للتداول 🏆

✨ هل تملك عينًا خبيرة في قراءة الشارتات؟ اختبر نفسك واربح!

💰 الجائزة: {{prize_details}}
🎁 أو جائزة بونص إيداع: {{deposit_bonus_prize_details}}

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

    showFormBtn.addEventListener('click', () => {
        renderCreateTemplateModal(defaultTemplateContent, loadTemplates);
    });

    async function loadTemplates() {
        const { data: templates, error } = await supabase
            .rpc('get_active_templates');

        if (error) {
            console.error('Error fetching templates:', error);
            templatesListDiv.innerHTML = '<p class="error">فشل تحميل القوالب.</p>';
            return;
        }

        // Sort templates by classification R, A, B, C, then All
        const classificationOrder = { 'R': 1, 'A': 2, 'B': 3, 'C': 4, 'All': 5 };
        templates.sort((a, b) => {
            const orderA = classificationOrder[a.classification] || 99;
            const orderB = classificationOrder[b.classification] || 99;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            // Secondary sort by question name alphabetically
            return a.question.localeCompare(b.question);
        });

        if (templates.length === 0) {
            templatesListDiv.innerHTML = '<p class="no-results-message">لا توجد قوالب محفوظة بعد.</p>';
        } else {
            const groupedTemplates = templates.reduce((acc, template) => {
                const key = template.classification || 'All';
                if (!acc[key]) acc[key] = [];
                acc[key].push(template);
                return acc;
            }, {});

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
                                    <div class="template-card" data-id="${template.id}" data-question="${template.question.toLowerCase()}" data-classification="${template.classification || 'All'}">
                                        <div class="template-card-header">
                                            <h4>${template.question}</h4>
                                        </div>
                                        <div class="template-card-body">
                                            <p>${template.content.substring(0, 120)}...</p>
                                        </div>
                                        <div class="template-card-footer">
                                            <button class="btn-secondary edit-template-btn" data-id="${template.id}"><i class="fas fa-edit"></i> تعديل</button>
                                            <button class="btn-danger delete-template-btn" data-id="${template.id}"><i class="fas fa-trash-alt"></i> حذف</button>
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
            const id = editBtn.dataset.id;
            const { data: template, error } = await supabase
                .from('competition_templates')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error || !template) {
                showToast('فشل العثور على القالب.', 'error');
                return;
            }
            
            renderEditTemplateModal(template, loadTemplates);
        }

        const deleteBtn = e.target.closest('.delete-template-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            showConfirmationModal(
                'هل أنت متأكد من حذف هذا القالب؟<br><small>لا يمكن التراجع عن هذا الإجراء.</small>',
                async () => {
                    const { error } = await supabase.from('competition_templates').delete().eq('id', id);
                    if (error) {
                        showToast('فشل حذف القالب.', 'error');
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
    
    const modal = document.createElement('div');
    // I need to add a function to create the modal for archived templates
    // Let's add the archive page first.
    // The user wants a new page for the archive.

    modal.className = 'form-modal-content modal-wide'; // Use existing style from components.css
    
    modal.innerHTML = `
        <div class="form-modal-header">
            <h2><i class="fas fa-plus-circle"></i> إنشاء قالب مسابقة جديد</h2>
            <button id="close-modal-btn" class="btn-secondary" style="min-width: 40px; padding: 5px 10px;">&times;</button>
        </div>
        <div class="form-modal-body">
            <form id="create-template-form" class="form-layout">
                <div class="form-group">
                    <label for="create-template-question">السؤال (سيكون اسم المسابقة)</label>
                    <input type="text" id="create-template-question" required>
                </div>
                <div class="form-group">
                    <label for="create-template-classification">التصنيف (لمن سيظهر هذا القالب)</label>
                    <select id="create-template-classification" required>
                        <option value="All" selected>الكل (يظهر لجميع التصنيفات)</option>
                        <option value="R">R</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="create-template-content">محتوى المسابقة (الوصف)</label>
                    <textarea id="create-template-content" rows="10" required>${defaultContent}</textarea>
                </div>
                <div class="form-group">
                    <label for="create-template-usage-limit">عدد مرات الاستخدام (اتركه فارغاً للاستخدام غير المحدود)</label>
                    <input type="number" id="create-template-usage-limit" min="1" placeholder="مثال: 5">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary"><i class="fas fa-save"></i> حفظ القالب</button>
                    <button type="button" id="cancel-create-modal" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-create-modal').addEventListener('click', closeModal);
    
    document.getElementById('create-template-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            question: document.getElementById('create-template-question').value.trim(),
            classification: document.getElementById('create-template-classification').value,
            content: document.getElementById('create-template-content').value.trim(),
            usage_limit: document.getElementById('create-template-usage-limit').value ? parseInt(document.getElementById('create-template-usage-limit').value, 10) : null,
        };

        const { error } = await supabase.from('competition_templates').insert(formData);
        if (error) {
            showToast('فشل حفظ القالب.', 'error');
        } else {
            showToast('تم حفظ القالب بنجاح.', 'success');
            closeModal();
            if (onSaveCallback) onSaveCallback();
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

        const allGroups = document.querySelectorAll('.template-group');
        let hasResults = false;

        allGroups.forEach(group => {
            const cards = group.querySelectorAll('.template-card');
            let visibleCardsInGroup = 0;

            cards.forEach(card => {
                const question = card.dataset.question;
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
        if (templatesToDisplay.length === 0) {
            listDiv.innerHTML = '<p class="no-results-message">لا توجد قوالب في الأرشيف تطابق بحثك.</p>';
        } else {
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
                            <tr data-question="${template.question.toLowerCase()}" data-classification="${template.classification || 'All'}">
                                <td data-label="اسم القالب">${template.question}</td>
                                <td data-label="التصنيف"><span class="classification-badge classification-${(template.classification || 'all').toLowerCase()}">${template.classification || 'الكل'}</span></td>
                                <td data-label="مرات الاستخدام">${template.usage_count} / ${template.usage_limit}</td>
                                <td class="actions-cell">
                                    <button class="btn-primary reactivate-template-btn btn-small" data-id="${template.id}"><i class="fas fa-undo"></i> إعادة تفعيل</button>
                                    <button class="btn-danger delete-template-btn btn-small" data-id="${template.id}"><i class="fas fa-trash-alt"></i> حذف نهائي</button>
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
                const matchesSearch = searchTerm === '' || template.question.toLowerCase().includes(searchTerm);
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
        const { data, error } = await supabase.rpc('get_archived_templates');

        if (error) {
            listDiv.innerHTML = `<p class="error">فشل تحميل الأرشيف.</p>`;
            console.error('Archive fetch error:', error);
            return;
        }
        allArchivedTemplates = data;
        displayArchived(allArchivedTemplates);
        setupArchiveFilters();
    }

    listDiv.addEventListener('click', async (e) => {
        const reactivateBtn = e.target.closest('.reactivate-template-btn');
        const deleteBtn = e.target.closest('.delete-template-btn');

        if (reactivateBtn) {
            const id = reactivateBtn.dataset.id;
            showConfirmationModal('هل أنت متأكد من إعادة تفعيل هذا القالب؟<br><small>سيتم إعادة تعيين عداد استخدامه إلى الصفر.</small>', async () => {
                const { error } = await supabase.from('competition_templates').update({ usage_count: 0 }).eq('id', id);
                if (error) {
                    showToast('فشل إعادة تفعيل القالب.', 'error');
                } else {
                    showToast('تم إعادة تفعيل القالب بنجاح.', 'success');
                    await loadAndDisplayArchived();
                }
            }, { title: 'تأكيد إعادة التفعيل' });
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            showConfirmationModal('هل أنت متأكد من الحذف النهائي لهذا القالب؟<br><small>هذا الإجراء لا يمكن التراجع عنه.</small>', async () => {
                const { error } = await supabase.from('competition_templates').delete().eq('id', id);
                if (error) {
                    showToast('فشل حذف القالب.', 'error');
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
    
    const modal = document.createElement('div');
    modal.className = 'form-modal-content modal-wide'; // Use existing style from components.css

    modal.innerHTML = `
        <div class="form-modal-header">
            <h2>تعديل قالب مسابقة</h2>
            <button id="close-modal-btn" class="btn-secondary" style="min-width: 40px; padding: 5px 10px;">&times;</button>
        </div>
        <div class="form-modal-body">
            <form id="edit-template-form" class="form-layout">
                <div class="form-group">
                    <label for="edit-template-question">السؤال</label>
                    <input type="text" id="edit-template-question" value="${template.question}" required>
                </div>
                <div class="form-group">
                    <label for="edit-template-classification">التصنيف</label>
                    <select id="edit-template-classification" required>
                        <option value="All" ${template.classification === 'All' ? 'selected' : ''}>الكل</option>
                        <option value="R" ${template.classification === 'R' ? 'selected' : ''}>R</option>
                        <option value="A" ${template.classification === 'A' ? 'selected' : ''}>A</option>
                        <option value="B" ${template.classification === 'B' ? 'selected' : ''}>B</option>
                        <option value="C" ${template.classification === 'C' ? 'selected' : ''}>C</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="edit-template-content">محتوى المسابقة</label>
                    <textarea id="edit-template-content" rows="8" required>${template.content}</textarea>
                </div>
                <div class="form-group">
                    <label for="edit-template-usage-limit">عدد مرات الاستخدام (اتركه فارغاً للاستخدام غير المحدود)</label>
                    <input type="number" id="edit-template-usage-limit" min="1" placeholder="مثال: 5" value="${template.usage_limit || ''}">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary"><i class="fas fa-save"></i> حفظ التعديلات</button>
                    <button type="button" id="cancel-edit-modal" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-edit-modal').addEventListener('click', closeModal);
    
    document.getElementById('edit-template-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updatedData = {
            question: document.getElementById('edit-template-question').value.trim(),
            classification: document.getElementById('edit-template-classification').value,
            content: document.getElementById('edit-template-content').value.trim(),
            usage_limit: document.getElementById('edit-template-usage-limit').value ? parseInt(document.getElementById('edit-template-usage-limit').value, 10) : null,
        };

        const { error } = await supabase.from('competition_templates').update(updatedData).eq('id', template.id);
            
        if (error) {
            showToast('فشل حفظ التعديلات.', 'error');
        } else {
            showToast('تم حفظ التعديلات بنجاح.', 'success');
            closeModal();
            if (onSaveCallback) onSaveCallback();
        }
    });
}