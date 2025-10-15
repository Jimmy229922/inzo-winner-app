(function() {
    class TasksPage {
        constructor(container) {
            this.container = container;
            this.tasksState = { tasks: {} };
            this.boundHandleClick = this.handleClick.bind(this);
            this.boundHandleChange = this.handleChange.bind(this);

            // The router in main.js will set window.currentTasksPageInstance
            // The subscription should pass the instance's method directly.
            if (window.taskStore && typeof window.taskStore.subscribe === 'function') {
                this.unsubscribe = window.taskStore.subscribe(this.updateUI.bind(this));
            }
            console.log('[Tasks Page] Instance created and subscribed to taskStore.');
        }

        async render() {
            this.container.innerHTML = `
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
            
            await this.renderTaskList();
            this.setupEventListeners();
        }

        async renderTaskList() {
            const wrapper = this.container.querySelector('#tasks-content-wrapper');
            if (!wrapper) return;

            const hash = window.location.hash;
            const urlParams = new URLSearchParams(hash.split('?')[1]);
            const highlightedAgentId = urlParams.get('highlight');

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

            const totalAgentsToday = filteredAgents.length;
            const completedAgentsToday = filteredAgents.filter(agent => {
                const task = tasksMap[agent._id] || {}; // Use server-fetched tasksMap
                return task.audited;
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
                            const task = tasksMap[agent._id] || {}; // Use server-fetched tasksMap
                            if (task.audited) {
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
                                    const task = tasksMap[agent._id] || { audited: false, competition_sent: false }; // Use server-fetched tasksMap
                                    const avatarHtml = agent.avatar_url
                                        ? `<img src="${agent.avatar_url}" alt="Avatar" class="task-agent-avatar" loading="lazy">`
                                        : `<div class="task-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;
                                    const isAudited = task.audited;
                                    const isCompetitionSent = task.competition_sent;
                                    const isComplete = isAudited;
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
                                                    <h3 class="${isComplete ? 'has-checkmark' : ''}">${agent.name}<i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i></h3>
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

            this.setupTaskPageInteractions();

            if (highlightedAgentId) {
                const container = document.getElementById('task-list-container');
                const highlightedCard = container.querySelector(`.task-card[data-agent-id="${highlightedAgentId}"]`);
                if (highlightedCard) {
                    highlightedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                history.replaceState(null, '', '#tasks');
            }
        }

        destroy() {
            console.log('[Tasks Page] Destroying instance and cleaning up listeners.');
            this.container.removeEventListener('click', this.boundHandleClick);
            this.container.removeEventListener('change', this.boundHandleChange);
            if (this.unsubscribe) {
                this.unsubscribe();
            }
            window.currentTasksPageInstance = null;
        }

        async handleMarkAllTasksComplete() {
            try {
                const dayIndex = new Date().getDay();
                const container = document.getElementById('task-list-container');
                if (!container) return;

                showConfirmationModal('هل أنت متأكد من تمييز جميع المهام كمكتملة؟', async () => {
                    showLoader();
                    const allCards = container.querySelectorAll('.task-card');
                    const promises = [];

                    for (const card of allCards) {
                        const agentId = card.dataset.agentId;
                        if (!agentId) continue;

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
                        await this.renderTaskList();
                    }
                });
            } catch (error) {
                console.error('Error in handleMarkAllTasksComplete:', error);
                showToast('حدث خطأ أثناء تحديث المهام', 'error');
            }
        }

        setupEventListeners() {
            this.container.addEventListener('click', this.boundHandleClick);
            this.container.addEventListener('change', this.boundHandleChange);

            const markAllCompleteBtn = document.getElementById('mark-all-tasks-complete-btn');
            if (markAllCompleteBtn) {
                markAllCompleteBtn.addEventListener('click', () => this.handleMarkAllTasksComplete());
            }
        }

        handleClick(e) {
            const cardHeader = e.target.closest('.task-card-header');
            if (cardHeader) {
                const agentId = cardHeader.closest('.task-card').dataset.agentId;
                window.location.hash = `#profile/${agentId}`;
            }
        }

        handleChange(e) {
            const auditCheck = e.target.closest('.audit-check');
            const competitionCheck = e.target.closest('.competition-check');
            if (!auditCheck && !competitionCheck) return;

            const agentId = e.target.dataset.agentId;
            const dayIndex = new Date().getDay();

            if (auditCheck) {
                const isChecked = auditCheck.checked;
                window.taskStore.updateTaskStatus(agentId, dayIndex, 'audited', isChecked);
            }

            if (competitionCheck) {
                const isChecked = competitionCheck.checked;
                window.taskStore.updateTaskStatus(agentId, dayIndex, 'competition_sent', isChecked);
            }
        }

        updateUI(state) {
            // --- REFACTOR: Instead of a full re-render, perform a "light" update on the UI.
            // This is more efficient and prevents losing UI state like scroll position or search filters.
            // It also ensures immediate feedback from changes made on other pages (like Calendar or Profile).
            this.tasksState = state;
            const taskList = this.container.querySelector('#task-list-container');
            if (!taskList) { // If the list isn't rendered yet, do nothing. The initial render will handle it.
                return;
            }

            const todayDayIndex = new Date().getDay();
            const allCards = taskList.querySelectorAll('.task-card');

            allCards.forEach(card => {
                const agentId = card.dataset.agentId;
                // Use the new state from the store to get the most up-to-date task status
                const taskState = ((this.tasksState.tasks || {})[agentId] || {})[todayDayIndex] || { audited: false, competition_sent: false };

                const auditCheck = card.querySelector('.audit-check');
                const competitionCheck = card.querySelector('.competition-check');

                if (auditCheck) auditCheck.checked = taskState.audited;
                if (competitionCheck) competitionCheck.checked = taskState.competition_sent;

                // Toggle the 'done' class on the parent container for styling
                auditCheck?.closest('.action-item').classList.toggle('done', taskState.audited);
                competitionCheck?.closest('.action-item').classList.toggle('done', taskState.competition_sent);

                // The main task is complete if it's audited
                const isComplete = taskState.audited;
                card.classList.toggle('complete', isComplete);

                const nameEl = card.querySelector('.task-agent-info h3');
                if (nameEl) nameEl.classList.toggle('has-checkmark', isComplete);
            });

            // After updating individual cards, update the group-level progress and state
            const allGroups = taskList.querySelectorAll('.task-group');
            allGroups.forEach(group => {
                updateTaskGroupState(group);
            });

            // Finally, update the overall progress donut chart and stats
            updateOverallProgress();
        }

        setupTaskPageInteractions() {
            const container = this.container.querySelector('#tasks-content-wrapper');
            if (!container) return;

            const allGroups = container.querySelectorAll('.task-group');
            allGroups.forEach(group => {
                group.addEventListener('toggle', () => {
                    const openGroups = Array.from(allGroups).filter(g => g.open).map(g => g.dataset.classification);
                    localStorage.setItem('openTaskGroups', JSON.stringify(openGroups));
                });
            });
        }
    }

    window.TasksPage = TasksPage;

    function updateTaskGroupState(groupDetailsElement) {
        if (!groupDetailsElement) return;
        const progressSpan = groupDetailsElement.querySelector('.task-group-progress');
        const cards = groupDetailsElement.querySelectorAll('.task-card');
        const total = cards.length;
        let completed = 0;
        cards.forEach(card => {
            const auditCheck = card.querySelector('.audit-check');
            if (auditCheck?.checked) {
                completed++;
            }
        });
        progressSpan.textContent = `${completed} / ${total}`;

        const allComplete = total > 0 && completed === total;
        groupDetailsElement.classList.toggle('all-complete', allComplete);
    }

    async function updateOverallProgress() {
        const overviewContainer = document.getElementById('tasks-overview');
        if (!overviewContainer) return;

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
})();