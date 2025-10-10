const ITEM_HEIGHT = 140; // 130px height + 10px margin-bottom
const BUFFER_ITEMS = 5; // Render items above and below the viewport for smoother scrolling

/**
 * Applies or removes search term highlighting from an agent item element.
 * @param {HTMLElement} element The agent item element.
 * @param {string} searchTerm The search term to highlight.
 */
function applyHighlight(element, searchTerm) {
    const nameEl = element.querySelector('.agent-name');
    const idEl = element.querySelector('.calendar-agent-id');
    const originalName = element.dataset.name;
    const originalId = '#' + element.dataset.agentidStr;

    const regex = searchTerm ? new RegExp(searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi') : null;

    nameEl.innerHTML = searchTerm ? originalName.replace(regex, '<mark>$&</mark>') : originalName;
    idEl.innerHTML = searchTerm ? originalId.replace(regex, '<mark>$&</mark>') : originalId;
}

function createAgentItemHtml(agent, dayIndex, isToday, tasksState, number, searchTerm = '') {
    // Read state directly from the centralized store's state
    const agentTasks = tasksState.tasks[agent._id] || {};
    const task = agentTasks[dayIndex] || { audited: false, competition_sent: false };

    const isComplete = task.audited; // Visual completion now only requires audit
    const avatarHtml = agent.avatar_url
        ? `<img src="${agent.avatar_url}" alt="Avatar" class="calendar-agent-avatar" loading="lazy">`
        : `<div class="calendar-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;

    // --- إضافة: التحقق من صلاحية السوبر أدمن لتفعيل السحب والإفلات ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const draggableAttribute = isSuperAdmin ? 'draggable="true"' : '';
    const cursorStyle = isSuperAdmin ? 'cursor: grab;' : 'cursor: pointer;';

    const element = document.createElement('div');
    element.className = `calendar-agent-item ${isComplete ? 'complete' : ''}`;
    element.dataset.agentId = agent._id;
    element.dataset.classification = agent.classification;
    element.dataset.name = agent.name;
    element.dataset.agentidStr = agent.agent_id;
    element.dataset.dayIndex = dayIndex;
    element.style.cssText = cursorStyle;
    if (isSuperAdmin) element.setAttribute('draggable', 'true');

    element.innerHTML = `
        <div class="calendar-agent-number">${number}</div>
        <div class="calendar-agent-main">
            ${avatarHtml}
            <div class="calendar-agent-info">
                <span class="agent-name"></span>
                <div class="agent-meta">
                    <p class="calendar-agent-id" title="نسخ الرقم" data-agent-id-copy="${agent.agent_id}"></p>
                    <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                </div>
            </div>
        </div>
        <div class="calendar-agent-actions">
            <div class="action-item ${task.audited ? 'done' : ''}">
                <label>التدقيق</label>
                <label class="custom-checkbox toggle-switch">
                    <input type="checkbox" class="audit-check" data-agent-id="${agent._id}" data-day-index="${dayIndex}" ${task.audited ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>
            <div class="action-item ${task.competition_sent ? 'done' : ''}">
                <label>المسابقة</label>
                <label class="custom-checkbox toggle-switch">
                    <input type="checkbox" class="competition-check" data-agent-id="${agent._id}" data-day-index="${dayIndex}" ${task.competition_sent ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>
        </div>
    `;

    applyHighlight(element, searchTerm);

    // Add checkmark icon separately for easier toggling
    const nameEl = element.querySelector('.agent-name');
    nameEl.insertAdjacentHTML('beforeend', '<i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>');
    nameEl.classList.toggle('has-checkmark', isComplete);

    return element;
}

class CalendarUI {
    constructor(container) {
        this.container = container;
        this.container.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>تقويم المهام الأسبوعي</h1>
                <span class="info-tooltip" title="حالة جميع الوكلاء سيتم إعادة تعيينها (إلغاء التدقيق والإرسال) تلقائياً كل يوم أحد الساعة 7 صباحاً">
                    <i class="fas fa-info-circle"></i>
                </span>
            </div>
            <div class="calendar-filters">
                <div class="filter-search-container">
                    <input type="search" id="calendar-search-input" placeholder="بحث بالاسم أو الرقم..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="calendar-search-clear"></i>
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
        <div id="calendar-container" class="calendar-container"></div>
        `;
        this.calendarContainer = this.container.querySelector('#calendar-container');
        this.calendarData = [];
        this.tasksState = null;
        this.daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
        this.searchDebounceTimer = null; // For debouncing search input
    }

    destroy() {
        window.taskStore.unsubscribe(this.boundUpdateUIFromState);
        clearTimeout(this.searchDebounceTimer); // Clear any pending search
    }

    async render() {
        const response = await authedFetch('/api/calendar/data');
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || 'فشل جلب بيانات التقويم');
        }
        const { agents, tasks } = await response.json();

        this.tasksState = window.taskStore.state;
        console.log('[Calendar Page] Rendering with initial data. Agents:', agents.length, 'Tasks in Store:', Object.keys(this.tasksState.tasks).length);

        this.calendarData = this.daysOfWeek.map(() => []);
        agents.forEach(agent => {
            const dayIndices = agent.audit_days || [];
            dayIndices.forEach(dayIndex => {
                if (dayIndex >= 0 && dayIndex < 6) {
                    this.calendarData[dayIndex].push(agent);
                }
            });
        });

        this._renderDayColumns();
        this._renderAllAgentCards(); // Render cards initially

        this._setupEventListeners();
        setupCalendarFilters(this); // Pass the entire UI instance

        this.boundUpdateUIFromState = updateCalendarUIFromState.bind(this);
        window.taskStore.subscribe(this.boundUpdateUIFromState);
    }

    _renderDayColumns() {
        this.calendarContainer.innerHTML = ''; // Clear previous columns
        this.daysOfWeek.forEach((dayName, index) => {
            const isToday = new Date().getDay() === index;
            const dailyAgents = this.calendarData[index];
            const { completedTasks, totalTasks, progressPercent } = this._calculateDayProgress(index);

            const columnEl = document.createElement('div');
            columnEl.className = `day-column ${isToday ? 'today' : ''}`;
            columnEl.dataset.dayIndex = index;
            columnEl.innerHTML = `
                <h2>${dayName}</h2>
                <div class="day-progress">
                    <div class="progress-bar" style="width: ${progressPercent}%"></div>
                    <span class="progress-label">${completedTasks} / ${totalTasks} مكتمل</span>
                </div>
                <div class="day-column-content"></div>
            `;
            this.calendarContainer.appendChild(columnEl);
        });
    }

    _calculateDayProgress(dayIndex) {
        const dailyAgents = this.calendarData[dayIndex] || [];
        const totalTasks = dailyAgents.length;
        let completedTasks = 0;
        dailyAgents.forEach(agent => {
            const agentTasks = this.tasksState.tasks[agent._id] || {};
            const task = agentTasks[dayIndex] || {};
            if (task.audited) {
                completedTasks++;
            }
        });
        const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        return { completedTasks, totalTasks, progressPercent };
    }

    _renderAllAgentCards() {
        this.calendarData.forEach((agentsForDay, dayIndex) => {
            const columnEl = this.calendarContainer.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
            if (!columnEl) return;

            const contentContainer = columnEl.querySelector('.day-column-content');
            contentContainer.innerHTML = ''; // Clear previous content

            if (agentsForDay.length > 0) {
                const fragment = document.createDocumentFragment();
                const isToday = new Date().getDay() === dayIndex;
                agentsForDay.forEach((agent, index) => {
                    const agentElement = createAgentItemHtml(agent, dayIndex, isToday, this.tasksState, index + 1, '');
                    fragment.appendChild(agentElement);
                });
                contentContainer.appendChild(fragment);
            } else {
                contentContainer.innerHTML = '<div class="no-tasks-placeholder"><i class="fas fa-bed"></i><p>لا توجد مهام</p></div>';
            }
        });
    }

    _setupEventListeners() {
        setupCalendarEventListeners(this.calendarContainer, this.calendarData, this);
    }

    /**
     * Surgically updates the UI after a drag-and-drop operation.
     * Instead of a full re-render, it only updates the source and destination columns.
     * @param {number} sourceDayIndex The original day index.
     * @param {number} newDayIndex The new day index.
     * @param {string} agentId The ID of the agent that was moved.
     */
    _updateAfterDrag(sourceDayIndex, newDayIndex, agentId) {
        const agentToMove = this.calendarData[sourceDayIndex].find(a => a._id === agentId);
        if (!agentToMove) return; // Should not happen

        // Update data arrays
        this.calendarData[sourceDayIndex] = this.calendarData[sourceDayIndex].filter(a => a._id !== agentId);
        this.calendarData[newDayIndex].push(agentToMove);
        this.calendarData[newDayIndex].sort((a, b) => a.name.localeCompare(b.name)); // Keep it sorted
    }
}

