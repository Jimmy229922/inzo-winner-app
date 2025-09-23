let allAgentsData = [];
const AGENTS_PER_PAGE = 10;
const RANKS_DATA = {
    // الاعتيادية
    'Beginning': { competition_bonus: 60, deposit_bonus_percentage: null, deposit_bonus_count: null },
    'Growth': { competition_bonus: 100, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
    'Pro': { competition_bonus: 150, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
    'Elite': { competition_bonus: 200, deposit_bonus_percentage: 50, deposit_bonus_count: 4 },
    // الحصرية
    'Bronze': { competition_bonus: 150, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
    'Silver': { competition_bonus: 230, deposit_bonus_percentage: 40, deposit_bonus_count: 3 },
    'Gold': { competition_bonus: 300, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
    'Platinum': { competition_bonus: 500, deposit_bonus_percentage: 60, deposit_bonus_count: 4 },
    'Diamond': { competition_bonus: 800, deposit_bonus_percentage: 75, deposit_bonus_count: 4 },
    'Sapphire': { competition_bonus: 1100, deposit_bonus_percentage: 85, deposit_bonus_count: 4 },
    'Emerald': { competition_bonus: 2000, deposit_bonus_percentage: 90, deposit_bonus_count: 4 },
    'King': { competition_bonus: 2500, deposit_bonus_percentage: 95, deposit_bonus_count: 4 },
    'Legend': { competition_bonus: Infinity, deposit_bonus_percentage: 100, deposit_bonus_count: Infinity },
};

async function renderTasksPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>مهمات اليوم</h1>
            </div>
            <div class="agent-filters">
                <div class="filter-search-container">
                    <input type="search" id="task-search-input" placeholder="بحث بالاسم أو الرقم..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="task-search-clear"></i>
                </div>
            </div>
        </div>
        <div id="task-list-container"></div>
    `;

    await renderTaskList();
}

async function renderManageAgentsPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>إدارة الوكلاء</h1>
                <button id="add-agent-btn" class="btn-primary"><i class="fas fa-plus"></i> إضافة وكيل جديد</button>
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
            </div>
        </div>
        <div id="agent-table-container"></div>
    `;

    document.getElementById('add-agent-btn').addEventListener('click', () => {
        setActiveNav(null);
        window.location.hash = 'add-agent?returnTo=manage-agents';
    });

    if (!supabase) {
        appContent.innerHTML = `<p class="error">لا يمكن عرض الوكلاء، لم يتم الاتصال بقاعدة البيانات.</p>`;
        return;
    }

    const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error("Error fetching agents:", error);
        document.getElementById('agent-table-container').innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات الوكلاء.</p>`;
        return;
    }

    allAgentsData = data;
    displayAgentsPage(allAgentsData, 1);
    setupAgentFilters();
}

function setupAgentFilters() {
    const searchInput = document.getElementById('agent-search-input');
    const clearBtn = document.getElementById('agent-search-clear');
    const filterButtons = document.querySelectorAll('.agent-filters .filter-btn');

    if (!searchInput) return;

    const applyFilters = () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeFilter = document.querySelector('.agent-filters .filter-btn.active').dataset.filter;

        const filteredAgents = allAgentsData.filter(agent => {
            const name = agent.name.toLowerCase();
            const agentIdStr = agent.agent_id;
            const classification = agent.classification;
            const matchesSearch = searchTerm === '' || name.includes(searchTerm) || agentIdStr.includes(searchTerm);
            const matchesFilter = activeFilter === 'all' || classification === activeFilter;
            return matchesSearch && matchesFilter;
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

    const gridHtml = paginatedAgents.length > 0 ? paginatedAgents.map(agent => {
        const avatarHtml = agent.avatar_url
            ? `<img src="${agent.avatar_url}" alt="Avatar" class="agent-manage-avatar">`
            : `<div class="agent-manage-avatar-placeholder"><i class="fas fa-user"></i></div>`;
        
        let highlightedName = agent.name;
        let highlightedId = '#' + agent.agent_id;

        if (searchTerm) {
            const regex = new RegExp(searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            highlightedName = agent.name.replace(regex, '<mark>$&</mark>');
            highlightedId = ('#' + agent.agent_id).replace(regex, '<mark>$&</mark>');
        }

        return `
        <div class="agent-manage-card" data-agent-id="${agent.id}">
            <div class="agent-manage-card-header">
                ${avatarHtml}
                <div class="agent-manage-info">
                    <h3 class="agent-name">${highlightedName}</h3>
                    <p class="agent-id-text">${highlightedId}</p>
                </div>
                <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
            </div>
            <div class="agent-manage-card-footer">
                <button class="btn-secondary edit-btn"><i class="fas fa-edit"></i> تعديل</button>
                <button class="btn-danger delete-btn"><i class="fas fa-trash-alt"></i> حذف</button>
            </div>
        </div>
        `;
    }).join('') : '<p class="no-results-message">لا توجد نتائج تطابق بحثك.</p>';

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

    container.innerHTML = `<div class="manage-agents-grid">${gridHtml}</div>${paginationHtml}`;

    attachCardEventListeners(agentsList, page);
}

function attachCardEventListeners(currentList, currentPage) {
    const container = document.getElementById('agent-table-container');
    if (!container) return;

    container.querySelectorAll('.agent-manage-card').forEach(card => {
        card.addEventListener('click', e => {
            if (e.target.closest('.agent-manage-card-footer')) return;
            window.location.hash = `profile/${card.dataset.agentId}`;
        });
    });

    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.currentTarget.closest('.agent-manage-card');
            window.location.hash = `profile/${card.dataset.agentId}/edit`;
        });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.currentTarget.closest('.agent-manage-card');
            const agentId = card.dataset.agentId;
            const agentName = card.querySelector('.agent-name').textContent;

            showConfirmationModal(
                `هل أنت متأكد من رغبتك في حذف الوكيل "${agentName}"؟`,
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
                    confirmText: 'نعم، قم بالحذف',
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

function updateTaskGroupState(groupDetailsElement) {
    if (!groupDetailsElement) return;
    const progressSpan = groupDetailsElement.querySelector('.task-group-progress');
    const cards = groupDetailsElement.querySelectorAll('.task-card');
    const total = cards.length;
    let completed = 0;
    cards.forEach(card => {
        // A task is only complete for the progress bar if both are checked
        const auditCheck = card.querySelector('.audit-check');
        const competitionCheck = card.querySelector('.competition-check');
        if (auditCheck?.checked && competitionCheck?.checked) {
            completed++;
        }
    });
    progressSpan.textContent = `${completed} / ${total}`;

    // Check if the entire group is complete
    const allComplete = total > 0 && completed === total;
    groupDetailsElement.classList.toggle('all-complete', allComplete);
}

async function renderTaskList() {
    const container = document.getElementById('task-list-container');
    if (!container) return;

    if (!supabase) {
        container.innerHTML = `<p class="error">لا يمكن عرض المهام، لم يتم الاتصال بقاعدة البيانات.</p>`;
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
        container.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات المهام.</p>`;
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

    let html = '';
    if (filteredAgents.length === 0) {
        html = '<p class="no-results-message" style="margin-top: 20px;">لا توجد مهام مجدولة لهذا اليوم.</p>';
    } else {
        for (const classification of classifications) {
            const group = groupedAgents[classification];
            if (group.length > 0) {
                let completedCount = 0;
                let allTasksInGroupComplete = group.length > 0;
                group.forEach(agent => {
                    const task = tasksMap[agent.id] || {};
                    if (task.audited && task.competition_sent) {
                        completedCount++;
                    } else {
                        allTasksInGroupComplete = false;
                    }
                });

                const groupContainsHighlight = highlightedAgentId && group.some(agent => agent.id == highlightedAgentId);
                const isOpen = openGroups.includes(classification) || groupContainsHighlight;

                html += `
                <details class="task-group ${allTasksInGroupComplete ? 'all-complete' : ''}" data-classification="${classification}" ${isOpen ? 'open' : ''}>
                    <summary class="task-group-header">
                        <div class="task-group-header-left">
                            <div class="task-group-title">
                                <h2>${classification}</h2>
                                <span class="task-group-progress">${completedCount} / ${group.length}</span>
                            </div>
                        </div>
                        <div class="task-group-header-right">
                            <div class="task-group-bulk-actions">
                                <label class="custom-checkbox small"><input type="checkbox" class="bulk-audit-check" data-classification="${classification}"><span class="checkmark"></span> تدقيق الكل</label>
                                <label class="custom-checkbox small"><input type="checkbox" class="bulk-competition-check" data-classification="${classification}"><span class="checkmark"></span> مسابقة الكل</label>
                            </div>
                            <div class="task-group-indicators">
                                <i class="fas fa-check-circle group-completion-indicator" title="اكتملت جميع المهام في هذا القسم"></i>
                                <i class="fas fa-chevron-down"></i>
                            </div>
                        </div>
                    </summary>
                    <div class="task-group-content">
                        ${group.map(agent => {
                            const task = tasksMap[agent.id] || {};
                            const avatarHtml = agent.avatar_url
                                ? `<img src="${agent.avatar_url}" alt="Avatar" class="task-agent-avatar">`
                                : `<div class="task-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;
                            const isComplete = task.audited && task.competition_sent;
                            const isAuditedOnly = task.audited && !task.competition_sent;
                            const isCompetitionOnly = !task.audited && task.competition_sent;
                            const isHighlighted = highlightedAgentId && agent.id == highlightedAgentId;

                            return `
                            <div class="task-card ${isComplete ? 'complete' : ''} ${isAuditedOnly ? 'partially-complete' : ''} ${isCompetitionOnly ? 'competition-sent-only' : ''} ${isHighlighted ? 'highlighted' : ''}" data-agent-id="${agent.id}" data-name="${agent.name.toLowerCase()}" data-original-name="${agent.name}" data-agentid-str="${agent.agent_id}">
                                <div class="task-card-main">
                                    ${avatarHtml}
                                    <div class="task-agent-info">
                                        <h3>${agent.name}</h3>
                                        <p>#${agent.agent_id}</p>
                                    </div>
                                </div>
                                <div class="task-card-actions">
                                    <label class="custom-checkbox small">
                                        <input type="checkbox" class="audit-check" data-agent-id="${agent.id}" ${task.audited ? 'checked' : ''}>
                                        <span class="checkmark"></span>
                                        تدقيق
                                    </label>
                                    <label class="custom-checkbox small">
                                        <input type="checkbox" class="competition-check" data-agent-id="${agent.id}" ${task.competition_sent ? 'checked' : ''}>
                                        <span class="checkmark"></span>
                                        مسابقة
                                    </label>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </details>
                `;
            }
        }
    }

    container.innerHTML = html;

    setupTaskPageInteractions();

    if (highlightedAgentId) {
        const highlightedCard = container.querySelector(`.task-card[data-agent-id="${highlightedAgentId}"]`);
        if (highlightedCard) {
            highlightedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Clean the URL so the highlight doesn't persist on refresh
        history.replaceState(null, '', '#tasks');
    }

    // Use event delegation for better performance
    container.addEventListener('click', (e) => {
        const card = e.target.closest('.task-card');
        if (card && !e.target.closest('.task-card-actions')) {
            const agentId = card.dataset.agentId;
            window.location.hash = `profile/${agentId}`;
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
                const isComplete = auditCheck.checked && competitionCheck.checked;
                const isAuditedOnly = auditCheck.checked && !competitionCheck.checked;
                const isCompetitionOnly = !auditCheck.checked && competitionCheck.checked;
                card.classList.toggle('complete', isComplete);
                card.classList.toggle('partially-complete', isAuditedOnly);
                card.classList.toggle('competition-sent-only', isCompetitionOnly);
                
                // Update the progress counter for the group
                const groupDetails = card.closest('.task-group');
                updateTaskGroupState(groupDetails);
            }
        }
    });
}

function setupTaskPageInteractions() {
    const container = document.getElementById('task-list-container');
    if (!container) return;

    // 1. Search functionality
    const searchInput = document.getElementById('task-search-input');
    const clearBtn = document.getElementById('task-search-clear');

    if (searchInput) {
        const handleSearch = () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const allGroups = container.querySelectorAll('.task-group');

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
    const allGroups = container.querySelectorAll('.task-group');
    allGroups.forEach(group => {
        group.addEventListener('toggle', () => {
            const openGroups = Array.from(allGroups).filter(g => g.open).map(g => g.dataset.classification);
            localStorage.setItem('openTaskGroups', JSON.stringify(openGroups));
        });
    });

    // 3. Bulk actions
    container.addEventListener('change', async (e) => {
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
                    
                    const isComplete = card.querySelector('.audit-check').checked && card.querySelector('.competition-check').checked;
                    const isAuditedOnly = card.querySelector('.audit-check').checked && !card.querySelector('.competition-check').checked;
                    const isCompetitionOnly = !card.querySelector('.audit-check').checked && card.querySelector('.competition-check').checked;
                    card.classList.toggle('complete', isComplete);
                    card.classList.toggle('partially-complete', isAuditedOnly);
                    card.classList.toggle('competition-sent-only', isCompetitionOnly);
                });
                updateTaskGroupState(group);
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
        <div class="form-container" style="max-width: 800px;">
            <h1><i class="fas fa-user-plus"></i> إضافة وكيل جديد</h1>
            <form id="add-agent-form" class="profile-header-edit-form">
                <div class="profile-avatar-edit">
                    <img src="https://via.placeholder.com/80/8A2BE2/FFFFFF?text=inzo" alt="Avatar" id="avatar-preview">
                    <label for="avatar-upload" class="btn-secondary" style="cursor: pointer; width: 100%; justify-content: center;">
                        <i class="fas fa-upload"></i> تغيير الصورة
                    </label>
                    <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                </div>
                <div style="flex-grow: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group"><label for="agent-name">اسم الوكيل</label><input type="text" id="agent-name" required></div>
                    <div class="form-group"><label for="agent-id">رقم الوكالة</label><input type="text" id="agent-id" required></div>
                    <div class="form-group">
                        <label for="agent-classification">التصنيف</label>
                        <select id="agent-classification">
                            <option value="R">R</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="agent-rank">المرتبة</label>
                        <select id="agent-rank">
                            <option value="">-- اختر --</option>
                            <optgroup label="⁕ مراتب الوكالة الأعتيادية ⁖">
                                ${Object.keys(RANKS_DATA).slice(0, 4).map(rank => `<option value="${rank}">${rank}</option>`).join('')}
                            </optgroup>
                            <optgroup label="⁕ مراتب الوكالة الحصرية ⁖">
                                ${Object.keys(RANKS_DATA).slice(4).map(rank => `<option value="${rank}">${rank}</option>`).join('')}
                            </optgroup>
                        </select>
                    </div>
                    <div class="form-group"><label for="telegram-channel-url">رابط قناة التلجرام</label><input type="text" id="telegram-channel-url"></div>
                    <div class="form-group"><label for="telegram-group-url">رابط جروب التلجرام</label><input type="text" id="telegram-group-url"></div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label>أيام التدقيق</label>
                        <div class="days-selector">
                            ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((day, index) => `
                                <label class="day-checkbox"><input type="checkbox" value="${index}"> <span>${day}</span></label>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="form-actions" style="grid-column: 1 / -1; justify-content: flex-end; width: 100%; padding-top: 20px; border-top: 1px solid var(--border-color);">
                    <button type="submit" id="save-agent-btn" class="btn-primary">حفظ الوكيل</button>
                    <button type="button" id="cancel-add-agent" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;

    // Avatar preview logic
    const avatarUploadInput = document.getElementById('avatar-upload');
    const avatarPreview = document.getElementById('avatar-preview');
    avatarUploadInput.addEventListener('change', () => {
        const file = avatarUploadInput.files[0];
        if (file) {
            avatarPreview.src = URL.createObjectURL(file);
        }
    });

    const cancelButton = document.getElementById('cancel-add-agent');
    cancelButton.addEventListener('click', () => {
        const nameInput = document.getElementById('agent-name');
        const idInput = document.getElementById('agent-id');

        if (nameInput.value.trim() !== '' || idInput.value.trim() !== '') {
            showConfirmationModal(
                'لديك بيانات غير محفوظة. هل أنت متأكد من الإلغاء؟',
                () => {
                    window.location.hash = `#${returnPage}`;
                }, {
                    confirmText: 'نعم، قم بالإلغاء',
                    confirmClass: 'btn-danger'
                });
        } else {
            window.location.hash = `#${returnPage}`;
        }
    });

    document.getElementById('add-agent-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabase) return showToast('لا يمكن إضافة وكيل، لم يتم الاتصال بقاعدة البيانات.', 'error');

        const saveBtn = document.getElementById('save-agent-btn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        const selectedDays = Array.from(document.querySelectorAll('.days-selector input:checked')).map(input => parseInt(input.value, 10));
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
            competition_bonus: rankData.competition_bonus,
            deposit_bonus_percentage: rankData.deposit_bonus_percentage,
            deposit_bonus_count: rankData.deposit_bonus_count,
            remaining_balance: rankData.competition_bonus,
            remaining_deposit_bonus: rankData.deposit_bonus_count,
        };

        // Check for uniqueness of agent_id
        const { data: existingAgents, error: checkError } = await supabase
            .from('agents')
            .select('id')
            .eq('agent_id', newAgentData.agent_id);

        if (checkError) {
            console.error('Error checking for existing agent on create:', checkError);
            showToast('حدث خطأ أثناء التحقق من رقم الوكالة.', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'حفظ الوكيل';
            return;
        }

        if (existingAgents && existingAgents.length > 0) {
            showToast('رقم الوكالة هذا مستخدم بالفعل لوكيل آخر.', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'حفظ الوكيل';
            return;
        }

        // Insert agent data without avatar first to get an ID
        const { data: insertedAgent, error: insertError } = await supabase.from('agents').insert([newAgentData]).select().single();

        if (insertError) {
            console.error('Error adding agent:', insertError);
            showToast(`فشل إضافة الوكيل: ${insertError.message}`, 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'حفظ الوكيل';
            return;
        }

        // If an avatar was selected, upload it and update the agent record
        const avatarFile = document.getElementById('avatar-upload').files[0];
        if (avatarFile) {
            const filePath = `${insertedAgent.id}-${Date.now()}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, avatarFile);

            if (uploadError) {
                showToast('تم إنشاء الوكيل ولكن فشل رفع الصورة.', 'error');
                console.error('Avatar upload error:', uploadError);
            } else {
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                await supabase.from('agents').update({ avatar_url: urlData.publicUrl }).eq('id', insertedAgent.id);
            }
        }

        await logAgentActivity(insertedAgent.id, 'AGENT_CREATED', `تم إنشاء وكيل جديد: ${insertedAgent.name}.`);
        showToast('تمت إضافة الوكيل بنجاح!', 'success');
        // Use replace to avoid adding the 'add-agent' page to history
        const newUrl = window.location.pathname + window.location.search + `#profile/${insertedAgent.id}`;
        window.location.replace(newUrl);
    });
}