const ITEM_HEIGHT = 140; // 130px height + 10px margin-bottom
const BUFFER_ITEMS = 5; // Render items above and below the viewport for smoother scrolling

class VirtualScroller {
    constructor(container, allItems, itemRenderer) {
        this.container = container;
        this.allItems = allItems;
        this.itemRenderer = itemRenderer;

        this.viewportHeight = this.container.clientHeight;
        this.totalHeight = this.allItems.length * ITEM_HEIGHT;
        this.visibleItemCount = Math.ceil(this.viewportHeight / ITEM_HEIGHT);
        this.totalVisibleItems = this.visibleItemCount + 2 * BUFFER_ITEMS;

        this.sizer = document.createElement('div');
        this.sizer.className = 'virtual-scroll-sizer';
        this.sizer.style.height = `${this.totalHeight}px`;

        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-scroll-viewport';

        this.container.innerHTML = '';

        this.onScroll = this.onScroll.bind(this);
        this.container.addEventListener('scroll', this.onScroll, { passive: true });

        // --- إصلاح: تأخير الحسابات الأولية لضمان تحديد ارتفاع الحاوية بشكل صحيح ---
        // هذا يمنع حساب عدد العناصر المرئية بشكل خاطئ قبل أن يأخذ العنصر أبعاده الكاملة.
        requestAnimationFrame(() => {
            this.viewportHeight = this.container.clientHeight;
            this.visibleItemCount = Math.ceil(this.viewportHeight / ITEM_HEIGHT);
            this.totalVisibleItems = this.visibleItemCount + 2 * BUFFER_ITEMS;
            
            this.container.appendChild(this.sizer);
            this.container.appendChild(this.viewport);
            this.render();
        });
    }

    onScroll() {
        window.requestAnimationFrame(() => this.render());
    }

    render() {
        // --- إصلاح: إعادة حساب ارتفاع منطقة العرض عند كل عملية عرض ---
        // هذا يحل مشكلة عدم ظهور جميع العناصر عند التمرير، خاصة في الأعمدة الطويلة.
        this.viewportHeight = this.container.clientHeight;
        this.visibleItemCount = Math.ceil(this.viewportHeight / ITEM_HEIGHT);
        this.totalVisibleItems = this.visibleItemCount + 2 * BUFFER_ITEMS;

        const scrollTop = this.container.scrollTop;
        let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
        startIndex = Math.max(0, startIndex - BUFFER_ITEMS);
        const endIndex = Math.min(this.allItems.length, startIndex + this.totalVisibleItems);
        this.viewport.style.transform = `translateY(${startIndex * ITEM_HEIGHT}px)`;
        this.viewport.innerHTML = this.allItems.slice(startIndex, endIndex).map((item, index) => this.itemRenderer(item, startIndex + index)).join('');
    }

    updateItems(newItems) {
        this.allItems = newItems;
        this.totalHeight = this.allItems.length * ITEM_HEIGHT;
        this.sizer.style.height = `${this.totalHeight}px`;
        this.render();
    }
}

