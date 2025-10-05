async function handleMarkAllTasksComplete() {
    try {
        const dayIndex = new Date().getDay();
        const container = document.getElementById('task-list-container');
        if (!container) return;

        // عرض تأكيد قبل التنفيذ
        showConfirmationModal('هل أنت متأكد من تمييز جميع المهام كمكتملة؟', async () => {
            showLoader();
            const allCards = container.querySelectorAll('.task-card');
            const promises = [];

            for (const card of allCards) {
                const agentId = card.dataset.agentId;
                if (!agentId) continue;

                // تحديث في السيرفر
                const promise = authedFetch('/api/tasks', {
                    method: 'POST',
                    body: JSON.stringify({
                        agentId: agentId,
                        taskType: 'audited',
                        status: true,
                        dayIndex: dayIndex
                    })
                });
                promises.push(promise);

                // تحديث في taskStore
                window.taskStore.updateTaskStatus(agentId, dayIndex, 'audited', true);
            }

            try {
                await Promise.all(promises);
                showToast('تم تحديث جميع المهام بنجاح', 'success');
            } catch (error) {
                console.error('Error updating all tasks:', error);
                showToast('حدث خطأ أثناء تحديث بعض المهام', 'error');
            } finally {
                hideLoader();
                await renderTaskList(); // تحديث واجهة المستخدم
            }
        });
    } catch (error) {
        console.error('Error in handleMarkAllTasksComplete:', error);
        showToast('حدث خطأ أثناء تحديث المهام', 'error');
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

async function renderTaskList() {
    const wrapper = document.getElementById('tasks-content-wrapper');
    if (!wrapper) return;

    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const highlightedAgentId = urlParams.get('highlight');

    // --- FIX: Do not attempt to fetch tasks on Saturday (day 6) ---
    if (new Date().getDay() === 6) {
        wrapper.innerHTML = '<p class="no-results-message" style="margin-top: 20px;">لا توجد مهام مجدولة في أيام العطلات.</p>';
        return;
    }

    const response = await authedFetch('/api/tasks/today');
    if (!response.ok) {
        wrapper.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات المهام.</p>`;
        return;
    }
    const { agents: filteredAgents, tasksMap } = await response.json();

    const classifications = ['R', 'A', 'B', 'C'];
    const openGroups = JSON.parse(localStorage.getItem('openTaskGroups')) || ['R', 'A'];
    const groupedAgents = classifications.reduce((acc, classification) => {
        acc[classification] = (filteredAgents || []).filter(a => a.classification === classification);
        return acc;
    }, {});

    // --- Create Overview Section ---
    const totalAgentsToday = filteredAgents.length;
    const completedAgentsToday = filteredAgents.filter(agent => {
        const task = tasksMap[agent._id] || {};
        return task.audited; // Completion is based on audit only
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
                    const task = tasksMap[agent._id] || {};
                    if (task.audited) { // Progress is based on audit only
                        completedCount++;
                    } else {
                        allTasksInGroupComplete = false;
                    }
                });

                const groupContainsHighlight = highlightedAgentId && group.some(agent => agent._id == highlightedAgentId);
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
                            const task = tasksMap[agent._id] || {};
                            const avatarHtml = agent.avatar_url
                                ? `<img src="${agent.avatar_url}" alt="Avatar" class="task-agent-avatar" loading="lazy">`
                                : `<div class="task-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;
                            const isAudited = task.audited;
                            const isCompetitionSent = task.competition_sent;
                            const isComplete = isAudited; // Visual completion now only requires audit
                            const isHighlighted = highlightedAgentId && agent._id == highlightedAgentId;
                            const depositBonusText = (agent.remaining_deposit_bonus > 0 && agent.deposit_bonus_percentage > 0)
                                ? `${agent.remaining_deposit_bonus} ${agent.remaining_deposit_bonus === 1 ? 'مرة' : 'مرات'} بنسبة ${agent.deposit_bonus_percentage}%`
                                : 'لا يوجد';

                            return `
                            <div class="task-card ${isComplete ? 'complete' : ''} ${isHighlighted ? 'highlighted' : ''}" data-agent-id="${agent._id}" data-name="${agent.name.toLowerCase()}" data-original-name="${agent.name}" data-agentid-str="${agent.agent_id}">
                                <div class="task-card-header" style="cursor: pointer;">
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
                                            <input type="checkbox" class="audit-check" data-agent-id="${agent._id}" ${isAudited ? 'checked' : ''}>
                                            <span class="slider round"></span>
                                        </label>
                                    </div>
                                    <div class="action-item ${isCompetitionSent ? 'done' : ''}">
                                        <label>المسابقة</label>
                                        <label class="custom-checkbox toggle-switch">
                                            <input type="checkbox" class="competition-check" data-agent-id="${agent._id}" ${isCompetitionSent ? 'checked' : ''}>
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

    // --- FIX: Use event delegation for card header clicks ---
    container.addEventListener('click', (e) => {
        const cardHeader = e.target.closest('.task-card-header');
        if (cardHeader) {
            const agentId = cardHeader.closest('.task-card').dataset.agentId;
            window.location.hash = `#profile/${agentId}`;
        }
    });
    container.addEventListener('change', async (e) => {
        if (e.target.matches('.audit-check, .competition-check')) {
            const checkbox = e.target;
            const card = checkbox.closest('.task-card');
            const agentId = checkbox.dataset.agentId;
            const isAuditedCheckbox = checkbox.classList.contains('audit-check');
            const isChecked = checkbox.checked;
            
            // Disable checkbox to prevent rapid clicks
            checkbox.disabled = true;

            // The backend controller at /api/tasks is designed to handle this payload format
            // It correctly determines the date on the server side.
            const dayIndex = new Date().getDay(); // Get today's day index
            const taskType = isAuditedCheckbox ? 'audited' : 'competition_sent';
            
            // تحديث السيرفر
            const response = await authedFetch('/api/tasks', {
                method: 'POST',
                body: JSON.stringify({ 
                    agentId: agentId,
                    taskType: taskType,
                    status: isChecked,
                    dayIndex: dayIndex
                })
            });
            
            // تحديث taskStore للتزامن مع التقويم
            window.taskStore.updateTaskStatus(agentId, dayIndex, taskType, isChecked);

            if (!response.ok) {
                const result = await response.json();
                console.error('Error updating agent status:', result.message);
                showToast('فشل تحديث حالة الوكيل.', 'error');
                checkbox.checked = !isChecked; // Revert UI on error
                checkbox.disabled = false; // Re-enable on error
            } else {
                // Update UI on success
                const auditCheck = card.querySelector('.audit-check');
                const competitionCheck = card.querySelector('.competition-check');
                
                auditCheck.closest('.action-item').classList.toggle('done', auditCheck.checked);
                competitionCheck.closest('.action-item').classList.toggle('done', competitionCheck.checked);

                const isComplete = auditCheck.checked; // Visual completion now only requires audit
                card.classList.toggle('complete', isComplete);

                // NEW: Update the checkmark icon next to the name instantly
                const nameEl = card.querySelector('.task-agent-info h3');
                const originalName = card.dataset.originalName;
                const iconHtml = isComplete ? ' <i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : '';
                nameEl.innerHTML = `${originalName}${iconHtml}`;

                
                // Update the progress counter for the group
                const groupDetails = card.closest('.task-group');
                updateUIAfterTaskChange(card);

                // --- FIX: Update the central store only AFTER a successful backend update ---
                const dayIndex = new Date().getUTCDay();
                window.taskStore.updateTaskStatus(agentId, dayIndex, isAuditedCheckbox ? 'audited' : 'competition_sent', isChecked);

                checkbox.disabled = false; // Re-enable after success
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
            const agentIds = Array.from(cards).map(card => card.dataset.agentId);
            const updateField = isBulkAudit ? 'audited' : 'competition_sent';

            // --- تعديل: استخدام الواجهة الخلفية الجديدة لتحديث المهام بشكل جماعي ---
            const response = await authedFetch('/api/tasks/bulk-update', {
                method: 'POST',
                body: JSON.stringify({ agentIds, date: todayStr, field: updateField, value: isChecked })
            });

            if (!response.ok) {
                const result = await response.json();
                console.error('Bulk update error:', result.message);
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
                    // FIX: Visual completion now only requires audit
                    const isComplete = auditCheck.checked; // Completion is based on audit only
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

/**
 * NEW: Updates the tasks UI based on the current state from the taskStore.
 * This function is called by the store's subscription mechanism.
 * @param {object} state The latest state from taskStore.
 */
function updateTasksUIFromState(state) {
    const container = document.getElementById('task-list-container');
    if (!container) return; // Only run if the tasks page is active

    const allCards = container.querySelectorAll('.task-card');    const dayIndex = new Date().getUTCDay(); // --- FIX: Use getUTCDay for consistency ---
    allCards.forEach(card => {
        const agentId = card.dataset.agentId;
        const taskState = state.tasks[agentId]?.[dayIndex] || { audited: false, competition_sent: false };

        const auditCheck = card.querySelector('.audit-check');
        const competitionCheck = card.querySelector('.competition-check');

        // Update checkbox state without triggering a 'change' event
        if (auditCheck) auditCheck.checked = taskState.audited;
        if (competitionCheck) competitionCheck.checked = taskState.competition_sent;

        // Update visual styles
        auditCheck?.closest('.action-item').classList.toggle('done', taskState.audited);
        competitionCheck?.closest('.action-item').classList.toggle('done', taskState.competition_sent);

        const isComplete = taskState.audited; // Completion is based on audit only
        card.classList.toggle('complete', isComplete);

        // Update the checkmark icon next to the name
        const nameEl = card.querySelector('.task-agent-info h3');
        const originalName = card.dataset.originalName;
        const iconHtml = isComplete ? ' <i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : '';
        if (nameEl) nameEl.innerHTML = `${originalName}${iconHtml}`;
    });
    
    // --- FIX: After updating cards, also update the group state (progress and completion status) ---
    const allGroups = container.querySelectorAll('.task-group');
    allGroups.forEach(group => {
        updateTaskGroupState(group);
    });

    updateOverallProgress();
}

/**
 * NEW: Centralized function to update all relevant UI parts after a task change.
 * This avoids making extra network requests to the backend.
 * @param {HTMLElement} changedCard The card element that was just updated.
 */
function updateUIAfterTaskChange(changedCard) {
    if (!changedCard) return;

    // 1. Update the group this card belongs to
    const groupDetails = changedCard.closest('.task-group');
    updateTaskGroupState(groupDetails);

    // 2. Update the overall progress stats at the top of the page
    updateOverallProgress();
}

async function updateOverallProgress() {
    const overviewContainer = document.getElementById('tasks-overview');
    if (!overviewContainer) return;
    
    // --- FIX: Calculate stats from the DOM to avoid network requests ---
    const allCards = document.querySelectorAll('#task-list-container .task-card');
    const total = allCards.length;
    const completed = document.querySelectorAll('#task-list-container .task-card.complete').length;
    const overallProgress = total > 0 ? (completed / total) * 100 : 0;

    const donutChart = overviewContainer.querySelector('.progress-donut-chart');
    const totalEl = overviewContainer.querySelector('[data-stat="total"]');
    const completedEl = overviewContainer.querySelector('[data-stat="completed"]');
    const pendingEl = overviewContainer.querySelector('[data-stat="pending"]');
    
    if (donutChart) {
        donutChart.style.setProperty('--p', overallProgress);
        donutChart.querySelector('span').textContent = `${Math.round(overallProgress)}%`;
    }
    if (totalEl) totalEl.textContent = total;
    if (completedEl) completedEl.textContent = completed;
    if (pendingEl) pendingEl.textContent = total - completed;
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