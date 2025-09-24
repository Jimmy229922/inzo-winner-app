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
        this.container.appendChild(this.sizer);
        this.container.appendChild(this.viewport);

        this.onScroll = this.onScroll.bind(this);
        this.container.addEventListener('scroll', this.onScroll, { passive: true });

        this.render();
    }

    onScroll() {
        requestAnimationFrame(() => this.render());
    }

    render() {
        const scrollTop = this.container.scrollTop;
        let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
        startIndex = Math.max(0, startIndex - BUFFER_ITEMS);
        const endIndex = Math.min(this.allItems.length, startIndex + this.totalVisibleItems);
        this.viewport.style.transform = `translateY(${startIndex * ITEM_HEIGHT}px)`;
        this.viewport.innerHTML = this.allItems.slice(startIndex, endIndex).map(item => this.itemRenderer(item)).join('');
    }

    updateItems(newItems) {
        this.allItems = newItems;
        this.totalHeight = this.allItems.length * ITEM_HEIGHT;
        this.sizer.style.height = `${this.totalHeight}px`;
        this.render();
    }
}

function createAgentItemHtml(agent, dayIndex, isToday, tasksMap) {
    const taskDate = new Date();
    const dayDiff = dayIndex - taskDate.getDay();
    taskDate.setDate(taskDate.getDate() + dayDiff);
    const taskDateStr = taskDate.toISOString().split('T')[0];
    const task = tasksMap[`${agent.id}-${taskDateStr}`] || {};
    // Visual completion requires both
    const isComplete = task.audited && task.competition_sent; 
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

    return `
        <div class="calendar-agent-item ${isComplete ? 'complete' : ''}" data-agent-id="${agent.id}" data-classification="${agent.classification}" data-name="${agent.name.toLowerCase()}" data-agentid-str="${agent.agent_id}">
            <div class="calendar-agent-main">
                ${avatarHtml}
                <div class="calendar-agent-info">
                    <span class="agent-name">${highlightedName} ${isComplete ? '<i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : ''}</span>
                    <p class="calendar-agent-id" title="نسخ الرقم">${highlightedId}</p>
                </div>
            </div>
            <div class="calendar-agent-actions">
                <div class="action-item ${task.audited ? 'done' : ''}">
                    <label>التدقيق</label>
                    <label class="custom-checkbox toggle-switch">
                        <input type="checkbox" class="audit-check" data-agent-id="${agent.id}" data-day-index="${dayIndex}" ${task.audited ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="action-item ${task.competition_sent ? 'done' : ''}">
                    <label>المسابقة</label>
                    <label class="custom-checkbox toggle-switch">
                        <input type="checkbox" class="competition-check" data-agent-id="${agent.id}" data-day-index="${dayIndex}" ${task.competition_sent ? 'checked' : ''}>
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

    if (!supabase) {
        const container = document.getElementById('calendar-container');
        if(container) {
            container.innerHTML = `<p class="error">لا يمكن عرض التقويم، لم يتم الاتصال بقاعدة البيانات.</p>`;
        }
        return;
    }

    const [agentsResult, tasksResult] = await Promise.all([
        supabase.from('agents').select('id, name, agent_id, avatar_url, audit_days, classification'),
        supabase.from('daily_tasks').select('*')
    ]);

    const { data: agents, error } = agentsResult;
    const { data: tasks, error: tasksError } = tasksResult;

    if (error) {
        console.error("Error fetching agents for calendar:", error);
        const container = document.getElementById('calendar-container');
        if(container) {
            container.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات التقويم.</p>`;
        }
        return;
    }
    const tasksMap = (tasks || []).reduce((acc, task) => {
        acc[`${task.agent_id}-${task.task_date}`] = task;
        return acc;
    }, {});

    const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const calendarData = daysOfWeek.map(() => []);

    agents.forEach(agent => {
        if (agent.audit_days && agent.audit_days.length > 0) {
            agent.audit_days.forEach(dayIndex => {
                if (dayIndex >= 0 && dayIndex < 7) {
                    calendarData[dayIndex].push(agent);
                }
            });
        }
    });

    let html = '';
    daysOfWeek.forEach((dayName, index) => {
        const isToday = index === new Date().getDay();
        const dailyAgents = calendarData[index];

        // Calculate daily progress
        let completedTasks = 0;
        dailyAgents.forEach(agent => {
            const taskDate = new Date();
            const dayDiff = index - taskDate.getDay();
            taskDate.setDate(taskDate.getDate() + dayDiff);
            const taskDateStr = taskDate.toISOString().split('T')[0];
            const task = tasksMap[`${agent.id}-${taskDateStr}`] || {};
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

    const scrollers = [];
    document.querySelectorAll('.day-column').forEach(columnEl => {
        const dayIndex = parseInt(columnEl.dataset.dayIndex, 10);
        const agentsForDay = calendarData[dayIndex];
        const isToday = dayIndex === new Date().getDay();
        const contentContainer = columnEl.querySelector('.day-column-content');

        if (agentsForDay.length === 0) {
            contentContainer.innerHTML = '<p class="no-tasks">لا توجد مهام لهذا اليوم.</p>';
            return;
        }

        const itemRenderer = (agent) => createAgentItemHtml(agent, dayIndex, isToday, tasksMap);
        const scroller = new VirtualScroller(contentContainer, agentsForDay, itemRenderer);
        scrollers.push({ dayIndex: dayIndex, instance: scroller, allAgents: agentsForDay });
    });

    function updateDayProgressUI(dayIndex) {
        const column = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
        if (!column) return;

        const progressBar = column.querySelector('.progress-bar');
        const progressLabel = column.querySelector('.progress-label');
        
        const agentsForDay = calendarData[dayIndex];
        const totalTasks = agentsForDay.length;
        let completedTasks = 0;

        agentsForDay.forEach(agent => {
            const taskDate = new Date();
            const dayDiff = dayIndex - taskDate.getDay();
            taskDate.setDate(taskDate.getDate() + dayDiff);
            const taskDateStr = taskDate.toISOString().split('T')[0];
            const task = tasksMap[`${agent.id}-${taskDateStr}`] || {}; 
            if (task.audited) { // Progress is based on audit only
                completedTasks++;
            }
        });

        const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        progressBar.style.width = `${progressPercent}%`;
        progressLabel.textContent = `${completedTasks} / ${totalTasks} مكتمل`;
    }

    const container = document.getElementById('calendar-container');
    if (!container) return;

    container.addEventListener('click', async (e) => {
        const agentIdEl = e.target.closest('.calendar-agent-id');
        const agentItem = e.target.closest('.calendar-agent-item');

        if (agentIdEl) {
            e.stopPropagation();
            const agentId = agentIdEl.textContent.replace('#', '');
            navigator.clipboard.writeText(agentId).then(() => showToast(`تم نسخ الرقم: ${agentId}`, 'info'));
            return;
        }

        if (agentItem && !e.target.closest('.calendar-agent-actions')) {
            const agentId = agentItem.dataset.agentId;
            window.location.hash = `profile/${agentId}`;
        }
    });

    container.addEventListener('change', async (e) => {
        const checkbox = e.target;
        if (checkbox.matches('.audit-check, .competition-check')) {
            const agentId = checkbox.dataset.agentId;
            const dayIndex = parseInt(checkbox.dataset.dayIndex, 10);
            const taskDate = new Date();
            const dayDiff = dayIndex - taskDate.getDay();
            taskDate.setDate(taskDate.getDate() + dayDiff);
            const taskDateStr = taskDate.toISOString().split('T')[0];
            const taskKey = `${agentId}-${taskDateStr}`;

            if (!tasksMap[taskKey]) {
                tasksMap[taskKey] = { agent_id: agentId, task_date: taskDateStr, audited: false, competition_sent: false };
            }
            const isAudited = checkbox.classList.contains('audit-check');
            tasksMap[taskKey][isAudited ? 'audited' : 'competition_sent'] = checkbox.checked;

            // Optimistic UI update
            const agentItem = checkbox.closest('.calendar-agent-item');
            const actionItem = checkbox.closest('.action-item');
            if (actionItem) actionItem.classList.toggle('done', checkbox.checked);
            
            const auditCheck = agentItem.querySelector('.audit-check');
            const competitionCheck = agentItem.querySelector('.competition-check');
            // Visual completion requires both
            const isComplete = auditCheck.checked && competitionCheck.checked; 
            agentItem.classList.toggle('complete', isComplete);

            // NEW: Update the checkmark icon next to the name instantly
            const nameEl = agentItem.querySelector('.agent-name');
            const originalName = agentItem.dataset.name; // We stored the original name in the dataset
            const iconHtml = isComplete ? ' <i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : '';
            nameEl.innerHTML = `${originalName}${iconHtml}`;

            updateDayProgressUI(dayIndex);

            const { error } = await supabase.from('daily_tasks').upsert(tasksMap[taskKey], { onConflict: 'agent_id, task_date' });
            if (error) {
                console.error('Error updating task from calendar:', error);
                showToast('فشل تحديث حالة المهمة.', 'error');
                // Revert UI on error
                checkbox.checked = !checkbox.checked;
                tasksMap[taskKey][isAudited ? 'audited' : 'competition_sent'] = checkbox.checked;
                if (actionItem) actionItem.classList.toggle('done', checkbox.checked); // Revert individual item
                agentItem.classList.toggle('complete', !isComplete);
                updateDayProgressUI(dayIndex);
            }
        }
    });

    setupCalendarFilters(scrollers, calendarData);
}

function setupCalendarFilters(scrollers, calendarData) {
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