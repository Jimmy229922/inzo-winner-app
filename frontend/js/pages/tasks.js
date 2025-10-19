// Refactored Tasks Page: Decoupled from Calendar, reliant solely on taskStore.
(function() {
    // --- Constants and Configuration ---
    const CLASSIFICATIONS = ['R', 'A', 'B', 'C'];
    const OPEN_GROUPS_KEY = 'openTaskGroups';

    // --- UI Rendering Functions ---

    function getTaskCardHtml(agent, task) {
        const avatarHtml = agent.avatar_url
            ? `<img src="${agent.avatar_url}" alt="Avatar" class="task-agent-avatar" loading="lazy">`
            : `<div class="task-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;

        const isAudited = task.audited;
        const isCompetitionSent = task.competition_sent;
        const isComplete = isAudited; // Main completion logic

        const depositBonusText = (agent.remaining_deposit_bonus > 0 && agent.deposit_bonus_percentage > 0)
            ? `${agent.remaining_deposit_bonus} ${agent.remaining_deposit_bonus === 1 ? 'مرة' : 'مرات'} بنسبة ${agent.deposit_bonus_percentage}%`
            : 'لا يوجد';

        return `
        <div class="task-card ${isComplete ? 'complete' : ''}" data-agent-id="${agent._id}" data-name="${agent.name.toLowerCase()}" data-original-name="${agent.name}" data-agentid-str="${agent.agent_id}">
            <div class="task-card-header" style="cursor: pointer;">
                <div class="task-card-main">
                    ${avatarHtml}
                    <div class="task-agent-info">
                        <h3 class="${isComplete ? 'has-checkmark' : ''}">${agent.name}<i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i></h3>
                        <p class="task-agent-id" title="نسخ الرقم">${agent.agent_id}</p>
                    </div>
                </div>
                <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
            </div>
            <div class="task-card-body">
                <div class="task-stat">
                    <label>الرصيد التداولي:</label>
                    <span>${agent.remaining_balance || 0}</span>
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
                <div class="action-item ${isAudited && isCompetitionSent ? 'done' : ''}">
                    <label>المسابقة</label>
                    <label class="custom-checkbox toggle-switch">
                        <input type="checkbox" class="competition-check" data-agent-id="${agent._id}" ${isCompetitionSent ? 'checked' : ''} ${!isAudited ? 'disabled' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
        </div>`;
    }

    function getTaskGroupHtml(classification, agents, tasksMap, openGroups, highlightedAgentId) {
        if (agents.length === 0) return '';

        const completedCount = agents.filter(agent => (tasksMap[agent._id] || {}).audited).length;
        const allComplete = completedCount === agents.length;
        const containsHighlight = highlightedAgentId && agents.some(agent => agent._id == highlightedAgentId);
        const isOpen = openGroups.includes(classification) || containsHighlight;

        const agentCardsHtml = agents.map(agent => getTaskCardHtml(agent, tasksMap[agent._id] || {})).join('');

        return `
        <details class="task-group ${allComplete ? 'all-complete' : ''}" data-classification="${classification}" ${isOpen ? 'open' : ''}>
            <summary class="task-group-header">
                <div class="task-group-title">
                    <h2>${classification}</h2>
                    <span class="task-group-progress">${completedCount} / ${agents.length}</span>
                </div>
                <div class="task-group-bulk-actions">
                    <label class="custom-checkbox small"><input type="checkbox" class="bulk-audit-check" data-classification="${classification}">
                        <span class="checkmark"></span> تدقيق الكل
                    </label>
                    <label class="custom-checkbox small"><input type="checkbox" class="bulk-competition-check" data-classification="${classification}">
                        <span class="checkmark"></span> مسابقة الكل
                    </label>
                </div>
                <div class="task-group-indicators">
                    <i class="fas fa-check-circle group-completion-indicator" title="اكتملت جميع المهام في هذا القسم"></i>
                    <i class="fas fa-chevron-down"></i>
                </div>
            </summary>
            <div class="task-group-content">${agentCardsHtml}</div>
        </details>`;
    }

    function getPageLayoutHtml() {
        return `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>مهمات اليوم</h1>
                <div class="header-actions-group">
                    <button id="mark-all-audited-btn" class="btn-primary">
                        <i class="fas fa-check-double"></i> تمييز الكل كـ "تم التدقيق"
                    </button>
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
        <div id="tasks-content-wrapper"></div>`;
    }

    function getOverviewHtml(agents, tasksMap) {
        const total = agents.length;
        const completed = agents.filter(agent => (tasksMap[agent._id] || {}).audited).length;
        const progress = total > 0 ? (completed / total) * 100 : 0;

        return `
        <div class="tasks-overview" id="tasks-overview">
            <div class="progress-donut-chart" style="--p:${progress};--b:10px;--c:var(--primary-color);">
                <span>${Math.round(progress)}%</span>
            </div>
            <div class="overview-stats">
                <div class="overview-stat-item" data-stat="total">
                    <h3>${total}</h3>
                    <p><i class="fas fa-tasks"></i> إجمالي مهام اليوم</p>
                </div>
                <div class="overview-stat-item" data-stat="completed">
                    <h3>${completed}</h3>
                    <p><i class="fas fa-check-double"></i> مهام مكتملة</p>
                </div>
                <div class="overview-stat-item" data-stat="pending">
                    <h3>${total - completed}</h3>
                    <p><i class="fas fa-hourglass-half"></i> مهام متبقية</p>
                </div>
            </div>
        </div>`;
    }


    // --- Main Page Class ---

    class TasksPage {
        constructor(container) {
            this.container = container;
            this.agents = [];
            this.tasksMap = {};
            this.dayIndex = new Date().getDay();
            this.searchDebounceTimer = null;

            // Bind methods
            this.boundHandleEvents = this.handleEvents.bind(this);
        }

        async render() {
            this.container.innerHTML = getPageLayoutHtml();
            this.contentWrapper = this.container.querySelector('#tasks-content-wrapper');
            
            this.setupEventListeners();
            
            // FIX: Subscription removed to prevent buggy global UI updates.
            // window.taskStore.subscribe(this.boundUpdateUIFromStore);

            await this.fetchAndRenderTasks();
        }

        async fetchAndRenderTasks() {
            if (this.dayIndex === 6) { // Saturday
                this.contentWrapper.innerHTML = '<p class="no-results-message">لا توجد مهام مجدولة في أيام العطلات.</p>';
                return;
            }

            try {
                const response = await authedFetch('/api/tasks/today');
                if (!response.ok) throw new Error('Failed to fetch tasks');
                
                const { agents, tasksMap } = await response.json();
                this.agents = agents || [];
                this.tasksMap = tasksMap || {};

                this.renderAllContent();

            } catch (error) {
                console.error("Error fetching tasks:", error);
                this.contentWrapper.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات المهام.</p>`;
            }
        }

        renderAllContent() {
            if (this.agents.length === 0) {
                this.contentWrapper.innerHTML = '<p class="no-results-message">لا توجد مهام مجدولة لهذا اليوم.</p>';
                return;
            }

            const groupedAgents = CLASSIFICATIONS.reduce((acc, c) => {
                acc[c] = this.agents.filter(a => a.classification === c);
                return acc;
            }, {});

            const openGroups = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY)) || ['R', 'A'];
            const highlightedAgentId = new URLSearchParams(window.location.hash.split('?')[1]).get('highlight');

            const overviewHtml = getOverviewHtml(this.agents, this.tasksMap);
            const groupsHtml = CLASSIFICATIONS.map(c => 
                getTaskGroupHtml(c, groupedAgents[c], this.tasksMap, openGroups, highlightedAgentId)
            ).join('');

            this.contentWrapper.innerHTML = `${overviewHtml}<div id="task-list-container">${groupsHtml}</div>`;
            
            this.highlightCard(highlightedAgentId);
        }

        highlightCard(agentId) {
            if (!agentId) return;
            const card = this.contentWrapper.querySelector(`.task-card[data-agent-id="${agentId}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('highlighted');
            }
            // Clean the URL
            history.replaceState(null, '', '#tasks');
        }

        setupEventListeners() {
            this.container.addEventListener('click', this.boundHandleEvents);
            this.container.addEventListener('change', this.boundHandleEvents);
            
            const searchInput = this.container.querySelector('#task-search-input');
            searchInput.addEventListener('input', () => {
                clearTimeout(this.searchDebounceTimer);
                this.searchDebounceTimer = setTimeout(() => this.filterAgents(searchInput.value), 300);
            });
            
            this.container.querySelector('#task-search-clear').addEventListener('click', () => {
                searchInput.value = '';
                this.filterAgents('');
            });
        }

        async handleEvents(e) {
            const target = e.target;
            const agentCard = target.closest('.task-card');
            const agentId = agentCard?.dataset.agentId;

            // --- Change Events (Toggles) ---
            if (e.type === 'change') {
                const taskType = target.classList.contains('audit-check') ? 'audited' 
                               : target.classList.contains('competition-check') ? 'competition_sent' 
                               : null;
                if (agentId && taskType) {
                    agentCard.classList.add('is-loading');
                    agentCard.querySelectorAll('input').forEach(i => i.disabled = true);
                    try {
                        await window.taskStore.updateTaskStatus(agentId, this.dayIndex, taskType, target.checked);
                        this.updateSingleCard(agentId); // FIX: Targeted UI update
                    } catch (error) {
                        console.error('Failed to update task', error);
                        showToast('فشل تحديث المهمة.', 'error');
                        target.checked = !target.checked; // Revert on error
                    } finally {
                        agentCard.classList.remove('is-loading');
                        // Re-enable controls, considering dependencies
                        const isAudited = agentCard.querySelector('.audit-check').checked;
                        agentCard.querySelector('.audit-check').disabled = false;
                        const compCheck = agentCard.querySelector('.competition-check');
                        if(compCheck) compCheck.disabled = !isAudited;
                    }
                    return;
                }

                const bulkTaskType = target.classList.contains('bulk-audit-check') ? 'audited' 
                                   : target.classList.contains('bulk-competition-check') ? 'competition_sent' 
                                   : null;
                if (bulkTaskType) {
                    this.handleBulkUpdate(target.dataset.classification, bulkTaskType, target.checked);
                    return;
                }
            }

            // --- Click Events ---
            if (e.type === 'click') {
                if (target.closest('.task-card-header')) {
                    window.location.hash = `#profile/${agentId}`;
                    return;
                }
                if (target.id === 'mark-all-audited-btn') {
                    this.handleMarkAllAudited();
                    return;
                }
                if (target.closest('.task-group-header')) {
                    this.saveOpenGroupsState();
                    return;
                }
            }
        }

        handleBulkUpdate(classification, taskType, status) {
            showLoader();
            const agentsToUpdate = this.agents.filter(a => a.classification === classification);
            const promises = agentsToUpdate.map(agent => 
                window.taskStore.updateTaskStatus(agent._id, this.dayIndex, taskType, status)
            );

            Promise.all(promises)
                .then(() => {
                    showToast(`تم تحديث ${agentsToUpdate.length} وكلاء بنجاح.`, 'success');
                    this.fetchAndRenderTasks(); // FIX: Refresh UI after bulk update
                })
                .catch(err => {
                    console.error('Bulk update failed:', err);
                    showToast('فشل تحديث بعض الوكلاء.', 'error');
                })
                .finally(hideLoader);
        }

        handleMarkAllAudited() {
            showConfirmationModal('هل أنت متأكد من تمييز جميع المهام كـ "تم التدقيق"؟', () => {
                showLoader();
                const promises = this.agents.map(agent => 
                    window.taskStore.updateTaskStatus(agent._id, this.dayIndex, 'audited', true)
                );

                Promise.all(promises)
                    .then(() => {
                        showToast('تم تحديث جميع المهام بنجاح.', 'success');
                        this.fetchAndRenderTasks(); // FIX: Refresh UI after bulk update
                    })
                    .catch(err => {
                        console.error('Mark all audited failed:', err);
                        showToast('فشل تحديث بعض المهام.', 'error');
                    })
                    .finally(hideLoader);
            });
        }
        
        filterAgents(searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            const taskListContainer = this.container.querySelector('#task-list-container');
            if (!taskListContainer) return;

            this.agents.forEach(agent => {
                const card = taskListContainer.querySelector(`.task-card[data-agent-id="${agent._id}"]`);
                if (!card) return;

                const isVisible = term === '' || 
                                  agent.name.toLowerCase().includes(term) || 
                                  agent.agent_id.includes(term);
                card.style.display = isVisible ? '' : 'none';
            });

            // Update group visibility and progress
            CLASSIFICATIONS.forEach(c => {
                const groupEl = taskListContainer.querySelector(`.task-group[data-classification="${c}"]`);
                if (!groupEl) return;

                const visibleCards = groupEl.querySelectorAll('.task-card[style=""]');
                groupEl.style.display = visibleCards.length > 0 ? '' : 'none';
            });
        }

        saveOpenGroupsState() {
            const openGroups = Array.from(this.container.querySelectorAll('.task-group[open]'))
                                    .map(el => el.dataset.classification);
            localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(openGroups));
        }

        updateSingleCard(agentId) {
            this.tasksMap = window.taskStore.state.tasks || {}; // Refresh state
            const card = this.container.querySelector(`.task-card[data-agent-id="${agentId}"]`);
            if (!card) return;

            const task = (this.tasksMap[agentId] || {})[this.dayIndex] || {};
            const isAudited = task.audited;
            const isCompetitionSent = task.competition_sent;
            const isComplete = isAudited;

            card.classList.toggle('complete', isComplete);
            card.querySelector('.task-agent-info h3').classList.toggle('has-checkmark', isComplete);
            
            const auditCheck = card.querySelector('.audit-check');
            const competitionCheck = card.querySelector('.competition-check');
            if (auditCheck) auditCheck.checked = isAudited;
            if (competitionCheck) {
                competitionCheck.checked = isCompetitionSent;
                competitionCheck.disabled = !isAudited;
            }

            auditCheck?.closest('.action-item').classList.toggle('done', isAudited);
            competitionCheck?.closest('.action-item').classList.toggle('done', isAudited && isCompetitionSent);

            // Update group and overview stats since a card changed
            this.updateAllGroupProgress();
            this.updateOverview();
        }

        updateAllGroupProgress() {
            CLASSIFICATIONS.forEach(c => {
                const groupEl = this.container.querySelector(`.task-group[data-classification="${c}"]`);
                if (!groupEl) return;

                const groupAgents = this.agents.filter(a => a.classification === c);
                const completedCount = groupAgents.filter(a => (this.tasksMap[a._id] || {})[this.dayIndex]?.audited).length;
                
                groupEl.querySelector('.task-group-progress').textContent = `${completedCount} / ${groupAgents.length}`;
                groupEl.classList.toggle('all-complete', completedCount === groupAgents.length);
            });
        }

        updateOverview() {
            const overviewEl = this.container.querySelector('#tasks-overview');
            if (!overviewEl) return;

            const total = this.agents.length;
            const completed = this.agents.filter(a => (this.tasksMap[a._id] || {})[this.dayIndex]?.audited).length;
            const progress = total > 0 ? (completed / total) * 100 : 0;

            overviewEl.querySelector('.progress-donut-chart').style.setProperty('--p', progress);
            overviewEl.querySelector('.progress-donut-chart span').textContent = `${Math.round(progress)}%`;
            overviewEl.querySelector('[data-stat="total"] h3').textContent = total;
            overviewEl.querySelector('[data-stat="completed"] h3').textContent = completed;
            overviewEl.querySelector('[data-stat="pending"] h3').textContent = total - completed;
        }

        destroy() {
            console.log('[Tasks Page] Destroying instance and cleaning up listeners.');
            this.container.removeEventListener('click', this.boundHandleEvents);
            this.container.removeEventListener('change', this.boundHandleEvents);
            clearTimeout(this.searchDebounceTimer);
            
            // FIX: Subscription removed
            if (window.taskStore && this.boundUpdateUIFromStore) {
                window.taskStore.unsubscribe(this.boundUpdateUIFromStore);
            }
        }
    }

    window.TasksPage = TasksPage;
})();