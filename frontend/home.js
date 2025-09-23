async function renderHomePage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = ''; // Clear content
    
    let agentCount = 0;
    let activeCompetitionsCount = 0;
    let auditedTasksCount = 0;
    let auditedToday = 0;
    let totalToday = 0;

    if (supabase) {
        // Use Promise.all to fetch all stats concurrently for better performance
        const today = new Date().getDay();
        const todayStr = new Date().toISOString().split('T')[0];

        const [agentCountResult, auditedTasksResult, competitionsResult, agentsForTodayResult] = await Promise.all([
            supabase.from('agents').select('*', { count: 'exact', head: true }),
            supabase.from('daily_tasks').select('*', { count: 'exact', head: true }).eq('audited', true),
            supabase.from('competitions').select('*', { count: 'exact', head: true }).eq('is_active', true), // Assumes 'competitions' table
            supabase.from('agents').select('id').contains('audit_days', [today])
        ]);

        if (agentCountResult.error) {
            console.error("Error fetching agent count:", agentCountResult.error);
        } else {
            agentCount = agentCountResult.count;
        }

        if (auditedTasksResult.error) {
            console.error("Error fetching audited tasks count:", auditedTasksResult.error);
        } else {
            auditedTasksCount = auditedTasksResult.count;
        }

        if (competitionsResult.error) {
            // This is expected if the table doesn't exist yet, so we don't need to log a big error.
            console.log("Could not fetch active competitions count. Table 'competitions' might not exist yet.");
        } else {
            activeCompetitionsCount = competitionsResult.count;
        }

        if (agentsForTodayResult.error) {
            console.error("Error fetching today's agents:", agentsForTodayResult.error);
        } else {
            totalToday = agentsForTodayResult.data.length;
            if (totalToday > 0) {
                const agentIds = agentsForTodayResult.data.map(a => a.id);
                const { count: auditedCount, error: auditedError } = await supabase
                    .from('daily_tasks')
                    .select('*', { count: 'exact', head: true })
                    .eq('task_date', todayStr)
                    .eq('audited', true)
                    .in('agent_id', agentIds);
                
                if (!auditedError) auditedToday = auditedCount;
            }
        }
    }

    appContent.innerHTML = `
        <h1>لوحة التحكم الرئيسية</h1>
        
        <h2>إحصائيات سريعة</h2>
        <div class="dashboard-grid">
            <div class="stat-card"><i class="fas fa-users"></i><div class="stat-info"><h3>إجمالي الوكلاء</h3><p>${agentCount}</p></div></div>
            <div class="stat-card"><i class="fas fa-trophy"></i><div class="stat-info"><h3>مسابقات نشطة</h3><p>${activeCompetitionsCount}</p></div></div>
            <div class="stat-card"><i class="fas fa-check-circle"></i><div class="stat-info"><h3>مهمات مدققة</h3><p>${auditedTasksCount}</p></div></div>
        </div>

        <h2>تقدم مهام اليوم</h2>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${totalToday > 0 ? (auditedToday / totalToday) * 100 : 0}%;"></div>
            <span class="progress-label">${auditedToday} / ${totalToday}</span>
        </div>

        <h2>إجراءات سريعة</h2>
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