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
        supabase.from('agents').select('*'),
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
        html += `
            <div class="day-column">
                <h2>${dayName}</h2>
                <div class="day-column-content">
                    ${calendarData[index].length === 0 ? '<p class="no-tasks">لا توجد مهام لهذا اليوم.</p>' : ''}
                    ${calendarData[index].map(agent => {
                        const taskDate = new Date();
                        const dayDiff = index - taskDate.getDay();
                        taskDate.setDate(taskDate.getDate() + dayDiff);
                        const taskDateStr = taskDate.toISOString().split('T')[0];
                        const task = tasksMap[`${agent.id}-${taskDateStr}`];
                        return `
                            <div class="calendar-agent-item" data-agent-id="${agent.id}">
                                <span class="agent-name">${agent.name}</span>
                                <p class="calendar-agent-id" title="نسخ الرقم">#${agent.agent_id}</p>
                                <div class="calendar-agent-statuses">
                                    ${task?.audited ? '<span class="status-tag status-audited">تم التدقيق</span>' : ''}
                                    ${task?.competition_sent ? '<span class="status-tag status-competition">تم الإرسال</span>' : ''}
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
            if (e.target.closest('.calendar-agent-id')) {
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
}