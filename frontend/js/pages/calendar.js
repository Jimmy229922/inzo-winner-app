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
    // --- تعديل: استخدام _id بدلاً من id ---
    const task = tasksMap[agent._id] || {};
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
        <div class="calendar-agent-item ${isComplete ? 'complete' : ''}" data-agent-id="${agent._id}" data-classification="${agent.classification}" data-name="${agent.name.toLowerCase()}" data-agentid-str="${agent.agent_id}" style="cursor: pointer;">
            <div class="calendar-agent-main">
                ${avatarHtml}
                <div class="calendar-agent-info">
                    <span class="agent-name">${highlightedName} ${isComplete ? '<i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>' : ''}</span>
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

        // --- تعديل: تحويل مصفوفة المهام إلى خريطة لسهولة الوصول ---
        const tasksMap = (tasks || []).reduce((map, task) => {
            map[task.agent_id.toString()] = task;
            return map;
        }, {});

        const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
        const calendarData = daysOfWeek.map(() => []);

        agents.forEach(agent => {
            // --- تعديل: قراءة الجدول الزمني من كائن schedule ---
            const agentDays = agent.schedule?.days || [];
            const dayIndices = agentDays.map(dayName => daysOfWeek.indexOf(dayName)).filter(i => i !== -1);

            dayIndices.forEach(dayIndex => {
                if (dayIndex >= 0 && dayIndex < 6) {
                    calendarData[dayIndex].push(agent);
                }
            });
        });

        let html = '';
        daysOfWeek.forEach((dayName, index) => {
            const isToday = new Date().getDay() === index;
            const dailyAgents = calendarData[index];

            // Calculate daily progress
            let completedTasks = 0;
            dailyAgents.forEach(agent => {
                const task = tasksMap[agent._id] || {};
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
                contentContainer.innerHTML = '<p class="no-tasks">لا توجد مهام لهذا اليوم.</p>';
                return;
            }

            const itemRenderer = (agent) => createAgentItemHtml(agent, dayIndex, isToday, tasksMap);
            const scroller = new VirtualScroller(contentContainer, agentsForDay, itemRenderer);
            scrollers.push({ dayIndex: dayIndex, instance: scroller, allAgents: agentsForDay });
        });

        setupCalendarEventListeners(container, tasksMap, calendarData);
        setupCalendarFilters(scrollers, calendarData);

    } catch (error) {
        console.error("Error rendering calendar page:", error);
        const container = document.getElementById('calendar-container');
        if (container) {
            container.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات التقويم: ${error.message}</p>`;
        }
    }
}

// --- NEW: Function to handle event listeners for the calendar page ---
function setupCalendarEventListeners(container, tasksMap, calendarData) {
    function updateDayProgressUI(dayIndex) {
        const column = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
        if (!column) return;

        const progressBar = column.querySelector('.progress-bar');
        const progressLabel = column.querySelector('.progress-label');
        
        const agentsForDay = calendarData[dayIndex];
        const totalTasks = agentsForDay.length;
        let completedTasks = 0;

        agentsForDay.forEach(agent => {
            const task = tasksMap[agent._id] || {};
            if (task.audited) { // Progress is based on audit only
                completedTasks++;
            }
        });

        const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        progressBar.style.width = `${progressPercent}%`;
        progressLabel.textContent = `${completedTasks} / ${totalTasks} مكتمل`;
    }

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

    container.addEventListener('change', async (e) => {
        const checkbox = e.target;
        if (checkbox.matches('.audit-check, .competition-check')) {
            const agentId = checkbox.dataset.agentId;
            const dayIndex = parseInt(checkbox.dataset.dayIndex, 10);
            const taskType = checkbox.classList.contains('audit-check') ? 'audited' : 'competition_sent';
            const status = checkbox.checked;

            // Update local tasksMap for optimistic UI
            if (!tasksMap[agentId]) {
                tasksMap[agentId] = { agent_id: agentId, audited: false, competition_sent: false };
            }
            tasksMap[agentId][taskType] = status;

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

            try {
                // --- تعديل: إرسال التحديث إلى الخادم الخلفي ---
                const response = await authedFetch('/api/tasks', {
                    method: 'POST',
                    body: JSON.stringify({ agentId, taskType, status })
                });
                if (!response.ok) throw new Error('Server responded with an error.');

                // --- Log the action ---
                const actionText = taskType === 'audited' ? 'التدقيق' : 'المسابقة';
                const statusText = status ? 'تفعيل' : 'إلغاء تفعيل';
                const agentName = agentItem.dataset.name;
                logAgentActivity(agentId, 'TASK_UPDATE', `تم ${statusText} مهمة "${actionText}" للوكيل ${agentName}.`);

            } catch (error) {
                console.error('Error updating task from calendar:', error);
                showToast('فشل تحديث حالة المهمة.', 'error');
                // Revert UI on error
                checkbox.checked = !checkbox.checked;
                tasksMap[agentId][taskType] = checkbox.checked;
                if (actionItem) actionItem.classList.toggle('done', checkbox.checked); // Revert individual item
                updateDayProgressUI(dayIndex);
            }
        }
    });
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