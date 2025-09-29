let allAgentsData = [];
const AGENTS_PER_PAGE = 10;
const RANKS_DATA = {
    // الاعتيادية
    'Beginning': { competition_bonus: 60, deposit_bonus_percentage: null, deposit_bonus_count: null },
    'Growth': { competition_bonus: 100, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
    'Pro': { competition_bonus: 150, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
    'Elite': { competition_bonus: 200, deposit_bonus_percentage: 50, deposit_bonus_count: 4 },
    // الحصرية
    'Center': { competition_bonus: 650, deposit_bonus_percentage: 70, deposit_bonus_count: 4 },
    'Bronze': { competition_bonus: 150, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
    'Silver': { competition_bonus: 230, deposit_bonus_percentage: 40, deposit_bonus_count: 3 },
    'Gold': { competition_bonus: 300, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
    'Platinum': { competition_bonus: 500, deposit_bonus_percentage: 60, deposit_bonus_count: 4 },
    'Diamond': { competition_bonus: 800, deposit_bonus_percentage: 75, deposit_bonus_count: 4 },
    'Sapphire': { competition_bonus: 1100, deposit_bonus_percentage: 85, deposit_bonus_count: 4 },
    'Emerald': { competition_bonus: 2000, deposit_bonus_percentage: 90, deposit_bonus_count: 4 },
    'King': { competition_bonus: 2500, deposit_bonus_percentage: 95, deposit_bonus_count: 4 },
    'Legend': { competition_bonus: Infinity, deposit_bonus_percentage: 100, deposit_bonus_count: Infinity },
    'وكيل حصري بدون مرتبة': { competition_bonus: 60, deposit_bonus_percentage: null, deposit_bonus_count: null },
};

async function renderTasksPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>مهمات اليوم</h1>
                <div class="header-actions-group">
                    <button id="mark-all-tasks-complete-btn" class="btn-primary"><i class="fas fa-check-double"></i> تمييز الكل كمكتمل</button>
                </div>
            </div>
            <div class="agent-filters">
                <div class="filter-search-container">
                    <input type="search" id="task-search-input" placeholder="بحث بالاسم أو الرقم..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="task-search-clear"></i>
                </div>
            </div>
        </div>
        <div id="tasks-content-wrapper"></div>
    `;

    await renderTaskList();
    const markAllCompleteBtn = document.getElementById('mark-all-tasks-complete-btn');
    if (markAllCompleteBtn) {
        markAllCompleteBtn.addEventListener('click', handleMarkAllTasksComplete);
    }
}

async function renderTasksPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>مهمات اليوم</h1>
                <div class="header-actions-group">
                    <button id="mark-all-tasks-complete-btn" class="btn-primary"><i class="fas fa-check-double"></i> تمييز الكل كمكتمل</button>
                </div>
            </div>
            <div class="agent-filters">
                <div class="filter-search-container">
                    <input type="search" id="task-search-input" placeholder="بحث بالاسم أو الرقم..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="task-search-clear"></i>
                </div>
            </div>
        </div>
        <div id="tasks-content-wrapper"></div>
    `;

    await renderTaskList();
    const markAllCompleteBtn = document.getElementById('mark-all-tasks-complete-btn');
    if (markAllCompleteBtn) {
        markAllCompleteBtn.addEventListener('click', handleMarkAllTasksComplete);
    }
}

async function renderManageAgentsPage() {
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
    const canRenewAll = isAdmin || currentUserProfile?.permissions?.agents?.can_renew_all_balances;

    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>إدارة الوكلاء</h1>
                <div class="header-actions-group">
                    ${canRenewAll ? `<button id="renew-all-balances-btn" class="btn-primary"><i class="fas fa-sync-alt"></i> تجديد رصيد الوكلاء</button>` : ''}
                    <button id="bulk-send-balance-btn" class="btn-telegram-bonus"><i class="fas fa-bullhorn"></i> تعميم الأرصدة</button>
                    <button id="add-agent-btn" class="btn-primary"><i class="fas fa-plus"></i> إضافة وكيل جديد</button>
                </div>
            </div>
            <div class="agent-filters">
                <div class="filter-search-container">
                    <input type="search" id="agent-search-input" placeholder="بحث بالاسم أو الرقم..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="agent-search-clear"></i>
                </div>
                <div class="filter-buttons">
                    <button class="filter-btn active" data-filter="all">الكل</button>
                    <button class="filter-btn" data-filter="R">R</button>
                    <button class="filter-btn" data-filter="A">A</button>
                    <button class="filter-btn" data-filter="B">B</button>
                    <button class="filter-btn" data-filter="C">C</button>
                </div>
                <div class="sort-container">
                    <label for="agent-sort-select">ترتيب حسب:</label>
                    <select id="agent-sort-select">
                        <option value="newest">الأحدث أولاً</option>
                        <option value="name_asc">أبجدي (أ - ي)</option>
                    </select>
                </div>
            </div>
        </div>
        <div id="agent-table-container"></div>
    `;

    document.getElementById('add-agent-btn').addEventListener('click', () => {
        setActiveNav(null);
        window.location.hash = 'add-agent?returnTo=manage-agents';
    });

    // تعديل: إضافة معالج لزر تجديد رصيد الوكلاء
    const renewBtn = document.getElementById('renew-all-balances-btn');
    if (renewBtn) {
        renewBtn.addEventListener('click', () => {
            handleRenewAllBalances();
        });
    }

    // تعديل: إضافة معالج لزر الإرسال الجماعي
    document.getElementById('bulk-send-balance-btn').addEventListener('click', () => {
        handleBulkSendBalances(allAgentsData);
    });

    // Caching: If we already have the data, don't fetch it again.
    if (allAgentsData.length > 0) {
        displayAgentsPage(allAgentsData, 1);
        setupAgentFilters();
    } else {
        if (!supabase) {
            appContent.innerHTML = `<p class="error">لا يمكن عرض الوكلاء، لم يتم الاتصال بقاعدة البيانات.</p>`;
            return;
        }

        const { data, error } = await supabase
            .from('agents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching agents:", error);
            document.getElementById('agent-table-container').innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات الوكلاء.</p>`;
            return;
        }

        allAgentsData = data;
        displayAgentsPage(allAgentsData, 1);
        setupAgentFilters();
    }
}

function setupAgentFilters() {
    const searchInput = document.getElementById('agent-search-input');
    const clearBtn = document.getElementById('agent-search-clear');
    const filterButtons = document.querySelectorAll('.agent-filters .filter-btn');
    const sortSelect = document.getElementById('agent-sort-select');

    if (!searchInput) return;

    const applyFilters = () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeFilter = document.querySelector('.agent-filters .filter-btn.active').dataset.filter;
        const sortValue = sortSelect.value;

        let filteredAgents = allAgentsData.filter(agent => {
            const name = agent.name.toLowerCase();
            const agentIdStr = agent.agent_id;
            const classification = agent.classification;
            const matchesSearch = searchTerm === '' || name.includes(searchTerm) || agentIdStr.includes(searchTerm);
            const matchesFilter = activeFilter === 'all' || classification === activeFilter;
            return matchesSearch && matchesFilter;
        });

        // Sort the filtered results
        filteredAgents.sort((a, b) => {
            if (sortValue === 'name_asc') {
                // Alphabetical sort
                return a.name.localeCompare(b.name);
            } else {
                // Default to newest first
                return new Date(b.created_at) - new Date(a.created_at);
            }
        });


        displayAgentsPage(filteredAgents, 1);
    };

    searchInput.addEventListener('input', applyFilters);

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            applyFilters();
            searchInput.focus();
        });
    }

    if (filterButtons.length) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                applyFilters();
            });
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', applyFilters);
    }
}

