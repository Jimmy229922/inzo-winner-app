async function renderHomePage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <h1>لوحة التحكم الرئيسية</h1>
        <div id="home-stats-container"></div>
        <div class="home-grid">
            <div class="home-main-column">
                <h2>تقدم مهام اليوم (<span id="progress-percentage">0</span>%)</h2>
                <div class="progress-bar-container">
                    <div id="tasks-progress-bar" class="progress-bar" style="width: 0%;"></div>
                    <span id="progress-label" class="progress-label">0 / 0</span>
                </div>

                <h2 style="margin-top: 30px;">المهام المتبقية لليوم (<span id="pending-count">0</span>)</h2>
                <div id="pending-tasks-list" class="pending-tasks-list">
                    <p class="no-pending-tasks">جاري تحميل المهام...</p>
                </div>
            </div>
            <div class="home-side-column">
                <h2>المسابقات المرسلة اليوم</h2>
                <div class="chart-container">
                    <canvas id="competitions-chart"></canvas>
                </div>
            </div>
        </div>

        <h2 style="margin-top: 40px;">إجراءات سريعة</h2>
        <div class="quick-actions">
            <button id="quick-add-agent" class="btn-primary"><i class="fas fa-user-plus"></i> إضافة وكيل جديد</button>
            <button id="quick-create-comp" class="btn-primary"><i class="fas fa-plus-circle"></i> إنشاء مسابقة جديدة</button>
        </div>
    `;

    if (supabase) {
        const today = new Date();
        const todayDayIndex = today.getDay();
        const todayStr = today.toISOString().split('T')[0];
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

        const [
            { count: totalAgents, error: agentsError },
            { count: activeCompetitions, error: activeCompError },
            { data: agentsForToday, error: agentsTodayError },
            { data: competitionsToday, error: compTodayError }
        ] = await Promise.all([
            supabase.from('agents').select('*', { count: 'exact', head: true }),
            supabase.from('competitions').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('agents').select('id, name, avatar_url').contains('audit_days', [todayDayIndex]),
            supabase.from('competitions').select('created_at').gte('created_at', todayStart).lt('created_at', tomorrowStart)
        ]);

        // Update Stat Cards
        const statsContainer = document.getElementById('home-stats-container');
        statsContainer.innerHTML = ` 
            <div class="dashboard-grid-v2">
                <div class="stat-card-v2 color-1">
                    <div class="stat-card-v2-icon-bg"><i class="fas fa-users"></i></div>
                    <p class="stat-card-v2-value">${totalAgents || 0}</p>
                    <h3 class="stat-card-v2-title">إجمالي الوكلاء</h3>
                </div>
                <div class="stat-card-v2 color-2">
                    <div class="stat-card-v2-icon-bg"><i class="fas fa-trophy"></i></div>
                    <p class="stat-card-v2-value">${activeCompetitions || 0}</p>
                    <h3 class="stat-card-v2-title">مسابقات نشطة</h3>
                </div>
                <div class="stat-card-v2 color-3">
                    <div class="stat-card-v2-icon-bg"><i class="fas fa-paper-plane"></i></div>
                    <p class="stat-card-v2-value">${competitionsToday?.length || 0}</p>
                    <h3 class="stat-card-v2-title">المسابقات المرسلة اليوم</h3>
                </div>
            </div>
        `;

        // Update Tasks Progress
        const totalTodayTasks = agentsForToday?.length || 0;
        if (totalTodayTasks > 0) {
            const agentIds = agentsForToday.map(a => a.id);
            const { data: tasks, error: tasksError } = await supabase
                .from('daily_tasks')
                .select('*')
                .eq('task_date', todayStr)
                .in('agent_id', agentIds);

            if (!tasksError && tasks) {
                const tasksMap = tasks.reduce((acc, task) => {
                    acc[task.agent_id] = task;
                    return acc;
                }, {});

                const completedToday = agentsForToday.filter(agent => {
                    const task = tasksMap[agent.id];
                    return task && task.audited && task.competition_sent;
                }).length;

                const pendingAgents = agentsForToday.filter(agent => {
                    const task = tasksMap[agent.id];
                    return !task || !task.audited || !task.competition_sent;
                });

                const progressPercent = totalTodayTasks > 0 ? Math.round((completedToday / totalTodayTasks) * 100) : 0;
                document.getElementById('progress-percentage').textContent = progressPercent;
                document.getElementById('tasks-progress-bar').style.width = `${progressPercent}%`;
                document.getElementById('progress-label').textContent = `${completedToday} / ${totalTodayTasks}`;
                document.getElementById('pending-count').textContent = pendingAgents.length;
                const pendingList = document.getElementById('pending-tasks-list');
                pendingList.innerHTML = pendingAgents.length > 0 ? pendingAgents.map(agent => `
                    <a href="#tasks?highlight=${agent.id}" class="pending-agent-card">
                        ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Avatar" loading="lazy">` : `<div class="avatar-placeholder"><i class="fas fa-user"></i></div>`}
                        <span>${agent.name}</span>
                    </a>
                `).join('') : '<p class="no-pending-tasks">لا توجد مهام متبقية لهذا اليوم. عمل رائع!</p>';
            }
        }

        // Render Chart
        renderCompetitionsChart(competitionsToday || []);
    }

    document.getElementById('quick-add-agent').addEventListener('click', () => {
        setActiveNav(null);
        window.location.hash = 'add-agent?returnTo=home';
    });
    document.getElementById('quick-create-comp').addEventListener('click', () => {
        window.location.hash = 'competitions/new';
    });
}

function renderCompetitionsChart(competitions) {
    const ctx = document.getElementById('competitions-chart')?.getContext('2d');
    if (!ctx) return;

    // Group competitions by hour
    const hourlyData = Array(24).fill(0);
    competitions.forEach(comp => {
        const hour = new Date(comp.created_at).getHours();
        hourlyData[hour]++;
    });

    const chartLabels = Array.from({ length: 24 }, (_, i) => {
        const hour = i % 12 === 0 ? 12 : i % 12;
        const ampm = i < 12 ? 'ص' : 'م';
        return `${hour} ${ampm}`;
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'عدد المسابقات',
                data: hourlyData,
                backgroundColor: 'rgba(138, 43, 226, 0.6)', // var(--primary-color) with opacity
                borderColor: 'rgba(138, 43, 226, 1)',
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 } // Ensure y-axis shows whole numbers
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}