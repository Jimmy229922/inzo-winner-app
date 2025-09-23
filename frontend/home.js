async function renderHomePage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = ''; // Clear content
    
    let agentCount = 0;
    let activeCompetitionsCount = 0;
    let completedToday = 0;
    let totalToday = 0;
    let pendingAgents = [];

    if (supabase) {
        // Use Promise.all to fetch all stats concurrently for better performance
        const today = new Date().getDay();
        const todayStr = new Date().toISOString().split('T')[0];

        const [
            agentCountResult, 
            competitionsResult, 
            agentsForTodayResult
        ] = await Promise.all([
            supabase.from('agents').select('*', { count: 'exact', head: true }),
            supabase.from('competitions').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('agents').select('id, name, avatar_url').contains('audit_days', [today])
        ]);

        // Process results
        agentCount = agentCountResult.count || 0;
        activeCompetitionsCount = competitionsResult.count || 0;
        totalToday = agentsForTodayResult.data?.length || 0;

        if (totalToday > 0) {
            const agentIds = agentsForTodayResult.data.map(a => a.id);
            const { data: tasks, error: tasksError } = await supabase
                .from('daily_tasks')
                .select('*')
                .eq('task_date', todayStr)
                .in('agent_id', agentIds);

            if (!tasksError) {
                const tasksMap = tasks.reduce((acc, task) => {
                    acc[task.agent_id] = task;
                    return acc;
                }, {});

                completedToday = agentsForTodayResult.data.filter(agent => {
                    const task = tasksMap[agent.id];
                    return task && task.audited && task.competition_sent;
                }).length;

                pendingAgents = agentsForTodayResult.data.filter(agent => {
                    const task = tasksMap[agent.id];
                    return !task || !task.audited || !task.competition_sent;
                });
            }
        }
    }

    appContent.innerHTML = `
        <h1>لوحة التحكم الرئيسية</h1>
        
        <div class="dashboard-grid">
            <div class="stat-card"><i class="fas fa-users"></i><div class="stat-info"><h3>إجمالي الوكلاء</h3><p>${agentCount}</p></div></div>
            <div class="stat-card"><i class="fas fa-trophy"></i><div class="stat-info"><h3>مسابقات نشطة</h3><p>${activeCompetitionsCount}</p></div></div>
            <div class="stat-card"><i class="fas fa-check-double"></i><div class="stat-info"><h3>مهام مكتملة اليوم</h3><p>${completedToday}</p></div></div>
        </div>

        <div class="home-grid">
            <div class="home-main-column" style="grid-column: 1 / -1;">
                <h2>تقدم مهام اليوم (${totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0}%)</h2>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${totalToday > 0 ? (completedToday / totalToday) * 100 : 0}%;"></div>
                    <span class="progress-label">${completedToday} / ${totalToday}</span>
                </div>

                <h2 style="margin-top: 30px;">المهام المتبقية لليوم (${pendingAgents.length})</h2>
                <div class="pending-tasks-list">
                    ${pendingAgents.length > 0 ? pendingAgents.map(agent => `
                        <a href="#tasks?highlight=${agent.id}" class="pending-agent-card">
                            ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Avatar">` : `<div class="avatar-placeholder"><i class="fas fa-user"></i></div>`}
                            <span>${agent.name}</span>
                        </a>
                    `).join('') : '<p class="no-pending-tasks">لا توجد مهام متبقية لهذا اليوم. عمل رائع!</p>'}
                </div>
            </div>
        </div>

        <h2 style="margin-top: 40px;">إجراءات سريعة</h2>
        <div class="quick-actions">
            <button id="quick-add-agent" class="btn-primary"><i class="fas fa-user-plus"></i> إضافة وكيل جديد</button>
            <button id="quick-create-comp" class="btn-primary"><i class="fas fa-plus-circle"></i> إنشاء مسابقة جديدة</button>
        </div>
    `;

    document.getElementById('quick-add-agent').addEventListener('click', () => {
        setActiveNav(null);
        window.location.hash = 'add-agent?returnTo=home';
    });
    document.getElementById('quick-create-comp').addEventListener('click', () => {
        window.location.hash = 'competitions/new';
    });
}