function displayAgentsPage(agentsList, page) {
    const container = document.getElementById('agent-table-container');
    if (!container) return;

    page = parseInt(page);
    const totalPages = Math.ceil(agentsList.length / AGENTS_PER_PAGE);
    const startIndex = (page - 1) * AGENTS_PER_PAGE;
    const endIndex = startIndex + AGENTS_PER_PAGE;
    const paginatedAgents = agentsList.slice(startIndex, endIndex);
    const searchTerm = document.getElementById('agent-search-input')?.value.toLowerCase().trim() || '';
    
    const tableHtml = paginatedAgents.length > 0 ? `
        <table class="modern-table">
            <thead>
                <tr>
                    <th>الوكيل</th>
                    <th>رقم الوكالة</th>
                    <th>التصنيف</th>
                    <th>المرتبة</th>
                    <th>روابط التلجرام</th>
                    <th class="actions-column">الإجراءات</th>
                </tr>
            </thead>
            <tbody>
                ${paginatedAgents.map(agent => {
                    const avatarHtml = agent.avatar_url
                        ? `<img src="${agent.avatar_url}" alt="Avatar" class="avatar-small" loading="lazy">`
                        : `<div class="avatar-placeholder-small"><i class="fas fa-user"></i></div>`;
                    
                    return `
                        <tr data-agent-id="${agent.id}">
                            <td data-label="الوكيل">
                                <div class="table-agent-cell">
                                    ${avatarHtml}
                                    <div class="agent-details">
                                        <a href="#profile/${agent.id}" class="agent-name-link" onclick="event.stopPropagation()">${agent.name}</a>
                                    </div>
                                </div>
                            </td>
                            <td data-label="رقم الوكالة" class="agent-id-text" title="نسخ الرقم">${agent.agent_id}</td>
                            <td data-label="التصنيف"><span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span></td>
                            <td data-label="المرتبة">${agent.rank || 'غير محدد'}</td>
                            <td data-label="روابط التلجرام">
                                ${agent.telegram_channel_url ? `<a href="${agent.telegram_channel_url}" target="_blank" onclick="event.stopPropagation()">القناة</a>` : ''}
                                ${agent.telegram_channel_url && agent.telegram_group_url ? ' | ' : ''}
                                ${agent.telegram_group_url ? `<a href="${agent.telegram_group_url}" target="_blank" onclick="event.stopPropagation()">الجروب</a>` : ''}
                            </td>
                            <td class="actions-cell">
                                <button class="btn-secondary edit-btn btn-small"><i class="fas fa-edit"></i> تعديل</button>
                                <button class="btn-danger delete-btn btn-small"><i class="fas fa-trash-alt"></i> حذف</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    ` : '<p class="no-results-message">لا توجد نتائج تطابق بحثك.</p>';

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

    container.innerHTML = `<div class="table-responsive-container">${tableHtml}</div>${paginationHtml}`;

    attachCardEventListeners(agentsList, page);
}

async function handleRenewAllBalances() {
    showConfirmationModal(
        `هل أنت متأكد من تجديد رصيد جميع الوكلاء؟`,
        async () => {
            // 1. جلب جميع الوكلاء من ذاكرة التخزين المؤقت
            const agentsToRenew = allAgentsData;
            const agentCount = agentsToRenew.length;

            if (agentCount === 0) {
                showToast('لا يوجد وكلاء لتجديد أرصدتهم.', 'info');
                return;
            }

            // 2. إظهار نافذة التقدم
            showBulkSendProgressModal(agentCount);
            const progressBar = document.getElementById('bulk-send-progress-bar-inner');
            const statusText = document.getElementById('bulk-send-status-text');
            let successCount = 0;
            let errorCount = 0;

            // 3. المرور على كل وكيل وتحديثه
            for (let i = 0; i < agentCount; i++) {
                const agent = agentsToRenew[i];
                const updateData = {
                    consumed_balance: 0,
                    remaining_balance: agent.competition_bonus,
                    used_deposit_bonus: 0,
                    remaining_deposit_bonus: agent.deposit_bonus_count,
                    last_renewal_date: new Date().toISOString()
                };

                try {
                    const { error } = await supabase.from('agents').update(updateData).eq('id', agent.id);
                    if (error) throw error;
                    successCount++;
                } catch (e) {
                    console.error(`Failed to renew balance for agent ${agent.name}:`, e);
                    errorCount++;
                }

                // تحديث واجهة التقدم
                const progress = Math.round(((i + 1) / agentCount) * 100);
                progressBar.style.width = `${progress}%`;
                statusText.innerHTML = `جاري تجديد الأرصدة... (${i + 1} / ${agentCount})<br>نجح: ${successCount} | فشل: ${errorCount}`;
                
                // إضافة تأخير بسيط بين الطلبات لتجنب الضغط على الخادم
                if (i < agentCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
                }
            }

            // 4. تحديث الواجهة بعد الانتهاء
            statusText.innerHTML = `اكتمل تجديد الأرصدة.<br><strong>${successCount}</strong> وكيل بنجاح | <strong>${errorCount}</strong> فشل.`;
            progressBar.style.backgroundColor = errorCount > 0 ? 'var(--danger-color)' : 'var(--success-color)';
            document.querySelector('.modal-no-actions .update-icon').className = 'fas fa-check-circle update-icon';
            await logAgentActivity(null, 'BULK_RENEWAL', `تم تجديد رصيد ${successCount} وكيل (فشل ${errorCount}).`);

            // 5. إعادة تحميل بيانات الوكلاء من قاعدة البيانات لعرضها محدثة
            const { data, error } = await supabase.from('agents').select('*').order('created_at', { ascending: false });
            if (!error) {
                allAgentsData = data;
                displayAgentsPage(allAgentsData, 1);
            }

            // --- تعديل: إخفاء نافذة التقدم تلقائياً بعد 3 ثوانٍ ---
            setTimeout(() => {
                // ابحث عن النافذة المنبثقة النشطة وقم بإزالتها
                const modalOverlay = document.querySelector('.modal-overlay');
                if (modalOverlay) {
                    modalOverlay.remove();
                }
            }, 3000); // إصلاح: إضافة المدة الزمنية والقوس الختامي
        }, { title: 'تأكيد تجديد الأرصدة', confirmText: 'تجديد الآن', confirmClass: 'btn-primary' }
    );
}

function attachCardEventListeners(currentList, currentPage) {
    const container = document.getElementById('agent-table-container');
    if (!container) return;

    container.querySelectorAll('tbody tr').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.closest('.actions-cell, a')) return; // Do not navigate if clicking on actions or a link
            window.location.hash = `profile/${row.dataset.agentId}`;
        });
    });

    // Click to copy agent ID
    container.querySelectorAll('.agent-id-text').forEach(idEl => {
        idEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const agentIdToCopy = idEl.textContent;
            navigator.clipboard.writeText(agentIdToCopy).then(() => showToast(`تم نسخ الرقم: ${agentIdToCopy}`, 'info'));
        });
    });

    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.currentTarget.closest('tr');
            window.location.hash = `profile/${card.dataset.agentId}/edit`;
        });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.currentTarget.closest('tr');
            const agentId = card.dataset.agentId;
            const agentName = card.querySelector('.agent-name-link').textContent;

            showConfirmationModal(
                `هل أنت متأكد من حذف الوكيل "<strong>${agentName}</strong>"؟<br><small>سيتم حذف جميع بياناته المرتبطة بشكل دائم.</small>`,
                async () => {
                    await logAgentActivity(agentId, 'AGENT_DELETED', `تم حذف الوكيل: ${agentName} (ID: ${agentId}).`);
                    const { error } = await supabase.from('agents').delete().eq('id', agentId);

                    if (error) {
                        console.error('Error deleting agent:', JSON.stringify(error, null, 2));
                        showToast('فشل حذف الوكيل.', 'error');
                    } else {
                        showToast('تم حذف الوكيل بنجاح.', 'success');
                        allAgentsData = allAgentsData.filter(agent => agent.id !== parseInt(agentId));
                        
                        // Re-apply filters and render the correct page
                        const searchTerm = document.getElementById('agent-search-input').value.toLowerCase().trim();
                        const activeFilter = document.querySelector('.agent-filters .filter-btn.active').dataset.filter;
                        const filteredAgents = allAgentsData.filter(agent => {
                            const name = agent.name.toLowerCase();
                            const agentIdStr = agent.agent_id;
                            const classification = agent.classification;
                            const matchesSearch = searchTerm === '' || name.includes(searchTerm) || agentIdStr.includes(searchTerm);
                            const matchesFilter = activeFilter === 'all' || classification === activeFilter;
                            return matchesSearch && matchesFilter;
                        });

                        let pageToDisplay = currentPage;
                        const newTotalPages = Math.ceil(filteredAgents.length / AGENTS_PER_PAGE);
                        if (pageToDisplay > newTotalPages) {
                            pageToDisplay = newTotalPages || 1;
                        }
                        displayAgentsPage(filteredAgents, pageToDisplay);
                    }
                }, {
                    title: 'تأكيد حذف الوكيل',
                    confirmText: 'حذف نهائي',
                    confirmClass: 'btn-danger'
                });
        });
    });

    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newPage = e.currentTarget.dataset.page;
            if (newPage) displayAgentsPage(currentList, newPage);
        });
    });
}

async function updateOverallProgress() {
    const overviewContainer = document.getElementById('tasks-overview');
    if (!overviewContainer) return;

    const today = new Date().getDay();
    const todayStr = new Date().toISOString().split('T')[0];

    const [agentsResult, tasksResult] = await Promise.all([
        supabase.from('agents').select('id').contains('audit_days', [today]),
        supabase.from('daily_tasks').select('agent_id, audited, competition_sent').eq('task_date', todayStr)
    ]);

    const totalAgentsToday = agentsResult.data?.length || 0;
    const tasksMap = (tasksResult.data || []).reduce((acc, task) => {
        acc[task.agent_id] = task;
        return acc;
    }, {});

    const completedAgentsToday = (agentsResult.data || []).filter(agent => {
        const task = tasksMap[agent.id];
        return task && task.audited; // Progress is based on audit only
    }).length;

    const overallProgress = totalAgentsToday > 0 ? (completedAgentsToday / totalAgentsToday) * 100 : 0;

    const donutChart = overviewContainer.querySelector('.progress-donut-chart');
    const totalEl = overviewContainer.querySelector('[data-stat="total"]');
    const completedEl = overviewContainer.querySelector('[data-stat="completed"]');
    const pendingEl = overviewContainer.querySelector('[data-stat="pending"]');

    if (donutChart) donutChart.style.setProperty('--p', overallProgress);
    if (donutChart) donutChart.querySelector('span').textContent = `${Math.round(overallProgress)}%`;
    if (totalEl) totalEl.textContent = totalAgentsToday;
    if (completedEl) completedEl.textContent = completedAgentsToday;
    if (pendingEl) pendingEl.textContent = totalAgentsToday - completedAgentsToday;
}

function updateTaskGroupState(groupDetailsElement) {
    if (!groupDetailsElement) return;
    const progressSpan = groupDetailsElement.querySelector('.task-group-progress');
    const cards = groupDetailsElement.querySelectorAll('.task-card');
    const total = cards.length;
    let completed = 0;
    cards.forEach(card => {
        const auditCheck = card.querySelector('.audit-check');
        // Progress is based on audit only
        if (auditCheck?.checked) {
            completed++;
        }
    });
    progressSpan.textContent = `${completed} / ${total}`;

    // Check if the entire group is complete
    const allComplete = total > 0 && completed === total;
    groupDetailsElement.classList.toggle('all-complete', allComplete);
}

async function renderTaskList() {
    const wrapper = document.getElementById('tasks-content-wrapper');
    if (!wrapper) return;

    if (!supabase) {
        wrapper.innerHTML = `<p class="error">لا يمكن عرض المهام، لم يتم الاتصال بقاعدة البيانات.</p>`;
        return;
    }

    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const highlightedAgentId = urlParams.get('highlight');

    const today = new Date().getDay();
    const todayStr = new Date().toISOString().split('T')[0];

    const [agentsResult, tasksResult] = await Promise.all([
        supabase.from('agents').select('*').contains('audit_days', [today]).order('classification').order('name'),
        supabase.from('daily_tasks').select('*').eq('task_date', todayStr)
    ]);
    
    const { data: filteredAgents, error } = agentsResult;
    const { data: tasks, error: tasksError } = tasksResult;

    if (error) {
        console.error("Error fetching agents for tasks:", error);
        wrapper.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات المهام.</p>`;
        return;
    }
    if (tasksError) {
        console.error("Error fetching daily tasks:", tasksError);
    }

    const tasksMap = (tasks || []).reduce((acc, task) => {
        acc[task.agent_id] = task;
        return acc;
    }, {});

    const classifications = ['R', 'A', 'B', 'C'];
    const openGroups = JSON.parse(localStorage.getItem('openTaskGroups')) || ['R', 'A'];
    const groupedAgents = classifications.reduce((acc, classification) => {
        acc[classification] = filteredAgents.filter(a => a.classification === classification);
        return acc;
    }, {});

    // --- Create Overview Section ---
    const totalAgentsToday = filteredAgents.length;
    const completedAgentsToday = filteredAgents.filter(agent => {
        const task = tasksMap[agent.id] || {};
        return task.audited && task.competition_sent;
    }).length;
    const overallProgress = totalAgentsToday > 0 ? (completedAgentsToday / totalAgentsToday) * 100 : 0;

    const overviewHtml = `
        <div class="tasks-overview" id="tasks-overview">
            <div class="progress-donut-chart" style="--p:${overallProgress};--b:10px;--c:var(--primary-color);">
                <span>${Math.round(overallProgress)}%</span>
            </div>
            <div class="overview-stats">
                <div class="overview-stat-item">
                    <h3 data-stat="total">${totalAgentsToday}</h3>
                    <p><i class="fas fa-tasks"></i> إجمالي مهام اليوم</p>
                </div>
                <div class="overview-stat-item">
                    <h3 data-stat="completed">${completedAgentsToday}</h3>
                    <p><i class="fas fa-check-double"></i> مهام مكتملة</p>
                </div>
                <div class="overview-stat-item">
                    <h3 data-stat="pending">${totalAgentsToday - completedAgentsToday}</h3>
                    <p><i class="fas fa-hourglass-half"></i> مهام متبقية</p>
                </div>
            </div>
        </div>
    `;

    let groupsHtml = '';
    if (filteredAgents.length === 0) {
        groupsHtml = '<p class="no-results-message" style="margin-top: 20px;">لا توجد مهام مجدولة لهذا اليوم.</p>';
    } else {
        for (const classification of classifications) {
            const group = groupedAgents[classification];
            if (group.length > 0) {
                let completedCount = 0;
                let allTasksInGroupComplete = group.length > 0;
                group.forEach(agent => {
                    const task = tasksMap[agent.id] || {};
                    if (task.audited) { // Progress is based on audit only
                        completedCount++;
                    } else {
                        allTasksInGroupComplete = false;
                    }
                });

                const groupContainsHighlight = highlightedAgentId && group.some(agent => agent.id == highlightedAgentId);
                const isOpen = openGroups.includes(classification) || groupContainsHighlight;

                groupsHtml += `
                <details class="task-group ${allTasksInGroupComplete ? 'all-complete' : ''}" data-classification="${classification}" ${isOpen ? 'open' : ''}>
                    <summary class="task-group-header">
                        <div class="task-group-title">
                            <h2>${classification}</h2>
                            <span class="task-group-progress">${completedCount} / ${group.length}</span>
                        </div>
                        <div class="task-group-bulk-actions">
                            <label class="custom-checkbox small"><input type="checkbox" class="bulk-audit-check" data-classification="${classification}"><span class="checkmark"></span> تدقيق الكل</label>
                            <label class="custom-checkbox small"><input type="checkbox" class="bulk-competition-check" data-classification="${classification}"><span class="checkmark"></span> مسابقة الكل</label>
                        </div>
                        <div class="task-group-indicators">
                            <i class="fas fa-check-circle group-completion-indicator" title="اكتملت جميع المهام في هذا القسم"></i>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </summary>
                    <div class="task-group-content">
                        ${group.map(agent => {
                            const task = tasksMap[agent.id] || {};
                            const avatarHtml = agent.avatar_url
                                ? `<img src="${agent.avatar_url}" alt="Avatar" class="task-agent-avatar" loading="lazy">`
                                : `<div class="task-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;
                            const isAudited = task.audited;
                            const isCompetitionSent = task.competition_sent;
                            // Visual completion requires both
                            const isComplete = isAudited && isCompetitionSent; 
                            const isHighlighted = highlightedAgentId && agent.id == highlightedAgentId;
                            const depositBonusText = (agent.remaining_deposit_bonus > 0 && agent.deposit_bonus_percentage > 0)
                                ? `${agent.remaining_deposit_bonus} ${agent.remaining_deposit_bonus === 1 ? 'مرة' : 'مرات'} بنسبة ${agent.deposit_bonus_percentage}%`
                                : 'لا يوجد';

                            return `
                            <div class="task-card ${isComplete ? 'complete' : ''} ${isHighlighted ? 'highlighted' : ''}" data-agent-id="${agent.id}" data-name="${agent.name.toLowerCase()}" data-original-name="${agent.name}" data-agentid-str="${agent.agent_id}">
                                <div class="task-card-header">
                                    <div class="task-card-main">
                                        ${avatarHtml}
                                        <div class="task-agent-info">
                                            <h3>${agent.name} ${isComplete ? '<i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : ''}</h3>
                                            <p class="task-agent-id" title="نسخ الرقم">${agent.agent_id}</p>
                                        </div>
                                    </div>
                                    <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                                </div>
                                <div class="task-card-body">
                                    <div class="task-stat">
                                        <label>الرصيد التداولي:</label>
                                        <span>$${agent.remaining_balance || 0}</span>
                                    </div>
                                    <div class="task-stat">
                                        <label>بونص الإيداع:</label>
                                        <span>${depositBonusText}</span>
                                    </div>
                                </div>
                                <div class="task-card-actions">
                                    <div class="action-item ${isAudited ? 'done' : ''}">
                                        <label>التدقيق</label>
                                        <label class="custom-checkbox toggle-switch">
                                            <input type="checkbox" class="audit-check" data-agent-id="${agent.id}" ${isAudited ? 'checked' : ''}>
                                            <span class="slider round"></span>
                                        </label>
                                    </div>
                                    <div class="action-item ${isCompetitionSent ? 'done' : ''}">
                                        <label>المسابقة</label>
                                        <label class="custom-checkbox toggle-switch">
                                            <input type="checkbox" class="competition-check" data-agent-id="${agent.id}" ${isCompetitionSent ? 'checked' : ''}>
                                            <span class="slider round"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </details>
                `;
            }
        }
    }

    wrapper.innerHTML = `${overviewHtml}<div id="task-list-container">${groupsHtml}</div>`;

    setupTaskPageInteractions();

    if (highlightedAgentId) {
        const container = document.getElementById('task-list-container');
        const highlightedCard = container.querySelector(`.task-card[data-agent-id="${highlightedAgentId}"]`);
        if (highlightedCard) {
            highlightedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Clean the URL so the highlight doesn't persist on refresh
        history.replaceState(null, '', '#tasks');
    }

    const container = document.getElementById('task-list-container');
    // Use event delegation for better performance
    container.addEventListener('click', (e) => {
        const card = e.target.closest('.task-card');
        if (card && !e.target.closest('.task-card-actions')) {
            const agentId = card.dataset.agentId;
            window.location.hash = `profile/${agentId}`;
        }

        const agentIdEl = e.target.closest('.task-agent-id');
        if (agentIdEl) {
            e.stopPropagation();
            const agentIdToCopy = agentIdEl.textContent;
            navigator.clipboard.writeText(agentIdToCopy).then(() => showToast(`تم نسخ الرقم: ${agentIdToCopy}`, 'info'));
        }
    });

    container.addEventListener('change', async (e) => {
        if (e.target.matches('.audit-check, .competition-check')) {
            const checkbox = e.target;
            const card = checkbox.closest('.task-card');
            const agentId = checkbox.dataset.agentId;
            
            const isAuditedCheckbox = checkbox.classList.contains('audit-check');
            const isChecked = checkbox.checked;
            
            const updateData = {};
            const taskIdentifier = { agent_id: agentId, task_date: todayStr };

            if (isAuditedCheckbox) {
                updateData.audited = isChecked;
            } else {
                updateData.competition_sent = isChecked;
            }

            if (!supabase) return showToast('لا يمكن تحديث الحالة، لم يتم الاتصال بقاعدة البيانات.', 'error');

            const { error } = await supabase
                .from('daily_tasks')
                .upsert({ ...taskIdentifier, ...updateData }, { onConflict: 'agent_id, task_date' });

            if (error) {
                console.error('Error updating agent status:', error);
                showToast('فشل تحديث حالة الوكيل.', 'error');
                checkbox.checked = !isChecked; // Revert UI on error
            } else {
                // Update UI on success
                const auditCheck = card.querySelector('.audit-check');
                const competitionCheck = card.querySelector('.competition-check');
                
                auditCheck.closest('.action-item').classList.toggle('done', auditCheck.checked);
                competitionCheck.closest('.action-item').classList.toggle('done', competitionCheck.checked);

                // Visual completion requires both
                const isComplete = auditCheck.checked && competitionCheck.checked; 
                card.classList.toggle('complete', isComplete);

                // NEW: Update the checkmark icon next to the name instantly
                const nameEl = card.querySelector('.task-agent-info h3');
                const originalName = card.dataset.originalName;
                const iconHtml = isComplete ? ' <i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : '';
                nameEl.innerHTML = `${originalName}${iconHtml}`;

                
                // Update the progress counter for the group
                const groupDetails = card.closest('.task-group');
                updateTaskGroupState(groupDetails);
                updateOverallProgress();
            }
        }
    });
}