let currentCalendarInstance = null;

async function renderCalendarPage() {
    if (currentCalendarInstance) {
        currentCalendarInstance.destroy();
    }
    const appContent = document.getElementById('app-content');
    currentCalendarInstance = new CalendarUI(appContent);
    try {
        await currentCalendarInstance.render();
    } catch (error) {
        console.error("Error rendering calendar page:", error);
        const calendarContainer = document.getElementById('calendar-container');
        if (calendarContainer) calendarContainer.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات التقويم: ${error.message}</p>`;
    }
}

/**
 * NEW: Updates the calendar UI based on the current state from the taskStore.
 * This function is called by the store's subscription mechanism.
 * @param {object} state The latest state from taskStore.
 */
function updateCalendarUIFromState(state) {
    const container = this.calendarContainer;
    if (!container) return;

    const allItems = container.querySelectorAll('.calendar-agent-item');
    const updatedDayIndexes = new Set();

    allItems.forEach(item => {
        const agentId = item.dataset.agentId;
        const dayIndex = parseInt(item.querySelector('.audit-check')?.dataset.dayIndex, 10);
        if (isNaN(dayIndex)) return;

        const taskState = state.tasks[agentId]?.[dayIndex] || { audited: false, competition_sent: false };

        const auditCheck = item.querySelector('.audit-check');
        const competitionCheck = item.querySelector('.competition-check');

        // Update checkbox state without triggering a 'change' event
        if (auditCheck) auditCheck.checked = taskState.audited;
        if (competitionCheck) competitionCheck.checked = taskState.competition_sent;

        // Update visual styles
        auditCheck?.closest('.action-item').classList.toggle('done', taskState.audited);
        competitionCheck?.closest('.action-item').classList.toggle('done', taskState.competition_sent);

        const isComplete = taskState.audited; // Completion is based on audit only
        item.classList.toggle('complete', isComplete);

        // Update the checkmark icon next to the name
        // --- REFACTOR: Toggle a class instead of manipulating innerHTML ---
        const nameEl = item.querySelector('.agent-name');
        if (nameEl) nameEl.classList.toggle('has-checkmark', isComplete);

        updatedDayIndexes.add(dayIndex);
    });

    // Update progress bars for all affected days
    updatedDayIndexes.forEach(dayIndex => updateDayProgressUI.call(this, dayIndex));
}

function updateDayProgressUI(dayIndex) {
    const column = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
    if (!column) return;

    const progressBar = column.querySelector('.progress-bar');
    const progressLabel = column.querySelector('.progress-label');
    
    // We need the original data to know which agents belong to this day
    const allAgentsForDay = this.calendarData?.[dayIndex] || [];
    const totalTasks = allAgentsForDay.length;
    let completedTasks = 0;

    allAgentsForDay.forEach(agent => {
        const agentTasks = window.taskStore.state.tasks[agent._id] || {};
        const task = agentTasks[dayIndex] || {};
        if (task.audited) { // Progress is based on audit only
            completedTasks++;
        }
    });

    const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    progressBar.style.width = `${progressPercent}%`;
    progressLabel.textContent = `${completedTasks} / ${totalTasks} مكتمل`;
}

// --- NEW: Function to handle event listeners for the calendar page ---
function setupCalendarEventListeners(container, calendarData, uiInstance) {
    // --- NEW: Event Delegation for CSP Compliance ---
    container.addEventListener('click', (e) => {
        const copyIdTrigger = e.target.closest('.calendar-agent-id[data-agent-id-copy]');
        if (copyIdTrigger) {
            e.stopPropagation();
            const agentIdToCopy = copyIdTrigger.dataset.agentIdCopy;
            navigator.clipboard.writeText(agentIdToCopy).then(() => showToast(`تم نسخ الرقم: ${agentIdToCopy}`, 'info'));
            return;
        }
        const card = e.target.closest('.calendar-agent-item[data-agent-id]');
        if (card && !e.target.closest('.calendar-agent-actions')) { // Don't navigate if clicking on toggles
            window.location.hash = `#profile/${card.dataset.agentId}`;
        }

        // --- NEW: Allow clicking the entire action item to toggle the checkbox ---
        const actionItem = e.target.closest('.action-item');
        if (actionItem && !e.target.matches('input[type="checkbox"]')) {
            const checkbox = actionItem.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                // Manually trigger a 'change' event to run the update logic
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });

    // --- تعديل: تفعيل السحب والإفلات للسوبر أدمن فقط ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    if (isSuperAdmin) {
        let draggedItem = null;
        let sourceDayIndex = null;

        container.addEventListener('dragstart', (e) => {
            const target = e.target.closest('.calendar-agent-item');
            if (target) {
                draggedItem = target;
                sourceDayIndex = parseInt(target.dataset.dayIndex, 10);
                setTimeout(() => {
                    target.classList.add('dragging');
                }, 0);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', target.dataset.agentId); // Required for Firefox
            }
        });

        container.addEventListener('dragend', (e) => {
            if (draggedItem) {
                draggedItem.classList.remove('dragging');
                draggedItem = null;
            }
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
            const column = e.target.closest('.day-column');
            if (column) {
                column.classList.add('drag-over');
            }
        });

        container.addEventListener('dragleave', (e) => {
            const column = e.target.closest('.day-column');
            if (column) {
                column.classList.remove('drag-over');
            }
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            const targetColumn = e.target.closest('.day-column');
            if (!targetColumn || !draggedItem) return;

            targetColumn.classList.remove('drag-over');
            const newDayIndex = parseInt(targetColumn.dataset.dayIndex, 10);
            const agentId = draggedItem.dataset.agentId;
            const agentName = draggedItem.dataset.name;

            if (sourceDayIndex === newDayIndex) return; // Dropped in the same column

            const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
            const sourceDayName = daysOfWeek[sourceDayIndex];
            const newDayName = daysOfWeek[newDayIndex];

            // --- إضافة: التحقق مما إذا كان الوكيل مسجلاً بالفعل في اليوم الجديد ---
            try {
                const agentCheckResponse = await authedFetch(`/api/agents/${agentId}?select=audit_days`);
                const { data: agent } = await agentCheckResponse.json();
                if ((agent.audit_days || []).includes(newDayIndex)) {
                    showToast(`هذا الوكيل مجدول بالفعل في يوم ${newDayName}.`, 'warning');
                    return; // إيقاف العملية
                }
            } catch (error) {
                // تجاهل الخطأ في حالة فشل التحقق، والسماح للمستخدم بالمتابعة على مسؤوليته
            }

            showConfirmationModal(
                `هل أنت متأكد من نقل الوكيل <strong>${agentName}</strong> من يوم <strong>${sourceDayName}</strong> إلى يوم <strong>${newDayName}</strong>؟`,
                async () => {
                    try {
                        const agentResponse = await authedFetch(`/api/agents/${agentId}?select=audit_days`);
                        const { data: agent } = await agentResponse.json();
                        const currentAuditDays = agent.audit_days || [];
                        const newAuditDays = [...currentAuditDays.filter(d => d !== sourceDayIndex), newDayIndex];

                        await authedFetch(`/api/agents/${agentId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ audit_days: newAuditDays })
                        });

                        showToast('تم تحديث يوم التدقيق بنجاح.', 'success');
                        await logAgentActivity(currentUserProfile?._id, agentId, 'DETAILS_UPDATE', `تم تغيير يوم التدقيق من ${sourceDayName} إلى ${newDayName} عبر التقويم.`);
                        // --- REFACTOR: Perform a surgical update instead of a full re-render ---
                        uiInstance._updateAfterDrag(sourceDayIndex, newDayIndex, agentId);
                        uiInstance.render(); // Re-render to apply changes to the two affected columns
                    } catch (error) {
                        showToast(`فشل تحديث يوم التدقيق: ${error.message}`, 'error');
                    }
                }, { title: 'تأكيد تغيير يوم التدقيق', confirmText: 'نعم، انقل', confirmClass: 'btn-primary' }
            );
        });
    }

    container.addEventListener('change', async (e) => {
        const checkbox = e.target;
        if (checkbox.matches('.audit-check, .competition-check')) {
            const agentId = checkbox.dataset.agentId;
            const dayIndex = parseInt(checkbox.dataset.dayIndex, 10);
            const taskType = checkbox.classList.contains('audit-check') ? 'audited' : 'competition_sent';
            const status = checkbox.checked;

            const agentItem = checkbox.closest('.calendar-agent-item');
            const actionsContainer = agentItem.querySelector('.calendar-agent-actions');

            // --- UX IMPROVEMENT: Show loading state on the card ---
            agentItem.classList.add('is-loading');
            actionsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = true);


            // Dispatch the update to the central store.
            window.taskStore.updateTaskStatus(agentId, dayIndex, taskType, status);
            // Optimistic UI update
            const actionItem = checkbox.closest('.action-item');
            if (actionItem) actionItem.classList.toggle('done', checkbox.checked);
            
            const auditCheck = agentItem.querySelector('.audit-check');
            const competitionCheck = agentItem.querySelector('.competition-check');
            const isComplete = auditCheck.checked; // Completion is based on audit only
            agentItem.classList.toggle('complete', isComplete);

            // --- REFACTOR: Toggle a class instead of manipulating innerHTML ---
            const nameEl = agentItem.querySelector('.agent-name');
            if (nameEl) nameEl.classList.toggle('has-checkmark', isComplete);

            updateDayProgressUI.call(uiInstance, dayIndex);

            try {
                const payload = { agentId, taskType, status, dayIndex }; // Send dayIndex to backend
                console.log('[Calendar] Sending update to backend:', payload);
                const response = await authedFetch('/api/tasks', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                const responseData = await response.json();
                console.log('[Calendar] Received response from backend:', responseData);
                if (!response.ok) throw new Error(responseData.message || 'Server responded with an error.');

                // --- Log the action ---
                const actionText = taskType === 'audited' ? 'التدقيق' : 'المسابقة';
                const statusText = status ? 'تفعيل' : 'إلغاء تفعيل';
                const agentName = agentItem.dataset.name; // Use the original name from the dataset
                await logAgentActivity(currentUserProfile?._id, agentId, 'TASK_UPDATE', `تم ${statusText} مهمة "${actionText}" للوكيل ${agentName}.`);

            } catch (error) {
                console.error(`[Calendar Error] Failed to update task. AgentID: ${agentId}, Day: ${dayIndex}, Type: ${taskType}. Reason:`, error);
                showToast('فشل تحديث حالة المهمة.', 'error');
                // Revert UI on error
                checkbox.checked = !checkbox.checked;
                // Revert state in the store
                window.taskStore.updateTaskStatus(agentId, dayIndex, taskType, checkbox.checked);
                if (actionItem) actionItem.classList.toggle('done', checkbox.checked);
                const isCompleteAfterRevert = auditCheck.checked; // Completion is based on audit only
                agentItem.classList.toggle('complete', isCompleteAfterRevert);
                
                // --- REFACTOR: Revert class toggle ---
                const nameEl = agentItem.querySelector('.agent-name');
                if (nameEl) nameEl.classList.toggle('has-checkmark', isCompleteAfterRevert);

                updateDayProgressUI.call(uiInstance, dayIndex);
            } finally {
                // --- UX IMPROVEMENT: Remove loading state ---
                agentItem.classList.remove('is-loading');
                actionsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = false);
            }
        }
    });
}

function setupCalendarFilters(uiInstance) {
    const searchInput = document.getElementById('calendar-search-input');
    const clearBtn = document.getElementById('calendar-search-clear');
    const filterButtons = document.querySelectorAll('.filter-btn');

    const applyFilters = () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;

        uiInstance.calendarData.forEach((allAgentsForDay, dayIndex) => {
            const columnEl = uiInstance.calendarContainer.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
            if (!columnEl) return;

            const filteredAgents = allAgentsForDay.filter(agent => {
                const name = agent.name.toLowerCase();
                const agentIdStr = agent.agent_id;
                const classification = agent.classification;
                const matchesSearch = searchTerm === '' || name.includes(searchTerm) || agentIdStr.includes(searchTerm);
                const matchesFilter = activeFilter === 'all' || classification === activeFilter;
                return matchesSearch && matchesFilter;
            });
            
            const contentContainer = columnEl.querySelector('.day-column-content');
            contentContainer.innerHTML = ''; // Clear current items

            if (filteredAgents.length === 0) {
                contentContainer.innerHTML = '<div class="no-tasks-placeholder"><i class="fas fa-search"></i><p>لا توجد نتائج</p></div>';
            } else {
                const fragment = document.createDocumentFragment();
                const isToday = new Date().getDay() === dayIndex;
                filteredAgents.forEach((agent, index) => {
                    const agentElement = createAgentItemHtml(agent, dayIndex, isToday, uiInstance.tasksState, index + 1, searchTerm);
                    fragment.appendChild(agentElement);
                });
                contentContainer.appendChild(fragment);
            }
        });
    };

    searchInput.addEventListener('input', () => {
        // --- UX IMPROVEMENT: Debounce the search input ---
        clearTimeout(uiInstance.searchDebounceTimer);
        uiInstance.searchDebounceTimer = setTimeout(applyFilters, 300); // Wait 300ms after user stops typing
    });

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