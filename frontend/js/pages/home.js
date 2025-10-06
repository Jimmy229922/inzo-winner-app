async function renderHomePage() {
    const appContent = document.getElementById('app-content');

    // 1. عرض هيكل الصفحة فوراً مع مؤشرات تحميل
    renderHomePageSkeleton();

    // 2. جلب البيانات (سيستخدم النسخة المخزنة مؤقتاً إن وجدت)
    const stats = await fetchHomePageData();

    // 3. تحديث الواجهة بالبيانات
    if (stats) {
        updateHomePageUI(stats);
    } else {
        // عرض رسالة خطأ في حاوية الإحصائيات إذا فشل كل شيء
        const statsContainer = document.getElementById('home-stats-container');
        if (statsContainer) {
            statsContainer.innerHTML = `<p class="error" style="text-align: center; padding: 20px;">فشل تحميل بيانات لوحة التحكم.</p>`;
        }
    }

    updateStatus('connected', 'متصل وجاهز'); // Ensure status is updated on home page load
}

async function fetchHomePageData() {
    try {
        const response = await authedFetch('/api/stats/home');
        if (!response.ok) {
            throw new Error('Failed to fetch home page stats.');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching home page data:', error);
        return null; // Return null to show an error message on the UI
    }
}

function renderHomePageSkeleton() {
    const appContent = document.getElementById('app-content');
    const loaderHtml = '<div class="loader-container small-loader"><div class="spinner"></div></div>';

    appContent.innerHTML = `
        <div class="page-header dashboard-header-card"><h1><i class="fas fa-tachometer-alt"></i> لوحة التحكم الرئيسية</h1><p class="welcome-message" id="welcome-message"></p></div>

        <div id="home-stats-container">${loaderHtml}</div>
        <div class="home-grid">
            <div class="home-main-column">
                <h2>تقدم مهام اليوم (<span id="progress-percentage">...</span>%)</h2>
                <div class="progress-bar-container">
                    <div id="tasks-progress-bar" class="progress-bar" style="width: 0%;"></div>
                    <span id="progress-label" class="progress-label">... / ...</span>
                </div>
 
                <h2 style="margin-top: 30px;">المسابقات المرسلة خلال اليوم</h2>
                <div id="competitions-chart-container" class="chart-container">${loaderHtml}</div>
            </div>
            <div class="home-side-column">
                <h2 style="margin-top: 30px;">المهام المتبقية لليوم (<span id="pending-count">...</span>)</h2>
                <div id="pending-tasks-list" class="pending-tasks-list">${loaderHtml}</div>

                <h2 style="margin-top: 30px;">نظرة سريعة على الوكلاء</h2>
                <div id="agent-quick-stats" class="agent-quick-stats">${loaderHtml}</div>
            </div>
            <div class="home-side-column">
                <h2 style="margin-top: 30px;"><i class="fas fa-star"></i> أبرز الوكلاء أداءً</h2>
                <div id="top-agents-list" class="top-agents-list">${loaderHtml}</div>
            </div>
        </div>
 
        <h2 style="margin-top: 40px;">إجراءات سريعة</h2>
        <div class="quick-actions">
            <a href="#add-agent?returnTo=home" class="quick-action-card"><h3><i class="fas fa-user-plus"></i> إضافة وكيل جديد</h3><p>إضافة وكيل جديد إلى النظام وتعيين بياناته.</p></a>            
            <a href="#competition-templates" class="quick-action-card"><h3><i class="fas fa-file-alt"></i> إنشاء قالب مسابقة</h3><p>إضافة أو تعديل قوالب المسابقات الجاهزة.</p></a>
        </div>

        <div id="connection-status" class="status-bar status-connecting">
            <span id="status-text">جاري الاتصال...</span>
            <span id="last-check-time"></span>
        </div>
    `;
}

// --- NEW: Function to render the UI from data (cached or fresh) ---
function updateHomePageUI(stats) {
    if (!stats) return;

    // استخراج البيانات من نتيجة الـ RPC
    const { total_agents: totalAgents, active_competitions: activeCompetitions, competitions_today_count: competitionsTodayCount, agents_for_today: agentsForToday, new_agents_this_month: newAgentsThisMonth, agents_by_classification: agentsByClassification, tasks_for_today: tasksForToday, top_agents: topAgents } = stats;

    // --- NEW: Welcome Message ---
    const welcomeEl = document.getElementById('welcome-message');
    if (welcomeEl && currentUserProfile) {
        const userName = currentUserProfile.full_name || currentUserProfile.email.split('@')[0];
        welcomeEl.textContent = `أهلاً بعودتك، ${userName}!`;
    }


        // --- تحديث واجهة المستخدم بعد جلب جميع البيانات ---

        // 1. Update Stat Cards
        const statsContainer = document.getElementById('home-stats-container');
        statsContainer.innerHTML = ` 
            <div class="dashboard-grid-v2">
                <a href="#manage-agents" class="stat-card-v2 color-1">
                    <div class="stat-card-v2-icon-bg"><i class="fas fa-users"></i></div>
                    <p class="stat-card-v2-value">${formatNumber(totalAgents)}</p>
                    <h3 class="stat-card-v2-title">إجمالي الوكلاء</h3>
                </a>
                <a href="#competitions" class="stat-card-v2 color-2">
                    <div class="stat-card-v2-icon-bg"><i class="fas fa-trophy"></i></div>
                    <p class="stat-card-v2-value">${formatNumber(activeCompetitions)}</p>
                    <h3 class="stat-card-v2-title">مسابقات نشطة</h3>
                </a>
                <a href="#competitions" class="stat-card-v2 color-3">
                    <div class="stat-card-v2-icon-bg"><i class="fas fa-paper-plane"></i></div>
                    <p class="stat-card-v2-value">${formatNumber(competitionsTodayCount)}</p>
                    <h3 class="stat-card-v2-title">المسابقات المرسلة اليوم</h3>
                </a>
            </div>
        `;

        // 2. Update Tasks Progress
        const totalTodayTasks = agentsForToday?.length || 0;
        const pendingList = document.getElementById('pending-tasks-list');
        if (!pendingList) return; // Exit if the element is not on the page

        if (totalTodayTasks > 0) {
            // تعديل: استخدام بيانات المهام التي تم جلبها مسبقاً
            if (tasksForToday) {
                const tasksMap = (tasksForToday || []).reduce((acc, task) => {
                    acc[task.agent_id.toString()] = task; // FIX: Use agent_id.toString() as key
                    return acc;
                }, {});

                const completedToday = agentsForToday.filter(agent => {
                    const task = tasksMap[agent._id] || {}; // FIX: Use _id instead of id
                    return task.audited; // FIX: Completion is based on audit only
                }).length;

                const pendingAgents = agentsForToday.filter(agent => {
                    const task = tasksMap[agent._id];
                    return !task || !task.audited;  // Show agents that have not been audited yet
                });

                // ترتيب الوكلاء حسب التصنيف
                pendingAgents.sort((a, b) => {
                    const classOrder = { 'R': 0, 'A': 1, 'B': 2, 'C': 3 };
                    return classOrder[a.classification] - classOrder[b.classification];
                });

                const progressPercent = totalTodayTasks > 0 ? Math.round((completedToday / totalTodayTasks) * 100) : 0;
                document.getElementById('progress-percentage').textContent = progressPercent;
                document.getElementById('tasks-progress-bar').style.width = `${progressPercent}%`;
                document.getElementById('progress-label').textContent = `${completedToday} / ${totalTodayTasks}`;
                document.getElementById('pending-count').textContent = pendingAgents.length;

                // عرض قائمة الوكلاء المتبقين
                if (pendingAgents.length > 0) {
                    pendingList.innerHTML = pendingAgents.map(agent => `
                        <a href="#tasks?highlight=${agent._id}" class="pending-task-item ${tasksMap[agent._id]?.competition_sent ? 'partial' : ''}">
                            <div class="pending-task-info">
                                <span class="pending-agent-name">${agent.name}</span>
                                <span class="pending-agent-id">#${agent.agent_id}</span>
                            </div>
                            <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                        </a>
                    `).join('');
                } else {
                    pendingList.innerHTML = '<p class="no-pending-tasks">لا توجد مهام متبقية لليوم 🎉</p>';
                }
                
                let pendingHtml = '';

                if (pendingAgents.length > 0) {
                    // --- تعديل: عرض قائمة واحدة مبسطة ---
                    pendingHtml = pendingAgents.slice(0, 5).map(agent => {
                        const task = tasksMap[agent._id] || {}; // FIX: Use _id instead of id
                        const needsAudit = !task.audited;
                        const needsCompetition = !task.competition_sent;
                        return `
                        <div class="pending-agent-card-v2" data-agent-id="${agent._id}" style="cursor: pointer;">
                            <div class="pending-agent-info">
                                ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Avatar" loading="lazy">` : `<div class="avatar-placeholder"><i class="fas fa-user"></i></div>`}
                                <div class="agent-name-wrapper">
                                    <span class="agent-name-link">${agent.name}</span>
                                    <div class="pending-task-actions">
                                        ${needsAudit ? '<button class="btn-icon-action home-task-action audit" data-task-type="audit" title="تمييز التدقيق كمكتمل"><i class="fas fa-clipboard-check"></i> <span>تدقيق</span></button>' : ''}
                                        ${needsCompetition ? '<button class="btn-icon-action home-task-action competition" data-task-type="competition" title="تمييز المسابقة كمكتملة"><i class="fas fa-pen-alt"></i> <span>مسابقة</span></button>' : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="pending-agent-actions">
                                <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                                <a href="#tasks?highlight=${agent._id}" class="go-to-task-icon" title="الذهاب للمهمة"><i class="fas fa-chevron-left"></i></a>
                            </div>
                        </div>
                        `;
                    }).join('');

                    if (pendingAgents.length > 5) {
                        pendingHtml += `<div class="view-all-container"><a href="#tasks" class="btn-secondary btn-small"><i class="fas fa-arrow-left"></i> عرض كل المهام (${pendingAgents.length} مهمة)</a></div>`;
                    }

                } else {
                    pendingHtml = '<p class="no-pending-tasks">لا توجد مهام متبقية لهذا اليوم. عمل رائع!</p>';
                }
                pendingList.innerHTML = pendingHtml;

                // --- NEW: Event Delegation for CSP Compliance ---
                pendingList.addEventListener('click', (e) => {
                    const taskAction = e.target.closest('.home-task-action');
                    if (taskAction) {
                        handleHomeTaskAction(e);
                        return;
                    }
                    const card = e.target.closest('.pending-agent-card-v2');
                    if (card && !e.target.closest('a')) {
                        window.location.hash = `#profile/${card.dataset.agentId}`;
                    }
                });
            }
        } else {
            // NEW: Handle the case where there are no tasks scheduled for today at all
            pendingList.innerHTML = '<p class="no-pending-tasks">لا توجد مهام مجدولة لهذا اليوم.</p>';
            document.getElementById('pending-count').textContent = 0;
            document.getElementById('progress-label').textContent = `0 / 0`;
        }

    // 3. Render Competitions Chart
    const chartContainer = document.getElementById('competitions-chart-container');
    if (chartContainer) {
        // Clear loader before rendering chart
        chartContainer.innerHTML = '<canvas id="competitions-chart"></canvas>'; 
        renderCompetitionsChart(stats.competitions_today_hourly || []);
    }

    // 4. Render Agent Quick Stats
    const agentStatsContainer = document.getElementById('agent-quick-stats');
    if (agentStatsContainer) {
        const classificationCounts = agentsByClassification || {}; // FIX: The backend now sends an object of counts directly.
        agentStatsContainer.innerHTML = `...`; // The rest of the function is correct
        
        // Render the new classification chart AFTER the container is in the DOM
        renderClassificationChart(classificationCounts);
    }

    // 5. Render Top Agents Section
    const topAgentsContainer = document.getElementById('top-agents-list');
    if (topAgentsContainer) {
        if (topAgents && topAgents.length > 0) {
            const processedTopAgents = topAgents.map(agent => {
                const totalViews = agent.competitions.reduce((sum, c) => sum + (c.views_count || 0), 0);
                const totalReactions = agent.competitions.reduce((sum, c) => sum + (c.reactions_count || 0), 0);
                const totalParticipants = agent.competitions.reduce((sum, c) => sum + (c.participants_count || 0), 0);
                return { ...agent, totalViews, totalReactions, totalParticipants };
            }).sort((a, b) => b.totalViews - a.totalViews); // Sort by total views

            topAgentsContainer.innerHTML = (processedTopAgents || []).map((agent, index) => { // FIX: Add null check
                const avatarHtml = agent.avatar_url
                    ? `<img src="${agent.avatar_url}" alt="Avatar" class="avatar-small" loading="lazy">`
                    : `<div class="avatar-placeholder-small"><i class="fas fa-user"></i></div>`;
                return `
                    <div class="top-agent-item" data-agent-id="${agent.id}" style="cursor: pointer;">
                        <span class="rank-number">${index + 1}</span>
                        ${avatarHtml}
                        <div class="agent-info">
                            <span class="agent-name">${agent.name}</span>
                            <span class="agent-stats" data-agent-id-copy="${agent.agent_id}" title="نسخ الرقم"><i class="fas fa-id-badge"></i> #${agent.agent_id}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            topAgentsContainer.innerHTML = '<p class="no-results-message">لا توجد بيانات لأبرز الوكلاء.</p>';
        }
    }
}


async function handleHomeTaskAction(event) {
    const button = event.target.closest('.home-task-action');
    if (!button) return;

    const card = button.closest('.pending-agent-card-v2');
    const agentId = card.dataset.agentId;
    const taskType = button.dataset.taskType;

    if (taskType === 'audit') {
        // تعديل: الانتقال إلى صفحة المهام مع التركيز على الوكيل
        window.location.hash = `tasks?highlight=${agentId}`;
    } else if (taskType === 'competition') {
        window.location.hash = `competitions/new?agentId=${agentId}`;
    }
}

function renderClassificationChart(classificationData) {
    const ctx = document.getElementById('classification-chart')?.getContext('2d');
    if (!ctx) return;

    const labels = Object.keys(classificationData);
    const data = Object.values(classificationData);

    // تعديل: استخدام ألوان أكثر تناسقاً مع هوية التطبيق
    const backgroundColors = [
        '#4CAF50', // --primary-color
        '#F4A261', // --accent-color
        '#3498db', // Blue
        '#9b59b6', // Purple
    ];

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'تصنيف الوكلاء',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: 'var(--card-bg-color)',
                borderWidth: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: 'var(--text-color)',
                        font: {
                            weight: 'bold'
                        }
                    },
                    // تعديل: جعل الرسم البياني تفاعلياً
                    onClick: (evt, elements) => {
                        if (elements.length > 0) {
                            const clickedIndex = elements[0].index;
                            const classificationLabel = labels[clickedIndex];
                            if (classificationLabel && classificationLabel !== 'N/A') {
                                window.location.hash = `#manage-agents?filter=${classificationLabel}`;
                            }
                        }
                    },
                }
            },
            cutout: '60%'
        }
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
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'عدد المسابقات',
                data: hourlyData,
                fill: true,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return null;
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, 'rgba(76, 175, 80, 0)'); // Green transparent
                    gradient.addColorStop(1, 'rgba(76, 175, 80, 0.4)'); // Green with opacity
                    return gradient;
                },
                borderColor: 'var(--primary-color)', // Use the new green
                borderWidth: 2,
                pointBackgroundColor: 'var(--primary-color)',
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.4 // Makes the line smooth
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        display: false // Hide vertical grid lines
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }, // Ensure y-axis shows whole numbers
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)' // Lighter grid lines for dark mode
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}