function setupTaskPageInteractions() {
    const container = document.getElementById('tasks-content-wrapper');
    if (!container) return;

    // 1. Search functionality
    const searchInput = document.getElementById('task-search-input');
    const clearBtn = document.getElementById('task-search-clear');

    if (searchInput) {
        const handleSearch = () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const allGroups = document.querySelectorAll('.task-group');

            if (clearBtn) {
                clearBtn.style.display = searchTerm ? 'block' : 'none';
            }

            allGroups.forEach(group => {
                const cards = group.querySelectorAll('.task-card');
                let visibleCardsInGroup = 0;

                cards.forEach(card => {
                    const name = card.dataset.name || '';
                    const agentIdStr = card.dataset.agentidStr || '';
                    const nameEl = card.querySelector('.task-agent-info h3');
                    const idEl = card.querySelector('.task-agent-info p');

                    const isVisible = searchTerm === '' || name.includes(searchTerm) || agentIdStr.includes(searchTerm);
                    card.style.display = isVisible ? '' : 'none';
                    if (isVisible) visibleCardsInGroup++;

                    // Highlight matching text
                    if (nameEl && idEl) {
                        const originalName = card.dataset.originalName;
                        const originalId = '#' + card.dataset.agentidStr;
                        if (isVisible && searchTerm) {
                            const regex = new RegExp(searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
                            nameEl.innerHTML = originalName.replace(regex, '<mark>$&</mark>');
                            idEl.innerHTML = originalId.replace(regex, '<mark>$&</mark>');
                        } else { // Reset when search is cleared
                            nameEl.textContent = originalName;
                            idEl.textContent = originalId;
                        }
                    }
                });

                // Hide the entire group if no cards match the search
                group.style.display = (visibleCardsInGroup > 0 || searchTerm === '') ? '' : 'none';
            });
        };
        searchInput.addEventListener('input', handleSearch);

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                handleSearch();
                searchInput.focus();
            });
        }
    }

    // 2. Accordion state persistence
    const allGroups = document.querySelectorAll('.task-group');
    allGroups.forEach(group => {
        group.addEventListener('toggle', () => {
            const openGroups = Array.from(allGroups).filter(g => g.open).map(g => g.dataset.classification);
            localStorage.setItem('openTaskGroups', JSON.stringify(openGroups));
        });
    });

    // 3. Bulk actions
    document.getElementById('task-list-container').addEventListener('change', async (e) => {
        if (e.target.matches('.bulk-audit-check, .bulk-competition-check')) {
            const bulkCheckbox = e.target;
            const isChecked = bulkCheckbox.checked;
            const classification = bulkCheckbox.dataset.classification;
            const isBulkAudit = bulkCheckbox.classList.contains('bulk-audit-check');
            const group = container.querySelector(`.task-group[data-classification="${classification}"]`);
            const cards = group.querySelectorAll('.task-card');

            if (cards.length === 0) return;

            bulkCheckbox.disabled = true;

            const todayStr = new Date().toISOString().split('T')[0];
            const upsertData = [];
            cards.forEach(card => {
                const agentId = card.dataset.agentId;
                const updatePayload = { agent_id: agentId, task_date: todayStr };
                if (isBulkAudit) {
                    updatePayload.audited = isChecked;
                } else {
                    updatePayload.competition_sent = isChecked;
                }
                upsertData.push(updatePayload);
            });

            const { error } = await supabase.from('daily_tasks').upsert(upsertData, { onConflict: 'agent_id, task_date' });

            if (error) {
                console.error('Bulk update error:', error);
                showToast('فشل تحديث المهام بشكل جماعي.', 'error');
                bulkCheckbox.checked = !isChecked; // Revert UI
            } else {
                // Update UI for all cards in the group
                cards.forEach(card => {
                    const individualCheckbox = card.querySelector(isBulkAudit ? '.audit-check' : '.competition-check');
                    if (individualCheckbox) individualCheckbox.checked = isChecked;

                    const auditCheck = card.querySelector('.audit-check');
                    const competitionCheck = card.querySelector('.competition-check');
                    auditCheck.closest('.action-item').classList.toggle('done', auditCheck.checked);
                    competitionCheck.closest('.action-item').classList.toggle('done', competitionCheck.checked);
                    const isComplete = auditCheck.checked && competitionCheck.checked;
                    card.classList.toggle('complete', isComplete);
                });
                updateTaskGroupState(group);
                updateOverallProgress();
                showToast(`تم ${isChecked ? 'تحديد' : 'إلغاء تحديد'} الكل بنجاح.`, 'success');
            }
            bulkCheckbox.disabled = false;
        }
    });
}

