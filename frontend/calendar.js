async function renderCalendarPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header">
            <h1>تقويم المهام الأسبوعي</h1>
            <span class="info-tooltip" title="حالة جميع الوكلاء سيتم إعادة تعيينها (إلغاء التدقيق والإرسال) تلقائياً كل يوم أحد الساعة 7 صباحاً">
                <i class="fas fa-info-circle"></i>
            </span>
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
        supabase.from('agents').select('id, name, agent_id, avatar_url, audit_days'),
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
            const task = tasksMap[`${agent.id}-${taskDateStr}`];
            if (task && (task.audited || task.competition_sent)) {
                completedTasks++;
            }
        });
        const totalTasks = dailyAgents.length;
        const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        html += `
            <div class="day-column ${isToday ? 'today' : ''}">
                <h2>${dayName}</h2>
                <div class="day-progress">
                    <div class="progress-bar" style="width: ${progressPercent}%"></div>
                    <span class="progress-label">${completedTasks} / ${totalTasks} مكتمل</span>
                </div>
                <div class="day-column-content">
                    ${dailyAgents.length === 0 ? '<p class="no-tasks">لا توجد مهام لهذا اليوم.</p>' : ''}
                    ${dailyAgents.map(agent => {
                        const taskDate = new Date();
                        const dayDiff = index - taskDate.getDay();
                        taskDate.setDate(taskDate.getDate() + dayDiff);
                        const taskDateStr = taskDate.toISOString().split('T')[0];
                        const task = tasksMap[`${agent.id}-${taskDateStr}`];
                        const avatarHtml = agent.avatar_url
                            ? `<img src="${agent.avatar_url}" alt="Avatar" class="calendar-agent-avatar">`
                            : `<div class="calendar-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;

                        return `
                            <div class="calendar-agent-item" data-agent-id="${agent.id}">
                                <div class="calendar-agent-main">
                                    ${avatarHtml}
                                    <div class="calendar-agent-info">
                                        <span class="agent-name">${agent.name}</span>
                                        <p class="calendar-agent-id" title="نسخ الرقم">#${agent.agent_id}</p>
                                    </div>
                                </div>
                                <div class="calendar-agent-actions">
                                    <label class="custom-checkbox small">
                                        <input type="checkbox" class="audit-check" data-agent-id="${agent.id}" data-day-index="${index}" ${task?.audited ? 'checked' : ''}>
                                        <span class="checkmark"></span>
                                        تدقيق
                                    </label>
                                    <label class="custom-checkbox small">
                                        <input type="checkbox" class="competition-check" data-agent-id="${agent.id}" data-day-index="${index}" ${task?.competition_sent ? 'checked' : ''}>
                                        <span class="checkmark"></span>
                                        مسابقة
                                    </label>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    document.getElementById('calendar-container').innerHTML = html;

    // Make calendar items clickable
    document.querySelectorAll('.calendar-agent-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            // Prevent navigation if the copyable ID was clicked
            if (e.target.closest('.calendar-agent-id, .calendar-agent-actions')) {
                return;
            }
            const agentId = item.dataset.agentId;
            window.location.hash = `profile/${agentId}`;
        });
    });

    // Add copy functionality to agent IDs
    document.querySelectorAll('.calendar-agent-id').forEach(idEl => {
        idEl.addEventListener('click', (e) => {
            const agentId = e.currentTarget.textContent.replace('#', '');
            navigator.clipboard.writeText(agentId).then(() => showToast(`تم نسخ الرقم: ${agentId}`, 'info'));
        });
    });

    // Add event listeners for the new checkboxes
    document.querySelectorAll('.audit-check, .competition-check').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const agentId = e.target.dataset.agentId;
            const dayIndex = parseInt(e.target.dataset.dayIndex, 10);

            // Calculate the correct date for the task based on the day column
            const taskDate = new Date();
            const dayDiff = dayIndex - taskDate.getDay();
            taskDate.setDate(taskDate.getDate() + dayDiff);
            const taskDateStr = taskDate.toISOString().split('T')[0];

            const isAudited = e.target.classList.contains('audit-check');
            const isChecked = e.target.checked;

            const updateData = {};
            const taskIdentifier = { agent_id: agentId, task_date: taskDateStr };

            if (isAudited) {
                updateData.audited = isChecked;
            } else {
                updateData.competition_sent = isChecked;
            }

            const { error } = await supabase
                .from('daily_tasks')
                .upsert({ ...taskIdentifier, ...updateData }, { onConflict: 'agent_id, task_date' });

            if (error) {
                console.error('Error updating task from calendar:', error);
                showToast('فشل تحديث حالة المهمة.', 'error');
                e.target.checked = !isChecked; // Revert on error
            }
            // No toast on success to keep the UI clean, the checkmark is enough feedback.
        });
    });
}