function createAgentItemHtml(agent, dayIndex, isToday, tasksState, number) {
    // Read state directly from the centralized store's state
    const agentTasks = tasksState.tasks[agent._id] || {};
    const task = agentTasks[dayIndex] || { audited: false, competition_sent: false };

    const isComplete = task.audited; // Visual completion now only requires audit
    const avatarHtml = agent.avatar_url
        ? `<img src="${agent.avatar_url}" alt="Avatar" class="calendar-agent-avatar" loading="lazy">`
        : `<div class="calendar-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;

    const searchTerm = document.getElementById('calendar-search-input')?.value.toLowerCase().trim() || '';
    let highlightedName = agent.name;
    let highlightedId = '#' + agent.agent_id;

    if (searchTerm) {
        const regex = new RegExp(searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
        highlightedName = agent.name.replace(regex, '<mark>$&</mark>');
        highlightedId = ('#' + agent.agent_id).replace(regex, '<mark>$&</mark>');
    }

    const completeIconHtml = isComplete ? '<i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : '';

    return `
        <div class="calendar-agent-item ${isComplete ? 'complete' : ''}" data-agent-id="${agent._id}" data-classification="${agent.classification}" data-name="${agent.name}" data-agentid-str="${agent.agent_id}" style="cursor: grab;" draggable="true" data-day-index="${dayIndex}">
            <div class="calendar-agent-number">${number}</div>
            <div class="calendar-agent-main">
                ${avatarHtml}
                <div class="calendar-agent-info">
                    <span class="agent-name">${highlightedName} ${completeIconHtml}</span>
                    <p class="calendar-agent-id" title="نسخ الرقم" data-agent-id-copy="${agent.agent_id}">${highlightedId}</p>
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
        </div>
    `;
}

async function renderCalendarPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
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

    try {
        // --- تعديل: استخدام authedFetch لجلب البيانات من الخادم الخلفي ---
        const response = await authedFetch('/api/calendar/data');
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || 'فشل جلب بيانات التقويم');
        }
        const { agents, tasks } = await response.json();

        // ARCHITECTURAL FIX: The store is now guaranteed to be ready.
        // We can safely access its state.
        const tasksState = window.taskStore.state;
        console.log('[Calendar Page] Rendering with initial data. Agents:', agents.length, 'Tasks in Store:', Object.keys(tasksState.tasks).length);

        const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
        const calendarData = daysOfWeek.map(() => []);

        agents.forEach(agent => {
            // --- تعديل: قراءة الجدول الزمني من كائن schedule ---
            const dayIndices = agent.audit_days || [];

            dayIndices.forEach(dayIndex => { // --- إصلاح: التعامل مع 6 أيام في الأسبوع فقط ---
                if (dayIndex >= 0 && dayIndex < 6) {
                    calendarData[dayIndex].push(agent);
                }
            });
        });

        let html = '';
        daysOfWeek.forEach((dayName, index) => {
            const isToday = new Date().getDay() === index;
            const dailyAgents = calendarData[index];

            let completedTasks = 0;
            dailyAgents.forEach(agent => {
                const agentTasks = tasksState.tasks[agent._id] || {};
                const task = agentTasks[index] || {};
                // Progress is based on audit only
                if (task.audited) {
                    completedTasks++;
                }
            });
            const totalTasks = dailyAgents.length;
            const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

            html += `
                <div class="day-column ${isToday ? 'today' : ''}" data-day-index="${index}">
                    <h2>${dayName}</h2>
                    <div class="day-progress">
                        <div class="progress-bar" style="width: ${progressPercent}%"></div>
                        <span class="progress-label">${completedTasks} / ${totalTasks} مكتمل</span>
                    </div>
                    <div class="day-column-content">
                        <!-- This will be populated by VirtualScroller -->
                    </div>
                </div>
            `;
        });

        document.getElementById('calendar-container').innerHTML = html;

        // --- إصلاح: تعريف متغير الحاوية قبل استخدامه ---
        const container = document.getElementById('calendar-container');

        const scrollers = [];
        document.querySelectorAll('.day-column').forEach(columnEl => {
            const dayIndex = parseInt(columnEl.dataset.dayIndex, 10);
            const agentsForDay = calendarData[dayIndex];
            const isToday = new Date().getDay() === dayIndex;
            const contentContainer = columnEl.querySelector('.day-column-content');

            if (agentsForDay.length === 0) {
                contentContainer.innerHTML = '<div class="no-tasks-placeholder"><i class="fas fa-bed"></i><p>لا توجد مهام</p></div>';
                return;
            }

            const itemRenderer = (agent, index) => createAgentItemHtml(agent, dayIndex, isToday, window.taskStore.state, index + 1);
            const scroller = new VirtualScroller(contentContainer, agentsForDay, itemRenderer);
            scrollers.push({ dayIndex: dayIndex, instance: scroller, allAgents: agentsForDay });
        });

        // --- FIX: Make calendarData globally available for progress UI updates ---
        window.calendarPageData = { calendarData };

        setupCalendarEventListeners(container, calendarData);
        setupCalendarFilters(scrollers, calendarData, window.taskStore.state);

        // --- NEW: Subscribe to store changes to keep the UI in sync ---
        // This ensures that if a task is updated on another page (like the tasks page), this page reflects the change.
        window.taskStore.subscribe(updateCalendarUIFromState);

    } catch (error) {
        console.error("Error rendering calendar page:", error);
        const container = document.getElementById('calendar-container');
        if (container) {
            container.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات التقويم: ${error.message}</p>`;
        }
    }
}

/**
 * NEW: Updates the calendar UI based on the current state from the taskStore.
 * This function is called by the store's subscription mechanism.
 * @param {object} state The latest state from taskStore.
 */
