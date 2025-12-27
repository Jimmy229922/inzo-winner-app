async function renderHomePage() {
    // Verify authentication first
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.replace('/login.html');
        return;
    }

    // Verify user profile exists or fetch it
    let userProfile = JSON.parse(localStorage.getItem('userProfile'));
    if (!userProfile) {
        try {
            const profileResponse = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!profileResponse.ok) {
                throw new Error('Failed to fetch user profile');
            }
            userProfile = await profileResponse.json();
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
        } catch (error) {
        /* logs suppressed: profile fetch failed */
            localStorage.removeItem('authToken');
            window.location.replace('/login.html');
            return;
        }
    }

    const appContent = document.getElementById('app-content');

    // 1. عرض هيكل الصفحة فوراً مع مؤشرات تحميل
    renderHomePageSkeleton();

    // 2. جلب البيانات (سيستخدم النسخة المخزنة مؤقتاً إن وجدت)
    const stats = await fetchHomePageData();

    // 3. تحديث الواجهة بالبيانات
    if (stats) {
        await updateHomePageUI(stats);
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
    /* logs suppressed: error fetching home page data */
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
                <h2>المهام المتبقية لليوم (<span id="pending-count">...</span>)</h2>
                <div id="pending-tasks-list" class="pending-tasks-list">${loaderHtml}</div>

                <h2 style="margin-top: 30px;">نظرة سريعة على الوكلاء</h2>
                <div id="agent-quick-stats" class="agent-quick-stats">${loaderHtml}</div>
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
async function updateHomePageUI(stats) {
    /* logs suppressed */
    
    if (!stats) {
    /* logs suppressed: no stats provided */
        return;
    }

    // استخراج البيانات من نتيجة الـ RPC
    const { total_agents: totalAgents, active_competitions: activeCompetitions, competitions_today_count: competitionsTodayCount, agents_for_today: agentsForToday, new_agents_this_month: newAgentsThisMonth, agents_by_classification: agentsByClassification, tasks_for_today: tasksForToday, top_agents: topAgents } = stats;

    /* logs suppressed: extracted data */

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
        const currentDayIndex = new Date().getDay();
        console.log('[Home] Debugging Saturday Tasks:', {
            dayIndex: currentDayIndex,
            agentsForTodayCount: agentsForToday?.length,
            agentsForToday: agentsForToday
        });

        // FAILSAFE: Force hide tasks on Saturday (6)
        let effectiveAgentsForToday = agentsForToday;
        if (currentDayIndex === 6) {
            console.warn('[Home] Saturday detected. Forcing empty task list on frontend.');
            effectiveAgentsForToday = [];
        }

        const totalTodayAgents = effectiveAgentsForToday?.length || 0;
        const pendingList = document.getElementById('pending-tasks-list');
        if (!pendingList) return; // Exit if the element is not on the page

        if (totalTodayAgents > 0) {
            /* logs suppressed: starting progress calculation */
            
            // تعديل: استخدام بيانات المهام التي تم جلبها مسبقاً
                // Prefer authoritative task status from /api/tasks/today (returns { tasksMap })
                let tasksMap = {};
                try {
                    /* logs suppressed: fetching tasks */
                    const todayResp = await authedFetch('/api/tasks/today');
                    /* logs suppressed: response status */
                    
                    if (todayResp.ok) {
                        const todayData = await todayResp.json();
                        tasksMap = todayData.tasksMap || {};
                        /* logs suppressed: tasks fetched successfully */
                    } else {
                        /* logs suppressed: failed to fetch tasks */
                    }
                } catch (e) {
                    /* logs suppressed: failed to load /api/tasks/today, will fallback */
                }

                // Fallback: build a map from stats.tasks_for_today shape if needed
                if (!tasksMap || Object.keys(tasksMap).length === 0) {
                    /* logs suppressed: using fallback */
                    tasksMap = (tasksForToday || []).reduce((acc, task) => {
                        const key = String(task.agent_id ?? task.agentId ?? task._id ?? task.agent ?? '');
                        if (key) acc[key] = task;
                        return acc;
                    }, {});
                    /* logs suppressed: fallback map */
                }

                // A daily task for an agent counts as complete when audited only
                const totalTodayActions = totalTodayAgents; // Count auditing only
                let completedActions = 0;

                /* logs suppressed: calculating completed actions */
                effectiveAgentsForToday.forEach(agent => {
                    const task = tasksMap[agent._id] || {};
                    /* logs suppressed: per-agent details */
                    
                    if (task.audited) {
                        completedActions++;
                    }
                    // Competition is not counted in progress anymore
                });

                /* logs suppressed: final calculations */
                
                const pendingAgents = effectiveAgentsForToday.filter(agent => {
                    const task = tasksMap[agent._id];
                    return !task || !task.audited; // Only check audited status
                });
                
                /* logs suppressed: pending count */

                // ترتيب الوكلاء حسب التصنيف
                pendingAgents.sort((a, b) => {
                    const classOrder = { 'R': 0, 'A': 1, 'B': 2, 'C': 3 };
                    return classOrder[a.classification] - classOrder[b.classification];
                });

                const progressPercent = totalTodayActions > 0 ? Math.round((completedActions / totalTodayActions) * 100) : 0;
                /* logs suppressed: progress percentage */
                
                const progressLabel = `${completedActions} / ${totalTodayActions}`;
                /* logs suppressed: progress label */
                
                // Update UI elements
                const progressPercentEl = document.getElementById('progress-percentage');
                const progressBarEl = document.getElementById('tasks-progress-bar');
                const progressLabelEl = document.getElementById('progress-label');
                const pendingCountEl = document.getElementById('pending-count');
                
                /* logs suppressed: updating UI elements */
                
                if (progressPercentEl) {
                    progressPercentEl.textContent = progressPercent;
                    /* logs suppressed */
                }
                
                if (progressBarEl) {
                    progressBarEl.style.width = `${progressPercent}%`;
                    /* logs suppressed */
                }
                
                if (progressLabelEl) {
                    progressLabelEl.textContent = progressLabel;
                    /* logs suppressed */
                }
                
                if (pendingCountEl) {
                    pendingCountEl.textContent = pendingAgents.length;
                    /* logs suppressed */
                }

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
                                        ${needsCompetition ? `<button class="btn-icon-action home-task-action competition" data-task-type="competition" data-auditing-enabled="${agent.is_auditing_enabled}" title="تمييز المسابقة كمكتملة"><i class="fas fa-pen-alt"></i> <span>مسابقة</span></button>` : ''}
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
        } else {
            // NEW: Handle the case where there are no tasks scheduled for today at all
            /* logs suppressed: no agents scheduled */
            pendingList.innerHTML = '<p class="no-pending-tasks">لا توجد مهام مجدولة لهذا اليوم.</p>';
            
            const progressPercentEl = document.getElementById('progress-percentage');
            const pendingCountEl = document.getElementById('pending-count');
            const progressLabelEl = document.getElementById('progress-label');
            
            if (progressPercentEl) progressPercentEl.textContent = 0;
            if (pendingCountEl) pendingCountEl.textContent = 0;
            if (progressLabelEl) progressLabelEl.textContent = '0 / 0';
            
            /* logs suppressed: set counters to 0 */
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
        const classificationCounts = agentsByClassification || {};
        agentStatsContainer.innerHTML = `
            <div class="quick-stat-item">
                <div class="stat-info">
                    <h4>وكلاء جدد هذا الشهر</h4>
                    <p>${formatNumber(newAgentsThisMonth)}</p>
                </div>
                <div class="stat-icon"><i class="fas fa-user-plus"></i></div>
            </div>
            <div class="classification-chart-container"><canvas id="classification-chart"></canvas></div>
        `;
        
        // Render the new classification chart AFTER the container is in the DOM
        renderClassificationChart(classificationCounts);
    }

    // 5. Removed activity distribution section - moved to analytics page only
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
        const auditingEnabled = button.dataset.auditingEnabled === 'true';
        if (!auditingEnabled) {
             if (typeof window.showToast === 'function') {
                 window.showToast('عذراً، لا يمكن إنشاء مسابقة قبل إتمام عملية التدقيق لهذا الوكيل.', 'error');
             } else {
                 alert('عذراً، لا يمكن إنشاء مسابقة قبل إتمام عملية التدقيق لهذا الوكيل.');
             }
             return;
        }
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
        const hour = new Date(comp.createdAt).getHours();
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

async function renderTopAgentsSection() {
    const appContent = document.getElementById('app-content');
    
    appContent.innerHTML = `
        <div class="page-header">
            <h1><i class="fas fa-trophy"></i> أبرز الوكلاء</h1>
        </div>
        
        <div class="top-agents-container">
            <!-- Top 3 Agents Section -->
            <div class="top-3-agents">
                <h2 class="section-title">أفضل 3 وكلاء</h2>
                <div class="top-3-grid" id="top-3-agents-grid">
                    <div class="loader-container"><div class="spinner"></div></div>
                </div>
            </div>
            
            <!-- Other Agents Sections -->
            <div class="other-agents">
                <h2 class="section-title">الوكلاء الحصريين</h2>
                <div class="agents-grid" id="exclusive-agents-grid">
                    <div class="loader-container"><div class="spinner"></div></div>
                </div>
                
                <h2 class="section-title">الوكلاء الاعتياديين</h2>
                <div class="agents-grid" id="regular-agents-grid">
                    <div class="loader-container"><div class="spinner"></div></div>
                </div>
            </div>
        </div>
    `;

    try {
        const response = await authedFetch('/api/agents?sort=performance');
        if (!response.ok) {
            throw new Error('Failed to fetch agents data');
        }

        const { data: agents } = await response.json();
        
        // Split agents into categories
        const top3Agents = agents.slice(0, 3);
        const exclusiveAgents = agents.filter(agent => 
            agent.is_exclusive && !top3Agents.includes(agent)
        );
        const regularAgents = agents.filter(agent => 
            !agent.is_exclusive && !top3Agents.includes(agent)
        );

        // Render top 3 agents
        document.getElementById('top-3-agents-grid').innerHTML = `
            ${top3Agents.map((agent, index) => `
                <div class="top-agent-card rank-${index + 1}">
                    <div class="rank-badge">${index + 1}</div>
                    <div class="agent-avatar">
                        ${agent.avatar_url ? 
                            `<img src="${agent.avatar_url}" alt="${agent.name}">` : 
                            `<div class="avatar-placeholder"><i class="fas fa-user"></i></div>`
                        }
                    </div>
                    <div class="agent-info">
                        <h3>${agent.name}</h3>
                        <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                        <div class="stats">
                            <div class="stat"><i class="fas fa-users"></i> ${agent.clients_count} عميل</div>
                            <div class="stat"><i class="fas fa-trophy"></i> ${agent.competitions_count} مسابقة</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        `;

        // Render exclusive agents
        document.getElementById('exclusive-agents-grid').innerHTML = 
            exclusiveAgents.length ? 
            exclusiveAgents.map(agent => generateAgentCard(agent)).join('') :
            '<p class="no-results">لا يوجد وكلاء حصريين حالياً</p>';

        // Render regular agents
        document.getElementById('regular-agents-grid').innerHTML = 
            regularAgents.length ?
            regularAgents.map(agent => generateAgentCard(agent)).join('') :
            '<p class="no-results">لا يوجد وكلاء اعتياديين حالياً</p>';

    } catch (error) {
    /* logs suppressed: error loading agents */
        showToast('حدث خطأ أثناء تحميل بيانات الوكلاء', 'error');
    }
}

function generateAgentCard(agent) {
    return `
        <div class="agent-card">
            <div class="agent-avatar">
                ${agent.avatar_url ? 
                    `<img src="${agent.avatar_url}" alt="${agent.name}">` : 
                    `<div class="avatar-placeholder"><i class="fas fa-user"></i></div>`
                }
            </div>
            <div class="agent-info">
                <h3>${agent.name}</h3>
                <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                <div class="stats">
                    <div class="stat"><i class="fas fa-users"></i> ${agent.clients_count} عميل</div>
                    <div class="stat"><i class="fas fa-trophy"></i> ${agent.competitions_count} مسابقة</div>
                    ${agent.is_exclusive ? '<div class="exclusive-badge"><i class="fas fa-star"></i> حصري</div>' : ''}
                </div>
            </div>
        </div>
    `;
}

function renderActivityDistributionChart(data, canvasId = 'activityDistributionChart') {
    // data expected as array of { _id: 'TYPE', count: Number }
    const ctx = document.getElementById(canvasId)?.getContext?.('2d');
    if (!ctx) return;

    const labels = (data || []).map(item => item._id || 'غير معروف');
    const counts = (data || []).map(item => item.count || 0);

    // fallback colors
    const colors = ['#4CAF50', '#2196F3', '#F4A261', '#E91E63', '#9C27B0', '#00BCD4', '#FF9800'];

    // Attempt to use ChartDataLabels if available — otherwise, just render a simple pie.
    const config = {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors,
                borderColor: 'var(--card-bg-color)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    };

    // If ChartDataLabels plugin is present, add a formatter for percentages
    if (window.ChartDataLabels) {
        config.options.plugins.datalabels = {
            color: '#fff',
            font: { weight: 'bold' },
            formatter: (value, ctx) => {
                const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) || 1;
                const perc = (value / sum) * 100;
                return perc > 5 ? perc.toFixed(0) + '%' : '';
            }
        };
        config.plugins = [ChartDataLabels];
    }

    // eslint-disable-next-line no-new
    new Chart(ctx, config);
}