function renderAddAgentForm() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const returnPage = urlParams.get('returnTo') || 'manage-agents';

    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header"><h1><i class="fas fa-user-plus"></i> إضافة وكيل جديد</h1></div>
        <div class="form-container-v2">
            <form id="add-agent-form">
                <div class="form-section avatar-section">
                    <div class="profile-avatar-edit large-avatar">
                        <img src="https://ui-avatars.com/api/?name=?&background=8A2BE2&color=fff&size=128" alt="Avatar" id="avatar-preview">
                        <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="details-section-title"><i class="fas fa-id-card"></i> المعلومات الأساسية</h3>
                    <div class="details-grid">
                        <div class="form-group"><label for="agent-name">اسم الوكيل</label><input type="text" id="agent-name" required></div>
                        <div class="form-group">
                            <label for="agent-id">رقم الوكالة</label><input type="text" id="agent-id" required>
                            <div id="agent-id-validation" class="validation-message"></div>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="details-section-title"><i class="fab fa-telegram-plane"></i> بيانات التلجرام</h3>
                    <div class="details-grid">
                        <div class="form-group"><label for="telegram-channel-url">رابط قناة التلجرام</label><input type="text" id="telegram-channel-url"></div>
                        <div class="form-group"><label for="telegram-group-url">رابط جروب التلجرام</label><input type="text" id="telegram-group-url"></div>
                        <div class="form-group"><label for="telegram-chat-id">معرف الدردشة (Chat ID)</label><input type="text" id="telegram-chat-id" placeholder="مثال: -100123456789"></div>
                        <div class="form-group"><label for="telegram-group-name">اسم مجموعة التلجرام</label><input type="text" id="telegram-group-name"></div>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="details-section-title"><i class="fas fa-cogs"></i> إعدادات النظام</h3>
                    <div class="details-grid">
                        <div class="form-group">
                            <label for="agent-classification">التصنيف</label>
                            <select id="agent-classification"><option value="R">R</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
                        </div>
                        <div class="form-group">
                            <label for="agent-rank">المرتبة</label>
                            <select id="agent-rank">
                                <optgroup label="⁕ مراتب الوكلاء الاعتيادية ⁖">
                                    ${Object.keys(RANKS_DATA).filter(r => ['Beginning', 'Growth', 'Pro', 'Elite'].includes(r)).map((rank, index) => `<option value="${rank}" ${index === 0 ? 'selected' : ''}>🔸 ${rank}</option>`).join('')}
                                </optgroup>
                                <optgroup label="⁕ مراتب الوكالة الحصرية ⁖">
                                    <option value="وكيل حصري بدون مرتبة">⭐ وكيل حصري بدون مرتبة</option>
                                    <option disabled>──────────</option>
                                    ${Object.keys(RANKS_DATA).filter(r => ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Sapphire', 'Emerald', 'King', 'Legend'].includes(r)).map(rank => `<option value="${rank}">⭐ ${rank}</option>`).join('')}
                                </optgroup>
                                <optgroup label="⁕ المراكز ⁖">
                                    <option value="Center">🏢 Center</option>
                                </optgroup>
                            </select>
                            <div id="rank-hint" class="form-hint">
                                <!-- Rank details will be shown here -->
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="agent-renewal-period">فترة تجديد الرصيد</label>
                            <select id="agent-renewal-period">
                                <option value="none" selected>بدون تجديد</option>
                                <option value="weekly">أسبوعي</option>
                                <option value="biweekly">كل أسبوعين</option>
                                <option value="monthly">شهري</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top: 20px;">
                        <label style="margin-bottom: 10px;">أيام التدقيق</label>
                        <div class="days-selector-v2">
                            ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((day, index) => `
                                <div class="day-toggle-wrapper">
                                    <input type="checkbox" id="day-${index}" value="${index}" class="day-toggle-input">
                                    <label for="day-${index}" class="day-toggle-btn">${day}</label>
                                </div>`).join('')}
                        </div>
                    </div>
                </div>

                <div class="form-actions-v2">
                    <button type="submit" id="save-agent-btn" class="btn-primary">حفظ الوكيل</button>
                    <button type="button" id="cancel-add-agent" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;

    // Avatar preview logic
    const avatarUploadInput = document.getElementById('avatar-upload');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarContainer = avatarPreview.closest('.profile-avatar-edit');

    if (avatarContainer) {
        avatarContainer.addEventListener('click', () => avatarUploadInput.click());
    }

    avatarUploadInput.addEventListener('change', () => {
        const file = avatarUploadInput.files[0];
        if (file) {
            avatarPreview.src = URL.createObjectURL(file);
        }
    });

    // --- الاقتراح أ: التحقق الفوري من رقم الوكالة ---
    const agentIdInput = document.getElementById('agent-id');
    const agentIdValidation = document.getElementById('agent-id-validation');
    agentIdInput.addEventListener('blur', async () => {
        const agentId = agentIdInput.value.trim();
        if (!agentId) {
            agentIdValidation.innerHTML = '';
            agentIdInput.classList.remove('invalid');
            return;
        }
        agentIdValidation.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';
        const { data, error } = await supabase.from('agents').select('id').eq('agent_id', agentId);
        if (error) {
            agentIdValidation.innerHTML = '<span class="error-text">خطأ في التحقق</span>';
        } else if (data.length > 0) {
            agentIdValidation.innerHTML = '<span class="error-text"><i class="fas fa-times-circle"></i> رقم الوكالة مستخدم بالفعل</span>';
            agentIdInput.classList.add('invalid');
        } else {
            agentIdValidation.innerHTML = '<span class="success-text"><i class="fas fa-check-circle"></i> الرقم متاح</span>';
            agentIdInput.classList.remove('invalid');
        }
    });

    // --- الاقتراح ب: إظهار تلميح عند اختيار المرتبة ---
    const rankSelect = document.getElementById('agent-rank');
    const rankHint = document.getElementById('rank-hint');
    const updateRankHint = () => {
        const rank = rankSelect.value;
        const rankData = RANKS_DATA[rank] || {};
        let hintText = '';
        if (rankData.competition_bonus) {
            const bonus = rankData.competition_bonus === Infinity ? 'غير محدود' : `$${rankData.competition_bonus}`;
            hintText += `💰 بونص المسابقات: <strong>${bonus}</strong>`;
        }
        if (rankData.deposit_bonus_count) {
            const count = rankData.deposit_bonus_count === Infinity ? 'غير محدود' : rankData.deposit_bonus_count;
            hintText += ` | 🎁 بونص الإيداع: <strong>${count} مرات</strong> بنسبة <strong>${rankData.deposit_bonus_percentage}%</strong>`;
        }
        if (hintText) {
            rankHint.innerHTML = hintText;
            rankHint.style.display = 'block';
        } else {
            rankHint.style.display = 'none';
        }
    };

    rankSelect.addEventListener('change', updateRankHint);
    updateRankHint(); // استدعاء أولي لعرض بيانات المرتبة الافتراضية

    document.getElementById('agent-name').addEventListener('input', (e) => {
        avatarPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(e.target.value) || '?'}&background=8A2BE2&color=fff&size=128`;
    });

    const cancelButton = document.getElementById('cancel-add-agent');
    cancelButton.addEventListener('click', () => {
        const nameInput = document.getElementById('agent-name');
        const idInput = document.getElementById('agent-id');

        if (nameInput.value.trim() !== '' || idInput.value.trim() !== '') {
            showConfirmationModal(
                'توجد بيانات غير محفوظة. هل تريد المتابعة وإلغاء الإضافة؟',
                () => {
                    window.location.hash = `#${returnPage}`;
                }, {
                    title: 'تأكيد الإلغاء',
                    confirmText: 'نعم، إلغاء',
                    confirmClass: 'btn-danger'
                });
        } else {
            window.location.hash = `#${returnPage}`;
        }
    });

    document.getElementById('add-agent-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabase) return showToast('لا يمكن إضافة وكيل، لم يتم الاتصال بقاعدة البيانات.', 'error');

        const rank = document.getElementById('agent-rank').value;
        const rankData = RANKS_DATA[rank] || {};

        const newAgentData = {
            name: document.getElementById('agent-name').value,
            agent_id: document.getElementById('agent-id').value,
            classification: document.getElementById('agent-classification').value,
            audit_days: selectedDays,
            rank: rank || null,
            telegram_channel_url: document.getElementById('telegram-channel-url').value || null,
            telegram_group_url: document.getElementById('telegram-group-url').value || null,
            telegram_chat_id: document.getElementById('telegram-chat-id').value || null,
            telegram_group_name: document.getElementById('telegram-group-name').value || null,
            renewal_period: document.getElementById('agent-renewal-period').value,
            competition_bonus: rankData.competition_bonus,
            deposit_bonus_percentage: rankData.deposit_bonus_percentage,
            deposit_bonus_count: rankData.deposit_bonus_count,
            remaining_balance: rankData.competition_bonus,
            remaining_deposit_bonus: rankData.deposit_bonus_count,
        };

        // --- الاقتراح د: تأكيد قبل الحفظ ---
        const summaryHtml = `
            <div class="confirmation-summary">
                <p><strong>الاسم:</strong> ${newAgentData.name}</p>
                <p><strong>رقم الوكالة:</strong> ${newAgentData.agent_id}</p>
                <p><strong>المرتبة:</strong> ${newAgentData.rank}</p>
            </div>
            <p>هل أنت متأكد من أن البيانات صحيحة؟</p>
        `;

        showConfirmationModal(
            summaryHtml,
            async () => {
                await saveAgent(newAgentData);
            }, {
                title: 'مراجعة بيانات الوكيل',
                confirmText: 'نعم، حفظ',
                confirmClass: 'btn-primary'
            }
        );
    });
}