function updateCalendarUIFromState(state) {
    const container = document.getElementById('calendar-container');
    if (!container) return; // Only run if the calendar page is active

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
        const nameEl = item.querySelector('.agent-name');
        const iconHtml = isComplete ? ' <i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : '';
        // This is a bit tricky because of search highlighting. We'll just append/remove the icon.
        nameEl.querySelector('.task-complete-icon')?.remove();
        if (isComplete) nameEl.insertAdjacentHTML('beforeend', iconHtml);

        updatedDayIndexes.add(dayIndex);
    });

    // Update progress bars for all affected days
    updatedDayIndexes.forEach(dayIndex => updateDayProgressUI(dayIndex));
}

function updateDayProgressUI(dayIndex) {
    const column = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
    if (!column) return;

    const progressBar = column.querySelector('.progress-bar');
    const progressLabel = column.querySelector('.progress-label');
    
    // We need the original data to know which agents belong to this day
    const allAgentsForDay = window.calendarPageData?.calendarData?.[dayIndex] || [];
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
function setupCalendarEventListeners(container, calendarData) {
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
    });

    // --- إضافة: وظيفة السحب والإفلات لتغيير أيام التدقيق ---
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
                    renderCalendarPage(); // Re-render the whole page to reflect changes
                } catch (error) {
                    showToast(`فشل تحديث يوم التدقيق: ${error.message}`, 'error');
                }
            }, { title: 'تأكيد تغيير يوم التدقيق', confirmText: 'نعم، انقل', confirmClass: 'btn-primary' }
        );
    });

    container.addEventListener('change', async (e) => {
        const checkbox = e.target;
        if (checkbox.matches('.audit-check, .competition-check')) {
            const agentId = checkbox.dataset.agentId;
            const dayIndex = parseInt(checkbox.dataset.dayIndex, 10);
            const taskType = checkbox.classList.contains('audit-check') ? 'audited' : 'competition_sent';
            const status = checkbox.checked;

            // Dispatch the update to the central store.
            window.taskStore.updateTaskStatus(agentId, dayIndex, taskType, status);
            // Optimistic UI update
            const agentItem = checkbox.closest('.calendar-agent-item');
            const actionItem = checkbox.closest('.action-item');
            if (actionItem) actionItem.classList.toggle('done', checkbox.checked);
            
            const auditCheck = agentItem.querySelector('.audit-check');
            const competitionCheck = agentItem.querySelector('.competition-check');
            const isComplete = auditCheck.checked; // Completion is based on audit only
            agentItem.classList.toggle('complete', isComplete);

            // NEW: Update the checkmark icon next to the name instantly
            const nameEl = agentItem.querySelector('.agent-name');
            // Re-apply search highlight if it exists
            const searchTerm = document.getElementById('calendar-search-input')?.value.toLowerCase().trim() || '';
            let agentNameForDisplay = agentItem.dataset.name;
            if (searchTerm) agentNameForDisplay = agentNameForDisplay.replace(new RegExp(searchTerm, 'gi'), '<mark>$&</mark>');
            const iconHtml = isComplete ? ' <i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : '';
            nameEl.innerHTML = `${agentNameForDisplay}${iconHtml}`;

            updateDayProgressUI(dayIndex);

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
                
                let agentNameForDisplayAfterRevert = agentItem.dataset.name;
                if (searchTerm) agentNameForDisplayAfterRevert = agentNameForDisplayAfterRevert.replace(new RegExp(searchTerm, 'gi'), '<mark>$&</mark>');
                const iconHtmlAfterRevert = isCompleteAfterRevert ? ' <i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : '';
                nameEl.innerHTML = `${agentNameForDisplayAfterRevert}${iconHtmlAfterRevert}`;

                updateDayProgressUI(dayIndex);
            }
        }
    });
}

function setupCalendarFilters(scrollers, calendarData, tasksState) {
    const searchInput = document.getElementById('calendar-search-input');
    const clearBtn = document.getElementById('calendar-search-clear');
    const filterButtons = document.querySelectorAll('.filter-btn');

    const applyFilters = () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;

        scrollers.forEach(scrollerData => {
            const allAgentsForDay = calendarData[scrollerData.dayIndex];
            const filteredAgents = allAgentsForDay.filter(agent => {
                const name = agent.name.toLowerCase();
                const agentIdStr = agent.agent_id;
                const classification = agent.classification;
                const matchesSearch = searchTerm === '' || name.includes(searchTerm) || agentIdStr.includes(searchTerm);
                const matchesFilter = activeFilter === 'all' || classification === activeFilter;
                return matchesSearch && matchesFilter;
            });
            scrollerData.instance.updateItems(filteredAgents);
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