async function saveAgent(newAgentData) {
    const saveBtn = document.getElementById('save-agent-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
        const rank = newAgentData.rank;
        const rankData = RANKS_DATA[rank] || {};

        // إعادة حساب الأرصدة للتأكيد
        newAgentData.competition_bonus = rankData.competition_bonus;
        newAgentData.deposit_bonus_percentage = rankData.deposit_bonus_percentage;
        newAgentData.deposit_bonus_count = rankData.deposit_bonus_count;
        newAgentData.remaining_balance = rankData.competition_bonus;
        newAgentData.remaining_deposit_bonus = rankData.deposit_bonus_count;

        // --- تعديل: منطق خاص لمرتبة "بدون مرتبة حصرية" ---
        if (rank === 'بدون مرتبة حصرية') {
            newAgentData.competition_bonus = 60;
            newAgentData.remaining_balance = 60;
            newAgentData.deposit_bonus_percentage = null;
            newAgentData.deposit_bonus_count = null;
            newAgentData.remaining_deposit_bonus = null;
        }

        // Check for uniqueness of agent_id
        const { data: existingAgents, error: checkError } = await supabase
            .from('agents')
            .select('id')
            .eq('agent_id', newAgentData.agent_id);

        if (checkError) {
            console.error('Error checking for existing agent on create:', checkError);
            showToast('حدث خطأ أثناء التحقق من رقم الوكالة.', 'error');
            throw new Error('Check error');
        }

        if (existingAgents && existingAgents.length > 0) {
            showToast('رقم الوكالة هذا مستخدم بالفعل لوكيل آخر.', 'error');
            throw new Error('Duplicate agent ID');
        }

        // Insert agent data without avatar first to get an ID
        const { data: insertedAgent, error: insertError } = await supabase.from('agents').insert([newAgentData]).select().single();

        if (insertError) {
            throw insertError;
        }

        // If an avatar was selected, upload it and update the agent record
        const avatarFile = document.getElementById('avatar-upload').files[0];
        if (avatarFile) {
            const filePath = `${insertedAgent.id}-${Date.now()}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile);

            if (uploadError) {
                showToast('تم إنشاء الوكيل ولكن فشل رفع الصورة.', 'error');
                console.error('Avatar upload error:', uploadError);
            } else {
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                const { error: updateAvatarError } = await supabase.from('agents').update({ avatar_url: urlData.publicUrl }).eq('id', insertedAgent.id);
                if (updateAvatarError) console.error('Avatar URL update error:', updateAvatarError);
            }
        }

        await logAgentActivity(insertedAgent.id, 'AGENT_CREATED', `تم إنشاء وكيل جديد: ${insertedAgent.name}.`);
        showToast('تمت إضافة الوكيل بنجاح!', 'success');
        allAgentsData = []; // مسح ذاكرة التخزين المؤقت للوكلاء لإعادة جلبها عند العودة
        // Use replace to avoid adding the 'add-agent' page to history
        const newUrl = window.location.pathname + window.location.search + `#profile/${insertedAgent.id}`;
        window.location.replace(newUrl);

    } catch (error) {
        console.error('Error saving agent:', error);
        if (error.message !== 'Duplicate agent ID' && error.message !== 'Check error') {
            showToast(`فشل إضافة الوكيل: ${error.message}`, 'error');
        }
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'حفظ الوكيل';
    }
}

async function renderActivityLogPage() {
    const appContent = document.getElementById('app-content');
    const LOGS_PER_PAGE = 20;
    let currentPage = 1;

    appContent.innerHTML = `
        <div class="page-header"><h1><i class="fas fa-history"></i> سجل الأنشطة العام</h1></div>
        <div id="activity-log-container">
            <p>جاري تحميل السجلات...</p>
        </div>
        <div id="activity-pagination-container" class="pagination-container"></div>
    `;

    const logContainer = document.getElementById('activity-log-container');
    const paginationContainer = document.getElementById('activity-pagination-container');

    async function loadAndDisplayLogs(page) {
        logContainer.innerHTML = '<p>جاري تحميل السجلات...</p>';
        const { data, error, count } = await supabase
            .from('agent_logs')
            .select('*, agents(name)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * LOGS_PER_PAGE, page * LOGS_PER_PAGE - 1);

        if (error) {
            logContainer.innerHTML = '<p class="error">فشل تحميل سجل الأنشطة.</p>';
            return;
        }

        if (data.length === 0) {
            logContainer.innerHTML = '<p class="no-results-message">لا توجد أنشطة مسجلة.</p>';
            paginationContainer.innerHTML = '';
            return;
        }

        const getLogIconDetails = (actionType) => {
            if (actionType.includes('CREATED')) return { icon: 'fa-user-plus', colorClass: 'log-icon-create' };
            if (actionType.includes('DELETED')) return { icon: 'fa-user-slash', colorClass: 'log-icon-delete' };
            if (actionType.includes('PROFILE_UPDATE')) return { icon: 'fa-user-edit', colorClass: 'log-icon-profile' };
            if (actionType.includes('DETAILS_UPDATE')) return { icon: 'fa-cogs', colorClass: 'log-icon-details' };
            if (actionType.includes('COMPETITION_CREATED')) return { icon: 'fa-trophy', colorClass: 'log-icon-competition' };
            return { icon: 'fa-history', colorClass: 'log-icon-generic' };
        };

        logContainer.innerHTML = data.map(log => {
            const { icon, colorClass } = getLogIconDetails(log.action_type);
            const agentName = log.agents ? `<a href="#profile/${log.agent_id}" class="agent-name-link">${log.agents.name}</a>` : '';
            let finalDescription = log.description.replace(/`([^`]+)`/g, '<strong>$1</strong>');
            // This logic is a bit tricky. We want to replace the agent name in the description with a link,
            // but only if the agent exists.
            // A simpler approach is to just prepend the agent name if it exists.
            const agentPrefix = agentName ? `<strong>${agentName}:</strong> ` : '';
            if (log.agents && log.agents.name) {
                finalDescription = finalDescription.replace(log.agents.name, agentName);
            }

            return `
                <div class="activity-item-full">
                    <div class="activity-icon ${colorClass}"><i class="fas ${icon}"></i></div>
                    <div class="activity-content">
                        <p class="activity-description">${agentPrefix}${finalDescription}</p>
                        <p class="activity-timestamp">${new Date(log.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                </div>
            `;
        }).join('');

        // Render pagination
        const totalPages = Math.ceil(count / LOGS_PER_PAGE);
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>السابق</button>`;
            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            paginationHtml += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي</button>`;
        }
        paginationContainer.innerHTML = paginationHtml;
    }

    paginationContainer.addEventListener('click', (e) => {
        if (e.target.matches('.page-btn') && !e.target.disabled) {
            const newPage = parseInt(e.target.dataset.page);
            if (newPage) {
                currentPage = newPage;
                loadAndDisplayLogs(currentPage);
            }
        }
    });

    await loadAndDisplayLogs(currentPage);
}

async function handleMarkAllTasksComplete() {
    // 1. جلب وكلاء اليوم
    const today = new Date().getDay();
    const { data: agentsForToday, error: fetchError } = await supabase
        .from('agents')
        .select('id') // نحتاج فقط إلى المعرفات
        .contains('audit_days', [today]);

    if (fetchError) {
        showToast('فشل جلب قائمة وكلاء اليوم.', 'error');
        return;
    }

    if (!agentsForToday || agentsForToday.length === 0) {
        showToast('لا توجد مهام مجدولة لهذا اليوم.', 'info');
        return;
    }

    // 2. إظهار نافذة التأكيد
    showConfirmationModal(
        `هل أنت متأكد من تمييز جميع مهام اليوم (${agentsForToday.length} وكيل) كمكتملة؟`,
        async () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const upsertData = agentsForToday.map(agent => ({
                agent_id: agent.id,
                task_date: todayStr,
                audited: true,
                competition_sent: true
            }));

            const { error } = await supabase.from('daily_tasks').upsert(upsertData, { onConflict: 'agent_id, task_date' });

            if (error) {
                showToast('فشل تحديث المهام بشكل جماعي.', 'error');
                console.error('Bulk complete error:', error);
            } else {
                showToast('تم تمييز جميع المهام كمكتملة بنجاح.', 'success');
                await renderTaskList(); // إعادة عرض قائمة المهام لتحديث الواجهة
            }
        }, { title: 'تأكيد إكمال جميع المهام', confirmText: 'نعم، إكمال الكل', confirmClass: 'btn-primary' }
    );
}

async function handleBulkSendBalances(agents) {
    // فلترة الوكلاء الذين لديهم معرف دردشة ورصيد أو بونص متبقي
    const eligibleAgents = agents.filter(agent => 
        agent.telegram_chat_id && 
        ((agent.remaining_balance || 0) > 0 || (agent.remaining_deposit_bonus || 0) > 0)
    );
    const agentCount = eligibleAgents.length;

    if (agentCount === 0) {
        showToast('لا يوجد وكلاء مؤهلون (لديهم معرف دردشة ورصيد متاح) لإرسال التعميم.', 'info');
        return;
    }

    const modalContent = `
        <p>سيتم إرسال كليشة الرصيد المتاح إلى <strong>${agentCount}</strong> وكيل مؤهل.</p>
        <p>سيتم تجهيز رسالة فريدة لكل وكيل تحتوي على تفاصيل رصيده وبونص الإيداع الخاص به.</p>
        <p class="warning-text" style="margin-top: 15px;"><i class="fas fa-exclamation-triangle"></i> هل أنت متأكد من المتابعة؟</p>
    `;

    showConfirmationModal(
        modalContent,
        async () => {
            showBulkSendProgressModal(agentCount);

            let successCount = 0;
            let errorCount = 0;
            const progressBar = document.getElementById('bulk-send-progress-bar-inner');
            const statusText = document.getElementById('bulk-send-status-text');
            const renewalPeriodMap = {
                'weekly': 'أسبوعي',
                'biweekly': 'كل أسبوعين',
                'monthly': 'شهري'
            };

            for (let i = 0; i < eligibleAgents.length; i++) {
                const agent = eligibleAgents[i];
                
                // بناء الرسالة الخاصة بكل وكيل
                const renewalText = renewalPeriodMap[agent.renewal_period] || 'تداولي';
                let benefitsText = '';
                if ((agent.remaining_balance || 0) > 0) {
                    benefitsText += `💰 <b>رصيد مسابقات (${renewalText}):</b> <code>${agent.remaining_balance}$</code>\n`;
                }
                if ((agent.remaining_deposit_bonus || 0) > 0) {
                    benefitsText += `🎁 <b>بونص ايداع:</b> <code>${agent.remaining_deposit_bonus}</code> مرات بنسبة <code>${agent.deposit_bonus_percentage || 0}%</code>\n`;
                }

                const clicheText = `<b>دمت بخير شريكنا العزيز ${agent.name}</b> ...\n\nيسرنا ان نحيطك علما بأن حضرتك كوكيل لدى شركة انزو تتمتع بالمميزات التالية:\n\n${benefitsText.trim()}\n\nبامكانك الاستفادة منه من خلال انشاء مسابقات اسبوعية لتنمية وتطوير العملاء التابعين للوكالة.\n\nهل ترغب بارسال مسابقة لحضرتك؟`;

                try {
                    const response = await fetch('/api/post-announcement', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: clicheText, chatId: agent.telegram_chat_id })
                    });

                    if (!response.ok) errorCount++;
                    else successCount++;

                } catch (e) {
                    errorCount++;
                }

                const progress = Math.round(((i + 1) / agentCount) * 100);
                progressBar.style.width = `${progress}%`;
                statusText.innerHTML = `جاري إرسال الأرصدة... (${i + 1} / ${agentCount})<br>نجح: ${successCount} | فشل: ${errorCount}`;
                // إصلاح: نقل التأخير الزمني إلى داخل الحلقة ليعمل بشكل صحيح
                if (i < eligibleAgents.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 400)); // 400ms delay
                }
            } // نهاية الحلقة for

            // Update modal with final result
            statusText.innerHTML = `اكتمل تعميم الأرصدة.<br><strong>${successCount}</strong> رسالة ناجحة | <strong>${errorCount}</strong> رسالة فاشلة.`;
            progressBar.style.backgroundColor = errorCount > 0 ? 'var(--danger-color)' : 'var(--success-color)';
            document.querySelector('.modal-no-actions .update-icon').className = 'fas fa-check-circle update-icon';
            await logAgentActivity(null, 'BULK_BALANCE_SENT', `تم تعميم الأرصدة إلى ${successCount} وكيل (فشل ${errorCount}).`);

            // --- تعديل: إخفاء نافذة التقدم تلقائياً بعد 3 ثوانٍ ---
            setTimeout(() => {
                // ابحث عن النافذة المنبثقة النشطة وقم بإزالتها
                const modalOverlay = document.querySelector('.modal-overlay');
                if (modalOverlay) {
                    modalOverlay.remove();
                }
            }, 3000); // إغلاق بعد 3 ثوانٍ

            // --- تعديل: إرسال إشعار بالنتيجة إلى المجموعة العامة ---
            const summaryMessage = `✅ اكتملت عملية تعميم الأرصدة.\n\n- رسائل ناجحة: ${successCount}\n- رسائل فاشلة: ${errorCount}`;
            try {
                await fetch('/api/post-announcement', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: summaryMessage }) // لا نمرر chatId ليتم الإرسال للمجموعة العامة
                });
            } catch (e) {
                console.warn('Could not send completion summary to Telegram:', e);
            }
        }, {
            title: 'تعميم الأرصدة المتاحة',
            confirmText: 'إرسال الآن',
            confirmClass: 'btn-telegram-bonus',
            cancelText: 'إلغاء',
            modalClass: 'modal-wide'
        }
    );
}


function showBulkSendProgressModal(total) {
    const modalContent = `
        <div class="update-progress-container">
            <i class="fas fa-paper-plane update-icon"></i>
            <h3 id="bulk-send-status-text">جاري التهيئة لإرسال ${total} رسالة...</h3>
            <div class="progress-bar-outer">
                <div id="bulk-send-progress-bar-inner" class="progress-bar-inner"></div>
            </div>
        </div>
    `;
    showConfirmationModal(modalContent, null, {
        title: 'عملية الإرسال الجماعي',
        showCancel: false,
        showConfirm: false,
        modalClass: 'modal-no-actions'
    });
}

async function renderMiniCalendar() {
    const wrapper = document.getElementById('tasks-calendar-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = `
        <div class="page-header" style="padding: 0; border: none;">
            <div class="header-top-row">
                <h2>التقويم</h2>
            </div>
        </div>
        <div id="mini-calendar-container"></div>
    `;

    const calendarContainer = document.getElementById('mini-calendar-container');
    const today = new Date();
    const month = today.getMonth();


    const year = today.getFullYear();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let calendarHtml = `
        <div class="mini-calendar-header">
            <span class="month-year">${today.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div class="mini-calendar-grid">
            ${['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map(day => `<div class="day-name">${day}</div>`).join('')}
    `;

    // Add empty cells for the first day of the week
    for (let i = 0; i < firstDay; i++) {
        calendarHtml += '<div></div>';
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === today.getDate();
        calendarHtml += `<div class="day-cell ${isToday ? 'today' : ''}">${day}</div>`;
    }

    calendarHtml += '</div>';
    calendarContainer.innerHTML = calendarHtml;
}
