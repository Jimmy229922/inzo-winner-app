(function(window) {


    // Ensure dependencies are loaded
    function ensureDependency(name) {
        if (typeof window[name] === 'undefined') {
            console.error(name + ' is not loaded. Please make sure all required scripts are included.');
            return false;
        }
        return true;
    }

    // Initialize utilities right away
    const utils = {
        async authedFetch(url, options = {}) {
            const token = localStorage.getItem('authToken');
            const headers = new Headers(options.headers || {});
            if (token) {
                headers.set('Authorization', 'Bearer ' + token);
            }
            return fetch(url, Object.assign({}, options, { headers: headers }));
        },
        showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            if (!container) return;
        
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            const iconClass = type === 'success' ? 'fa-check-circle' : 
                            (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
            toast.innerHTML = '<i class="fas ' + iconClass + '"></i> ' + message;
            
            container.appendChild(toast);
        
            setTimeout(function() {
                toast.remove();
            }, 5000);
        }
    };

    // Make utilities globally available immediately
    window.utils = utils;
    window.authedFetch = utils.authedFetch;  // Direct global access for compatibility
    window.showToast = utils.showToast;      // Direct global access for compatibility

    // == taskStore.js ==
    /**
     * TaskStore: The Single Source of Truth for task state management.
     * This store manages the state, handles updates, and persists data to localStorage.
     * It uses a custom event system to notify components of state changes,
     * mimicking a Redux/Context pattern in vanilla JavaScript.
     */
    
    const TASK_STATE_KEY = 'inzoTaskState';
    const { authedFetch } = window.utils;
    
    const taskStore = {
        state: {
            // tasks: { agentId: { dayIndex: { audited: bool, competition_sent: bool } } }
            tasks: {},
        },
        _subscribers: [], // NEW: To hold all callback functions
    
        /**
         * Initializes the store by loading data from localStorage and fetching initial data.
         * This acts as the "hydration" step.
         */
        async init() {
            this._loadState();
            await this._fetchInitialData();
            // Notify all components that the initial state is ready.
            this._notify();
        },
    
        /**
         * The main dispatcher function to update task status.
         * This is the equivalent of a reducer action.
         * @param {string} agentId
         * @param {number} dayIndex
         * @param {'audited' | 'competition_sent'} taskType
         * @param {boolean} status
         */
        async updateTaskStatus(agentId, dayIndex, taskType, status) {
            console.log(`[TaskStore] updateTaskStatus called with:`, { agentId, dayIndex, taskType, status });
    
            // Log state before
            console.log(`[TaskStore] State for agent ${agentId} BEFORE update:`, JSON.parse(JSON.stringify(this.state.tasks[agentId] || {})));
    
            try {
                const response = await authedFetch('/api/tasks', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ agentId, dayIndex, taskType, status })
                });
    
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to update task on the server.');
                }
    
                // Ensure the agent and day objects exist
                if (!this.state.tasks[agentId]) {
                    this.state.tasks[agentId] = {};
                }
                if (!Object.prototype.hasOwnProperty.call(this.state.tasks[agentId], dayIndex)) {
                    this.state.tasks[agentId][dayIndex] = { audited: false, competition_sent: false };
                }
    
                // Update the state
                this.state.tasks[agentId][dayIndex][taskType] = status;
    
                // Log state after
                console.log(`[TaskStore] State for agent ${agentId} AFTER update:`, JSON.parse(JSON.stringify(this.state.tasks[agentId] || {})));
    
                // Persist and notify
                this._saveState();
                this._notify();
    
            } catch (error) {
                console.error("Error updating task status:", error);
                // Re-throw the error to be caught by the calling UI component
                throw error;
            }
        },
    
        async resetAllTasks() {
            console.log('[TaskStore] Resetting all tasks.');
            try {
                // Perform API call to reset all tasks on the backend
                const response = await authedFetch('/api/tasks/reset-all', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
    
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to reset tasks on server.');
                }
    
                // If API call is successful, reset the local state
                this.state.tasks = {};
    
                // Persist and notify
                this._saveState();
                this._notify();
                console.log('[TaskStore] All tasks have been reset locally and on the server.');
    
            } catch (error) {
                console.error("Error resetting all tasks:", error);
                throw error; // Re-throw for the UI to handle
            }
        },
    
        /**
         * Fetches the initial data (agents and tasks for the week) from the backend.
         * It merges the backend state with the local state, giving precedence to local changes.
         */
        async _fetchInitialData() {
            try {
                const response = await authedFetch('/api/calendar/data');
                if (!response.ok) throw new Error('Failed to fetch calendar data');
                const { tasks: serverTasks } = await response.json();
    
                // Merge server tasks into local state
                (serverTasks || []).forEach(task => {
                    const dayIndex = new Date(task.task_date).getUTCDay();
                    const agentId = task.agent_id.toString();
                    
                    if (!this.state.tasks[agentId]) this.state.tasks[agentId] = {};
                    if (!this.state.tasks[agentId][dayIndex]) {
                         this.state.tasks[agentId][dayIndex] = {
                            audited: task.audited,
                            competition_sent: task.competition_sent
                        };
                    }
                });
                this._saveState();
            } catch (error) {
                console.error("Failed to fetch initial task data:", error);
            }
        },
    
        _loadState() {
            const storedState = localStorage.getItem(TASK_STATE_KEY);
            if (storedState) {
                this.state = JSON.parse(storedState);
            }
        },
    
        _saveState() {
            localStorage.setItem(TASK_STATE_KEY, JSON.stringify(this.state));
        },
    
        _notify() {
            // Call all subscribed callbacks with a deep clone of the new state to prevent mutation.
            const stateClone = JSON.parse(JSON.stringify(this.state));
            this._subscribers.forEach(callback => callback(stateClone));
        },
    
        /**
         * Subscribes a callback function to state changes.
         * @param {Function} callback
         */
        subscribe(callback) {
            if (!this._subscribers.includes(callback)) {
                this._subscribers.push(callback);
            }
        },
    
        /**
         * Unsubscribes a callback function from state changes.
         * @param {Function} callback
         */
        unsubscribe(callback) {
            this._subscribers = this._subscribers.filter(cb => cb !== callback);
        }
    };
    
    // Make it globally accessible immediately
    window.taskStore = taskStore; 
    
    // Initialize the store only after the main document is fully loaded and parsed.
    // This ensures that functions from other scripts (like authedFetch) are available.
    document.addEventListener('DOMContentLoaded', () => {
        taskStore.init().then(() => {
            // Dispatch storeReady event after initialization is complete.
            window.dispatchEvent(new Event('storeReady'));
        });
    });

    // == home.js ==
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
            const totalTodayAgents = agentsForToday?.length || 0;
            const pendingList = document.getElementById('pending-tasks-list');
            if (!pendingList) return; // Exit if the element is not on the page
    
            if (totalTodayAgents > 0) {
                // تعديل: استخدام بيانات المهام التي تم جلبها مسبقاً
                if (tasksForToday) {
                    const tasksMap = (tasksForToday || []).reduce((acc, task) => {
                        acc[task.agent_id.toString()] = task;
                        return acc;
                    }, {});
    
                    // A daily task for an agent has two components: audit and competition.
                    const totalTodayActions = totalTodayAgents * 2;
                    let completedActions = 0;
    
                    agentsForToday.forEach(agent => {
                        const task = tasksMap[agent._id] || {};
                        if (task.audited) {
                            completedActions++;
                        }
                        if (task.competition_sent) {
                            completedActions++;
                        }
                    });
    
                    const pendingAgents = agentsForToday.filter(agent => {
                        const task = tasksMap[agent._id];
                        return !task || !task.audited || !task.competition_sent;
                    });
    
                    // ترتيب الوكلاء حسب التصنيف
                    pendingAgents.sort((a, b) => {
                        const classOrder = { 'R': 0, 'A': 1, 'B': 2, 'C': 3 };
                        return classOrder[a.classification] - classOrder[b.classification];
                    });
    
                    const progressPercent = totalTodayActions > 0 ? Math.round((completedActions / totalTodayActions) * 100) : 0;
                    document.getElementById('progress-percentage').textContent = progressPercent;
                    document.getElementById('tasks-progress-bar').style.width = `${progressPercent}%`;
                    document.getElementById('progress-label').textContent = `${completedActions} / ${totalTodayActions}`;
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
            console.error('Error loading agents:', error);
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

    // == agents.js ==
    const AGENTS_PER_PAGE = 10;
    
    async function renderManageAgentsPage() {
        // --- NEW: Permission Check ---
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
    
        const appContent = document.getElementById('app-content');
        appContent.innerHTML = `
            <div class="page-header column-header">
                <div class="header-top-row">
                    <h1>إدارة الوكلاء</h1>
                    <div class="header-actions-group">
                        ${isSuperAdmin ? `<button id="delete-all-agents-btn" class="btn-danger"><i class="fas fa-skull-crossbones"></i> حذف كل الوكلاء</button>` : ''}
                        ${isAdmin ? `<button id="bulk-renew-balances-btn" class="btn-renewal"><i class="fas fa-sync-alt"></i> تجديد الأرصدة</button>` : ''}
                        ${isSuperAdmin ? `<button id="bulk-send-balance-btn" class="btn-telegram-bonus"><i class="fas fa-bullhorn"></i> تعميم الأرصدة</button>` : ''}
                        ${isSuperAdmin ? `<button id="bulk-broadcast-btn" class="btn-telegram-broadcast"><i class="fas fa-microphone-alt"></i> تعميم جماعي</button>` : ''}
                        ${isAdmin ? `<button id="bulk-add-agents-btn" class="btn-secondary"><i class="fas fa-users-cog"></i> إضافة وكلاء دفعة واحدة</button>` : ''}
                        <button id="add-agent-btn" class="btn-primary"><i class="fas fa-plus"></i> إضافة وكيل جديد</button>
                    </div>
                </div>
                <div class="agent-filters">
                    <div class="filter-search-container">
                        <input type="search" id="agent-search-input" placeholder="بحث بالاسم أو الرقم..." autocomplete="off">
                        <i class="fas fa-search"></i>
                        <i class="fas fa-times-circle search-clear-btn" id="agent-search-clear"></i>
                    </div>
                    <div class="filter-buttons">
                        <button class="filter-btn active" data-filter="all">الكل</button>
                        <button class="filter-btn" data-filter="R">R</button>
                        <button class="filter-btn" data-filter="A">A</button>
                        <button class="filter-btn" data-filter="B">B</button>
                        <button class="filter-btn" data-filter="C">C</button>
                    </div>
                    <div class="sort-container">
                        <label for="agent-sort-select">ترتيب حسب:</label>
                        <select id="agent-sort-select">
                            <option value="newest">الأحدث أولاً</option>
                            <option value="name_asc">أبجدي (أ - ي)</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="agent-table-container"></div>
        `;
    
        document.getElementById('add-agent-btn').addEventListener('click', () => {
            setActiveNav(null);
            window.location.hash = 'add-agent?returnTo=manage-agents';
        });
    
        // --- NEW: Add listener for bulk renew balances button ---
        const bulkRenewBtn = document.getElementById('bulk-renew-balances-btn');
        if (bulkRenewBtn) {
            bulkRenewBtn.addEventListener('click', () => {
                handleBulkRenewBalances();
            });
        }
    
        // --- NEW: Add listener for delete all agents button ---
        const deleteAllBtn = document.getElementById('delete-all-agents-btn');
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', () => {
                handleDeleteAllAgents();
            });
        }
        // تعديل: إضافة معالج لزر الإرسال الجماعي
        const bulkSendBtn = document.getElementById('bulk-send-balance-btn');
        if (bulkSendBtn) {
            bulkSendBtn.addEventListener('click', () => handleBulkSendBalances());
        }
    
        // --- NEW: Add listener for bulk add agents button ---
        const bulkAddBtn = document.getElementById('bulk-add-agents-btn');
        if (bulkAddBtn) {
            bulkAddBtn.addEventListener('click', renderBulkAddAgentsModal);
        }
    
        // --- NEW: Add listener for bulk broadcast button ---
        const bulkBroadcastBtn = document.getElementById('bulk-broadcast-btn');
        if (bulkBroadcastBtn) {
            bulkBroadcastBtn.addEventListener('click', handleBulkBroadcast);
        }
    
        // --- NEW: Attach event listeners once for the entire page ---
        const container = document.getElementById('agent-table-container');
        container.addEventListener('click', (e) => {
            const agentCell = e.target.closest('.table-agent-cell');
            const agentIdText = e.target.closest('.agent-id-text');
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            const link = e.target.closest('a');
            const paginationBtn = e.target.closest('.page-btn');
    
            // 1. نسخ رقم الوكالة
            if (agentIdText) {
                e.stopPropagation();
                const agentIdToCopy = agentIdText.textContent;
                navigator.clipboard.writeText(agentIdToCopy).then(() => showToast(`تم نسخ الرقم: ${agentIdToCopy}`, 'info'));
            }
            // 2. الانتقال للملف الشخصي عند الضغط على خلية الوكيل (الاسم/الصورة)
            else if (agentCell && !editBtn && !deleteBtn && !link) {
                const row = agentCell.closest('tr');
                if (row && row.dataset.agentId) {
                    window.location.hash = `profile/${row.dataset.agentId}`;
                }
            }
            // 3. زر التعديل
            else if (editBtn) {
                const row = editBtn.closest('tr');
                if (row) window.location.hash = `profile/${row.dataset.agentId}/edit`;
            }
            // 4. زر الحذف
            else if (deleteBtn) {
                const row = deleteBtn.closest('tr');
                const agentId = row.dataset.agentId;
                const agentName = row.querySelector('.agent-details')?.textContent || 'وكيل غير معروف';
                const currentPage = parseInt(container.querySelector('.page-btn.active')?.dataset.page || '1');
    
                showConfirmationModal(
                    `هل أنت متأكد من حذف الوكيل "<strong>${agentName}</strong>"؟<br><small>سيتم حذف جميع بياناته المرتبطة بشكل دائم.</small>`,
                    async () => {
                        try {
                            const response = await authedFetch(`/api/agents/${agentId}`, { method: 'DELETE' });
                            if (!response.ok) {
                                const result = await response.json();
                                throw new Error(result.message || 'فشل حذف الوكيل.');
                            }
                            showToast('تم حذف الوكيل بنجاح.', 'success');
                            fetchAndDisplayAgents(currentPage); // تحديث القائمة بعد الحذف
                        } catch (error) {
                            showToast(`فشل حذف الوكيل: ${error.message}`, 'error');
                        }
                    }, { title: 'تأكيد حذف الوكيل', confirmText: 'حذف نهائي', confirmClass: 'btn-danger' });
            }
            // 5. أزرار التنقل بين الصفحات
            else if (paginationBtn && !paginationBtn.disabled) {
                const newPage = paginationBtn.dataset.page;
                if (newPage) fetchAndDisplayAgents(parseInt(newPage));
            }
        });
    
        setupAgentFilters();
        await fetchAndDisplayAgents(1); // Initial fetch for page 1
    }
    
    function setupAgentFilters() {
        const searchInput = document.getElementById('agent-search-input');
        const clearBtn = document.getElementById('agent-search-clear');
        const filterButtons = document.querySelectorAll('.agent-filters .filter-btn');
        const sortSelect = document.getElementById('agent-sort-select');
    
        if (!searchInput) return;
    
        const triggerFetch = () => {
            fetchAndDisplayAgents(1); // Always go to page 1 when filters change
        };
    
        searchInput.addEventListener('input', triggerFetch);
    
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                triggerFetch();
                searchInput.focus();
            });
        }
    
        if (filterButtons.length) {
            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    triggerFetch();
                });
            });
        }
    
        if (sortSelect) {
            sortSelect.addEventListener('change', triggerFetch);
        }
    }
    
    async function fetchAndDisplayAgents(page) {
        const container = document.getElementById('agent-table-container');
        if (!container) return;
    
        container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    
        // Get filter and sort values from the UI
        const searchInput = document.getElementById('agent-search-input');
        const sortSelect = document.getElementById('agent-sort-select');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const classificationFilter = document.querySelector('.agent-filters .filter-btn.active')?.dataset.filter || 'all';
        const sortValue = sortSelect ? sortSelect.value : 'newest';
    
        if (document.getElementById('agent-search-clear')) {
            document.getElementById('agent-search-clear').style.display = searchTerm ? 'block' : 'none';
        }
    
        try {
            const queryParams = new URLSearchParams({
                page: page,
                limit: AGENTS_PER_PAGE,
                search: searchTerm,
                classification: classificationFilter,
                sort: sortValue
            });
    
            const response = await authedFetch(`/api/agents?${queryParams.toString()}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to fetch data from server.');
            }
            const { data: agents, count } = await response.json();
    
            displayAgentsPage(agents || [], page, count || 0);
        } catch (error) {
            console.error("Error fetching agents:", error);
            container.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات الوكلاء.</p>`;
            return;
        }
    }
    
    function displayAgentsPage(paginatedAgents, page, totalCount) {
        const container = document.getElementById('agent-table-container');
        if (!container) return;
    
        page = parseInt(page);
        const totalPages = Math.ceil(totalCount / AGENTS_PER_PAGE);
        
        const tableHtml = paginatedAgents.length > 0 ? `
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>الوكيل</th>
                        <th>رقم الوكالة</th>
                        <th>التصنيف</th>
                        <th>المرتبة</th>
                        <th>تاريخ التجديد</th>
                        <th>روابط التلجرام</th>
                        <th class="actions-column">الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginatedAgents.map(agent => {
                        const avatarHtml = agent.avatar_url
                            ? `<img src="${agent.avatar_url}" alt="Avatar" class="avatar-small" loading="lazy">`
                            : `<div class="avatar-placeholder-small"><i class="fas fa-user"></i></div>`;
                        
                        return `
                            <tr data-agent-id="${agent._id}">
                                <td data-label="الوكيل">
                                    <div class="table-agent-cell" style="cursor: pointer;">
                                        ${avatarHtml}
                                        <div class="agent-details">${agent.name}</div>
                                    </div>
                                </td>
                                <td data-label="رقم الوكالة" class="agent-id-text" title="نسخ الرقم">${agent.agent_id}</td>
                                <td data-label="التصنيف"><span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span></td>
                                <td data-label="المرتبة">${agent.rank || 'غير محدد'}</td>
                                <td data-label="تاريخ التجديد">${agent.next_renewal_date ? new Date(agent.next_renewal_date).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'لا يوجد'}</td>
                                <td data-label="روابط التلجرام">
                                    ${agent.telegram_channel_url ? `<a href="${agent.telegram_channel_url}" target="_blank" class="agent-table-link">القناة</a>` : ''}
                                    ${agent.telegram_channel_url && agent.telegram_group_url ? ' | ' : ''}
                                    ${agent.telegram_group_url ? `<a href="${agent.telegram_group_url}" target="_blank" class="agent-table-link">الجروب</a>` : ''}
                                </td>
                                <td class="actions-cell">
                                    <button class="btn-secondary edit-btn btn-small"><i class="fas fa-edit"></i> تعديل</button>
                                    <button class="btn-danger delete-btn btn-small"><i class="fas fa-trash-alt"></i> حذف</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        ` : '<p class="no-results-message">لا توجد وكلاء تطابق بحثك أو الفلتر الحالي.</p>';
    
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml += '<div class="pagination-container">';
            paginationHtml += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>السابق</button>`;
            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            paginationHtml += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي</button>`;
            paginationHtml += '</div>';
        }
    
        container.innerHTML = `<div class="table-responsive-container">${tableHtml}</div>${paginationHtml}`;
    
        // The event listener is now attached once in renderManageAgentsPage, so no need to re-attach.
    }
    
    // --- NEW: Delete All Agents Feature (Super Admin only) ---
    async function handleDeleteAllAgents() {
        // --- تعديل: استخدام الواجهة الخلفية الجديدة لحذف جميع الوكلاء ---
        const modalContent = `
            <p class="warning-text" style="font-size: 1.1em;">
                <i class="fas fa-exclamation-triangle"></i> <strong>تحذير خطير!</strong> 
            </p>
            <p>أنت على وشك حذف <strong>جميع الوكلاء</strong> من النظام بشكل نهائي. هذا الإجراء لا يمكن التراجع عنه وسيزيل جميع بياناتهم ومسابقاتهم وسجلاتهم.</p>
            <p style="margin-top: 15px;">للتأكيد، يرجى كتابة كلمة "<strong>حذف</strong>" في الحقل أدناه:</p>
            <div class="form-group" style="margin-top: 10px;">
                <input type="text" id="delete-confirmation-input" class="modal-input" autocomplete="off">
            </div>
        `;
        showConfirmationModal(
            modalContent,
            async () => {
                const response = await authedFetch('/api/agents/delete-all', { method: 'DELETE' });
                if (response.ok) {
                    showToast('تم حذف جميع الوكلاء بنجاح.', 'success');
                    await fetchAndDisplayAgents(1);
                } else {
                    const result = await response.json();
                    showToast(result.message || 'فشل حذف جميع الوكلاء.', 'error');
                }
            },
            {
                title: 'تأكيد الحذف النهائي',
                confirmText: 'نعم، أحذف الكل',
                confirmClass: 'btn-danger',
                onRender: (modal) => {
                    const confirmBtn = modal.querySelector('#confirm-btn');
                    const confirmationInput = modal.querySelector('#delete-confirmation-input');
                    confirmBtn.disabled = true; // Disable by default
    
                    confirmationInput.addEventListener('input', () => {
                        if (confirmationInput.value.trim() === 'حذف') {
                            confirmBtn.disabled = false;
                            confirmBtn.classList.add('pulse-animation');
                        } else {
                            confirmBtn.disabled = true;
                            confirmBtn.classList.remove('pulse-animation');
                        }
                    });
                }
            }
        );
    }
    
    // --- NEW: Bulk Renew Balances Feature ---
    async function handleBulkRenewBalances() {
        try {
            // --- NEW: Fetch all agents first to get a count and show progress ---
            showLoader('جاري جلب قائمة الوكلاء...');
            const response = await authedFetch('/api/agents?limit=10000&select=name'); // Fetch all agents
            if (!response.ok) {
                throw new Error('فشل في جلب قائمة الوكلاء للبدء في عملية التجديد.');
            }
            const { data: agents } = await response.json();
            hideLoader();
    
            if (!agents || agents.length === 0) {
                showToast('لا يوجد وكلاء نشطون لتجديد أرصدتهم.', 'info');
                return;
            }
    
            const agentCount = agents.length;
    
            showConfirmationModal(
                `سيتم تجديد أرصدة <strong>${agentCount}</strong> وكيل. هذه العملية قد تستغرق بعض الوقت. هل أنت متأكد من المتابعة؟`,
                async () => {
                    console.log('[Bulk Renew] Starting client-side bulk renewal process.');
                    const progressModalOverlay = showProgressModal(
                        'تجديد الأرصدة الجماعي',
                        `
                        <div class="update-progress-container">
                            <i class="fas fa-sync-alt fa-spin update-icon"></i>
                            <h3 id="bulk-renew-status-text">جاري التهيئة...</h3>
                            <div class="progress-bar-outer">
                                <div id="bulk-renew-progress-bar-inner" class="progress-bar-inner"></div>
                            </div>
                        </div>
                        `
                    );
    
                    const statusText = document.getElementById('bulk-renew-status-text');
                    const progressBar = document.getElementById('bulk-renew-progress-bar-inner');
                    const updateIcon = progressModalOverlay.querySelector('.update-icon');
                    let processedCount = 0;
                    let errorCount = 0;
    
                    for (let i = 0; i < agents.length; i++) {
                        const agent = agents[i];
                        processedCount++;
                        const progressPercentage = Math.round((processedCount / agentCount) * 100);
    
                        statusText.innerHTML = `(${processedCount}/${agentCount}) جاري تجديد رصيد: <strong>${agent.name}</strong>`;
                        progressBar.style.width = `${progressPercentage}%`;
    
                        try {
                            const renewResponse = await authedFetch(`/api/agents/${agent._id}/renew`, { method: 'POST' });
                            if (!renewResponse.ok) {
                                errorCount++;
                                console.error(`Failed to renew balance for agent ${agent.name}`);
                            }
                            // A small delay to prevent overwhelming the server and to make the UI updates visible
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } catch (err) {
                            errorCount++;
                            console.error(`Error renewing balance for agent ${agent.name}:`, err);
                        }
                    }
    
                    progressBar.style.width = '100%';
                    updateIcon.className = errorCount > 0 ? 'fas fa-exclamation-triangle update-icon' : 'fas fa-check-circle update-icon';
                    progressBar.style.backgroundColor = errorCount > 0 ? 'var(--warning-color)' : 'var(--success-color)';
                    statusText.innerHTML = `اكتمل التجديد.<br>تمت معالجة <strong>${processedCount}</strong> وكيل.<br>${errorCount > 0 ? `(مع وجود <strong>${errorCount}</strong> أخطاء)` : ''}`;
    
                    console.log(`[Bulk Renew] Client-side process finished. Processed: ${processedCount}, Errors: ${errorCount}`);
                    await fetchAndDisplayAgents(1); // Refresh the agents list
    
                    setTimeout(() => {
                        if (progressModalOverlay) progressModalOverlay.remove();
                    }, 4000);
                },
                { title: 'تأكيد تجديد الأرصدة', confirmText: 'نعم، جدد الآن', confirmClass: 'btn-renewal' }
            );
    
        } catch (error) {
            hideLoader();
            showToast(error.message, 'error');
            console.error('[Bulk Renew] Error setting up bulk renewal:', error);
        }
    }
    
    async function handleMarkAllTasksComplete() {
        // 1. جلب وكلاء اليوم
        // --- تعديل: استخدام الواجهة الخلفية الجديدة لجلب وكلاء اليوم ---
        const response = await authedFetch('/api/agents?for_tasks=today&select=_id');
        if (!response.ok) {
            showToast('فشل جلب قائمة وكلاء اليوم.', 'error');
            return;
        }
        const { data: agentsForToday } = await response.json();
        
        if (!agentsForToday || agentsForToday.length === 0) {
            showToast('لا توجد مهام مجدولة لهذا اليوم.', 'info');
            return;
        }
        // 2. إظهار نافذة التأكيد
        showConfirmationModal(
            `هل أنت متأكد من تمييز جميع مهام اليوم (${agentsForToday.length} وكيل) كمكتملة؟`,
            async () => {
                const todayStr = new Date().toISOString().split('T')[0];
                const agentIds = agentsForToday.map(agent => agent._id);
    
                // --- تعديل: استخدام الواجهة الخلفية الجديدة لتحديث المهام ---
                const completeResponse = await authedFetch('/api/tasks/bulk-complete', {
                    method: 'POST',
                    body: JSON.stringify({ agentIds, date: todayStr })
                });
    
                if (!completeResponse.ok) {
                    showToast('فشل تحديث المهام بشكل جماعي.', 'error');
                } else {
                    showToast('تم تمييز جميع المهام كمكتملة بنجاح.', 'success');
                    // The tasks page is not currently rendered, so no need to refresh it.
                }
            }, { title: 'تأكيد إكمال جميع المهام', confirmText: 'نعم، إكمال الكل', confirmClass: 'btn-primary' }
        );
    }
    
    async function handleBulkSendBalances() {
        // تعديل: جلب الوكلاء المؤهلين من الواجهة الخلفية الجديدة
        const response = await authedFetch('/api/agents?eligibleForBalance=true');
        if (!response.ok) {
            showToast('فشل جلب بيانات الوكلاء المؤهلين.', 'error');
            return;
        }
        const { data: eligibleAgents, error: fetchError } = await response.json();
    
        if (fetchError) {
            showToast('فشل جلب بيانات الوكلاء المؤهلين.', 'error');
            return;
        }
    
        const agentCount = eligibleAgents.length;
    
        if (agentCount === 0) {
            showToast('لا يوجد وكلاء مؤهلون (لديهم معرف دردشة ورصيد متاح) لإرسال التعميم.', 'info');
            return;
        }
    
        const modalContent = `
            <p>سيتم إرسال كليشة الرصيد المتاح إلى <strong>${agentCount}</strong> وكيل مؤهل.</p>
            <p>سيتم تجهيز رسالة فريدة لكل وكيل تحتوي على تفاصيل رصيده وبونص الإيداع الخاص به.</p>
            <p class="warning-text" style="margin-top: 15px;"><i class="fas fa-exclamation-triangle"></i> هل أنت متأكد من المتابعة؟</p>
        `;
    
        showConfirmationModal(
            modalContent,
            async () => {
                showBulkSendProgressModal(agentCount);
    
                let successCount = 0;
                let errorCount = 0;
                const progressBar = document.getElementById('bulk-send-progress-bar-inner');
                const statusText = document.getElementById('bulk-send-status-text');
                const renewalPeriodMap = {
                    'weekly': 'أسبوعي',
                    'biweekly': 'كل أسبوعين',
                    'monthly': 'شهري'
                };
    
                for (let i = 0; i < eligibleAgents.length; i++) {
                    const agent = eligibleAgents[i];
                    
                    // --- FIX: Improved message construction logic ---
                    const renewalValue = (agent.renewal_period && agent.renewal_period !== 'none') 
                        ? (renewalPeriodMap[agent.renewal_period] || '')
                        : '';
    
                    let benefitsText = '';
                    if ((agent.remaining_balance || 0) > 0) {
                        benefitsText += `💰 <b>بونص تداولي:</b> <code>${agent.remaining_balance}$</code>\n`;
                    }
                    if ((agent.remaining_deposit_bonus || 0) > 0) {
                        benefitsText += `🎁 <b>بونص ايداع:</b> <code>${agent.remaining_deposit_bonus}</code> مرات بنسبة <code>${agent.deposit_bonus_percentage || 0}%</code>\n`;
                    }
    
                    const clicheText = `<b>دمت بخير شريكنا العزيز ${agent.name}</b> ...\n\nيسرنا ان نحيطك علما بأن حضرتك كوكيل لدى شركة انزو تتمتع برصيد مسابقات:\n${renewalValue ? `(<b>${renewalValue}</b>):\n\n` : ''}${benefitsText.trim()}\n\nبامكانك الاستفادة منه من خلال انشاء مسابقات اسبوعية لتنمية وتطوير العملاء التابعين للوكالة.\n\nهل ترغب بارسال مسابقة لحضرتك؟`;
    
                    // --- FIX: Use authedFetch for authenticated requests ---
                    try {
                        const response = await authedFetch('/api/post-announcement', {
                            method: 'POST',
                            body: JSON.stringify({ message: clicheText, chatId: agent.telegram_chat_id })
                        });
    
                        if (!response.ok) errorCount++;
                        else successCount++;
    
                    } catch (e) {
                        errorCount++;
                    }
    
                    const progress = Math.round(((i + 1) / agentCount) * 100);
                    progressBar.style.width = `${progress}%`;
                    statusText.innerHTML = `جاري إرسال الأرصدة... (${i + 1} / ${agentCount})<br>نجح: ${successCount} | فشل: ${errorCount}`;
                    // إصلاح: نقل التأخير الزمني إلى داخل الحلقة ليعمل بشكل صحيح
                    if (i < eligibleAgents.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 400)); // 400ms delay
                    }
                } // نهاية الحلقة for
    
                // Update modal with final result
                statusText.innerHTML = `اكتمل تعميم الأرصدة.<br><strong>${successCount}</strong> رسالة ناجحة | <strong>${errorCount}</strong> رسالة فاشلة.`;
                progressBar.style.backgroundColor = errorCount > 0 ? 'var(--danger-color)' : 'var(--success-color)';
                document.querySelector('.modal-no-actions .update-icon').className = 'fas fa-check-circle update-icon';
                await logAgentActivity(null, 'BULK_BALANCE_SENT', `تم تعميم الأرصدة إلى ${successCount} وكيل (فشل ${errorCount}).`);
    
                // --- تعديل: إخفاء نافذة التقدم تلقائياً بعد 3 ثوانٍ ---
                setTimeout(() => {
                    // ابحث عن النافذة المنبثقة النشطة وقم بإزالتها
                    const modalOverlay = document.querySelector('.modal-overlay');
                    if (modalOverlay) {
                        modalOverlay.remove();
                    }
                }, 3000); // إغلاق بعد 3 ثوانٍ
            }, {
                title: 'تعميم الأرصدة المتاحة',
                confirmText: 'إرسال الآن',
                confirmClass: 'btn-telegram-bonus',
                cancelText: 'إلغاء',
                modalClass: 'modal-wide'
            }
        );
    }
    
    // --- NEW: Bulk Broadcast Feature (Super Admin only) ---
    async function handleBulkBroadcast() {
        // Step 1: Show a modal to write the message
        const messageModalContent = `
            <p>اكتب الرسالة التي تود إرسالها لجميع الوكلاء المؤهلين.</p>
            <p><small>سيتم إرسال الرسالة فقط للوكلاء الذين لديهم معرف دردشة واسم مجموعة صحيحين.</small></p>
            <div class="form-group" style="margin-top: 15px;">
                <textarea id="broadcast-message-input" class="modal-textarea-preview" rows="10" placeholder="اكتب رسالتك هنا..."></textarea>
            </div>
        `;
    
        showConfirmationModal(
            messageModalContent,
            async () => {
                const message = document.getElementById('broadcast-message-input').value.trim();
                if (!message) {
                    showToast('لا يمكن إرسال رسالة فارغة.', 'error');
                    return;
                }
    
                // Step 2: Fetch eligible agents to get the count
                try {
                    showLoader();
                    const response = await authedFetch('/api/agents?eligibleForBroadcast=true&limit=5000&select=_id name agent_id telegram_chat_id');
                    if (!response.ok) throw new Error('فشل جلب قائمة الوكلاء.');
                    
                    const { data: eligibleAgents } = await response.json();
                    hideLoader();
    
                    console.log('Eligible agents for broadcast:', eligibleAgents); // DEBUG
    
                    if (!eligibleAgents || eligibleAgents.length === 0) {
                        showToast('لا يوجد وكلاء مؤهلون لإرسال التعميم لهم.', 'info');
                        return;
                    }
    
                    // Step 3: Show final confirmation and then start sending
                    showConfirmationModal(
                        `سيتم إرسال رسالتك إلى <strong>${eligibleAgents.length}</strong> وكيل. هل أنت متأكد من المتابعة؟`,
                        async () => {
                            showBulkSendProgressModal(eligibleAgents.length, 'تعميم جماعي');
    
                            let successCount = 0;
                            let errorCount = 0;
                            const failedAgents = [];
                            const progressBar = document.getElementById('bulk-send-progress-bar-inner');
                            const statusText = document.getElementById('bulk-send-status-text');
    
                            for (let i = 0; i < eligibleAgents.length; i++) {
                                const agent = eligibleAgents[i];
                                try {
                                    const sendResponse = await authedFetch('/api/post-announcement', {
                                        method: 'POST',
                                        body: JSON.stringify({ message: message, chatId: agent.telegram_chat_id })
                                    });
                                    if (!sendResponse.ok) {
                                        const errorData = await sendResponse.json();
                                        const reason = translateTelegramError(errorData.telegram_error || errorData.message);
                                        throw new Error(reason);
                                    }
                                    successCount++;
                                } catch (e) {
                                    errorCount++;
                                    const errorMessage = e.message;
                                    failedAgents.push({ name: agent.name, reason: errorMessage });
                                    console.error(`Failed to send broadcast to agent ${agent.name} (${agent.agent_id}): ${errorMessage}`);
                                }
    
                                const progress = Math.round(((i + 1) / eligibleAgents.length) * 100);
                                progressBar.style.width = `${progress}%`;
                                statusText.innerHTML = `جاري الإرسال... (${i + 1} / ${eligibleAgents.length})<br>نجح: ${successCount} | فشل: ${errorCount}`;
                                
                                // Add a small delay between messages to avoid rate limiting
                                if (i < eligibleAgents.length - 1) {
                                    await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
                                }
                            }
    
                            // Final update to progress modal
                            let finalMessage = `اكتمل التعميم.<br><strong>${successCount}</strong> رسالة ناجحة | <strong>${errorCount}</strong> رسالة فاشلة.`;
                            if (errorCount > 0) {
                                finalMessage += `<br><br><strong>الأخطاء:</strong><ul class="error-list">`;
                                failedAgents.forEach(fail => {
                                    finalMessage += `<li><strong>${fail.name}:</strong> ${fail.reason}</li>`;
                                });
                                finalMessage += `</ul>`;
                            }
                            statusText.innerHTML = finalMessage;
                            progressBar.style.backgroundColor = errorCount > 0 ? 'var(--danger-color)' : 'var(--success-color)';
                            document.querySelector('.modal-no-actions .update-icon').className = 'fas fa-check-circle update-icon';
                            
                            // Log the activity
                            await logAgentActivity(currentUserProfile?._id, null, 'BULK_BROADCAST', `تم إرسال تعميم جماعي إلى ${successCount} وكيل (فشل ${errorCount}).`);
    
                            setTimeout(() => {
                                const modalOverlay = document.querySelector('.modal-overlay');
                                if (modalOverlay) modalOverlay.remove();
                            }, 4000 + (errorCount * 500)); // Keep modal open a bit longer if there are errors to read
                        },
                        { title: 'تأكيد الإرسال الجماعي', confirmText: 'نعم، أرسل الآن', confirmClass: 'btn-telegram-broadcast' }
                    );
                } catch (error) {
                    hideLoader();
                    showToast(error.message, 'error');
                }
            },
            {
                title: 'إنشاء رسالة تعميم جماعي',
                confirmText: 'متابعة',
                confirmClass: 'btn-primary',
                modalClass: 'modal-wide'
            }
        );
    }
    
    function showBulkSendProgressModal(total) {
        const modalContent = `
            <div class="update-progress-container">
                <i class="fas fa-paper-plane update-icon"></i>
                <h3 id="bulk-send-status-text">جاري التهيئة لإرسال ${total} رسالة...</h3>
                <div class="progress-bar-outer">
                    <div id="bulk-send-progress-bar-inner" class="progress-bar-inner"></div>
                </div>
            </div>
        `;
        showConfirmationModal(modalContent, null, {
            title: 'عملية الإرسال الجماعي',
            showCancel: false,
            showConfirm: false,
            modalClass: 'modal-no-actions'
        });
    }
    
    async function renderMiniCalendar() {
        const wrapper = document.getElementById('tasks-calendar-wrapper');
        if (!wrapper) return;
    
        wrapper.innerHTML = `
            <div class="page-header" style="padding: 0; border: none;">
                <div class="header-top-row">
                    <h2>التقويم</h2>
                </div>
            </div>
            <div id="mini-calendar-container"></div>
        `;
    
        const calendarContainer = document.getElementById('mini-calendar-container');
        const today = new Date();
        const month = today.getMonth();
    
    
        const year = today.getFullYear();
    
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
    
        let calendarHtml = `
            <div class="mini-calendar-header">
                <span class="month-year">${today.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</span>
            </div>
            <div class="mini-calendar-grid">
                ${['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map(day => `<div class="day-name">${day}</div>`).join('')}
        `;
    
        // Add empty cells for the first day of the week
        for (let i = 0; i < firstDay; i++) {
            calendarHtml += '<div></div>';
        }
    
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = day === today.getDate();
            calendarHtml += `<div class="day-cell ${isToday ? 'today' : ''}">${day}</div>`;
        }
    
        calendarHtml += '</div>';
        calendarContainer.innerHTML = calendarHtml;
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
                    ${agent.is_exclusive ? '<div class="exclusive-badge"><i class="fas fa-star"></i> حصري</div>' : ''}
                </div>
            </div>
        `;
    }
    

    // == competitions.js ==
    // --- Main Router for Competitions/Templates Section ---
    const COMPETITIONS_PER_PAGE = 10; // Changed to 10 for consistency
    let competitionListCountdownInterval = null; // For the main list countdown
    let selectedCompetitionIds = []; // For bulk actions
    
    
    async function renderCompetitionsPage() {
        const hash = window.location.hash;
        const urlParams = new URLSearchParams(hash.split('?')[1]);
        const agentId = urlParams.get('agentId');
    
        if (hash.startsWith('#competitions/new')) {
            await renderCompetitionCreatePage(agentId);
        } else if (hash.startsWith('#competitions/edit/')) {
            const compId = hash.split('/')[2];
            await renderCompetitionEditForm(compId);
        } else if (hash.startsWith('#archived-competitions')) {
            await renderArchivedCompetitionsPage();
        } else {
            // Default to #competitions
            await renderCompetitionManagementPage();
        }
    
        // Cleanup timer when navigating away
        window.addEventListener('hashchange', () => {
            if (competitionListCountdownInterval) clearInterval(competitionListCountdownInterval);
        });
    }
    
    // --- 0. All Competitions List Page (New Default) ---
    async function renderCompetitionManagementPage() {
        const appContent = document.getElementById('app-content');
        // --- NEW: Permission Check ---
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
        const compsPerm = currentUserProfile?.permissions?.competitions?.manage_comps || 'none';
        const canView = isAdmin || compsPerm === 'full' || compsPerm === 'view';
        if (!canView) {
            appContent.innerHTML = `
                <div class="access-denied-container">
                    <i class="fas fa-lock"></i>
                    <h2>ليس لديك صلاحية وصول</h2>
                    <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
                </div>`;
            return;
        }
    
        const canEdit = isAdmin || compsPerm === 'full';
        selectedCompetitionIds = []; // Reset selection on page render
        appContent.innerHTML = `
            <div class="page-header column-header">
                <div class="header-top-row">
                    <h1>إدارة المسابقات النشطة</h1>
                </div>
                <div class="filters-container">
                    <div class="filter-search-container">
                        <input type="search" id="competition-search-input" placeholder="بحث باسم المسابقة أو الوكيل..." autocomplete="off">
                        <i class="fas fa-search"></i>
                        <i class="fas fa-times-circle search-clear-btn" id="competition-search-clear"></i>
                    </div>
                    <div class="filter-controls">
                        <div class="filter-group">
                            <label class="filter-label">فلترة حسب الحالة</label>
                            <div class="filter-buttons" data-filter-group="status">
                                <button class="filter-btn active" data-filter="all">الكل</button>
                                <button class="filter-btn" data-filter="active">نشطة</button>
                                <button class="filter-btn" data-filter="inactive">غير نشطة</button>
                            </div>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">فلترة حسب التصنيف</label>
                            <div class="filter-buttons" data-filter-group="classification">
                                <button class="filter-btn active" data-filter="all">الكل</button>
                                <button class="filter-btn" data-filter="R">R</button>
                                <button class="filter-btn" data-filter="A">A</button>
                                <button class="filter-btn" data-filter="B">B</button>
                                <button class="filter-btn" data-filter="C">C</button>
                            </div>
                        </div>
                    </div>
                    <div class="sort-container">
                        <label for="competition-sort-select">ترتيب حسب:</label>
                        <select id="competition-sort-select">
                            <option value="newest">الأحدث أولاً</option>
                            <option value="name_asc">اسم المسابقة (أ - ي)</option>
                            <option value="agent_asc">اسم الوكيل (أ - ي)</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="bulk-action-bar" class="bulk-action-bar">
                <span id="bulk-action-count">0 عنصر محدد</span>
                ${canEdit ? `
                    <div class="bulk-actions">
                        <button id="bulk-deactivate-btn" class="btn-secondary"><i class="fas fa-power-off"></i> تعطيل المحدد</button>
                        <button id="bulk-delete-btn" class="btn-danger"><i class="fas fa-trash-alt"></i> حذف المحدد</button>
                    </div>
                ` : ''}
            </div>
            <div id="competitions-list-container"></div>
        `;
    
        const container = document.getElementById('competitions-list-container');
    
        // Use event delegation for delete buttons
        container.addEventListener('click', async (e) => { // Listen on a parent that persists
            if (!canEdit && (e.target.closest('.delete-competition-btn') || e.target.closest('#bulk-deactivate-btn') || e.target.closest('#bulk-delete-btn'))) {
                showToast('ليس لديك صلاحية للقيام بهذا الإجراء.', 'error');
                return;
            }
             const deleteBtn = e.target.closest('.delete-competition-btn');
            if (deleteBtn && canEdit) {
                const id = deleteBtn.dataset.id;
                if (!id) return;
                showConfirmationModal(
                    'هل أنت متأكد من حذف هذه المسابقة؟<br><small>هذا الإجراء لا يمكن التراجع عنه.</small>',
                    async () => {
                        const response = await authedFetch(`/api/competitions/${id}`, { method: 'DELETE' });
                        if (!response.ok) {
                            const result = await response.json();
                            showToast(`فشل حذف المسابقة: ${result.message}`, 'error');
                        } else {
                            showToast('تم حذف المسابقة بنجاح.', 'success');
                            await fetchAndDisplayCompetitions(1); // Refetch from server
                        }
                    }, {
                        title: 'تأكيد حذف المسابقة',
                        confirmText: 'حذف',
                        confirmClass: 'btn-danger'
                    });
            }
        });
    
        // Separate listener for status toggle to avoid complexity
        container.addEventListener('change', async (e) => {
            const statusToggle = e.target.closest('.competition-status-toggle');
            if (statusToggle) {
                if (!canEdit) {
                    showToast('ليس لديك صلاحية لتغيير حالة المسابقة.', 'error');
                    statusToggle.checked = !statusToggle.checked; // Revert UI
                    return;
                }
                const id = statusToggle.dataset.id;
                const isActive = statusToggle.checked;
    
                const response = await authedFetch(`/api/competitions/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ is_active: isActive })
                });
                if (!response.ok) {
                    showToast('فشل تحديث حالة المسابقة.', 'error');
                    statusToggle.checked = !isActive; // Revert UI on error
                } else {
                    showToast(`تم تحديث حالة المسابقة إلى "${isActive ? 'نشطة' : 'غير نشطة'}".`, 'success');
                    // No need to refetch, UI is already updated.
                }
            }
        });
        // --- NEW: Attach bulk action listeners separately ---
        const bulkDeactivateBtn = document.getElementById('bulk-deactivate-btn');
        if (bulkDeactivateBtn && canEdit) {
            bulkDeactivateBtn.addEventListener('click', () => {
                showConfirmationModal(
                    `هل أنت متأكد من تعطيل ${selectedCompetitionIds.length} مسابقة؟`,
                    async () => {
                        const response = await authedFetch('/api/competitions/bulk-update', {
                            method: 'PUT',
                            body: JSON.stringify({ ids: selectedCompetitionIds, data: { is_active: false } })
                        });
                        if (!response.ok) {
                            const result = await response.json();
                            showToast(result.message || 'فشل تعطيل المسابقات المحددة.', 'error');
                        } else {
                            showToast('تم تعطيل المسابقات المحددة بنجاح.', 'success');
                            await fetchAndDisplayCompetitions(1);
                        }
                    }, { title: 'تأكيد التعطيل' }
                );
            });
        }
    
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        if (bulkDeleteBtn && canEdit) {
            bulkDeleteBtn.addEventListener('click', () => {
                showConfirmationModal(
                    `هل أنت متأكد من حذف ${selectedCompetitionIds.length} مسابقة بشكل نهائي؟`,
                    async () => {
                        const response = await authedFetch('/api/competitions/bulk-delete', {
                            method: 'DELETE',
                            body: JSON.stringify({ ids: selectedCompetitionIds })
                        });
                        if (!response.ok) {
                            const result = await response.json();
                            showToast(result.message || 'فشل حذف المسابقات المحددة.', 'error');
                        } else {
                            showToast('تم حذف المسابقات المحددة بنجاح.', 'success');
                            await fetchAndDisplayCompetitions(1);
                        }
                    }, {
                        title: 'تأكيد الحذف',
                        confirmText: 'حذف',
                        confirmClass: 'btn-danger'
                    }
                );
            });
        }
    
        // Initial fetch and setup
        setupCompetitionFilters();
        await fetchAndDisplayCompetitions(1);
    
        // FIX: Setup one-time global listener for this page
        setupCompetitionListGlobalListeners();
    }
    
    async function fetchAndDisplayCompetitions(page) {
        const container = document.getElementById('competitions-list-container');
        if (!container) return;
        container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    
        // Get filter and sort values from the UI
        const searchInput = document.getElementById('competition-search-input');
        const sortSelect = document.getElementById('competition-sort-select');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const statusFilter = document.querySelector('.filter-buttons[data-filter-group="status"] .filter-btn.active')?.dataset.filter || 'all';
        const classificationFilter = document.querySelector('.filter-buttons[data-filter-group="classification"] .filter-btn.active')?.dataset.filter || 'all';
        const sortValue = sortSelect ? sortSelect.value : 'newest';
    
        if (document.getElementById('competition-search-clear')) {
            document.getElementById('competition-search-clear').style.display = searchTerm ? 'block' : 'none';
        }
    
        const queryParams = new URLSearchParams({
            page: page,
            limit: COMPETITIONS_PER_PAGE,
            search: searchTerm,
            status: statusFilter,
            classification: classificationFilter,
            sort: sortValue,
            excludeStatus: 'completed' // Always exclude completed competitions
        });
    
        const response = await authedFetch(`/api/competitions?${queryParams.toString()}`);
    
        if (!response.ok) {
            console.error("Error fetching competitions:", await response.text());
            container.innerHTML = `<p class="error">حدث خطأ أثناء جلب المسابقات.</p>`;
            return;
        }
    
        const { data: competitions, count } = await response.json();
    
        displayCompetitionsPage(competitions || [], page, count || 0);
    }
    
    function displayCompetitionsPage(paginatedCompetitions, page, totalCount) {
        const container = document.getElementById('competitions-list-container');
        if (!container) return;
    
        page = parseInt(page);
        const totalPages = Math.ceil(totalCount / COMPETITIONS_PER_PAGE);
    
        const gridHtml = generateCompetitionGridHtml(paginatedCompetitions);
    
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml += '<div class="pagination-container">';
            paginationHtml += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>السابق</button>`;
            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            paginationHtml += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي</button>`;
            paginationHtml += '</div>';
        }
    
        // Improved empty state
        let finalHtml;
        if (paginatedCompetitions.length > 0) {
            const selectAllChecked = selectedCompetitionIds.length > 0 && paginatedCompetitions.every(c => selectedCompetitionIds.includes(c.id));
            const listHeader = `
                <div class="list-view-header">
                    <label class="custom-checkbox">
                        <input type="checkbox" id="select-all-competitions" ${selectAllChecked ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                    <span class="header-name">المسابقة</span>
                    <span class="header-status">الحالة</span>
                    <span class="header-agent">الوكيل</span>
                    <span class="header-actions">الإجراءات</span>
                </div>
            `;
            finalHtml = `${listHeader}<div class="competitions-list-view">${gridHtml}</div>${paginationHtml}`;
        } else {
            finalHtml = '<p class="no-results-message">لا توجد نتائج تطابق بحثك أو الفلتر الحالي.</p>';
        }
        container.innerHTML = finalHtml;
    
        // Attach event listeners for checkboxes and pagination
        attachCompetitionListListeners(paginatedCompetitions, totalCount);
    
        // Start the countdown timers for the newly rendered list
        startCompetitionListCountdowns();
    }
    function startCompetitionListCountdowns() {
        if (competitionListCountdownInterval) clearInterval(competitionListCountdownInterval);
    
        const updateTimers = () => {
            document.querySelectorAll('.competition-list-countdown').forEach(el => {
                updateCountdownTimer(el);
            });
        };
        updateTimers(); // Run once immediately
        competitionListCountdownInterval = setInterval(updateTimers, 1000);
    }
    
    function setupCompetitionListGlobalListeners() {
        const container = document.getElementById('app-content');
        container.addEventListener('click', (e) => { // Handle edit button clicks using event delegation
            const agentCell = e.target.closest('.table-agent-cell');
            if (agentCell) {
                const agentId = agentCell.dataset.agentId;
                if (agentId) window.location.hash = `#profile/${agentId}`;
            }
        });
    }
    
    function generateCompetitionGridHtml(competitions) {
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const compsPerm = currentUserProfile?.permissions?.competitions?.manage_comps;
        const canEdit = isSuperAdmin || compsPerm === 'full';
    
        if (competitions.length === 0) return ''; // Let displayCompetitionsPage handle the empty message
        return competitions.map(comp => { // The agent object is now nested under 'agent' not 'agents'
            const isSelected = selectedCompetitionIds.includes(comp.id);
            const agent = comp.agents;
            const agentInfoHtml = agent
                ? `<a href="#profile/${agent._id}" class="table-agent-cell" data-agent-id="${agent._id}">
                        ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Agent Avatar" class="avatar-small" loading="lazy">` : `<div class="avatar-placeholder-small"><i class="fas fa-user"></i></div>`}
                        <div class="agent-details">
                            <span>${agent.name}</span>
                            ${agent.classification ? `<span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>` : ''}
                        </div>
                   </a>`
                : `<div class="table-agent-cell"><span>(وكيل محذوف أو غير مرتبط)</span></div>`;
    
            let countdownHtml = '';
            if (comp.ends_at && comp.status !== 'completed' && comp.status !== 'awaiting_winners') {
                const endDate = new Date(comp.ends_at);
                const formattedDate = endDate.toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric' });
                countdownHtml = `
                    <div class="competition-timing-info">
                        <div class="competition-list-countdown" data-end-date="${comp.ends_at}"><i class="fas fa-hourglass-half"></i> <span>جاري الحساب...</span></div>
                        <div class="competition-end-date"><i class="fas fa-calendar-check"></i> <span>تنتهي في: ${formattedDate}</span></div>
                    </div>
                `;
            }
    
            return `
            <div class="competition-card ${isSelected ? 'selected' : ''}" data-id="${comp.id}">
                <label class="custom-checkbox row-checkbox">
                    <input type="checkbox" class="competition-select-checkbox" data-id="${comp.id}" ${isSelected ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
                <div class="competition-card-name">
                    <h3>${comp.name}</h3>
                    ${countdownHtml}
                </div>
                <div class="competition-card-status">
                    <label class="custom-checkbox toggle-switch small-toggle" title="${comp.is_active ? 'تعطيل' : 'تفعيل'}" ${!canEdit ? 'style="cursor:not-allowed;"' : ''}>
                        <input type="checkbox" class="competition-status-toggle" data-id="${comp.id}" ${comp.is_active ? 'checked' : ''} ${!canEdit ? 'disabled' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                ${agentInfoHtml}
                <div class="competition-card-footer">
                    <button class="btn-danger delete-competition-btn" title="حذف" data-id="${comp.id}"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            `;
        }).join('');
    }
    
    function setupCompetitionFilters() {
        const searchInput = document.getElementById('competition-search-input');
        const clearBtn = document.getElementById('competition-search-clear');
        const sortSelect = document.getElementById('competition-sort-select');
    
        const triggerFetch = () => {
            fetchAndDisplayCompetitions(1); // Always go to page 1 when filters change
        };
    
        if (searchInput) {
            // Use a debounce to avoid fetching on every keystroke
            let searchTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(triggerFetch, 300); // 300ms delay
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (searchInput.value) {
                    searchInput.value = '';
                    triggerFetch();
                    searchInput.focus();
                }
            });
        }
    
        if (sortSelect) {
            sortSelect.addEventListener('change', triggerFetch);
        }
    
        document.querySelectorAll('.filter-buttons').forEach(group => {
            group.addEventListener('click', (e) => {
                if (e.target.classList.contains('filter-btn')) {
                    group.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    triggerFetch();
                }
            });
        });
    }
    
    // New helper functions for bulk actions
    function attachCompetitionListListeners(paginatedList, totalCount) {
        const container = document.getElementById('competitions-list-container');
        if (!container) return;
    
        // Pagination
        container.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newPage = parseInt(e.currentTarget.dataset.page);
                if (newPage) fetchAndDisplayCompetitions(newPage);
            });
        });
    
        // Individual checkboxes
        container.querySelectorAll('.competition-select-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) {
                    if (!selectedCompetitionIds.includes(id)) {
                        selectedCompetitionIds.push(id);
                    }
                } else {
                    selectedCompetitionIds = selectedCompetitionIds.filter(selectedId => selectedId !== id);
                }
                updateBulkActionBar(paginatedList.length);
                // Also update the row's selected class
                e.target.closest('.competition-card').classList.toggle('selected', e.target.checked);
            });
        });
    
        // Select All checkbox
        const selectAllCheckbox = document.getElementById('select-all-competitions');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const paginatedIds = paginatedList.map(c => c.id);
                if (e.target.checked) {
                    // Add only the ones not already selected
                    paginatedIds.forEach(id => {
                        if (!selectedCompetitionIds.includes(id)) {
                            selectedCompetitionIds.push(id);
                        }
                    });
                } else {
                    // Remove all from the current page
                    selectedCompetitionIds = selectedCompetitionIds.filter(id => !paginatedIds.includes(id));
                }
                const currentPage = document.querySelector('.pagination-container .page-btn.active')?.dataset.page || 1;
                // Re-render the current page to update checkbox states
                fetchAndDisplayCompetitions(currentPage);
                updateBulkActionBar(paginatedList.length);
            });
        }
    }
    
    function updateBulkActionBar(currentPageItemCount) {
        const bar = document.getElementById('bulk-action-bar');
        const countSpan = document.getElementById('bulk-action-count');
        const selectAllCheckbox = document.getElementById('select-all-competitions');
    
        if (selectedCompetitionIds.length > 0) {
            bar.classList.add('visible');
            countSpan.textContent = `${selectedCompetitionIds.length} عنصر محدد`;
        } else {
            bar.classList.remove('visible');
        }
    
        if (selectAllCheckbox) {
            const paginatedIds = Array.from(document.querySelectorAll('.competition-select-checkbox')).map(cb => parseInt(cb.dataset.id));
            const allOnPageSelected = currentPageItemCount > 0 && paginatedIds.every(id => selectedCompetitionIds.includes(id));
            selectAllCheckbox.checked = allOnPageSelected;
        }
    }
    
    async function renderCompetitionCreatePage(agentId) {
        const appContent = document.getElementById('app-content');
        let competitionImageFile = null; // Variable to hold the new image file
    
        // --- NEW: Permission Check ---
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const canCreate = isSuperAdmin || currentUserProfile?.permissions?.competitions?.can_create;
        if (!canCreate) {
            appContent.innerHTML = `
                <div class="access-denied-container">
                    <i class="fas fa-lock"></i>
                    <h2>ليس لديك صلاحية لإنشاء مسابقة</h2>
                    <p>أنت لا تملك الصلاحية اللازمة للوصول إلى هذه الصفحة. يرجى التواصل مع المدير.</p>
                </div>`;
            return;
        }
    
        if (!agentId) { // If no agent is selected, do not render the form.
            appContent.innerHTML = `<p class="error">تم إلغاء هذه الصفحة. لا يمكن إنشاء مسابقة بدون تحديد وكيل أولاً.</p>`;
            return;
        }
    
        // Fetch agent and template data
        const agentResponse = await authedFetch(`/api/agents/${agentId}`);
        if (!agentResponse.ok) {
            appContent.innerHTML = `<p class="error">لم يتم العثور على الوكيل.</p>`;
            return;
        }
        const { data: agent } = await agentResponse.json();
    
        const agentClassification = agent.classification || 'R'; // Default to R if not set
        const templatesResponse = await authedFetch(`/api/templates/available?classification=${agentClassification}`);
    
        if (!templatesResponse.ok) {
            appContent.innerHTML = `<p class="error">حدث خطأ أثناء جلب قوالب المسابقات.</p>`;
            return;
        }
        const { data: templates } = await templatesResponse.json();
        
        appContent.innerHTML = `
            <div class="page-header"><h1><i class="fas fa-magic"></i> إنشاء وإرسال مسابقة</h1></div>
            <p class="page-subtitle">للعميل: <a href="#profile/${agent._id}" class="agent-name-link-subtitle"><strong>${agent.name}</strong></a>. قم بتعديل تفاصيل المسابقة أدناه وسيتم تحديث الكليشة تلقائياً.</p>
            
            <div class="create-competition-layout-v3">
                <!-- Agent Info Column -->
                <div class="agent-info-v3 card-style-container">
                    <h3><i class="fas fa-user-circle"></i> بيانات الوكيل</h3>
                    <div class="agent-info-grid">
                        <div class="action-info-card"><i class="fas fa-star"></i><div class="info"><label>المرتبة</label><p>${agent.rank || 'غير محدد'}</p></div></div>                    <div class="action-info-card"><i class="fas fa-tag"></i><div class="info"><label>التصنيف</label><p>${agent.classification}</p></div></div>
                        <div class="action-info-card" id="balance-card"><i class="fas fa-wallet"></i><div class="info"><label>الرصيد المتبقي</label><p id="agent-remaining-balance">${agent.remaining_balance || 0}</p></div></div>
                        <div class="action-info-card" id="bonus-card"><i class="fas fa-gift"></i><div class="info"><label>بونص إيداع متبقي</label><p id="agent-remaining-deposit-bonus">${agent.remaining_deposit_bonus || 0} مرات</p></div></div>
                        <div class="action-info-card"><i class="fas fa-percent"></i><div class="info"><label>نسبة بونص الإيداع</label><p>${agent.deposit_bonus_percentage || 0}%</p></div></div>
                    </div>
                </div>
    
                <!-- Variables Column -->
                <div class="variables-v3 card-style-container">
                    <h3><i class="fas fa-cogs"></i> 1. تعديل المتغيرات</h3>
                    <div class="form-group">
                        <label for="competition-template-select">المسابقات المقترحة</label>
                        <select id="competition-template-select" required>
                            <option value="" disabled selected>-- اختار مسابقة --</option>
                            ${templates.map(t => `<option value="${t._id}">${t.question}</option>`).join('')}
                        </select>
                        <div id="template-usage-info" class="form-hint" style="display: none;"></div>
                    </div>
                    <div class="override-fields-grid">
                        <div class="form-group">
                            <label for="override-trading-winners">عدد الفائزين (تداولي)</label>
                            <input type="number" id="override-trading-winners" value="${agent.winners_count || 0}">
                        </div>
                        <div class="form-group">
                            <label for="override-prize">الجائزة لكل فائز ($)</label>
                            <input type="number" id="override-prize" step="0.01" value="${parseFloat(agent.prize_per_winner || 0).toFixed(2)}">
                        </div>
                        <div class="form-group">
                            <label for="override-deposit-winners">عدد الفائزين (إيداع)</label>
                            <input type="number" id="override-deposit-winners" value="${agent.deposit_bonus_winners_count || 0}">
                        </div>
                        <div class="form-group">
                            <label for="override-duration">مدة المسابقة</label>
                            <select id="override-duration">
                                <option value="" disabled>-- اختر مدة --</option>
                                <option value="1d" ${agent.competition_duration === '24h' || !agent.competition_duration || (agent.competition_duration !== '48h' && agent.competition_duration !== '168h') ? 'selected' : ''}>يوم واحد</option>
                                <option value="2d" ${agent.competition_duration === '48h' ? 'selected' : ''}>يومين</option>
                                <option value="1w" ${agent.competition_duration === '168h' ? 'selected' : ''}>أسبوع</option>
                            </select>
                        </div>
                        <div class="form-group" style="grid-column: 1 / -1; background-color: var(--bg-color); padding: 10px 15px; border-radius: 6px; margin-top: 10px;">
                            <label for="winner-selection-date-preview" style="color: var(--primary-color);"><i class="fas fa-calendar-alt"></i> تاريخ اختيار الفائز المتوقع</label>
                            <p id="winner-selection-date-preview" class="summary-preview-text"></p>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top: 15px;">
                        <label for="override-correct-answer">الإجابة الصحيحة للمسابقة</label>
                        <input type="text" id="override-correct-answer" placeholder="اكتب الإجابة الصحيحة هنا" required>
                    </div>
                    <div class="form-group" style="margin-top: 15px; background-color: var(--bg-color); padding: 10px; border-radius: 6px; display: none;">
                        <label style="color: var(--primary-color);"><i class="fas fa-key"></i> الإجابة الصحيحة</label>
                        <p id="correct-answer-display" class="summary-preview-text" style="color: var(--text-color);"></p>
                    </div>
                    <div id="validation-messages" class="validation-messages" style="margin-top: 20px;"></div>
                </div>
                
                <!-- Preview Column -->
                <div class="preview-v3 card-style-container">
                    <form id="competition-form">
                        <h3><i class="fab fa-telegram-plane"></i> 2. معاينة وإرسال</h3>
                        <div class="telegram-preview-wrapper">
                            <div class="telegram-preview-header">
                                <div class="header-left"><i class="fab fa-telegram"></i><span>معاينة الرسالة</span></div>
                            </div>
                            <div class="telegram-preview-body">
                                <textarea id="competition-description" rows="15" required readonly></textarea>
                            </div>
                            <div id="telegram-image-preview-container" class="telegram-image-preview-container" style="display: none;">
                                <img id="telegram-image-preview" src="" alt="Competition Image Preview">
                            </div>
                            <div class="image-actions" style="margin-top: 10px;">
                                <input type="file" id="competition-image-upload" accept="image/*" style="display: none;">
                                <button type="button" id="change-competition-image-btn" class="btn-secondary btn-small"><i class="fas fa-edit"></i> تغيير الصورة</button>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary btn-send-telegram"><i class="fas fa-paper-plane"></i> إرسال إلى تلجرام الآن</button>
                            <button type="button" id="cancel-competition-form" class="btn-secondary">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    
        const form = document.getElementById('competition-form');
        const templateSelect = document.getElementById('competition-template-select');
        const descInput = document.getElementById('competition-description');
        const tradingWinnersInput = document.getElementById('override-trading-winners');
        const prizeInput = document.getElementById('override-prize');
        const depositWinnersInput = document.getElementById('override-deposit-winners');
        const durationInput = document.getElementById('override-duration');
        const imagePreviewContainer = document.getElementById('telegram-image-preview-container');
        const imagePreview = document.getElementById('telegram-image-preview');
        const imageUploadInput = document.getElementById('competition-image-upload');
        const changeImageBtn = document.getElementById('change-competition-image-btn');
    
        changeImageBtn.addEventListener('click', () => imageUploadInput.click());
    
        imageUploadInput.addEventListener('change', () => {
            const file = imageUploadInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
                competitionImageFile = file;
            }
        });
    
        async function checkExistingCompetition(agentId, templateId) {
            const templateUsageInfo = document.getElementById('template-usage-info');
            templateUsageInfo.style.display = 'none';
            templateUsageInfo.classList.remove('error-text');
            if (!agentId || !templateId) return;
            try {
                const response = await authedFetch(`/api/competitions/check-existence?agent_id=${agentId}&template_id=${templateId}`);
                if (response.ok) {
                    const { exists } = await response.json();
                    if (exists) {
                        templateUsageInfo.innerHTML = `<i class="fas fa-exclamation-triangle"></i> تم إرسال هذه المسابقة لهذا الوكيل من قبل.`;
                        templateUsageInfo.style.display = 'block';
                        templateUsageInfo.classList.add('error-text');
                    }
                }
            } catch (error) { console.error('Failed to check for existing competition:', error); }
        }
    
        function updateDescriptionAndPreview(event = {}) {
            const selectedId = templateSelect.value;
            const selectedTemplate = templates.find(t => String(t._id) === selectedId);
    
            if (!selectedTemplate) {
                descInput.value = 'الرجاء اختيار قالب مسابقة أولاً لعرض المعاينة.';
                return;
            }
    
            // --- REVISED: Image Handling ---
            // Image is now always set from the template when the template is selected.
            if (event.target && event.target.id === 'competition-template-select') {
                const imageUrl = selectedTemplate.image_url || 'images/competition_bg.jpg';
                imagePreview.src = imageUrl;
                imagePreviewContainer.style.display = 'block';
                competitionImageFile = null; // Reset custom image when template changes
            }
    
            if (event.target && event.target.id === 'competition-template-select') {
                checkExistingCompetition(agent._id, selectedId);
                if (selectedTemplate.usage_limit !== null) {
                    const remaining = Math.max(0, selectedTemplate.usage_limit - (selectedTemplate.usage_count || 0));
                    const message = `مرات الاستخدام المتبقية لهذا القالب: ${remaining}`;
                    if (remaining === 1) showToast(message, 'error');
                    else if (remaining <= 3) showToast(message, 'warning');
                    else showToast(message, 'info');
                }
            }
    
            const correctAnswerDisplay = document.getElementById('correct-answer-display');
            correctAnswerDisplay.textContent = selectedTemplate.correct_answer || 'غير محددة';
            correctAnswerDisplay.parentElement.style.display = 'block';
    
            const correctAnswerInput = document.getElementById('override-correct-answer');
            if (correctAnswerInput) correctAnswerInput.value = selectedTemplate.correct_answer || '';
    
            const originalTemplateContent = selectedTemplate.content;
            const selectedTemplateQuestion = selectedTemplate.question;
    
            const tradingWinners = parseInt(tradingWinnersInput.value) || 0;
            const depositWinners = parseInt(depositWinnersInput.value) || 0;
            const prize = parseInt(prizeInput.value || 0);
            const duration = durationInput.value;
            const depositBonusPerc = agent.deposit_bonus_percentage || 0;
            
            function numberToArPlural(num) {
                const words = { 3: 'ثلاث', 4: 'أربع', 5: 'خمس', 6: 'ست', 7: 'سبع', 8: 'ثماني', 9: 'تسع', 10: 'عشر' };
                return words[num] || num.toString();
            }
            
            let prizeDetailsText = '';
            if (tradingWinners === 1) prizeDetailsText = `${prize}$ لفائز واحد فقط.`;
            else if (tradingWinners === 2) prizeDetailsText = `${prize}$ لفائزين اثنين فقط.`;
            else if (tradingWinners >= 3 && tradingWinners <= 10) prizeDetailsText = `${prize}$ لـ ${numberToArPlural(tradingWinners)} فائزين فقط.`;
            else if (tradingWinners > 10) prizeDetailsText = `${prize}$ لـ ${tradingWinners} فائزاً فقط.`;
            else if (tradingWinners > 0) prizeDetailsText = `${prize}$ لـ ${tradingWinners} فائزاً فقط.`;
    
            let depositBonusPrizeText = '';
            if (depositWinners > 0 && depositBonusPerc > 0) {
                if (depositWinners === 1) depositBonusPrizeText = `${depositBonusPerc}% بونص إيداع لفائز واحد فقط.`;
                else if (depositWinners === 2) depositBonusPrizeText = `${depositBonusPerc}% بونص إيداع لفائزين اثنين فقط.`;
                else if (depositWinners >= 3 && depositWinners <= 10) depositBonusPrizeText = `${depositBonusPerc}% بونص إيداع لـ ${numberToArPlural(depositWinners)} فائزين فقط.`;
                else if (depositWinners > 10) depositBonusPrizeText = `${depositBonusPerc}% بونص إيداع لـ ${depositWinners} فائزاً فقط.`;
            }
    
            let content = originalTemplateContent;
            content = content.replace(/{{agent_name}}/g, agent.name || 'الوكيل');
            if (prizeDetailsText) content = content.replace(/{{prize_details}}/g, prizeDetailsText);
            else content = content.replace(/^.*{{prize_details}}.*\n?/gm, '');
    
            if (depositBonusPrizeText) content = content.replace(/{{deposit_bonus_prize_details}}/g, depositBonusPrizeText);
            else content = content.replace(/^.*{{deposit_bonus_prize_details}}.*\n?/gm, '');
    
            let displayDuration = '';
            if (duration) {
                const endDate = new Date();
                let daysToAdd = 0;
                if (duration === '1d') daysToAdd = 1;
                else if (duration === '2d') daysToAdd = 2;
                else if (duration === '1w') daysToAdd = 7;
                endDate.setDate(endDate.getDate() + daysToAdd);
                const formattedEndDate = endDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                displayDuration = `من تاريخ اليوم وحتى نهاية يوم ${formattedEndDate}`;
            }
    
            if (displayDuration) content = content.replace(/⏳ مدة المسابقة: {{competition_duration}}/g, `⏳ مدة المسابقة:\n${displayDuration}`);
            else content = content.replace(/^.*⏳ مدة المسابقة: {{competition_duration}}.*\n?/gm, '');
            
            content = content.replace(/{{question}}/g, selectedTemplateQuestion || '');
            content = content.replace(/{{remaining_deposit_bonus}}/g, agent.remaining_deposit_bonus || 0);
            content = content.replace(/{{deposit_bonus_percentage}}/g, agent.deposit_bonus_percentage || 0);
            content = content.replace(/{{winners_count}}/g, tradingWinners);
            content = content.replace(/{{prize_per_winner}}/g, prize);
            descInput.value = content;
    
            const totalCost = tradingWinners * prize;
            const newRemainingBalance = (agent.remaining_balance || 0) - totalCost;
            const newRemainingDepositBonus = (agent.remaining_deposit_bonus || 0) - depositWinners;
            const balanceEl = document.getElementById('agent-remaining-balance');
            const bonusEl = document.getElementById('agent-remaining-deposit-bonus');
            const validationContainer = document.getElementById('validation-messages');
            balanceEl.textContent = `${newRemainingBalance.toFixed(2)}`;
            bonusEl.textContent = `${newRemainingDepositBonus} مرات`;
    
            let validationMessages = '';
            if (newRemainingBalance < 0) {
                validationMessages += `<div class="validation-error"><i class="fas fa-exclamation-triangle"></i> الرصيد غير كافٍ. التكلفة (${totalCost.toFixed(2)}$) تتجاوز الرصيد المتاح (${(agent.remaining_balance || 0).toFixed(2)}$).</div>`;
            }
            if (newRemainingDepositBonus < 0) {
                validationMessages += `<div class="validation-error"><i class="fas fa-exclamation-triangle"></i> عدد مرات بونص الإيداع غير كافٍ (المتاح: ${agent.remaining_deposit_bonus || 0}).</div>`;
            }
            const templateUsageInfo = document.getElementById('template-usage-info');
            if (templateUsageInfo.style.display === 'block' && templateUsageInfo.classList.contains('error-text')) {
                // Message is already displayed
            }
            validationContainer.innerHTML = validationMessages;
            document.getElementById('balance-card').classList.toggle('invalid', newRemainingBalance < 0);
            document.getElementById('bonus-card').classList.toggle('invalid', newRemainingDepositBonus < 0);
    
            const winnerDatePreview = document.getElementById('winner-selection-date-preview');
            if (duration) {
                let daysToAdd = 0;
                switch (duration) {
                    case '1d': daysToAdd = 1; break;
                    case '2d': daysToAdd = 2; break;
                    case '1w': daysToAdd = 7; break;
                }
                const localToday = new Date();
                localToday.setHours(0, 0, 0, 0);
                localToday.setDate(localToday.getDate() + daysToAdd + 1);
                winnerDatePreview.innerHTML = `سيتم إرسال طلب اختيار الفائزين في بداية يوم <br><strong>${localToday.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>`;
                winnerDatePreview.parentElement.style.display = 'block';
            } else {
                winnerDatePreview.parentElement.style.display = 'none';
            }
        }
    
        [templateSelect, tradingWinnersInput, prizeInput, depositWinnersInput, durationInput].forEach(input => {
            input.addEventListener('change', updateDescriptionAndPreview);
        });
    
        imagePreviewContainer.addEventListener('click', (e) => {
            if (document.querySelector('.image-modal-overlay')) return;
            const imgSrc = imagePreview.src;
            if (imgSrc) { // Allow modal for all image sources, including data: URLs
                const modalOverlay = document.createElement('div');
                modalOverlay.className = 'image-modal-overlay';
                modalOverlay.setAttribute('role', 'dialog');
                modalOverlay.setAttribute('aria-modal', 'true');
                modalOverlay.setAttribute('aria-label', 'معاينة الصورة بحجم كبير');
                modalOverlay.innerHTML = `<img src="${imgSrc}" class="image-modal-content" alt="معاينة الصورة">`;
                const closeModal = () => {
                    modalOverlay.remove();
                    document.removeEventListener('keydown', handleEsc);
                };
                const handleEsc = (event) => {
                    if (event.key === 'Escape') closeModal();
                };
                modalOverlay.addEventListener('click', closeModal);
                document.addEventListener('keydown', handleEsc);
                document.body.appendChild(modalOverlay);
            }
        });
    
        document.getElementById('cancel-competition-form').addEventListener('click', () => {
            window.location.hash = `profile/${agent.id}`;
        });
    
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const sendBtn = e.target.querySelector('.btn-send-telegram');
            const originalBtnHtml = sendBtn.innerHTML;
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق والإرسال...';
    
            try {
                const selectedTemplateId = templateSelect.value;
                const selectedTemplate = templates.find(t => t._id == selectedTemplateId);
                if (!selectedTemplate) throw new Error('يرجى اختيار قالب مسابقة صالح.');
    
                const winnersCount = parseInt(document.getElementById('override-trading-winners').value) || 0;
                const prizePerWinner = parseFloat(document.getElementById('override-prize').value) || 0;
                const depositWinnersCount = parseInt(document.getElementById('override-deposit-winners').value) || 0;
                const totalCost = winnersCount * prizePerWinner;
    
                if (totalCost > (agent.remaining_balance || 0) || depositWinnersCount > (agent.remaining_deposit_bonus || 0)) {
                    throw new Error('الرصيد أو عدد مرات البونص غير كافٍ.');
                }
    
                const verification = await verifyTelegramChat(agent);
                if (!verification.verified) throw new Error('فشل التحقق من بيانات التلجرام.');
    
                let finalImageUrl = selectedTemplate.image_url || '/images/competition_bg.jpg'; // Default to template image
    
                // --- FIX: Handle absolute localhost URLs from old templates ---
                if (finalImageUrl && finalImageUrl.startsWith('http://localhost')) {
                    try {
                        const url = new URL(finalImageUrl);
                        finalImageUrl = url.pathname; // Convert to relative path
                    } catch (e) {
                        console.error('Could not parse template image URL, leaving as is:', e);
                    }
                }
                // --- End of FIX ---
    
                if (competitionImageFile) {
                    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الصورة...';
                    const formData = new FormData();
                    formData.append('image', competitionImageFile);
    
                    const uploadResponse = await authedFetch('/api/competitions/upload-image', { method: 'POST', body: formData });
    
                    if (!uploadResponse.ok) {
                        throw new Error('فشل رفع الصورة.');
                    }
                    
                    const uploadResult = await uploadResponse.json();
                    finalImageUrl = uploadResult.imageUrl;
                }
    
    
    
                console.log(`The image URL being sent is: ${finalImageUrl}`);
    
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
    
                const competitionPayload = {
                    name: selectedTemplate.question,
                    description: descInput.value,
                    is_active: true,
                    classification: agent.classification,
                    status: 'sent',
                    agent_id: agent._id,
                    duration: durationInput.value,
                    total_cost: totalCost,
                    deposit_winners_count: depositWinnersCount,
                    correct_answer: document.getElementById('override-correct-answer').value,
                    winners_count: winnersCount,
                    prize_per_winner: prizePerWinner,
                    template_id: selectedTemplate._id,
                    image_url: finalImageUrl
                };
    
                const compResponse = await authedFetch('/api/competitions', {
                    method: 'POST',
                    body: JSON.stringify(competitionPayload)
                });
    
                if (!compResponse.ok) {
                    if (compResponse.status === 409) throw new Error('فشل الإرسال: تم إرسال هذه المسابقة لهذا الوكيل من قبل.');
                    const result = await compResponse.json();
                    throw new Error(result.message || 'فشل حفظ المسابقة.');
                }
    
                // --- FIX: Re-add Telegram sending logic after successful save ---
                const telegramResponse = await authedFetch('/api/post-announcement', {
                    method: 'POST',
                    body: JSON.stringify({
                        message: competitionPayload.description,
                        chatId: agent.telegram_chat_id,
                        imageUrl: finalImageUrl
                    })
                });
    
                if (!telegramResponse.ok) {
                    const result = await telegramResponse.json();
                    // Even if Telegram fails, the competition is saved. Log it and inform the user.
                    console.error(`فشل الإرسال إلى تلجرام لكن تم حفظ المسابقة: ${result.message}`);
                    showToast(`تم حفظ المسابقة، لكن فشل الإرسال إلى تلجرام: ${result.message}`, 'warning');
                } else {
                    showToast('تم حفظ المسابقة وإرسالها بنجاح.', 'success');
                    // --- NEW: Automatically toggle the competition icon on success ---
                    const todayDayIndex = new Date().getDay();
                    window.taskStore.updateTaskStatus(agent._id, todayDayIndex, 'competition_sent', true);
                }
                // --- End of FIX ---
    
                // --- NEW: Use the correct PUT endpoint to update the agent's balance and deposit bonus ---
                const newRemainingBalance = (agent.remaining_balance || 0) - totalCost;
                const newConsumedBalance = (agent.consumed_balance || 0) + totalCost;
                const newRemainingDepositBonus = (agent.remaining_deposit_bonus || 0) - depositWinnersCount;
                const newUsedDepositBonus = (agent.used_deposit_bonus || 0) + depositWinnersCount;
    
                const updatePayload = {
                    remaining_balance: newRemainingBalance,
                    consumed_balance: newConsumedBalance,
                    remaining_deposit_bonus: newRemainingDepositBonus,
                    used_deposit_bonus: newUsedDepositBonus
                };
    
                const balanceUpdateResponse = await authedFetch(`/api/agents/${agent._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatePayload)
                });
    
                if (!balanceUpdateResponse.ok) {
                    const result = await balanceUpdateResponse.json();
                    // Log the error and perhaps show a warning to the user that the balance deduction failed
                    console.error(`فشل خصم الرصيد أو البونص: ${result.message}`);
                    showToast(`تم إرسال المسابقة، لكن فشل تحديث الرصيد أو البونص: ${result.message}`, 'warning');
                } else {
                    showToast('تم خصم التكاليف من الرصيد والبونص بنجاح.', 'success');
                }
    
                // --- FIX: Force a full page reload to show updated balance ---
                // Using .hash only changes the URL fragment without reloading, which can show stale cached data.
                // Using .assign() reloads the page, ensuring the latest agent data (with deducted balance) is fetched from the server.
                showToast('اكتملت العملية. جاري الانتقال لصفحة الوكيل...', 'info');
                window.location.assign(`/#profile/${agent._id}`);
    
            } catch (error) {
                showToast(error.message, 'error');
                console.error('Competition creation failed:', error);
                sendBtn.disabled = false;
                sendBtn.innerHTML = originalBtnHtml;
            }
        });
    }
    
    async function renderArchivedCompetitionsPage() {
        const appContent = document.getElementById('app-content');
        // --- NEW: Permission Check ---
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
        const compsPerm = currentUserProfile?.permissions?.competitions?.manage_comps || 'none';
        const canView = isAdmin || templatesPerm === 'full' || templatesPerm === 'view';
    
        if (!canView) {
            appContent.innerHTML = `
                <div class="access-denied-container">
                    <i class="fas fa-lock"></i>
                    <h2>ليس لديك صلاحية وصول</h2>
                    <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
                </div>`;
            return;
        }
        appContent.innerHTML = `
            <div class="page-header column-header">
                <div class="header-top-row">
                    <h1><i class="fas fa-archive"></i> المسابقات المنتهية</h1>
                </div>
                <div class="filters-container">
                    <div class="filter-search-container">
                        <input type="search" id="archive-comp-search-input" placeholder="بحث باسم المسابقة أو الوكيل..." autocomplete="off">
                        <i class="fas fa-search"></i>
                        <i class="fas fa-times-circle search-clear-btn" id="archive-comp-search-clear"></i>
                    </div>
                    <div class="sort-container">
                        <label for="archive-comp-sort-select">ترتيب حسب:</label>
                        <select id="archive-comp-sort-select">
                            <option value="newest">الأحدث أولاً</option>
                            <option value="name_asc">اسم المسابقة (أ - ي)</option>
                            <option value="agent_asc">اسم الوكيل (أ - ي)</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="archived-competitions-list-container"></div>
        `;
    
        let allArchivedCompetitions = [];
    
        async function loadArchivedCompetitions() {
            const response = await authedFetch('/api/competitions?status=completed&sort=newest');
    
            if (!response.ok) {
                document.getElementById('archived-competitions-list-container').innerHTML = '<p class="error">فشل تحميل المسابقات المنتهية.</p>';
                return;
            }
    
            const { data } = await response.json();
            allArchivedCompetitions = data || [];
            applyFiltersAndSort();
        }
    
        function displayArchived(competitions) {
            const container = document.getElementById('archived-competitions-list-container');
            if (competitions.length === 0) {
                container.innerHTML = '<p class="no-results-message">لا توجد مسابقات منتهية.</p>';
                return;
            }
            container.innerHTML = `
                <div class="competitions-list-view">
                    ${competitions.map(comp => {
                        const agent = comp.agents;
                        const agentInfoHtml = agent
                            ? `<a href="#profile/${agent.id}" class="table-agent-cell">
                                    ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Agent Avatar" class="avatar-small" loading="lazy">` : `<div class="avatar-placeholder-small"><i class="fas fa-user"></i></div>`}
                                    <div class="agent-details"><span>${agent.name}</span></div>
                               </a>`
                            : `<div><span>(وكيل محذوف)</span></div>`;
    
                        return `
                        <div class="competition-card" data-id="${comp.id}">
                            <div class="competition-card-name"><h3>${comp.name}</h3></div>
                            <div class="competition-card-status"><span class="status-badge-v2 status-completed">مكتملة</span></div>
                            ${agentInfoHtml}
                            <div class="competition-card-footer">
                                <button class="btn-danger delete-competition-btn" title="حذف" data-id="${comp._id}"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            `;
        }
    
        function applyFiltersAndSort() {
            const searchInput = document.getElementById('archive-comp-search-input');
            const sortSelect = document.getElementById('archive-comp-sort-select');
            const searchTerm = searchInput.value.toLowerCase().trim();
            const sortValue = sortSelect.value;
    
            let filtered = allArchivedCompetitions.filter(comp => {
                const name = comp.name.toLowerCase();
                const agentName = comp.agents ? comp.agents.name.toLowerCase() : '';
                return searchTerm === '' || name.includes(searchTerm) || agentName.includes(searchTerm);
            });
    
            filtered.sort((a, b) => {
                switch (sortValue) {
                    case 'name_asc': return a.name.localeCompare(b.name);
                    case 'agent_asc': return (a.agents?.name || '').localeCompare(b.agents?.name || '');
                    default: return new Date(b.created_at) - new Date(a.created_at);
                }
            });
    
            displayArchived(filtered);
        }
    
        document.getElementById('archive-comp-search-input').addEventListener('input', applyFiltersAndSort);
        document.getElementById('archive-comp-sort-select').addEventListener('change', applyFiltersAndSort);
        document.getElementById('archive-comp-search-clear').addEventListener('click', () => {
            const searchInput = document.getElementById('archive-comp-search-input');
            searchInput.value = '';
            applyFiltersAndSort();
        });
    
        // --- NEW: Add event listener for delete buttons ---
        const container = document.getElementById('archived-competitions-list-container');
        container.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-competition-btn');
            if (deleteBtn) {
                const isSuperAdmin = currentUserProfile?.role === 'super_admin';
                const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
                const compsPerm = currentUserProfile?.permissions?.competitions?.manage_comps || 'none';
                const canEdit = isAdmin || compsPerm === 'full';
    
                if (!canEdit) {
                    showToast('ليس لديك صلاحية لحذف المسابقات.', 'error');
                    return;
                }
    
                const id = deleteBtn.dataset.id;
                showConfirmationModal(
                    'هل أنت متأكد من حذف هذه المسابقة نهائياً؟',
                    async () => {
                        const response = await authedFetch(`/api/competitions/${id}`, { method: 'DELETE' });
                        if (!response.ok) {
                            showToast('فشل حذف المسابقة.', 'error');
                        } else {
                            showToast('تم حذف المسابقة بنجاح.', 'success');
                            await loadArchivedCompetitions(); // Refresh the list
                        }
                    }, { title: 'تأكيد الحذف', confirmText: 'حذف', confirmClass: 'btn-danger' });
            }
        });
    
        await loadArchivedCompetitions();
    }
    
    // --- 3. Edit Existing Competition Form ---
    
    async function renderCompetitionEditForm(compId) {
        // --- NEW: Permission Check ---
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const canEdit = isSuperAdmin || (currentUserProfile?.permissions?.competitions?.manage_comps === 'full');
        if (!canEdit) {
            document.getElementById('app-content').innerHTML = `
                <div class="access-denied-container">
                    <i class="fas fa-lock"></i>
                    <h2>ليس لديك صلاحية لتعديل المسابقات</h2>
                    <p>أنت لا تملك الصلاحية اللازمة للوصول إلى هذه الصفحة. يرجى التواصل مع المدير.</p>
                </div>`;
            return;
        }
        appContent.innerHTML = `
            <div class="form-container">
                <h2>تعديل المسابقة: ${competition.name}</h2>
                <form id="competition-form" class="form-layout">
                    <div class="form-group"><label for="competition-name">اسم المسابقة</label><input type="text" id="competition-name" value="${competition.name}" required></div>
                    <div class="form-group"><label for="competition-description">الوصف</label><textarea id="competition-description" rows="3">${competition.description || ''}</textarea></div>
                    <div class="form-group"><label class="custom-checkbox toggle-switch"><input type="checkbox" id="competition-active" ${competition.is_active ? 'checked' : ''}> <span class="slider"></span><span class="label-text">نشطة</span></label></div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">حفظ التعديلات</button>
                        <button type="button" id="cancel-competition-form" class="btn-secondary">إلغاء</button>
                    </div>
                </form>
            </div>
        `;
    
        document.getElementById('cancel-competition-form').addEventListener('click', () => { window.location.hash = 'competitions'; });
    
        document.getElementById('competition-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                name: document.getElementById('competition-name').value,
                description: document.getElementById('competition-description').value,
                is_active: document.getElementById('competition-active').checked,
            };
    
            const response = await authedFetch(`/api/competitions/${compId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
    
            if (!response.ok) {
                showToast('فشل حفظ التعديلات.', 'error');
            } else {
                showToast('تم حفظ التعديلات بنجاح.', 'success');
                window.location.hash = 'competitions';
            }
        });
    }
    
    // --- 4. Competition Templates Page ---
    
    async function renderCompetitionTemplatesPage() {
        // --- NEW: Permission Check ---
        const appContent = document.getElementById('app-content');
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
        const templatesPerm = currentUserProfile?.permissions?.competitions?.manage_templates || 'none';
        const canView = isAdmin || templatesPerm === 'full' || templatesPerm === 'view';
    
        if (!canView) {
            appContent.innerHTML = `
                <div class="access-denied-container">
                    <i class="fas fa-lock"></i>
                    <h2>ليس لديك صلاحية وصول</h2>
                    <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
                </div>`;
            return;
        }
    
        const canEdit = isAdmin || templatesPerm === 'full'; // إصلاح: تعريف الصلاحية بعد التحقق من العرض
        document.querySelector('main').classList.add('full-width');
    
        const defaultTemplateContent = `مسابقة جديدة من شركة إنزو للتداول 🏆
    
    ✨ هل تملك عينًا خبيرة في قراءة الشارتات؟ اختبر نفسك واربح!
    
    💰 الجائزة: {{prize_details}}
                     {{deposit_bonus_prize_details}}
    
    ❓ سؤال المسابقة:
    {{question}}
    
    📝 كيفية المشاركة:
    ضع تعليقك على منشور المسابقة بالقناة باستخدام حسابك الشخصي على تليجرام.
    
    يجب أن يتضمن تعليقك:
    • إجابتك على السؤال.
    • اسمك الثلاثي المسجل بالوثائق.
    • رقم الحساب التداولي.
    
    يُمنع تعديل التعليق بعد نشره، وأي تعليق مُعدل سيتم استبعاده مباشرة.
    
    ⏳ مدة المسابقة: {{competition_duration}}
    
    📚 يمكنك معرفة الإجابة وتعلّم المزيد عن النماذج الفنية وأساليب التحليل مع الكورس المجاني المقدم من الخبير العالمي أ. شريف خورشيد على موقع إنزو. 🆓
    
    ✨ لا تفوت الفرصة!
    جاوب صح، اختبر معرفتك، وكن الفائز مع إنزو 🎁`;
    
        appContent.innerHTML = `
            <div class="page-header">
                <div class="header-top-row">
                    <h1><i class="fas fa-file-alt"></i> إدارة قوالب المسابقات</h1>
                    <button id="show-template-form-btn" class="btn-primary"><i class="fas fa-plus-circle"></i> إنشاء قالب جديد</button>
                </div>
                <div class="template-filters">
                    <div class="filter-search-container">
                        <input type="search" id="template-search-input" placeholder="بحث باسم القالب..." autocomplete="off">
                        <i class="fas fa-search"></i>
                        <i class="fas fa-times-circle search-clear-btn" id="template-search-clear"></i>
                    </div>
                    <div class="filter-buttons" data-filter-group="classification">
                        <button class="filter-btn active" data-filter="all">الكل</button>
                        <button class="filter-btn" data-filter="R">R</button>
                        <button class="filter-btn" data-filter="A">A</button>
                        <button class="filter-btn" data-filter="B">B</button>
                        <button class="filter-btn" data-filter="C">C</button>
                        <button class="filter-btn" data-filter="All">عام</button>
                    </div>
                </div>
            </div>
            <div class="templates-list-container">
                <div id="templates-list" class="templates-list-grouped"></div>
            </div>
        `;
    
        const templatesListDiv = document.getElementById('templates-list');
        const showFormBtn = document.getElementById('show-template-form-btn');
    
        if (showFormBtn) {
            if (canEdit) {
                showFormBtn.addEventListener('click', () => renderCreateTemplateModal(defaultTemplateContent, loadTemplates));
            } else {
                showFormBtn.addEventListener('click', () => showToast('ليس لديك صلاحية لإنشاء قوالب.', 'error'));
            }
        }
    
        async function loadTemplates() {
            const response = await authedFetch('/api/templates?archived=false');
    
            if (!response.ok) {
                console.error('Error fetching templates:', await response.text());
                templatesListDiv.innerHTML = '<p class="error">فشل تحميل القوالب.</p>';
                return;
            }
    
            const { data: templates } = await response.json();
            // Sort templates by classification R, A, B, C, then All
            const classificationOrder = { 'R': 1, 'A': 2, 'B': 3, 'C': 4, 'All': 5 };
            templates.sort((a, b) => {
                const orderA = classificationOrder[a.classification] || 99;
                const orderB = classificationOrder[b.classification] || 99;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                // Secondary sort by question name alphabetically
                // --- FIX: Add a fallback for templates that might not have a name ---
                return (a.name || '').localeCompare(b.name || '');
            });
    
            if (templates.length === 0) {
                templatesListDiv.innerHTML = '<p class="no-results-message">لا توجد قوالب محفوظة بعد.</p>';
            } else {
                const groupedTemplates = templates.reduce((acc, template) => {
                const key = template.classification || 'All'; // Ensure key exists
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(template);
                    return acc;
            }, {}); // Initialize with an empty object
    
                const classificationOrder = ['R', 'A', 'B', 'C', 'All'];
                let groupsHtml = '';
    
                for (const classification of classificationOrder) {
                    if (groupedTemplates[classification]) {
                        const group = groupedTemplates[classification];
                        groupsHtml += `
                            <details class="template-group" data-classification-group="${classification}" open>
                                <summary class="template-group-header">
                                    <h2>تصنيف ${classification === 'All' ? 'عام' : classification}</h2>
                                    <span class="template-count">${group.length} قوالب</span>
                                </summary>
                                <div class="template-group-content">
                                    ${group.map(template => `
                                    <div class="template-card" data-id="${template._id}" data-question="${(template.name || '').toLowerCase()}" data-classification="${template.classification || 'All'}">
                                            <div class="template-card-header">
                                            <h4>${template.name || 'قالب بدون اسم'}</h4>
                                            </div>
                                            <div class="template-card-body">
                                                <p>${template.content.substring(0, 120)}...</p>
                                            </div>
                                            <div class="template-card-footer">
                                                <button class="btn-secondary edit-template-btn" data-id="${template._id}"><i class="fas fa-edit"></i> تعديل</button>
                                                <button class="btn-danger delete-template-btn" data-id="${template._id}"><i class="fas fa-trash-alt"></i> حذف</button>
                                            </div> 
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        `;
                    }
                }
                templatesListDiv.innerHTML = groupsHtml;
            }
        }
    
        templatesListDiv.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-template-btn');
            if (editBtn) {
                if (!canEdit) {
                    showToast('ليس لديك صلاحية لتعديل القوالب.', 'error'); // Corrected permission check
                    return;
                }
                const id = editBtn.dataset.id; // This is the Supabase ID, which is correct for fetching
                const response = await authedFetch(`/api/templates/${id}`);
                const { data: template } = await response.json();
                
                if (!response.ok || !template) {
                    showToast('فشل العثور على القالب.', 'error');
                    return;
                }
                
                renderEditTemplateModal(template, loadTemplates);
            }
    
            const deleteBtn = e.target.closest('.delete-template-btn');
            if (deleteBtn) {
                if (!canEdit) {
                    showToast('ليس لديك صلاحية لحذف القوالب.', 'error');
                    return;
                }
                const templateId = deleteBtn.dataset.id; // This is the MongoDB _id string
                showConfirmationModal(
                    'هل أنت متأكد من حذف هذا القالب؟<br><small>لا يمكن التراجع عن هذا الإجراء.</small>',
                    async () => {
                        const response = await authedFetch(`/api/templates/${templateId}/archive`, { method: 'PATCH' });
                        if (!response.ok) {
                            const result = await response.json();
                            showToast(result.message || 'فشل حذف القالب.', 'error');
                        } else {
                            showToast('تم حذف القالب بنجاح.', 'success');
                            await loadTemplates();
                        }
                    },
                    { title: 'تأكيد حذف القالب', confirmText: 'حذف', confirmClass: 'btn-danger' }
                );
            }
        });
    
        await loadTemplates();
        setupTemplateFilters();
    }
    
    function renderCreateTemplateModal(defaultContent, onSaveCallback) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        let templateImageFile = null; // Variable to hold the new image file
    
        const modal = document.createElement('div');
        modal.className = 'form-modal-content modal-fullscreen'; // Use existing style from components.css
        
        modal.innerHTML = `
            <div class="form-modal-header">
                <h2><i class="fas fa-plus-circle"></i> إنشاء قالب مسابقة جديد</h2>
                <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
            </div>
            <div class="form-modal-body">
                <form id="create-template-form" class="template-form-grid">
                    <div class="template-form-fields">
                        <h3 class="details-section-title" style="margin-top: 0;"><i class="fas fa-info-circle"></i> الحقول الأساسية</h3>
                        <div class="form-group">
                            <label for="create-template-question">السؤال (سيكون اسم المسابقة)</label>
                            <textarea id="create-template-question" rows="3" required></textarea>
                            <div id="template-question-validation" class="validation-error" style="display: none; margin-top: 8px; font-size: 0.9em;"></div>
                        </div>
                        <div class="form-group">
                            <label for="create-template-correct-answer">الإجابة الصحيحة</label>
                            <textarea id="create-template-correct-answer" rows="2" required></textarea>
                        </div>
                        <div class="form-group">
                            <label for="create-template-classification">التصنيف (لمن سيظهر هذا القالب)</label>
                            <select id="create-template-classification" required>
                                <option value="All" selected>عام (يظهر للجميع)</option>
                                <option value="R">R</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="create-template-usage-limit">عدد مرات الاستخدام (اتركه فارغاً للاستخدام غير المحدود)</label>
                            <input type="number" id="create-template-usage-limit" min="1" placeholder="مثال: 5">
                        </div>
                    </div>
                    <div class="template-form-content">
                        <h3 class="details-section-title" style="margin-top: 0;"><i class="fas fa-file-alt"></i> محتوى المسابقة</h3>
                        <!-- NEW: Image Preview Section with upload button -->
                        <div class="form-group">
                            <label>صورة القالب</label>
                            <div class="image-preview-container">
                                <img id="create-template-image-preview" src="images/competition_bg.jpg" alt="صورة القالب" class="image-preview">
                            </div>
                            <input type="file" id="create-template-image-upload" accept="image/*" style="display: none;">
                            <button type="button" id="change-template-image-btn" class="btn-secondary btn-small" style="margin-top: 10px;"><i class="fas fa-edit"></i> تغيير الصورة</button>
                        </div>
                        <div class="form-group">
                            <label for="create-template-content">نص المسابقة</label>
                            <textarea id="create-template-content" rows="15" required>${defaultContent}</textarea>
                        </div>
                    </div>
                    <div class="form-actions template-form-actions">
                        <button type="submit" class="btn-primary"><i class="fas fa-save"></i> حفظ القالب</button>
                        <button type="button" id="cancel-create-modal" class="btn-secondary">إلغاء</button>
                    </div>
                </form>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    
        const closeModal = () => overlay.remove();
    
        // --- NEW: Event Listeners for Image Manipulation ---
        const imageUploadInput = document.getElementById('create-template-image-upload');
        const changeImageBtn = document.getElementById('change-template-image-btn');
        const imagePreview = document.getElementById('create-template-image-preview');
    
        changeImageBtn.addEventListener('click', () => imageUploadInput.click());
    
        imageUploadInput.addEventListener('change', () => {
            const file = imageUploadInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
                templateImageFile = file;
            }
        });
    
        // --- NEW: Live validation for template question ---
        const questionInput = document.getElementById('create-template-question');
        const validationDiv = document.getElementById('template-question-validation');
        let debounceTimeout;
    
        questionInput.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(async () => {
                const questionText = questionInput.value.trim();
                if (questionText) {
                    try {
                        const response = await authedFetch(`/api/templates/check-existence?question=${encodeURIComponent(questionText)}`);
                        if (response.ok) {
                            const { exists, archived } = await response.json();
                            if (exists) {
                                if (archived) {
                                    validationDiv.innerHTML = 'هذا السؤال موجود في قالب محذوف. يمكنك <a href="#archived-templates">استعادته من الأرشيف</a>.';
                                } else {
                                    validationDiv.textContent = 'هذا السؤال مستخدم بالفعل في قالب آخر.';
                                }
                                validationDiv.style.display = 'block';
                            } else {
                                validationDiv.style.display = 'none';
                            }
                        } else {
                            validationDiv.style.display = 'none'; // Hide on error
                        }
                    } catch (error) {
                        console.error('Error checking template existence:', error);
                        validationDiv.style.display = 'none'; // Hide on error
                    }
                } else {
                    validationDiv.style.display = 'none';
                }
            }, 500); // 500ms debounce delay
        });
    
    
        document.getElementById('close-modal-btn').addEventListener('click', closeModal);
        document.getElementById('cancel-create-modal').addEventListener('click', closeModal);
        
        document.getElementById('create-template-form').addEventListener('submit', async (e) => {
            e.preventDefault();
    
            // --- NEW: Prevent submission if validation error is visible ---
            if (validationDiv.style.display === 'block') {
                showToast('لا يمكن حفظ القالب لأن السؤال مستخدم بالفعل.', 'error');
                return;
            }
    
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
    
                        const questionText = document.getElementById('create-template-question').value.trim();        
                        if (!questionText) {
                            showToast('حقل السؤال مطلوب.', 'error');
                            submitBtn.disabled = false;
                            return;
                        }
            
                        // Debugging: Log values before sending
                        console.log('DEBUG: Question Text (name/question):', questionText);
                        console.log('DEBUG: Template Content:', document.getElementById('create-template-content').value.trim());
                        console.log('DEBUG: Correct Answer:', document.getElementById('create-template-correct-answer').value.trim());
                        console.log('DEBUG: Classification:', document.getElementById('create-template-classification').value);
                        console.log('DEBUG: Usage Limit:', document.getElementById('create-template-usage-limit').value);
            
                        try {
                            let finalImageUrl = '/images/competition_bg.jpg'; // Default image
            
                            if (templateImageFile) {
                                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الصورة...';
                                const formData = new FormData();
                                formData.append('image', templateImageFile);
            
                                // Re-using the competition image upload endpoint
                                const uploadResponse = await authedFetch('/api/competitions/upload-image', { method: 'POST', body: formData });
            
                                if (!uploadResponse.ok) {
                                    throw new Error('فشل رفع الصورة.');
                                }
                                
                                const uploadResult = await uploadResponse.json();
                                finalImageUrl = uploadResult.imageUrl; // The backend should return the relative path
                            }
                            
                            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري حفظ القالب...';
            
                            const formData = {
                                name: questionText,
                                question: questionText, // FIX: Ensure 'question' field is also sent
                                classification: document.getElementById('create-template-classification').value,
                                content: document.getElementById('create-template-content').value.trim(),
                                correct_answer: document.getElementById('create-template-correct-answer').value.trim(),
                                usage_limit: document.getElementById('create-template-usage-limit').value ? parseInt(document.getElementById('create-template-usage-limit').value, 10) : null,
                                usage_count: 0,
                                is_archived: false,
                                image_url: finalImageUrl // Add the image URL to the payload
                            };
            
                            console.log('DEBUG: Creating template with data:', formData);
                const response = await authedFetch('/api/templates', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
    
                const result = await response.json();
    
                if (!response.ok) {
                    console.error('Template creation failed:', result);
                    throw new Error(result.message || 'فشل حفظ القالب.');
                }
                
                console.log('Template created successfully:', result);
                showToast('تم حفظ القالب بنجاح.', 'success');
                closeModal();
                if (onSaveCallback) onSaveCallback();
    
            } catch (error) {
                showToast(error.message, 'error');
                console.error('Template creation failed:', error);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }
    
    function setupTemplateFilters() {
        const searchInput = document.getElementById('template-search-input');
        const clearBtn = document.getElementById('template-search-clear');
        const filterButtons = document.querySelectorAll('.template-filters .filter-btn');
    
        if (!searchInput) return;
    
        const applyFilters = () => {
            if (clearBtn) {
                clearBtn.style.display = searchInput.value ? 'block' : 'none';
            }
    
            const searchTerm = searchInput.value.toLowerCase().trim();
            const activeFilter = document.querySelector('.template-filters .filter-btn.active').dataset.filter;
    
            const allGroups = document.querySelectorAll('.template-group'); // Corrected selector
            let hasResults = false;
    
            allGroups.forEach(group => {
                const cards = group.querySelectorAll('.template-card');
                let visibleCardsInGroup = 0;
    
                cards.forEach(card => {
                    const question = card.dataset.question || ''; // Add fallback for safety
                    const classification = card.dataset.classification;
    
                    const matchesSearch = searchTerm === '' || question.includes(searchTerm);
                    const matchesFilter = activeFilter === 'all' || classification === activeFilter;
    
                    const isVisible = matchesSearch && matchesFilter;
                    card.style.display = isVisible ? '' : 'none';
                    if (isVisible) {
                        visibleCardsInGroup++;
                    }
                });
    
                // Hide the entire group if no cards are visible
                group.style.display = visibleCardsInGroup > 0 ? '' : 'none';
                if (visibleCardsInGroup > 0) {
                    hasResults = true;
                }
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
    
    async function renderArchivedTemplatesPage() {
        const appContent = document.getElementById('app-content');
        // --- NEW: Permission Check ---
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
        const templatesPerm = currentUserProfile?.permissions?.competitions?.manage_templates || 'none';
        const canView = isAdmin || templatesPerm === 'full' || templatesPerm === 'view';
    
        if (!canView) {
            appContent.innerHTML = ` <div class="access-denied-container">
                    <i class="fas fa-lock"></i>
                    <h2>ليس لديك صلاحية وصول</h2>
                    <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
                </div>`;
            return;
        }
        document.querySelector('main').classList.add('full-width');
    
        appContent.innerHTML = `
            <div class="page-header">
                <div class="header-top-row">
                    <h1><i class="fas fa-archive"></i> أرشيف قوالب المسابقات</h1>
                </div>
                <div class="template-filters">
                    <div class="filter-search-container">
                        <input type="search" id="archive-search-input" placeholder="بحث باسم القالب..." autocomplete="off">
                        <i class="fas fa-search"></i>
                        <i class="fas fa-times-circle search-clear-btn" id="archive-search-clear"></i>
                    </div>
                    <div class="filter-buttons" data-filter-group="classification">
                        <button class="filter-btn active" data-filter="all">الكل</button>
                        <button class="filter-btn" data-filter="R">R</button>
                        <button class="filter-btn" data-filter="A">A</button>
                        <button class="filter-btn" data-filter="B">B</button>
                        <button class="filter-btn" data-filter="C">C</button>
                        <button class="filter-btn" data-filter="All">عام</button>
                    </div>
                </div>
            </div>
            <p class="page-subtitle" style="text-align: right; margin-top: 0;">القوالب التي وصلت إلى الحد الأقصى من الاستخدام. يمكنك إعادة تفعيلها من هنا.</p>
            <div id="archived-templates-list" class="table-responsive-container">
                <p>جاري تحميل الأرشيف...</p>
            </div>
        `;
    
        const listDiv = document.getElementById('archived-templates-list');
        let allArchivedTemplates = [];
    
        function displayArchived(templatesToDisplay) {
            const isSuperAdmin = currentUserProfile?.role === 'super_admin';
            const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
            const templatesPerm = currentUserProfile?.permissions?.competitions?.manage_templates || 'none';
            const canEdit = isAdmin || templatesPerm === 'full';
            if (templatesToDisplay.length === 0) {
                listDiv.innerHTML = '<p class="no-results-message">لا توجد قوالب في الأرشيف تطابق بحثك.</p>';
            } else { // Corrected logic
                listDiv.innerHTML = `
                    <table class="modern-table">
                        <thead>
                            <tr>
                                <th>اسم القالب (السؤال)</th>
                                <th>التصنيف</th>
                                <th>مرات الاستخدام</th>
                                <th class="actions-column">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${templatesToDisplay.map(template => `
                                <tr data-question="${(template.name || '').toLowerCase()}" data-classification="${template.classification || 'All'}">
                                    <td data-label="اسم القالب">${template.name || 'قالب بدون اسم'}</td>
                                    <td data-label="التصنيف"><span class="classification-badge classification-${(template.classification || 'all').toLowerCase()}">${template.classification || 'الكل'}</span></td>
                                    <td data-label="مرات الاستخدام">${template.usage_count} / ${template.usage_limit}</td>
                                    <td class="actions-cell">
                                        <button class="btn-primary reactivate-template-btn btn-small" data-id="${template._id}"><i class="fas fa-undo"></i> إعادة تفعيل</button>
                                        ${canEdit ? `<button class="btn-danger delete-template-btn btn-small" data-id="${template._id}"><i class="fas fa-trash-alt"></i> حذف نهائي</button>` : ''}
                                    </td> 
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        }
    
        function setupArchiveFilters() {
            const searchInput = document.getElementById('archive-search-input');
            const clearBtn = document.getElementById('archive-search-clear');
            const filterButtons = document.querySelectorAll('.template-filters .filter-btn');
    
            const applyFilters = () => {
                if (clearBtn) clearBtn.style.display = searchInput.value ? 'block' : 'none';
                const searchTerm = searchInput.value.toLowerCase().trim();
                const activeFilter = document.querySelector('.template-filters .filter-btn.active').dataset.filter;
    
                const filtered = allArchivedTemplates.filter(template => {
                    const matchesSearch = searchTerm === '' || template.name.toLowerCase().includes(searchTerm);
                    const matchesFilter = activeFilter === 'all' || (template.classification || 'All') === activeFilter;
                    return matchesSearch && matchesFilter;
                });
                displayArchived(filtered);
            };
    
            searchInput.addEventListener('input', applyFilters);
            clearBtn.addEventListener('click', () => { searchInput.value = ''; applyFilters(); });
            filterButtons.forEach(btn => btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyFilters();
            }));
        }
    
        async function loadAndDisplayArchived() {
            const response = await authedFetch('/api/templates?archived=true');
    
            if (!response.ok) {
                listDiv.innerHTML = `<p class="error">فشل تحميل الأرشيف.</p>`;
                console.error('Archive fetch error:', await response.text());
                return;
            }
            const { data } = await response.json();
            allArchivedTemplates = data || [];
            displayArchived(allArchivedTemplates || []);
            setupArchiveFilters();
        }
    
        listDiv.addEventListener('click', async (e) => {
            const reactivateBtn = e.target.closest('.reactivate-template-btn');
            const deleteBtn = e.target.closest('.delete-template-btn');
    
            if (reactivateBtn) {
                const id = reactivateBtn.dataset.id;
                showConfirmationModal('هل أنت متأكد من إعادة تفعيل هذا القالب؟<br><small>سيتم إعادة تعيين عداد استخدامه إلى الصفر.</small>', async () => {
                    const response = await authedFetch(`/api/templates/${id}/reactivate`, { method: 'PUT' });
                    if (!response.ok) {
                        const result = await response.json();
                        showToast(result.message || 'فشل إعادة تفعيل القالب.', 'error');
                    } else {
                        showToast('تم إعادة تفعيل القالب بنجاح.', 'success');
                        await loadAndDisplayArchived();
                    }
                }, { title: 'تأكيد إعادة التفعيل' });
            }
    
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                showConfirmationModal('هل أنت متأكد من الحذف النهائي لهذا القالب؟<br><small>هذا الإجراء لا يمكن التراجع عنه.</small>', async () => {
                    const response = await authedFetch(`/api/templates/${id}`, { method: 'DELETE' });
                    if (!response.ok) {
                        const result = await response.json();
                        showToast(result.message || 'فشل حذف القالب.', 'error');
                    } else {
                        showToast('تم حذف القالب نهائياً.', 'success');
                        await loadAndDisplayArchived();
                    }
                }, { title: 'تأكيد الحذف النهائي', confirmText: 'حذف نهائي', confirmClass: 'btn-danger' });
            }
        });
    
        await loadAndDisplayArchived();
    }
    
    function renderEditTemplateModal(template, onSaveCallback) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        let templateImageFile = null; // Variable to hold the new image file
    
        const modal = document.createElement('div');
        modal.className = 'form-modal-content modal-fullscreen'; // Use fullscreen for consistency
    
        modal.innerHTML = `
            <div class="form-modal-header">
                <h2><i class="fas fa-edit"></i> تعديل قالب مسابقة</h2>
                <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
            </div>
            <div class="form-modal-body">
                <form id="edit-template-form" class="template-form-grid">
                    <div class="template-form-fields">
                        <h3 class="details-section-title" style="margin-top: 0;"><i class="fas fa-info-circle"></i> الحقول الأساسية</h3>
                        <div class="form-group">
                            <label for="edit-template-question">السؤال (سيكون اسم المسابقة)</label>
                            <textarea id="edit-template-question" rows="3" required>${template.name}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit-template-correct-answer">الإجابة الصحيحة</label>
                            <textarea id="edit-template-correct-answer" rows="2" required>${template.correct_answer || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit-template-classification">التصنيف</label>
                            <select id="edit-template-classification" required>
                                <option value="All" ${template.classification === 'All' ? 'selected' : ''}>عام</option>
                                <option value="R" ${template.classification === 'R' ? 'selected' : ''}>R</option>
                                <option value="A" ${template.classification === 'A' ? 'selected' : ''}>A</option>
                                <option value="B" ${template.classification === 'B' ? 'selected' : ''}>B</option>
                                <option value="C" ${template.classification === 'C' ? 'selected' : ''}>C</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit-template-usage-limit">
                                عدد مرات الاستخدام (اتركه فارغاً للاستخدام غير المحدود)
                                <small style="display: block; color: var(--text-secondary-color);">المستخدم حالياً: ${template.usage_count || 0}</small>
                            </label>
                            <input type="number" id="edit-template-usage-limit" min="1" placeholder="مثال: 5" value="${template.usage_limit || ''}">
                        </div>
                    </div>
                    <div class="template-form-content">
                        <h3 class="details-section-title" style="margin-top: 0;"><i class="fas fa-file-alt"></i> محتوى المسابقة</h3>
                        <div class="form-group">
                            <label>صورة القالب</label>
                            <div class="image-preview-container">
                                <img id="edit-template-image-preview" src="${template.image_url || 'images/competition_bg.jpg'}" alt="صورة القالب" class="image-preview">
                            </div>
                            <input type="file" id="edit-template-image-upload" accept="image/*" style="display: none;">
                            <button type="button" id="change-template-image-btn" class="btn-secondary btn-small" style="margin-top: 10px;"><i class="fas fa-edit"></i> تغيير الصورة</button>
                        </div>
                        <div class="form-group">
                            <label for="edit-template-content">نص المسابقة</label>
                            <textarea id="edit-template-content" rows="15" required>${template.content}</textarea>
                        </div>
                    </div>
                    <div class="form-actions template-form-actions">
                        <button type="submit" class="btn-primary"><i class="fas fa-save"></i> حفظ التعديلات</button>
                        <button type="button" id="cancel-edit-modal" class="btn-secondary">إلغاء</button>
                    </div>
                </form>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    
        const closeModal = () => overlay.remove();
    
        // Image manipulation listeners
        const imageUploadInput = document.getElementById('edit-template-image-upload');
        const changeImageBtn = document.getElementById('change-template-image-btn');
        const imagePreview = document.getElementById('edit-template-image-preview');
    
        changeImageBtn.addEventListener('click', () => imageUploadInput.click());
    
        imageUploadInput.addEventListener('change', () => {
            const file = imageUploadInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
                templateImageFile = file;
            }
        });
    
        document.getElementById('close-modal-btn').addEventListener('click', closeModal);
        document.getElementById('cancel-edit-modal').addEventListener('click', closeModal);
    
        document.getElementById('edit-template-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            console.log('Edit template form submitted.');
    
            try {
                let finalImageUrl = template.image_url; // Start with the existing image URL
    
                // Defensively strip origin if it's a localhost URL
                if (finalImageUrl && finalImageUrl.startsWith('http://localhost')) {
                    try {
                        const url = new URL(finalImageUrl);
                        finalImageUrl = url.pathname;
                    } catch (e) {
                        console.error('Could not parse existing template image URL:', e);
                    }
                }
    
                console.log('Initial image URL:', finalImageUrl);
                console.log('templateImageFile:', templateImageFile);
    
                if (templateImageFile) {
                    console.log('New template image file detected. Uploading...');
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الصورة...';
                    const formData = new FormData();
                    formData.append('image', templateImageFile);
    
                    const uploadResponse = await authedFetch('/api/competitions/upload-image', { method: 'POST', body: formData });
    
                    if (!uploadResponse.ok) {
                        const errorText = await uploadResponse.text();
                        console.error('Image upload failed. Status:', uploadResponse.status, 'Response:', errorText);
                        throw new Error('فشل رفع الصورة.');
                    }
                    
                    const uploadResult = await uploadResponse.json();
                    finalImageUrl = uploadResult.imageUrl;
                    console.log('Image uploaded successfully. New image URL:', finalImageUrl);
                } else {
                    console.log('No new image file. Keeping existing URL.');
                }
                
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري حفظ التعديلات...';
    
                const updatedData = {
                    name: document.getElementById('edit-template-question').value.trim(),
                    classification: document.getElementById('edit-template-classification').value,
                    content: document.getElementById('edit-template-content').value.trim(),
                    correct_answer: document.getElementById('edit-template-correct-answer').value.trim(),
                    usage_limit: document.getElementById('edit-template-usage-limit').value ? parseInt(document.getElementById('edit-template-usage-limit').value, 10) : null,
                    image_url: finalImageUrl // Use the new or existing image URL
                };
    
                console.log('Submitting updated template data:', updatedData);
    
                const response = await authedFetch(`/api/templates/${template._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatedData)
                });
    
                if (!response.ok) {
                    const result = await response.json();
                    console.error('Failed to save template:', result);
                    throw new Error(result.message || 'فشل حفظ التعديلات.');
                }
                
                showToast('تم حفظ التعديلات بنجاح.', 'success');
                closeModal();
                if (onSaveCallback) onSaveCallback();
    
            } catch (error) {
                showToast(error.message, 'error');
                console.error('Template edit failed:', error);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }
    
    // New function to display competition details in a dedicated section
    function displayCompetitionDetails(competition) {
        const detailsContainer = document.getElementById('competition-details-container');
        if (!detailsContainer) return;
    
        // Basic info
        detailsContainer.innerHTML = `
            <h2>تفاصيل المسابقة: ${competition.name}</h2>
            <p><strong>الوصف:</strong> ${competition.description || 'لا يوجد وصف متاح.'}</p>
            <p><strong>الحالة:</strong> ${competition.is_active ? 'نشطة' : 'غير نشطة'}</p>
            <p><strong>تاريخ البدء:</strong> ${new Date(competition.starts_at).toLocaleString('ar-EG')}</p>
            <p><strong>تاريخ الانتهاء:</strong> ${new Date(competition.ends_at).toLocaleString('ar-EG')}</p>
        `;
    
        // Agent info
        if (competition.agents) {
            const agent = competition.agents;
            detailsContainer.innerHTML += `
                <div class="agent-info-card">
                    <h3>بيانات الوكيل</h3>
                    <p><strong>الاسم:</strong> ${agent.name}</p>
                    <p><strong>التصنيف:</strong> ${agent.classification || 'غير محدد'}</p>
                    <p><strong>الرصيد المتبقي:</strong> $${agent.remaining_balance || 0}</p>
                </div>
            `;
        }
    
        // --- FIX: Display the actual winner selection request date from `processed_at` ---
        const winnerDateElement = document.querySelector('.competition-winner-date');
        if (winnerDateElement) {
            let winnerDateHtml = '<strong>تاريخ إرسال طلب اختيار الفائز:</strong> ';
            if (competition.processed_at) {
                const formattedWinnerDate = new Intl.DateTimeFormat('ar-EG', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }).format(new Date(competition.processed_at));
                winnerDateHtml += `<span class="date-value">${formattedWinnerDate}</span>`;
            } else {
                winnerDateHtml += `<span class="date-value" style="color: var(--warning-color);">لم يتم الإرسال بعد</span>`;
            }
            winnerDateElement.innerHTML = winnerDateHtml;
        }
        
        console.log('Competition Processed At:', competition.processed_at);
    }

    // == calendar.js ==
    const ITEM_HEIGHT = 140; // 130px height + 10px margin-bottom
    const BUFFER_ITEMS = 5; // Render items above and below the viewport for smoother scrolling
    let weeklyResetCountdownInterval = null;
    
    /**
     * Applies or removes search term highlighting from an agent item element.
     * @param {HTMLElement} element The agent item element.
     * @param {string} searchTerm The search term to highlight.
     */
    function applyHighlight(element, searchTerm) {
        const nameEl = element.querySelector('.agent-name');
        const idEl = element.querySelector('.calendar-agent-id');
        const originalName = element.dataset.name;
        const originalId = '#' + element.dataset.agentidStr;
    
        const regex = searchTerm ? new RegExp(searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi') : null;
    
        nameEl.innerHTML = searchTerm ? originalName.replace(regex, '<mark>$&</mark>') : originalName;
        idEl.innerHTML = searchTerm ? originalId.replace(regex, '<mark>$&</mark>') : originalId;
    }
    
    function createAgentItemHtml(agent, dayIndex, isToday, tasksState, number, searchTerm = '') {
        // Read state directly from the centralized store's state
        const agentTasks = tasksState.tasks[agent._id] || {};
        const task = agentTasks[dayIndex] || { audited: false, competition_sent: false };
    
        const isComplete = task.audited; // Visual completion now only requires audit
        const avatarHtml = agent.avatar_url
            ? `<img src="${agent.avatar_url}" alt="Avatar" class="calendar-agent-avatar" loading="lazy">`
            : `<div class="calendar-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;
    
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const cursorStyle = isSuperAdmin ? 'cursor: grab;' : 'cursor: pointer;';
    
        const element = document.createElement('div');
        element.id = `agent-card-${agent._id}-${dayIndex}`;
        element.className = `calendar-agent-item ${isComplete ? 'complete' : ''}`;
        element.dataset.agentId = agent._id;
        element.dataset.classification = agent.classification;
        element.dataset.name = agent.name;
        element.dataset.agentidStr = agent.agent_id;
        element.dataset.dayIndex = dayIndex;
        element.style.cssText = cursorStyle;
        if (isSuperAdmin) element.setAttribute('draggable', 'true');
    
        element.innerHTML = `
            <div class="calendar-agent-number">${number}</div>
            <div class="calendar-agent-main">
                ${avatarHtml}
                <div class="calendar-agent-info">
                    <span class="agent-name"></span>
                    <div class="agent-meta">
                        <p class="calendar-agent-id" title="نسخ الرقم" data-agent-id-copy="${agent.agent_id}"></p>
                        <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                    </div>
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
        `;
    
        applyHighlight(element, searchTerm);
    
        const nameEl = element.querySelector('.agent-name');
        nameEl.insertAdjacentHTML('beforeend', '<i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>');
        nameEl.classList.toggle('has-checkmark', isComplete);
    
        return element;
    }
    
    class CalendarUI {
        constructor(container) {
            this.container = container;
            this.container.innerHTML = `
            <div class="page-header column-header">
                <div class="header-top-row">
                    <h1>تقويم المهام الأسبوعي</h1>
                    <div class="header-actions-group">
                        <button id="reset-all-tasks-btn" class="btn btn-danger">
                            <i class="fas fa-undo"></i> إعادة تعيين الكل
                        </button>
                        <div id="weekly-reset-countdown-container" class="countdown-timer-container" style="display: none;">
                            <i class="fas fa-sync-alt"></i>
                            <span>إعادة التعيين خلال: <span id="weekly-reset-countdown" class="countdown-time"></span></span>
                        </div>
                        <span class="info-tooltip" title="حالة جميع الوكلاء سيتم إعادة تعيينها (إلغاء التدقيق والإرسال) تلقائياً كل يوم أحد الساعة 7 صباحاً">
                            <i class="fas fa-info-circle"></i>
                        </span>
                    </div>
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
            this.calendarContainer = this.container.querySelector('#calendar-container');
            this.calendarData = [];
            this.tasksState = null;
            this.daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة',];
            this.searchDebounceTimer = null;
    
            this.boundHandleChange = this._handleChange.bind(this);
            this.boundHandleResetAll = this.handleResetAllTasks.bind(this);
        }
    
        destroy() {
            // window.taskStore.unsubscribe(this.boundUpdateUIFromState); // Removed to fix bug
            clearTimeout(this.searchDebounceTimer);
            if (weeklyResetCountdownInterval) {
                clearInterval(weeklyResetCountdownInterval);
            }
            this.calendarContainer.removeEventListener('change', this.boundHandleChange);
            const resetBtn = this.container.querySelector('#reset-all-tasks-btn');
            if (resetBtn) {
                resetBtn.removeEventListener('click', this.boundHandleResetAll);
            }
            console.log('[Calendar Page] Instance destroyed and listeners cleaned up.');
        }
    
        async render() {
            const response = await authedFetch('/api/calendar/data');
            if (!response.ok) {
                throw new Error((await response.json()).message || 'فشل جلب بيانات التقويم');
            }
            const { agents } = await response.json();
    
            this.tasksState = window.taskStore.state;
    
            this.calendarData = this.daysOfWeek.map(() => []);
            agents.forEach(agent => {
                const dayIndices = agent.audit_days || [];
                dayIndices.forEach(dayIndex => {
                    if (dayIndex >= 0 && dayIndex < 6) { // Corrected to include Saturday
                        this.calendarData[dayIndex].push(agent);
                    }
                });
            });
    
            this._renderDayColumns();
            this._renderAllAgentCards();
            this._setupEventListeners();
            setupCalendarFilters(this);
    
            // The global subscription is removed to fix the bug.
            // this.boundUpdateUIFromState = updateCalendarUIFromState.bind(this);
            // window.taskStore.subscribe(this.boundUpdateUIFromState);
        }
    
        _renderDayColumns() {
            this.calendarContainer.innerHTML = '';
            this.daysOfWeek.forEach((dayName, index) => {
                const isToday = new Date().getDay() === index;
                const { completedTasks, totalTasks, progressPercent } = this._calculateDayProgress(index);
    
                const columnEl = document.createElement('div');
                columnEl.className = `day-column ${isToday ? 'today' : ''}`;
                columnEl.dataset.dayIndex = index;
                columnEl.innerHTML = `
                    <h2>${dayName}</h2>
                    <div class="day-progress">
                        <div class="progress-bar" style="width: ${progressPercent}%"></div>
                        <span class="progress-label">${completedTasks} / ${totalTasks} مكتمل</span>
                    </div>
                    <div class="day-column-content"></div>
                `;
                this.calendarContainer.appendChild(columnEl);
            });
        }
    
        _calculateDayProgress(dayIndex) {
            const dailyAgents = this.calendarData[dayIndex] || [];
            const totalTasks = dailyAgents.length;
            let completedTasks = 0;
            dailyAgents.forEach(agent => {
                const task = (this.tasksState.tasks[agent._id] || {})[dayIndex] || {};
                if (task.audited) {
                    completedTasks++;
                }
            });
            const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
            return { completedTasks, totalTasks, progressPercent };
        }
    
        _renderAllAgentCards() {
            this.calendarData.forEach((agentsForDay, dayIndex) => {
                const columnEl = this.calendarContainer.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
                if (!columnEl) return;
    
                const contentContainer = columnEl.querySelector('.day-column-content');
                contentContainer.innerHTML = '';
    
                if (agentsForDay.length > 0) {
                    const fragment = document.createDocumentFragment();
                    const isToday = new Date().getDay() === dayIndex;
                    agentsForDay.forEach((agent, index) => {
                        const agentElement = createAgentItemHtml(agent, dayIndex, isToday, this.tasksState, index + 1, '');
                        fragment.appendChild(agentElement);
                    });
                    contentContainer.appendChild(fragment);
                } else {
                    contentContainer.innerHTML = '<div class="no-tasks-placeholder"><i class="fas fa-bed"></i><p>لا توجد مهام</p></div>';
                }
            });
        }
    
        _setupEventListeners() {
            this.calendarContainer.addEventListener('change', this.boundHandleChange);
            this.container.querySelector('#reset-all-tasks-btn').addEventListener('click', this.boundHandleResetAll);
            setupClickAndDragEventListeners(this.calendarContainer, this.calendarData, this);
        }
    
        async handleResetAllTasks() {
            showConfirmationModal(
                'هل أنت متأكد من إعادة تعيين جميع المهام (التدقيق والمسابقة) لهذا الأسبوع؟ لا يمكن التراجع عن هذا الإجراء.',
                async () => {
                    showLoader();
                    try {
                        await window.taskStore.resetAllTasks();
                        showToast('تمت إعادة تعيين جميع المهام بنجاح.', 'success');
    
                        // FIX: Manually re-render the UI without a page reload
                        this.tasksState = window.taskStore.state; // Get the fresh, reset state
                        this._renderDayColumns(); // Re-render columns to reset progress bars
                        this._renderAllAgentCards(); // Re-render agent cards with reset state
    
                    } catch (error) {
                        console.error('Failed to reset all tasks:', error);
                        showToast(`فشل إعادة التعيين: ${error.message}`, 'error');
                    } finally {
                        hideLoader();
                    }
                },
                { title: 'تأكيد إعادة تعيين الكل', confirmText: 'نعم، أعد التعيين', confirmClass: 'btn-danger' }
            );
        }
    
        async _handleChange(e) {
            const checkbox = e.target;
            if (!checkbox.matches('.audit-check, .competition-check')) return;
    
            const agentId = checkbox.dataset.agentId;
            const dayIndex = parseInt(checkbox.dataset.dayIndex, 10);
            const taskType = checkbox.classList.contains('audit-check') ? 'audited' : 'competition_sent';
            const status = checkbox.checked;
    
            const agentItem = checkbox.closest('.calendar-agent-item');
            agentItem.classList.add('is-loading');
            agentItem.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = true);
    
            try {
                // This updates the central store
                await window.taskStore.updateTaskStatus(agentId, dayIndex, taskType, status);
                
                // FIX: Now, manually and correctly update the UI for this single item.
                updateCalendarUIFromState.call(this, { agentId, dayIndex, taskType, status });
    
            } catch (error) {
                console.error(`[Calendar Error] Failed to update task. AgentID: ${agentId}, Day: ${dayIndex}, Type: ${taskType}. Reason:`, error);
                showToast('فشل تحديث حالة المهمة.', 'error');
                
                // Revert UI on error
                checkbox.checked = !status;
                agentItem.classList.remove('is-loading');
                agentItem.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = false);
            }
        }
    
        _updateAfterDrag(sourceDayIndex, newDayIndex, agentId) {
            const agentToMove = this.calendarData[sourceDayIndex].find(a => a._id === agentId);
            if (!agentToMove) return;
    
            this.calendarData[sourceDayIndex] = this.calendarData[sourceDayIndex].filter(a => a._id !== agentId);
            this.calendarData[newDayIndex].push(agentToMove);
            this.calendarData[newDayIndex].sort((a, b) => a.name.localeCompare(b.name));
            
            // Re-render only the two affected columns for efficiency
            this._renderSingleDayColumn(sourceDayIndex);
            this._renderSingleDayColumn(newDayIndex);
        }
    
        _renderSingleDayColumn(dayIndex) {
            const columnEl = this.calendarContainer.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
            if (!columnEl) return;
    
            const contentContainer = columnEl.querySelector('.day-column-content');
            contentContainer.innerHTML = '';
    
            const agentsForDay = this.calendarData[dayIndex] || [];
            if (agentsForDay.length > 0) {
                const fragment = document.createDocumentFragment();
                const isToday = new Date().getDay() === dayIndex;
                agentsForDay.forEach((agent, index) => {
                    const agentElement = createAgentItemHtml(agent, dayIndex, isToday, this.tasksState, index + 1, '');
                    fragment.appendChild(agentElement);
                });
                contentContainer.appendChild(fragment);
            } else {
                contentContainer.innerHTML = '<div class="no-tasks-placeholder"><i class="fas fa-bed"></i><p>لا توجد مهام</p></div>';
            }
            updateDayProgressUI.call(this, dayIndex);
        }
    }
    
    let currentCalendarInstance = null;
    
    async function renderCalendarPage() {
        if (currentCalendarInstance) {
            currentCalendarInstance.destroy();
        }
        const appContent = document.getElementById('app-content');
        currentCalendarInstance = new CalendarUI(appContent);
        try {
            await currentCalendarInstance.render();
            startWeeklyResetCountdown();
        } catch (error) {
            console.error("Error rendering calendar page:", error);
            const calendarContainer = document.getElementById('calendar-container');
            if (calendarContainer) calendarContainer.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات التقويم: ${error.message}</p>`;
        }
    }
    
    function getNextResetTime() {
        const now = new Date();
        const nextReset = new Date();
        const day = now.getDay();
        const daysUntilSunday = (7 - day) % 7;
        nextReset.setDate(now.getDate() + daysUntilSunday);
        nextReset.setHours(7, 0, 0, 0);
        if (day === 0 && now.getTime() > nextReset.getTime()) {
            nextReset.setDate(nextReset.getDate() + 7);
        }
        return nextReset;
    }
    
    function startWeeklyResetCountdown() {
        const countdownContainer = document.getElementById('weekly-reset-countdown-container');
        const countdownElement = document.getElementById('weekly-reset-countdown');
        if (!countdownContainer || !countdownElement) return;
    
        const updateTimer = () => {
            const now = new Date();
            const nextReset = getNextResetTime();
            const diff = nextReset - now;
    
            if (diff > 0 && diff < 5 * 60 * 60 * 1000) {
                countdownContainer.style.display = 'flex';
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                countdownElement.textContent = `${h}س ${m}د ${s}ث`;
            } else {
                countdownContainer.style.display = 'none';
            }
            
            if (diff < 0) {
                const lastReset = localStorage.getItem('lastWeeklyReset');
                if (!lastReset || new Date(lastReset) < nextReset) {
                    localStorage.setItem('lastWeeklyReset', new Date().toISOString());
                    location.reload();
                }
            }
        };
    
        updateTimer();
        weeklyResetCountdownInterval = setInterval(updateTimer, 1000);
    }
    
    function updateCalendarUIFromState({ agentId, dayIndex, taskType, status }) {
        const container = this.calendarContainer;
        if (!container) return;
    
        const agentItem = container.querySelector(`#agent-card-${agentId}-${dayIndex}`);
        if (!agentItem) return;
    
        const taskState = (this.tasksState.tasks[agentId] || {})[dayIndex] || { audited: false, competition_sent: false };
    
        const checkbox = agentItem.querySelector(`.${taskType === 'audited' ? 'audit-check' : 'competition-check'}`);
        if (checkbox) checkbox.checked = status;
    
        checkbox?.closest('.action-item').classList.toggle('done', status);
    
        if (taskType === 'audited') {
            const isComplete = taskState.audited;
            agentItem.classList.toggle('complete', isComplete);
            const nameEl = agentItem.querySelector('.agent-name');
            if (nameEl) nameEl.classList.toggle('has-checkmark', isComplete);
        }
    
        agentItem.classList.remove('is-loading');
        agentItem.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = false);
    
        updateDayProgressUI.call(this, dayIndex);
    }
    
    function updateDayProgressUI(dayIndex) {
        const column = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
        if (!column) return;
    
        const progressBar = column.querySelector('.progress-bar');
        const progressLabel = column.querySelector('.progress-label');
        
        const allAgentsForDay = this.calendarData?.[dayIndex] || [];
        const totalTasks = allAgentsForDay.length;
        let completedTasks = 0;
    
        allAgentsForDay.forEach(agent => {
            const task = (this.tasksState.tasks[agent._id] || {})[dayIndex] || {};
            if (task.audited) {
                completedTasks++;
            }
        });
    
        const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        progressBar.style.width = `${progressPercent}%`;
        progressLabel.textContent = `${completedTasks} / ${totalTasks} مكتمل`;
    }
    
    function setupClickAndDragEventListeners(container, calendarData, uiInstance) {
        container.addEventListener('click', (e) => {
            const copyIdTrigger = e.target.closest('.calendar-agent-id[data-agent-id-copy]');
            if (copyIdTrigger) {
                e.stopPropagation();
                navigator.clipboard.writeText(copyIdTrigger.dataset.agentIdCopy).then(() => showToast(`تم نسخ الرقم: ${copyIdTrigger.dataset.agentIdCopy}`, 'info'));
                return;
            }
            const card = e.target.closest('.calendar-agent-item[data-agent-id]');
            if (card && !e.target.closest('.calendar-agent-actions')) {
                window.location.hash = `#profile/${card.dataset.agentId}`;
            }
    
            const actionItem = e.target.closest('.action-item');
            if (actionItem && !e.target.matches('input[type="checkbox"]')) {
                const checkbox = actionItem.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        if (isSuperAdmin) {
            let draggedItem = null;
            let sourceDayIndex = null;
    
            container.addEventListener('dragstart', (e) => {
                const target = e.target.closest('.calendar-agent-item');
                if (target) {
                    draggedItem = target;
                    sourceDayIndex = parseInt(target.dataset.dayIndex, 10);
                    setTimeout(() => target.classList.add('dragging'), 0);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', target.dataset.agentId);
                }
            });
    
            container.addEventListener('dragend', () => {
                if (draggedItem) {
                    draggedItem.classList.remove('dragging');
                    draggedItem = null;
                }
            });
    
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                const column = e.target.closest('.day-column');
                if (column) column.classList.add('drag-over');
            });
    
            container.addEventListener('dragleave', (e) => {
                const column = e.target.closest('.day-column');
                if (column) column.classList.remove('drag-over');
            });
    
            container.addEventListener('drop', async (e) => {
                e.preventDefault();
                const targetColumn = e.target.closest('.day-column');
                if (!targetColumn || !draggedItem) return;
    
                targetColumn.classList.remove('drag-over');
                const newDayIndex = parseInt(targetColumn.dataset.dayIndex, 10);
                const agentId = draggedItem.dataset.agentId;
    
                if (sourceDayIndex === newDayIndex) return;
    
                try {
                    const agentCheckResponse = await authedFetch(`/api/agents/${agentId}?select=audit_days`);
                    const { data: agent } = await agentCheckResponse.json();
                    if ((agent.audit_days || []).includes(newDayIndex)) {
                        showToast(`هذا الوكيل مجدول بالفعل في يوم ${uiInstance.daysOfWeek[newDayIndex]}.`, 'warning');
                        return;
                    }
    
                    showConfirmationModal(
                        `هل أنت متأكد من نقل الوكيل <strong>${draggedItem.dataset.name}</strong> من يوم <strong>${uiInstance.daysOfWeek[sourceDayIndex]}</strong> إلى يوم <strong>${uiInstance.daysOfWeek[newDayIndex]}</strong>؟`,
                        async () => {
                            const agentResponse = await authedFetch(`/api/agents/${agentId}?select=audit_days`);
                            const { data: agent } = await agentResponse.json();
                            const newAuditDays = [...(agent.audit_days || []).filter(d => d !== sourceDayIndex), newDayIndex];
    
                            await authedFetch(`/api/agents/${agentId}`, {
                                method: 'PUT',
                                body: JSON.stringify({ audit_days: newAuditDays })
                            });
    
                            showToast('تم تحديث يوم التدقيق بنجاح.', 'success');
                            await logAgentActivity(currentUserProfile?._id, agentId, 'DETAILS_UPDATE', `تم تغيير يوم التدقيق من ${uiInstance.daysOfWeek[sourceDayIndex]} إلى ${uiInstance.daysOfWeek[newDayIndex]} عبر التقويم.`);
                            
                            uiInstance._updateAfterDrag(sourceDayIndex, newDayIndex, agentId);
                        }
                    );
                } catch (error) {
                    showToast(`فشل تحديث يوم التدقيق: ${error.message}`, 'error');
                }
            });
        }
    }
    
    function setupCalendarFilters(uiInstance) {
        const searchInput = document.getElementById('calendar-search-input');
        const clearBtn = document.getElementById('calendar-search-clear');
        const filterButtons = document.querySelectorAll('.filter-btn');
    
        const applyFilters = () => {
            if (clearBtn) {
                clearBtn.style.display = searchInput.value ? 'block' : 'none';
            }
    
            const searchTerm = searchInput.value.toLowerCase().trim();
            const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
    
            uiInstance.calendarData.forEach((allAgentsForDay, dayIndex) => {
                const columnEl = uiInstance.calendarContainer.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
                if (!columnEl) return;
    
                const filteredAgents = allAgentsForDay.filter(agent => {
                    const name = agent.name.toLowerCase();
                    const agentIdStr = agent.agent_id;
                    const classification = agent.classification;
                    const matchesSearch = searchTerm === '' || name.includes(searchTerm) || agentIdStr.includes(searchTerm);
                    const matchesFilter = activeFilter === 'all' || classification === activeFilter;
                    return matchesSearch && matchesFilter;
                });
                
                const contentContainer = columnEl.querySelector('.day-column-content');
                contentContainer.innerHTML = '';
    
                if (filteredAgents.length === 0) {
                    contentContainer.innerHTML = '<div class="no-results-placeholder"><i class="fas fa-search"></i><p>لا توجد نتائج</p></div>';
                } else {
                    const fragment = document.createDocumentFragment();
                    const isToday = new Date().getDay() === dayIndex;
                    filteredAgents.forEach((agent, index) => {
                        const agentElement = createAgentItemHtml(agent, dayIndex, isToday, uiInstance.tasksState, index + 1, searchTerm);
                        fragment.appendChild(agentElement);
                    });
                    contentContainer.appendChild(fragment);
                }
            });
        };
    
        searchInput.addEventListener('input', () => {
            clearTimeout(uiInstance.searchDebounceTimer);
            uiInstance.searchDebounceTimer = setTimeout(applyFilters, 300);
        });
    
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

    // == topAgents.js ==
    let agentStats = [];
    
    // --- NEW: Confetti Animation on Page Load ---
    function triggerConfettiAnimation() {
        const container = document.getElementById('app-content');
        if (!container) return;
    
        const confettiContainer = document.createElement('div');
        confettiContainer.className = 'confetti-container';
        container.appendChild(confettiContainer);
    
        const confettiCount = 150; // Number of confetti pieces
        const colors = ['#FFD700', '#C0C0C0', '#CD7F32']; // Gold, Silver, Bronze
    
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.animationDuration = `${Math.random() * 3 + 4}s`; // Duration between 4 and 7 seconds
            confetti.style.animationDelay = `${Math.random() * 2}s`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confettiContainer.appendChild(confetti);
        }
    
        // Remove the confetti after the animation is done to keep the DOM clean
        setTimeout(() => confettiContainer.remove(), 7000);
    }
    
    async function renderTopAgentsPage() {
        const appContent = document.getElementById('app-content');
        appContent.innerHTML = `
            <div class="page-header column-header">
                <div class="header-top-row">
                    <h1 class="leaderboard-title"><i class="fas fa-chart-bar"></i> أبرز الوكلاء</h1>
                    <div class="header-actions-group">
                        <button id="export-top-agents-btn" class="btn-secondary"><i class="fas fa-file-excel"></i> تصدير</button>
                    </div>
                </div>
                <div class="leaderboard-filters-v2">
                    <div class="filter-group">
                        <label class="filter-label"><i class="fas fa-sort-amount-down"></i> ترتيب حسب</label>
                        <div class="filter-buttons" data-filter-group="sort">
                            <button class="filter-btn active" data-sort="total_views"><i class="fas fa-eye"></i> المشاهدات</button>
                            <button class="filter-btn" data-sort="total_reactions"><i class="fas fa-heart"></i> التفاعلات</button>
                            <button class="filter-btn" data-sort="total_participants"><i class="fas fa-users"></i> المشاركات</button>
                            <button class="filter-btn" data-sort="growth_rate"><i class="fas fa-rocket"></i> النمو</button>
                        </div>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label"><i class="fas fa-tags"></i> فلترة حسب التصنيف</label>
                        <div class="filter-buttons" data-filter-group="classification">
                            <button class="filter-btn active" data-filter="all"><i class="fas fa-globe-asia"></i> الكل</button>
                            <button class="filter-btn classification-badge classification-r" data-filter="R">R</button>
                            <button class="filter-btn classification-badge classification-a" data-filter="A">A</button>
                            <button class="filter-btn classification-badge classification-b" data-filter="B">B</button>
                            <button class="filter-btn classification-badge classification-c" data-filter="C">C</button>
                        </div>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label"><i class="fas fa-clock"></i> النطاق الزمني</label>
                        <div class="filter-buttons" data-filter-group="date">
                            <button class="filter-btn active" data-range="all"><i class="fas fa-infinity"></i> الكل</button>
                            <button class="filter-btn" data-range="week"><i class="fas fa-calendar-week"></i> هذا الأسبوع</button>
                            <button class="filter-btn" data-range="month"><i class="fas fa-calendar-day"></i> هذا الشهر</button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="leaderboard-content-container">
            </div>
        `;
    
        // --- NEW: Trigger the celebration animation ---
        triggerConfettiAnimation();
    
        // Initial fetch for all time
        await fetchAndRenderTopAgents('all');
    
        // --- NEW: Add listener for export button ---
        const exportBtn = document.getElementById('export-top-agents-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => exportTopAgentsToCSV(agentStats));
        }
    
        // --- تعديل: ربط معالجات الأحداث مرة واحدة فقط لضمان الاستجابة الفورية ---
        const dateFilterGroup = document.querySelector('.filter-buttons[data-filter-group="date"]');
        const sortFilterGroup = document.querySelector('.filter-buttons[data-filter-group="sort"]');
        const classificationFilterGroup = document.querySelector('.filter-buttons[data-filter-group="classification"]');
    
        dateFilterGroup?.addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn')) {
                dateFilterGroup.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                fetchAndRenderTopAgents(e.target.dataset.range);
            }
        });
        sortFilterGroup?.addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn')) {
                sortFilterGroup.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                applyAndDisplay(); // إعادة الفرز والتصفية على البيانات الحالية
            }
        });
        classificationFilterGroup?.addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn')) {
                classificationFilterGroup.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                applyAndDisplay(); // إعادة الفرز والتصفية على البيانات الحالية
            }
        });
    }
    
    async function fetchAndRenderTopAgents(dateRange = 'all') {
        const container = document.getElementById('leaderboard-content-container');
        container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    
        try {
            const queryParams = new URLSearchParams({ dateRange });
            const response = await authedFetch(`/api/stats/top-agents?${queryParams.toString()}`);
    
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.message || 'فشل تحميل بيانات الوكلاء.');
            }
    
            const topAgentsData = await response.json();
    
            // The rest of the logic remains the same, but we need to adjust for _id
            processAndDisplayTopAgents(topAgentsData);
        } catch (error) {
            container.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }
    
    function processAndDisplayTopAgents(agents, competitions) {
        // Group competitions by agent
        // --- FIX: The backend now sends a single array with stats already calculated ---
        agentStats = agents.map(agent => {
            const total_views = agent.total_views || 0;
            const total_reactions = agent.total_reactions || 0;
            const total_participants = agent.total_participants || 0;
    
            let growth_rate = 0;
            let trend = 'stable'; // 'up', 'down', 'stable'
            // Growth rate calculation needs to be re-evaluated if needed, as we don't have individual competitions here.
            /* if (agentComps.length >= 2) {
                const latestTotal = (latest.views_count || 0) + (latest.reactions_count || 0) + (latest.participants_count || 0);
                const previousTotal = (previous.views_count || 0) + (previous.reactions_count || 0) + (previous.participants_count || 0);
                if (previousTotal > 0) {
                    growth_rate = ((latestTotal - previousTotal) / previousTotal) * 100;
                    if (growth_rate > 5) trend = 'up';
                    else if (growth_rate < -5) trend = 'down';
                }
            } */
    
            return {
                ...agent,
                total_views, total_reactions, total_participants,
                growth_rate,
                trend
            };
        });
    
        // Store globally for filtering
        window.currentAgentStats = agentStats;
    
        // Initial render
        applyAndDisplay();
    }
    function applyAndDisplay() {
        const sortKey = document.querySelector('.filter-buttons[data-filter-group="sort"] .active')?.dataset.sort || 'total_views';
        const classification = document.querySelector('.filter-buttons[data-filter-group="classification"] .active')?.dataset.filter || 'all';
        let sortedAgents = [...(window.currentAgentStats || [])];
    
        // 1. Filter by classification
        if (classification !== 'all') {
            sortedAgents = sortedAgents.filter(agent => agent.classification === classification);
        }
    
        // 2. Sort the filtered list
        const classificationOrder = { 'R': 1, 'A': 2, 'B': 3, 'C': 4 };
        sortedAgents.sort((a, b) => {
            const sortValue = b[sortKey] - a[sortKey];
            if (sortValue !== 0) return sortValue;
            const orderA = classificationOrder[a.classification] || 99;
            const orderB = classificationOrder[b.classification] || 99;
            return orderA - orderB;
        });
    
        // 3. Display the final sorted and filtered list
        displayTopAgents(sortedAgents, sortKey);
    }
    
    
    function displayTopAgents(sortedAgents, sortKey) {
        const container = document.getElementById('leaderboard-content-container');
        const dateRange = document.querySelector('.filter-buttons[data-filter-group="date"] .active')?.dataset.range || 'all';
    
        if (!container) return;
        // --- NEW: Clear previous content and add a loading state ---
        container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    
    
        if (!sortedAgents || sortedAgents.length === 0) {
            container.innerHTML = '<div class="no-results-message"><i class="fas fa-ghost"></i><p>لا توجد بيانات لعرضها حسب الفلاتر المحددة.</p></div>';
            return;
        }
    
        const getStatLabel = (key) => {
            switch (key) {
                case 'total_views': return 'مشاهدة';
                case 'total_reactions': return 'تفاعل';
                case 'total_participants': return 'مشاركة';
                case 'growth_rate': return 'نمو';
                default: return '';
            }
        };
    
        const getStatValue = (agent, key) => {
            if (key === 'growth_rate') {
                return `${agent[key].toFixed(1)}%`;
            }
            return formatNumber(agent[key]);
        };
    
        const getRankIcon = (rank) => {
            if (rank === 1) return '<span class="rank-icon gold">🥇</span>';
            if (rank === 2) return '<span class="rank-icon silver">🥈</span>';
            if (rank === 3) return '<span class="rank-icon bronze">🥉</span>';
            return `<span class="rank-number">${rank}</span>`;
        };
    
        // --- تعديل: فصل الوكلاء الثلاثة الأوائل لعرضهم في منصة التتويج ---
        const topThree = sortedAgents.slice(0, 3);
        const runnersUp = sortedAgents.slice(3);
        const exclusiveRanks = ['CENTER', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'SAPPHIRE', 'EMERALD', 'KING', 'LEGEND', 'وكيل حصري بدون مرتبة'];
        const regularRanks = ['BEGINNING', 'GROWTH', 'PRO', 'ELITE'];
        const exclusiveRunnersUp = runnersUp.filter(agent => exclusiveRanks.includes(agent.rank));
        const regularRunnersUp = runnersUp.filter(agent => regularRanks.includes(agent.rank));
    
        // --- NEW: Podium data preparation ---
        const podiumData = {
            first: topThree.find((_, i) => i === 0),
            second: topThree.find((_, i) => i === 1),
            third: topThree.find((_, i) => i === 2)
        };
        // Order for flexbox display: 2nd, 1st, 3rd
        const podiumOrder = [podiumData.second, podiumData.first, podiumData.third].filter(Boolean);
    
        const topAgentBadge = dateRange === 'week' ? 'وكيل الأسبوع' : (dateRange === 'month' ? 'وكيل الشهر' : 'وكيل الموسم');
    
        const renderCard = (agent, rank) => {
            const isTopThree = rank <= 3;
            const rankClass = rank === 1 ? 'gold' : (rank === 2 ? 'silver' : 'bronze');
            const trendIcon = agent.trend === 'up' ? '<i class="fas fa-arrow-up trend-up"></i>' : (agent.trend === 'down' ? '<i class="fas fa-arrow-down trend-down"></i>' : '');
            const avatarHtml = agent.avatar_url
                ? `<img src="${agent.avatar_url}" alt="Avatar" class="leaderboard-avatar" loading="lazy">`
                : `<div class="leaderboard-avatar-placeholder"><i class="fas fa-user"></i></div>`;
    
            return `
                <div class="leaderboard-card ${isTopThree ? `top-rank ${rankClass}` : ''}" data-agent-id="${agent._id}" style="cursor: pointer;">
                    <div class="leaderboard-rank">
                        ${isTopThree ? `<div class="medal-badge ${rankClass}">${getRankIcon(rank)}</div>` : getRankIcon(rank)}
                    </div>
                    ${rank === 1 ? '<div class="glow-bar"></div>' : ''}
                    <div class="leaderboard-agent-profile">
                        ${avatarHtml}
                        <div class="leaderboard-agent-info">
                            <h3 class="leaderboard-agent-name">${agent.name} ${trendIcon}</h3>
                            <div class="leaderboard-agent-meta" data-agent-id-copy="${agent.agent_id}" title="نسخ الرقم">
                                <span class="leaderboard-agent-id">#${agent.agent_id}</span>
                            </div>
                        </div>
                    </div>
                    <div class="leaderboard-stats-grid">
                        <div class="stat-item">
                            <span class="stat-value">${formatNumber(agent.total_views)}</span>
                            <span class="stat-label"><i class="fas fa-eye"></i> مشاهدات</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${formatNumber(agent.total_reactions)}</span>
                            <span class="stat-label"><i class="fas fa-heart"></i> تفاعلات</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${formatNumber(agent.total_participants)}</span>
                            <span class="stat-label"><i class="fas fa-users"></i> مشاركات</span>
                        </div>
                    </div>
                    ${(rank === 1 && topAgentBadge) ? `<div class="top-agent-banner">${topAgentBadge}</div>` : ''}
                </div>
            `;
        };
    
        const renderSimpleCard = (agent, rank) => {
            const avatarHtml = agent.avatar_url
                ? `<img src="${agent.avatar_url}" alt="Avatar" class="leaderboard-avatar-simple" loading="lazy">`
                : `<div class="leaderboard-avatar-placeholder-simple"><i class="fas fa-user"></i></div>`;
    
            return `
                <div class="leaderboard-card-simple" data-agent-id="${agent._id}" style="cursor: pointer;">
                    <span class="simple-rank">${rank}</span>
                    ${avatarHtml}
                    <div class="simple-agent-info">
                        <span class="simple-agent-name">${agent.name}</span>
                        <span class="simple-agent-id" data-agent-id-copy="${agent.agent_id}" title="نسخ الرقم">#${agent.agent_id}</span>
                    </div>
                    <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                </div>
            `;
        };
    
        container.innerHTML = `
            ${podiumOrder.length > 0 ? `
                <div class="leaderboard-podium">
                    ${podiumOrder.map(agent => renderCard(agent, sortedAgents.findIndex(a => a._id.toString() === agent._id.toString()) + 1)).join('')}
                </div>
            ` : ''}
            
            ${runnersUp.length > 0 ? `
                <hr class="leaderboard-divider">
                <div class="leaderboard-bottom-sections">
                    <div class="leaderboard-list-section">
                        <h2 class="leaderboard-section-title"><i class="fas fa-crown"></i> 1- الوكلاء الحصريين</h2>
                        <div class="leaderboard-simple-list">${exclusiveRunnersUp.map((agent, index) => renderSimpleCard(agent, index + 4)).join('')}</div>
                    </div>
                    <div class="leaderboard-list-section">
                        <h2 class="leaderboard-section-title"><i class="fas fa-users"></i> 2- الوكلاء الاعتياديين</h2>
                        <div class="leaderboard-simple-list">${regularRunnersUp.map((agent, index) => renderSimpleCard(agent, index + 4 + exclusiveRunnersUp.length)).join('')}</div>
                    </div>
                </div>
            ` : ''}
        `;
    
        // --- NEW: Event Delegation for CSP Compliance ---
        container.addEventListener('click', (e) => {
            const copyIdTrigger = e.target.closest('[data-agent-id-copy]');
            if (copyIdTrigger) {
                e.stopPropagation();
                const agentIdToCopy = copyIdTrigger.dataset.agentIdCopy;
                navigator.clipboard.writeText(agentIdToCopy).then(() => showToast(`تم نسخ الرقم: ${agentIdToCopy}`, 'info'));
                return;
            }
    
            const card = e.target.closest('[data-agent-id]');
            if (card) {
                window.location.hash = `#profile/${card.dataset.agentId}`;
            }
        });
    }
    
    // --- NEW: Export to CSV Functionality ---
    function exportTopAgentsToCSV(agentStats) {
        const sortKey = document.querySelector('.filter-buttons[data-filter-group="sort"] .active')?.dataset.sort || 'total_views';
        const classification = document.querySelector('.filter-buttons[data-filter-group="classification"] .active')?.dataset.filter || 'all';
    
        // Re-filter and sort the data exactly as it's displayed
        const classificationOrder = { 'R': 1, 'A': 2, 'B': 3, 'C': 4 };
        let agentsToExport = [...(agentStats || [])];
    
        if (classification !== 'all') {
            agentsToExport = agentsToExport.filter(agent => agent.classification === classification);
        }
        agentsToExport.sort((a, b) => {
            const sortValue = b[sortKey] - a[sortKey];
            if (sortValue !== 0) return sortValue;
            const orderA = classificationOrder[a.classification] || 99;
            const orderB = classificationOrder[b.classification] || 99;
            return orderA - orderB;
        });
    
        if (!agentsToExport || agentsToExport.length === 0) {
            showToast('لا توجد بيانات لتصديرها.', 'info');
            return;
        }
    
        // --- NEW: Professional Excel Export ---
        try {
            const dataForSheet = agentsToExport.map((agent, index) => ({
                'الترتيب': index + 1,
                'الاسم': agent.name,
                'رقم الوكالة': agent.agent_id,
                'المرتبة': agent.rank,
                'التصنيف': agent.classification,
                'إجمالي المشاهدات': agent.total_views || 0,
                'إجمالي التفاعلات': agent.total_reactions || 0,
                'إجمالي المشاركات': agent.total_participants || 0,
                'معدل النمو (%)': agent.growth_rate.toFixed(2)
            }));
    
            const ws = XLSX.utils.json_to_sheet(dataForSheet);
    
            // --- NEW: Styling ---
            // Set column widths
            ws['!cols'] = [
                { wch: 8 },  // الترتيب
                { wch: 25 }, // الاسم
                { wch: 15 }, // رقم الوكالة
                { wch: 15 }, // المرتبة
                { wch: 10 }, // التصنيف
                { wch: 20 }, // إجمالي المشاهدات
                { wch: 20 }, // إجمالي التفاعلات
                { wch: 20 }, // إجمالي المشاركات
                { wch: 18 }  // معدل النمو
            ];
    
            // Style header
            const headerRange = XLSX.utils.decode_range(ws['!ref']);
            for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
                const address = XLSX.utils.encode_cell({ r: 0, c: C });
                if (!ws[address]) continue;
                ws[address].s = {
                    font: { bold: true, color: { rgb: "FFFFFF" } }, // نص أبيض عريض
                    fill: { fgColor: { rgb: "4CAF50" } }, // خلفية خضراء
                    alignment: { horizontal: "center", vertical: "center" } // توسيط أفقي وعمودي
                };
            }
    
            // --- تعديل: التأكد من توسيط جميع خلايا البيانات ---
            for (let R = headerRange.s.r + 1; R <= headerRange.e.r; ++R) {
                for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
                    const address = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[address]) continue;
                    // Ensure the cell has a style object
                    if (!ws[address].s) ws[address].s = {};
                    ws[address].s.alignment = { horizontal: "center", vertical: "center" }; // توسيط أفقي وعمودي
                }
            }
    
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'أبرز الوكلاء');
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Top_Agents_${dateStr}.xlsx`);
        } catch (err) {
            console.error('Failed to export to Excel:', err);
            showToast('فشل تصدير الملف. يرجى المحاولة مرة أخرى.', 'error');
        }
    
        showToast('تم بدء تصدير البيانات بنجاح.', 'success');
    }
    
    function getStartDateForRange(range) {
        const now = new Date();
        if (range === 'week') {
            const firstDayOfWeek = now.getDate() - now.getDay(); // Sunday is the first day
            const startDate = new Date(now.setDate(firstDayOfWeek));
            startDate.setHours(0, 0, 0, 0);
            return startDate;
        }
        if (range === 'month') {
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            return startDate;
        }
        return new Date(0); // Default for 'all'
    }

    // == profile.js ==
    let competitionCountdownIntervals = [];
    let renewalCountdownInterval = null; // For the new renewal countdown
    let isRenewing = false; // Flag to prevent renewal race condition
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    let profilePageEventListeners = []; // Defensive: To manage event listeners
    
    function stopCompetitionCountdowns() {
        competitionCountdownIntervals.forEach(clearInterval);
        competitionCountdownIntervals = [];
    }
    
    function stopAllProfileTimers() {
        // A single function to clean up all timers when leaving the profile page.
        // This ensures complete separation.
        stopCompetitionCountdowns();
        if (renewalCountdownInterval) {
            clearInterval(renewalCountdownInterval);
            renewalCountdownInterval = null;
        }
        // Defensive: Remove all dynamically added event listeners for this page
        profilePageEventListeners.forEach(({ element, type, handler }) => {
            if (element) element.removeEventListener(type, handler);
        });
        profilePageEventListeners = [];
    }
    
    async function renderAgentProfilePage(agentId, options = {}) {
        isRenewing = false; // Reset the flag on each render
        const appContent = document.getElementById('app-content');
        appContent.innerHTML = '';
    
        if (!authedFetch) { // Check if authedFetch is available (it's a placeholder for now)
            appContent.innerHTML = `<p class="error">لا يمكن عرض الملف الشخصي، لم يتم الاتصال بقاعدة البيانات.</p>`;
            return;
        }
    
        // Clear any previous timers from other profiles
        stopAllProfileTimers();
    
        // --- Defensive Programming: Use optional chaining and provide defaults ---
        if (!currentUserProfile) { // Worst-case: profile data not loaded yet
            appContent.innerHTML = `<p class="error">فشل تحميل بيانات المستخدم. يرجى تحديث الصفحة.</p>`;
            return;
        }
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = currentUserProfile?.role === 'admin';
        const userPerms = currentUserProfile?.permissions || {};
    
        // Check for edit mode in hash, e.g., #profile/123/edit
        const hashParts = window.location.hash.split('/');
        const startInEditMode = hashParts.includes('edit');
        const defaultTab = options.activeTab || 'action';
    
        // --- STEP 5: MIGRATION TO CUSTOM BACKEND ---
        let agent = null;
        let error = null;
        try {
            const response = await authedFetch(`/api/agents/${agentId}`);
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || 'فشل جلب بيانات الوكيل.');
            }
            const result = await response.json();
            agent = result.data;
        } catch (e) {
            error = e;
        }
    
        // --- Defensive Programming: Handle API failures gracefully ---
        let agentCompetitions = [];
        let agentLogs = [];
        try {
            const compResponse = await authedFetch(`/api/competitions?agentId=${agentId}&limit=100&sort=newest`); // Fetch up to 100 competitions for the agent
            const logUrl = `/api/logs?agent_id=${agentId}&limit=50&populate=user`;
            const logResponse = await authedFetch(logUrl); // Fetch latest 50 logs for the agent
    
            if (compResponse.ok) {
                const compResult = await compResponse.json();
                agentCompetitions = compResult.data || []; // Default to empty array
            } else {
                console.error("Failed to fetch agent competitions.");
                // Don't block rendering, just show an empty list.
            }
            if (logResponse.ok) {
                const logResult = await logResponse.json();
                agentLogs = logResult.data || []; // Default to empty array
            } else {
                console.error("Failed to fetch agent logs.");
            }
        } catch (compError) {
            console.error("Error fetching secondary profile data:", compError);
            // The page can still render without this data.
        }
        if (error || !agent) {
            appContent.innerHTML = `<p class="error">فشل العثور على الوكيل المطلوب.</p>`;
            return;
        }
    
        // --- NEW: Fetch today's task status for this agent from the central store ---
        const today = new Date();
        const todayDayIndex = today.getDay();
        let isTaskDay = (agent.audit_days || []).includes(todayDayIndex);
    
        // --- NEW: Ensure task store is initialized and get today's task status ---
        await window.taskStore.init(); // Make sure we have the latest task data
        const agentTaskToday = window.taskStore.state.tasks[agentId]?.[todayDayIndex] || { audited: false, competition_sent: false };
        const isAuditedToday = agentTaskToday.audited;
    
        const activeCompetition = agentCompetitions.find(c => c.is_active === true);
        const hasActiveCompetition = !!activeCompetition;
        const hasInactiveCompetition = !hasActiveCompetition && agentCompetitions.length > 0;
    
        let activeCompetitionCountdownHtml = '';
        if (activeCompetition && activeCompetition.ends_at) {
            const endDate = new Date(activeCompetition.ends_at);
            if (endDate.getTime() > new Date().getTime()) {
                // The content will be filled by the live countdown timer
                activeCompetitionCountdownHtml = `<div class="competition-countdown-header" data-end-date="${activeCompetition.ends_at}">
                    <i class="fas fa-clock"></i> 
                    <span>جاري حساب الوقت...</span>
                </div>`;
            }
        }
    
        // --- NEW: Create the audit button for the header ---
        const auditButtonHtml = isTaskDay
            ? `<div id="header-audit-status" class="header-audit-status ${isAuditedToday ? 'audited' : 'pending'}">
                   <button id="perform-audit-btn" class="btn-icon-action" title="${isAuditedToday ? 'إلغاء التدقيق' : 'تمييز كـ "تم التدقيق"'}">
                       <i class="fas fa-${isAuditedToday ? 'check-circle' : 'clipboard-check'}"></i>
                   </button>
                   <span class="audit-status-text">${isAuditedToday ? 'تم التدقيق' : 'التدقيق مطلوب اليوم'}</span>
               </div>`
            : '';
    
        // Helper for audit days in Action Tab
        // --- تعديل: عرض أيام التدقيق المحددة فقط كعلامات (tags) ---
        const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']; 
        const auditDaysHtml = (agent.audit_days && agent.audit_days.length > 0)
            ? `<div class="audit-days-display">${agent.audit_days.sort().map(dayIndex => `<span class="day-tag">${dayNames[dayIndex]}</span>`).join('')}</div>`
            : '<span class="day-tag-none">لا توجد أيام محددة</span>';
    
        // --- Defensive Programming: Centralize permission checks after data loading ---
        const canViewFinancials = isSuperAdmin || isAdmin || userPerms.agents?.view_financials;
        const canEditProfile = isSuperAdmin || isAdmin; // Or a specific permission
        const canViewAgentComps = isSuperAdmin || isAdmin || userPerms.agents?.can_view_competitions_tab;
        const canCreateComp = isSuperAdmin || isAdmin || userPerms.competitions?.can_create;
        const canEditComps = isSuperAdmin || isAdmin || userPerms.competitions?.manage_comps === 'full';
        const canManualRenew = isSuperAdmin || isAdmin; // Define who can manually renew
    
        appContent.innerHTML = `
            <div class="profile-page-top-bar">
                <button id="back-btn" class="btn-secondary">&larr; عودة</button>
                <div id="renewal-date-display" class="countdown-timer" style="display: none;"></div>
            </div>
            
            <div class="profile-header-v2">
                <div class="profile-avatar">
                    ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Avatar">` : '<i class="fas fa-user-astronaut"></i>'}
                </div>
                <div class="profile-main-info" data-agent-id="${agent._id}">
                    <h1>
                        ${agent.name} 
                        ${hasActiveCompetition ? `<span class="status-badge active">مسابقة نشطة</span>${activeCompetitionCountdownHtml}` : ''}
                        ${hasInactiveCompetition ? '<span class="status-badge inactive">مسابقة غير نشطة</span>' : ''}
                    </h1>
                    <p>رقم الوكالة: <strong class="agent-id-text" title="نسخ الرقم">${agent.agent_id}</strong> | التصنيف: ${agent.classification} | المرتبة: ${agent.rank || 'غير محدد'}</p>
                    <p>روابط التلجرام: ${agent.telegram_channel_url ? `<a href="${agent.telegram_channel_url}" target="_blank">القناة</a>` : 'القناة (غير محدد)'} | ${agent.telegram_group_url ? `<a href="${agent.telegram_group_url}" target="_blank">الجروب</a>` : 'الجروب (غير محدد)'}</p>
                    <p>معرف الدردشة: ${agent.telegram_chat_id ? `<code>${agent.telegram_chat_id}</code>` : 'غير محدد'} | اسم المجموعة: <strong>${agent.telegram_group_name || 'غير محدد'}</strong></p>
                    ${auditButtonHtml}
                </div>
                <div class="profile-header-actions">
                    <button id="edit-profile-btn" class="btn-secondary"><i class="fas fa-user-edit"></i> تعديل</button>
                </div>
            </div>
    
            <div class="tabs">
                <button class="tab-link active" data-tab="action">Action</button>
                <button class="tab-link" data-tab="details">تفاصيل</button>
                <button class="tab-link" data-tab="agent-competitions">المسابقات</button>
                <button class="tab-link" data-tab="log">سجل</button>
                ${(isSuperAdmin || isAdmin) ? '<button class="tab-link" data-tab="analytics">تحليلات</button>' : ''}
            </div>
    
            <div id="tab-action" class="tab-content active">
                <div class="action-tab-grid">
                    <div class="action-section">
                        <h2><i class="fas fa-info-circle"></i> بيانات تلقائية</h2>
                        <div class="action-info-grid">
                            <div class="action-info-card">
                                <i class="fas fa-calendar-check"></i>
                                <div class="info">
                                    <label>أيام التدقيق</label>
                                    <div class="value-group">${auditDaysHtml}</div>
                                </div>
                            </div>
                            <div class="action-info-card">
                                <i class="fas fa-wallet"></i>
                                <div class="info">
                                    <label>الرصيد المتبقي</label>
                                    <p>$${agent.remaining_balance || 0}</p>
                                </div>
                            </div>
                            <div class="action-info-card">
                                <i class="fas fa-gift"></i>
                                <div class="info">
                                    <label>بونص الإيداع</label>
                                    <p>${agent.remaining_deposit_bonus || 0} <span class="sub-value">مرات بنسبة</span> ${agent.deposit_bonus_percentage || 0}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="action-section">
                        <h2><i class="fas fa-rocket"></i> إجراءات سريعة</h2>
                        <div class="details-actions">
                            <button id="create-agent-competition" class="btn-primary"><i class="fas fa-magic"></i> إنشاء مسابقة</button>
                            <button id="send-bonus-cliche-btn" class="btn-telegram-bonus"><i class="fas fa-paper-plane"></i> إرسال كليشة البونص</button>
                            <button id="send-winners-cliche-btn" class="btn-telegram-winners"><i class="fas fa-trophy"></i> إرسال كليشة الفائزين</button>
                            ${canManualRenew ? `<button id="manual-renew-btn" class="btn-renewal"><i class="fas fa-sync-alt"></i> تجديد الرصيد يدوياً</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div id="tab-details" class="tab-content">
                <!-- Content will be rendered here -->
            </div>
            <div id="tab-agent-competitions" class="tab-content">
                <!-- Content will be rendered here -->
            </div>
            <div id="tab-log" class="tab-content">
                <h2>سجل النشاط</h2>
                <p>لا توجد سجلات حالياً لهذا الوكيل.</p>
            </div>
            <div id="tab-analytics" class="tab-content">
                <!-- Analytics content will be rendered here -->
            </div>
        `;
     
        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.hash = '#manage-agents';
        });
    
        // Click to copy agent ID from header
        const agentIdEl = appContent.querySelector('.profile-main-info .agent-id-text');
        if (agentIdEl) {
            agentIdEl.addEventListener('click', () => {
                navigator.clipboard.writeText(agent.agent_id).then(() => showToast(`تم نسخ الرقم: ${agent.agent_id}`, 'info'));
            });
        }
    
        const createCompBtn = document.getElementById('create-agent-competition');
        if (createCompBtn) {
            if (canCreateComp) { // This will be migrated later
                createCompBtn.addEventListener('click', () => window.location.hash = `competitions/new?agentId=${agent._id}`);
            } else {
                createCompBtn.addEventListener('click', () => showToast('ليس لديك صلاحية لإنشاء مسابقة.', 'error'));
            }
        }
    
        // --- NEW: Event listener for the new audit button ---
        const auditBtn = document.getElementById('perform-audit-btn');
        if (auditBtn) {
            // --- MODIFICATION: Make the button a toggle ---
            auditBtn.addEventListener('click', async () => {
                // --- REFACTOR: Centralize state management for immediate UI feedback ---
                const statusContainer = document.getElementById('header-audit-status');
                const wasAudited = statusContainer.classList.contains('audited');
                const newAuditStatus = !wasAudited;
                const statusTextEl = statusContainer.querySelector('.audit-status-text');
                const iconEl = auditBtn.querySelector('i');
     
                auditBtn.disabled = true;
                iconEl.className = 'fas fa-spinner fa-spin';
     
                // 1. Optimistically update the UI
                statusContainer.classList.toggle('pending', !newAuditStatus);
                statusContainer.classList.toggle('audited', newAuditStatus);
                iconEl.className = `fas fa-${newAuditStatus ? 'check-circle' : 'clipboard-check'}`;
                statusTextEl.textContent = newAuditStatus ? 'تم التدقيق' : 'التدقيق مطلوب اليوم';
                auditBtn.title = newAuditStatus ? 'إلغاء التدقيق' : 'تمييز كـ "تم التدقيق"';
     
                // 2. Dispatch the update to the central store.
                // This will handle the backend call and notify other subscribed components (like calendar).
                try {
                    await window.taskStore.updateTaskStatus(agent._id, todayDayIndex, 'audited', newAuditStatus);
                    // --- FIX: Log this important activity ---
                    const logMessage = `تم ${newAuditStatus ? 'تفعيل' : 'إلغاء تفعيل'} مهمة "التدقيق" للوكيل ${agent.name} من ملفه الشخصي.`;
                    await logAgentActivity(currentUserProfile?._id, agent._id, 'TASK_UPDATE', logMessage);
    
                    showToast('تم تحديث حالة التدقيق بنجاح.', 'success');
                } catch (error) {
                    showToast('فشل تحديث حالة التدقيق.', 'error');
                    // Revert UI on error
                    statusContainer.classList.toggle('pending', wasAudited);
                    statusContainer.classList.toggle('audited', !wasAudited);
                    iconEl.className = `fas fa-${wasAudited ? 'check-circle' : 'clipboard-check'}`;
                    statusTextEl.textContent = wasAudited ? 'تم التدقيق' : 'التدقيق مطلوب اليوم';
                    auditBtn.title = wasAudited ? 'إلغاء التدقيق' : 'تمييز كـ "تم التدقيق"';
                } finally {
                    auditBtn.disabled = false; // Re-enable the button
                }
            });
        }
    
        // --- Manual Renewal Button Logic ---
        const manualRenewBtn = document.getElementById('manual-renew-btn');
        if (manualRenewBtn) {
          manualRenewBtn.addEventListener('click', async () => {
            if (!agent.renewal_period || agent.renewal_period === 'none') {
                showToast('لا يوجد نظام تجديد مفعل لهذا الوكيل.', 'info');
                return;
            }
    
            // Calculate next renewal date (same logic as the countdown)
            const renewalBtn = manualRenewBtn;
            const lastRenewal = agent.last_renewal_date ? new Date(agent.last_renewal_date) : new Date(agent.created_at);
            let nextRenewalDate = new Date(lastRenewal);
            const period = agent.renewal_period;
            if (period === 'weekly') nextRenewalDate.setDate(lastRenewal.getDate() + 7);
            else if (period === 'biweekly') nextRenewalDate.setDate(lastRenewal.getDate() + 14);
            else if (period === 'monthly') nextRenewalDate.setMonth(lastRenewal.getMonth() + 1);
    
            if (new Date() < nextRenewalDate) {
                const remainingTime = nextRenewalDate - new Date();
                const days = Math.ceil(remainingTime / (1000 * 60 * 60 * 24)); // Use ceil to show "1 day" for any remaining time
                showToast(`لا يمكن التجديد الآن. متبقي ${days} يوم.`, 'warning');
                return;
            }
    
            // If eligible, show confirmation
            showConfirmationModal(
                `هل أنت متأكد من تجديد رصيد الوكيل <strong>${agent.name}</strong> يدوياً؟`,
                async () => {
                    // Defensive: Disable button immediately
                    renewalBtn.disabled = true;
                    renewalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
                    const updateData = {
                        consumed_balance: 0,
                        remaining_balance: agent.competition_bonus,
                        used_deposit_bonus: 0,
                        remaining_deposit_bonus: agent.deposit_bonus_count,
                        last_renewal_date: new Date().toISOString()
                    };
    
                    // --- STEP 5: MIGRATION TO CUSTOM BACKEND ---
                    try {
                        const response = await authedFetch(`/api/agents/${agent._id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updateData)
                        });
                        if (!response.ok) {
                            const result = await response.json();
                            throw new Error(result.message || 'فشل تجديد الرصيد.');
                        }
                        // --- FIX: Add correct logging for manual renewal ---
                        await logAgentActivity(currentUserProfile?._id, agent._id, 'MANUAL_RENEWAL', `تم تجديد الرصيد يدوياً للوكيل ${agent.name}.`, {
                            renewed_by: currentUserProfile?.full_name || 'غير معروف',
                            new_balance: agent.competition_bonus
                        });
                        showToast('تم تجديد الرصيد بنجاح.', 'success');
                        renderAgentProfilePage(agent._id, { activeTab: 'action' }); // Re-render the page
                    } catch (error) {
                        showToast(`فشل تجديد الرصيد: ${error.message}`, 'error');
                        // Defensive: Re-enable button on failure
                        renewalBtn.disabled = false;
                        renewalBtn.innerHTML = '<i class="fas fa-sync-alt"></i> تجديد الرصيد يدوياً';
                    }
                },
                {
                    title: 'تأكيد التجديد اليدوي',
                    confirmText: 'نعم، جدد الآن',
                    confirmClass: 'btn-renewal'
                }
            );
          });
        }
    
        document.getElementById('send-bonus-cliche-btn').addEventListener('click', async () => {
            // 1. Construct the message
            const baseLine = `يسرنا ان نحيطك علما بأن حضرتك كوكيل لدى شركة انزو تتمتع برصيد مسابقات:`
    
            // --- NEW: Add renewal period text ---
            const renewalPeriodMap = {
                'weekly': 'أسبوعي',
                'biweekly': 'كل أسبوعين',
                'monthly': 'شهري'
            };
            const renewalValue = (agent.renewal_period && agent.renewal_period !== 'none') 
                ? (renewalPeriodMap[agent.renewal_period] || '')
                : '';
    
            // --- تعديل: بناء نص المميزات حسب الشكل الجديد ---
            let benefitsText = '';
            const remainingBalance = agent.remaining_balance || 0;
            const remainingDepositBonus = agent.remaining_deposit_bonus || 0;
    
            if (remainingBalance > 0) {
                benefitsText += `💰 <b>بونص تداولي:</b> <code>${remainingBalance}$</code>\n`;
            }
            if (remainingDepositBonus > 0) {
                benefitsText += `🎁 <b>بونص ايداع:</b> <code>${remainingDepositBonus}</code> مرات بنسبة <code>${agent.deposit_bonus_percentage || 0}%</code>\n`;
            }
    
            // إذا لم تكن هناك أي مميزات، لا تقم بالإرسال
            if (!benefitsText.trim()) {
                showToast('لا توجد أرصدة متاحة لإرسال كليشة البونص لهذا الوكيل.', 'info');
                return;
            }
            
            const clicheText = `<b>دمت بخير شريكنا العزيز ${agent.name}</b> ...
    
    ${baseLine}
    ${renewalValue ? `(<b>${renewalValue}</b>):\n\n` : ''}${benefitsText.trim()}
    
    بامكانك الاستفادة منه من خلال انشاء مسابقات اسبوعية لتنمية وتطوير العملاء التابعين للوكالة.
    
    هل ترغب بارسال مسابقة لحضرتك?`;
    
            // --- Verification Logic ---
            let targetGroupInfo = 'المجموعة العامة';
            // --- FIX: Check for chat_id first and show a clear error if it's missing ---
            if (!agent.telegram_chat_id) {
                showToast('لا يمكن الإرسال. معرف مجموعة التلجرام غير مسجل لهذا الوكيل.', 'error');
                return; // Stop the process
            }
    
            if (agent.telegram_chat_id && agent.telegram_group_name) {
                try {
                    showToast('جاري التحقق من بيانات المجموعة...', 'info');
                    const response = await authedFetch(`/api/get-chat-info?chatId=${agent.telegram_chat_id}`);
                    const data = await response.json();
                    // --- FIX: Handle 404 Not Found specifically ---
                    if (response.status === 404) {
                        throw new Error('المجموعة غير موجودة أو تم طرد البوت منها.');
                    } else if (!response.ok) {
                        throw new Error(data.message || 'فشل التحقق من بيانات المجموعة.');
                    }
    
                    const actualGroupName = data.title;
                    if (actualGroupName.trim() !== agent.telegram_group_name.trim()) {
                        showToast(`<b>خطأ في التحقق:</b> اسم المجموعة المسجل (<b>${agent.telegram_group_name}</b>) لا يطابق الاسم الفعلي على تلجرام (<b>${actualGroupName}</b>). يرجى تصحيح البيانات.`, 'error');
                        return; // Stop the process
                    }
                    // Verification successful
                    targetGroupInfo = `مجموعة الوكيل: <strong>${agent.telegram_group_name}</strong> (تم التحقق بنجاح)`;
    
                } catch (error) {
                    showToast(`فشل التحقق من المجموعة: ${error.message}`, 'error');
                    return; // Stop the process
                }
            } else if (agent.telegram_chat_id) {
                showToast('لا يمكن التحقق. اسم المجموعة غير مسجل لهذا الوكيل.', 'warning');
                return;
            }
            // --- End Verification Logic ---
    
            // Show confirmation modal only after successful verification (if applicable)
            showConfirmationModal(
                `<p>سيتم إرسال الرسالة إلى: ${targetGroupInfo}. هل أنت متأكد من المتابعة؟</p>
                 <textarea class="modal-textarea-preview" readonly>${clicheText}</textarea>`,
                async () => {
                    try {
                        const response = await authedFetch('/api/post-announcement', { // This will be migrated later
                            method: 'POST',
                            body: JSON.stringify({ message: clicheText, chatId: agent.telegram_chat_id })
                        });
                        if (!response.ok) {
                            const result = await response.json();
                            throw new Error(result.message || 'فشل الاتصال بالخادم.');
                        }
                        showToast('تم إرسال كليشة البونص إلى تلجرام بنجاح.', 'success');
                        // --- FIX: Add correct logging for sending bonus cliche ---
                        await logAgentActivity(currentUserProfile?._id, agent._id, 'BONUS_CLICHE_SENT', `تم إرسال كليشة تذكير البونص إلى تلجرام.`, {
                            sent_by: currentUserProfile?.full_name
                        });
                    } catch (error) {
                        showToast(`فشل إرسال الكليشة: ${error.message}`, 'error');
                    }
                },
                {
                    title: 'إرسال رسالة البونص',
                    confirmText: 'إرسال',
                    confirmClass: 'btn-telegram-bonus',
                    modalClass: 'modal-wide'
                }
            );
        });
    
        document.getElementById('send-winners-cliche-btn').addEventListener('click', async () => {
            // --- NEW: Use centralized verification function ---
            const verification = await verifyTelegramChat(agent);
            if (!verification.verified) {
                return;
            }
            const targetGroup = `مجموعة الوكيل: <strong>${agent.telegram_group_name}</strong> (تم التحقق)`;
            // --- End Verification ---
            // Defensive: Find active competition, but handle if it's not found
            const activeCompetition = agentCompetitions.find(c => c.is_active);
    
            const clicheText = `الأساتذة الكرام،
    
    نحيطكم علمًا بانتهاء مدة المشاركة في المسابقة الأخيرة.
    🔹 الإجابة الصحيحة: ${activeCompetition?.correct_answer || 'غير محددة'}
    
    يرجى تزويدنا برابط منشور المسابقة من قناتكم ليقوم القسم المختص باختيار الفائزين والتحقق من بياناتهم، ثم إرسال الأسماء إليكم للإعلان عنها.
    
    مع خالص التقدير،
    إدارة المسابقات – انزو`;
    
            // Show confirmation modal before sending
            showConfirmationModal(
                `<p>سيتم إرسال الرسالة إلى: ${targetGroup}. هل أنت متأكد من المتابعة؟</p>
                 <textarea class="modal-textarea-preview" readonly>${clicheText}</textarea>`,
                async () => {
                    // Send to backend on confirmation
                    try {
                        const response = await authedFetch('/api/post-announcement', { // This will be migrated later
                            method: 'POST',
                            body: JSON.stringify({ message: clicheText, chatId: agent.telegram_chat_id })
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.message || 'فشل الاتصال بالخادم.');
    
                        showToast('تم إرسال طلب اختيار الفائزين إلى تلجرام بنجاح.', 'success');
                        // --- FIX: Add correct logging for winner selection request ---
                        await logAgentActivity(currentUserProfile?._id, agent._id, 'WINNERS_SELECTION_REQUESTED', `تم إرسال طلب اختيار الفائزين لمسابقة "${activeCompetition?.name || 'الأخيرة'}".`, {
                            sent_by: currentUserProfile?.full_name
                        });
                    } catch (error) {
                        showToast(`فشل إرسال الطلب: ${error.message}`, 'error');
                    }
                },
                {
                    title: 'طلب اختيار الفائزين',
                    confirmText: 'إرسال',
                    confirmClass: 'btn-telegram-winners',
                    modalClass: 'modal-wide'
                }
            );
        });
    
        const editBtn = document.getElementById('edit-profile-btn');
        if (editBtn) {
            if (canEditProfile) { // This will be migrated later
                editBtn.addEventListener('click', () => renderEditProfileHeader(agent));
            } else {
                editBtn.addEventListener('click', () => showToast('ليس لديك صلاحية لتعديل بيانات الوكيل.', 'error'));
            }
        }
    
        if (startInEditMode) {
            editBtn.click();
        }
    
        // Tab switching logic
        const tabLinks = appContent.querySelectorAll('.tab-link');
        const tabContents = appContent.querySelectorAll('.tab-content');
    
        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.dataset.tab;
    
                // Deactivate all
                tabLinks.forEach(l => l.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
    
                // Activate the clicked one
                link.classList.add('active');
                document.getElementById(`tab-${tabId}`).classList.add('active');
            });
        });
    
        // Set the default active tab
        appContent.querySelector(`.tab-link[data-tab="${defaultTab}"]`)?.click();
    
        // Render competitions in the log tab
        const detailsTabContent = document.getElementById('tab-details');
        const logTabContent = document.getElementById('tab-log');
        const agentCompetitionsContent = document.getElementById('tab-agent-competitions'); // This will be migrated later
        const analyticsTabContent = document.getElementById('tab-analytics');
    
        // --- NEW: Render tab content based on permissions ---
        if (detailsTabContent) {
            if (!canViewFinancials) {
                detailsTabContent.innerHTML = `
                    <div class="access-denied-container">
                        <i class="fas fa-lock"></i>
                        <h2>ليس لديك صلاحية وصول</h2>
                        <p>أنت لا تملك الصلاحية اللازمة لعرض التفاصيل المالية لهذا الوكيل.</p>
                    </div>`;
            } else {
                renderDetailsView(agent);
            }
        }
    
        if (logTabContent) {
            if (agentLogs && agentLogs.length > 0) {
                logTabContent.innerHTML = generateAgentActivityLogHTML(agentLogs); // Use the dedicated function for agent profile
            } else {
                logTabContent.innerHTML = '<h2>سجل النشاط</h2><p>لا توجد سجلات حالياً لهذا الوكيل.</p>';
            }
        }
        // This will be migrated later
        if (analyticsTabContent && (isSuperAdmin || isAdmin)) {
            // Render analytics tab content
            renderAgentAnalytics(agent, analyticsTabContent);
        }
        if (agentCompetitionsContent) {
            if (agentCompetitions && agentCompetitions.length > 0) {
                if (!canViewAgentComps) {
                    agentCompetitionsContent.innerHTML = `
                        <div class="access-denied-container"> 
                            <i class="fas fa-lock"></i>
                            <h2>ليس لديك صلاحية وصول</h2>
                            <p>أنت لا تملك الصلاحية اللازمة لعرض مسابقات هذا الوكيل.</p>
                        </div>`;
                    // Stop further processing for this tab
                    startCompetitionCountdowns(); // Still need to start other timers
                    return;
                }
                const activeAndPendingCompetitions = agentCompetitions.filter(c => c.status !== 'completed');
                const completedCompetitions = agentCompetitions.filter(c => c.status === 'completed' || c.status === 'archived'); // Defensive: include archived
    
                const renderCompetitionList = (competitions) => {
                    return competitions.map(comp => {
                        const endDate = comp.ends_at ? new Date(comp.ends_at) : null;
                        let countdownHtml = '';
                        if (endDate && comp.status !== 'completed' && comp.status !== 'awaiting_winners') {
                            const diffTime = endDate.getTime() - new Date().getTime();
                            if (diffTime > 0) {
                                countdownHtml = `<div class="competition-countdown" data-end-date="${comp.ends_at}"><i class="fas fa-hourglass-half"></i> <span>جاري حساب الوقت...</span></div>`;
                            } else {
                                countdownHtml = `<div class="competition-countdown expired"><i class="fas fa-hourglass-end"></i> في انتظار المعالجة...</div>`;
                            }
                        }
    
                        const statusSteps = {
                            'sent': { text: 'تم الإرسال', step: 1, icon: 'fa-paper-plane' },
                            'awaiting_winners': { text: 'في انتظار الفائزين', step: 2, icon: 'fa-user-clock' },
                            'completed': { text: 'مكتملة', step: 3, icon: 'fa-check-double' }
                        };
                        const currentStatus = statusSteps[comp.status] || statusSteps['sent'];
    
                        const progressBarHtml = `
                            <div class="stepper-wrapper step-${currentStatus.step}">
                                ${Object.values(statusSteps).map((s, index) => {
                                    const isLineCompleted = currentStatus.step > index + 1; // Line is complete if the next step is reached
                                    return `
                                    <div class="stepper-item ${currentStatus.step >= s.step ? 'completed' : ''}" title="${s.text}">
                                        <div class="step-counter">
                                            ${currentStatus.step > s.step ? '<i class="fas fa-check"></i>' : s.step}
                                        </div>
                                        <div class="step-name">${s.text}</div>
                                    </div>
                                    ${index < Object.values(statusSteps).length - 1 ? `<div class="stepper-line ${isLineCompleted ? 'completed' : ''}"></div>` : ''}
                                `}).join('')}
                            </div>
                        `;
    
                        return `
                        <div class="competition-card">
                            <div class="competition-card-header">
                                <h3>${comp.name}</h3>
                                <div class="header-right-content">
                                    ${countdownHtml}
                                    <span class="status-badge-v2 status-${comp.status}">${currentStatus.text}</span>
                                </div>
                            </div>
                            <div class="competition-card-body">
                                <div class="competition-status-tracker">${progressBarHtml}</div>
                                <div class="competition-details-grid">
                                    <p class="competition-detail-item"><i class="fas fa-users"></i><strong>عدد الفائزين:</strong> ${comp.winners_count || 0}</p>
                                    <p class="competition-detail-item"><i class="fas fa-dollar-sign"></i><strong>الجائزة للفائز:</strong> ${comp.prize_per_winner ? comp.prize_per_winner.toFixed(2) : '0.00'}</p>
                                    <!-- NEW: Display both expected and actual winner selection dates -->
                                    <p class="competition-detail-item"><i class="fas fa-calendar-alt"></i><strong>تاريخ اختيار الفائز:</strong> ${comp.ends_at ? new Date(comp.ends_at).toLocaleDateString('ar-EG', { dateStyle: 'medium' }) : '<em>غير محدد</em>'}</p>
                                    ${comp.processed_at ? `
                                        <p class="competition-detail-item"><i class="fas fa-calendar-check"></i><strong>تاريخ المعالجة الفعلي:</strong> ${new Date(comp.processed_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    ` : ''}
                                    <p class="competition-detail-item"><i class="fas fa-eye"></i><strong>المشاهدات:</strong> ${formatNumber(comp.views_count)}</p>
                                    <p class="competition-detail-item"><i class="fas fa-heart"></i><strong>التفاعلات:</strong> ${formatNumber(comp.reactions_count)}</p>
                                    <p class="competition-detail-item"><i class="fas fa-user-check"></i><strong>المشاركات:</strong> ${formatNumber(comp.participants_count)}</p>
                                    <p class="competition-detail-item"><i class="fas fa-key"></i><strong>الإجابة الصحيحة:</strong> ${comp.correct_answer || '<em>غير محددة</em>'}</p>
                                </div>
                            </div>
                            <div class="competition-card-footer">
                                ${comp.status === 'awaiting_winners' ? `<button class="btn-primary complete-competition-btn" data-id="${comp.id}" data-name="${comp.name}"><i class="fas fa-check-double"></i> تم اختيار الفائزين</button>` : ''}
                                ${canEditComps ? `<button class="btn-danger delete-competition-btn" data-id="${comp._id}"><i class="fas fa-trash-alt"></i> حذف</button>` : ''}
                            </div>
                        </div>
                    `}).join('');
                };
    
                agentCompetitionsContent.innerHTML = `
                    <div class="competitions-list-profile">
                        ${renderCompetitionList(activeAndPendingCompetitions)}
                    </div>
                    ${completedCompetitions.length > 0 ? `
                        <details class="completed-competitions-group">
                            <summary>
                                <i class="fas fa-archive"></i> المسابقات المكتملة (${completedCompetitions.length})
                            </summary>
                            <div class="competitions-list-profile">
                                ${renderCompetitionList(completedCompetitions)}
                            </div>
                        </details>
                    ` : ''}
                `;
            } else {
                if (canViewAgentComps) {
                    agentCompetitionsContent.innerHTML = '<p>لا توجد مسابقات خاصة بهذا الوكيل بعد.</p>';
                }
            }
        }
    
        if (agentCompetitionsContent) {
            agentCompetitionsContent.addEventListener('click', async (e) => {
                const deleteBtn = e.target.closest('.delete-competition-btn');
                const completeBtn = e.target.closest('.complete-competition-btn');
    
                if (completeBtn) {
                    const id = completeBtn.dataset.id;
                    const name = completeBtn.dataset.name;
    
                    // --- NEW: Show modal with required fields before completing ---
                    const modalContent = `
                        <p>لإكمال مسابقة "<strong>${name}</strong>"، يرجى إدخال البيانات التالية:</p>
                        <div class="form-layout" style="margin-top: 15px;">
                            <div class="form-group">
                                <label for="comp-views-count">عدد المشاهدات</label>
                                <input type="number" id="comp-views-count" class="modal-input" required min="0">
                            </div>
                            <div class="form-group">
                                <label for="comp-reactions-count">عدد التفاعلات</label>
                                <input type="number" id="comp-reactions-count" class="modal-input" required min="0">
                            </div>
                            <div class="form-group">
                                <label for="comp-participants-count">عدد المشاركات</label>
                                <input type="number" id="comp-participants-count" class="modal-input" required min="0">
                            </div>
                        </div>
                    `;
    
                    showConfirmationModal(
                        modalContent,
                        async () => {
                            const views = document.getElementById('comp-views-count').value;
                            const reactions = document.getElementById('comp-reactions-count').value;
                            const participants = document.getElementById('comp-participants-count').value;
    
                            const updateData = {
                                status: 'completed',
                                is_active: false,
                                views_count: parseInt(views, 10),
                                reactions_count: parseInt(reactions, 10),
                                participants_count: parseInt(participants, 10)
                            };
    
                            const response = await authedFetch(`/api/competitions/${id}`, { method: 'PUT', body: JSON.stringify(updateData) });
    
                            if (!response.ok) {
                                showToast('فشل إكمال المسابقة.', 'error');
                            } else {
                                showToast('تم إكمال المسابقة بنجاح.', 'success');
                                // --- FIX: Add correct logging for competition completion ---
                                await logAgentActivity(currentUserProfile?._id, agent._id, 'COMPETITION_COMPLETED', `تم إكمال مسابقة "${name}" وتسجيل الأداء.`, {
                                    completed_by: currentUserProfile?.full_name,
                                    performance: updateData
                                });
                                renderAgentProfilePage(agent._id, { activeTab: 'agent-competitions' });
                            }
                        }, {
                            title: 'إكمال المسابقة وتسجيل الأداء',
                            confirmText: 'نعم، اكتملت',
                            confirmClass: 'btn-primary',
                            onRender: (modal) => {
                                const confirmBtn = modal.querySelector('#confirm-btn');
                                const inputs = modal.querySelectorAll('.modal-input');
                                confirmBtn.disabled = true; // Disable by default
    
                                inputs.forEach(input => input.addEventListener('input', () => {
                                    const allFilled = Array.from(inputs).every(i => i.value.trim() !== '' && parseInt(i.value, 10) >= 0 && i.value !== '');
                                    confirmBtn.disabled = !allFilled;
                                }));
                            }
                        }
                    );
                    return; // Stop further execution
                }
    
                if (deleteBtn) {
                    const id = deleteBtn.dataset.id;
                    if (!id) return;
            
                    showConfirmationModal(
                        'هل أنت متأكد من حذف هذه المسابقة؟<br><small>لا يمكن التراجع عن هذا الإجراء.</small>',
                        async () => {
                            const response = await authedFetch(`/api/competitions/${id}`, { method: 'DELETE' });
                            if (!response.ok) {
                                const result = await response.json();
                                showToast(result.message || 'فشل حذف المسابقة.', 'error');
                                return;
                            }
                            showToast('تم حذف المسابقة بنجاح.', 'success');
                            // --- FIX: Add correct logging for competition deletion ---
                            await logAgentActivity(currentUserProfile?._id, agent._id, 'COMPETITION_DELETED', `تم حذف مسابقة من سجل الوكيل.`, {
                                deleted_by: currentUserProfile?.full_name
                            });
                            renderAgentProfilePage(agent._id, { activeTab: 'agent-competitions' });
                        }, {
                            title: 'تأكيد الحذف',
                            confirmText: 'حذف',
                            confirmClass: 'btn-danger'
                        });
                }
            });
        }
    
        // Start live countdowns for competitions
        startCompetitionCountdowns(); // This will be migrated later
    
        // Display the next renewal date, which is now fully independent
        displayNextRenewalDate(agent); // This will be migrated later
    }
    
    /**
     * NEW: Renders an editor for the main profile header fields.
     * @param {object} agent The agent object to edit.
     */
    function renderEditProfileHeader(agent) {
        // Defensive: Check for required permissions
        const canEditProfile = currentUserProfile?.role === 'super_admin' || currentUserProfile?.role === 'admin';
        if (!canEditProfile) {
            showToast('ليس لديك صلاحية لتعديل بيانات الوكيل.', 'error');
            return;
        }
    
        const headerContainer = document.querySelector('.profile-main-info');
        const actionsContainer = document.querySelector('.profile-header-actions');
        if (!headerContainer || !actionsContainer) return;
    
        const originalHeaderHtml = headerContainer.innerHTML;
        const originalActionsHtml = actionsContainer.innerHTML;
    
        // --- تعديل: إضافة محدد أيام التدقيق ---
        const auditDaysEditorHtml = `
            <div class="form-group" style="grid-column: 1 / -1; margin-top: 10px;"> 
                <label style="margin-bottom: 10px;">أيام التدقيق</label>
                <div class="days-selector-v2" id="header-edit-audit-days">
                    ${dayNames.map((day, index) => `
                        <div class="day-toggle-wrapper">
                            <input type="checkbox" id="day-header-edit-${index}" value="${index}" class="day-toggle-input" ${(agent.audit_days || []).includes(index) ? 'checked' : ''}>
                            <label for="day-header-edit-${index}" class="day-toggle-btn">${day}</label>
                        </div>`).join('')}
                </div>
            </div>
        `;
    
        headerContainer.innerHTML = `
            <div class="form-layout-grid" style="gap: 10px;">
                <div class="form-group" style="grid-column: 1 / span 2;"><label>اسم الوكيل</label><input type="text" id="header-edit-name" value="${agent.name || ''}"></div>
                <div class="form-group">
                    <label>التصنيف</label>
                    <select id="header-edit-classification">
                        <option value="R" ${agent.classification === 'R' ? 'selected' : ''}>R</option>
                        <option value="A" ${agent.classification === 'A' ? 'selected' : ''}>A</option>
                        <option value="B" ${agent.classification === 'B' ? 'selected' : ''}>B</option>
                        <option value="C" ${agent.classification === 'C' ? 'selected' : ''}>C</option>
                    </select>
                </div>
                <div class="form-group"><label>معرف الدردشة</label><input type="text" id="header-edit-chatid" value="${agent.telegram_chat_id || ''}"></div>
                <div class="form-group"><label>اسم المجموعة</label><input type="text" id="header-edit-groupname" value="${agent.telegram_group_name || ''}"></div>
                <div class="form-group" style="grid-column: 1 / -1;"><label>رابط القناة</label><input type="text" id="header-edit-channel" value="${agent.telegram_channel_url || ''}"></div>
                <div class="form-group" style="grid-column: 1 / -1;"><label>رابط الجروب</label><input type="text" id="header-edit-group" value="${agent.telegram_group_url || ''}"></div>
                ${auditDaysEditorHtml}
            </div>
        `;
    
        actionsContainer.innerHTML = `
            <button id="header-save-btn" class="btn-primary"><i class="fas fa-check"></i> حفظ</button>
            <button id="header-cancel-btn" class="btn-secondary"><i class="fas fa-times"></i> إلغاء</button>
        `;
    
        const saveBtn = document.getElementById('header-save-btn');
        const cancelBtn = document.getElementById('header-cancel-btn');
    
        cancelBtn.addEventListener('click', () => {
            // Restore original content without a full page reload
            headerContainer.innerHTML = originalHeaderHtml;
            actionsContainer.innerHTML = originalActionsHtml;
            // Re-attach the edit button listener
            document.getElementById('edit-profile-btn').addEventListener('click', () => renderEditProfileHeader(agent));
        });
    
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
            // --- تعديل: قراءة أيام التدقيق المحددة ---
            const selectedDays = Array.from(document.querySelectorAll('#header-edit-audit-days .day-toggle-input:checked')).map(input => parseInt(input.value, 10));
    
            const updatedData = {
                name: document.getElementById('header-edit-name').value,
                telegram_channel_url: document.getElementById('header-edit-channel').value,
                telegram_group_url: document.getElementById('header-edit-group').value,
                telegram_chat_id: document.getElementById('header-edit-chatid').value,
                telegram_group_name: document.getElementById('header-edit-groupname').value,
                classification: document.getElementById('header-edit-classification').value,
                audit_days: selectedDays
            };
    
            try {
                const response = await authedFetch(`/api/agents/${agent._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatedData)
                });
    
                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.message || 'فشل تحديث البيانات.');
                }
    
                showToast('تم تحديث بيانات الوكيل بنجاح.', 'success');
                // --- FIX: Backend already logs this. No need to log from frontend. ---
                // The backend provides a more reliable and detailed log for this action.
                // await logAgentActivity(agent._id, 'PROFILE_UPDATE', 'تم تحديث بيانات الملف الشخصي للوكيل.');
    
                // Re-render the entire page to reflect changes everywhere
                renderAgentProfilePage(agent._id);
    
            } catch (error) {
                showToast(`فشل الحفظ: ${error.message}`, 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-check"></i> حفظ';
            }
        });
    }
    
    
    function startCompetitionCountdowns() {
        const countdownElements = document.querySelectorAll('.competition-countdown, .competition-countdown-header');
        if (countdownElements.length === 0) return;
    
        stopCompetitionCountdowns(); // Clear any existing intervals before starting new ones
    
        const updateElements = () => {
            let activeTimers = false;
            countdownElements.forEach(el => {
                if (!document.body.contains(el)) return;
    
                const endDateStr = el.dataset.endDate;
                if (!endDateStr) {
                    el.innerHTML = ''; // Clear if no date
                    return;
                }
    
                const endDate = new Date(endDateStr);
                const diffTime = endDate.getTime() - Date.now();
    
                if (diffTime <= 0) {
                    el.innerHTML = `<i class="fas fa-hourglass-end"></i> <span>في انتظار المعالجة...</span>`;
                    el.classList.add('expired');
                } else {
                    activeTimers = true;
                    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    let daysText = '';
                    if (days > 1) {
                        daysText = `${days} أيام`;
                    } else if (days === 1) {
                        daysText = `يوم واحد`;
                    } else { // Fallback for less than a day
                        daysText = 'أقل من يوم';
                    }
                    el.innerHTML = `<i class="fas fa-hourglass-half"></i> <span>متبقي: ${daysText}</span>`;
                }
            });
            if (!activeTimers) stopCompetitionCountdowns();
        };
    
        updateElements();
        const intervalId = setInterval(updateElements, 1000);
        competitionCountdownIntervals.push(intervalId);
    }
    
    /**
     * Generates the HTML for an agent's activity log, grouped by date.
     * This function is now self-contained within the profile page script.
     * @param {Array} logs - The array of log objects for the agent.
     * @returns {string} The generated HTML string.
     */
    function generateAgentActivityLogHTML(logs) {
        const getLogIconDetails = (actionType) => {
            if (actionType.includes('CREATED')) return { icon: 'fa-user-plus', colorClass: 'log-icon-create' };
            if (actionType.includes('DELETED')) return { icon: 'fa-user-slash', colorClass: 'log-icon-delete' };
            if (actionType.includes('PROFILE_UPDATE')) return { icon: 'fa-user-edit', colorClass: 'log-icon-profile' };
            if (actionType.includes('MANUAL_RENEWAL')) return { icon: 'fa-sync-alt', colorClass: 'log-icon-renewal' };
            if (actionType.includes('DETAILS_UPDATE')) return { icon: 'fa-cogs', colorClass: 'log-icon-details' };
            if (actionType.includes('COMPETITION_CREATED')) return { icon: 'fa-trophy', colorClass: 'log-icon-competition' };
            if (actionType.includes('WINNERS_SELECTION_REQUESTED')) return { icon: 'fa-question-circle', colorClass: 'log-icon-telegram' };
            // Add more specific icons for agent profile if needed
            return { icon: 'fa-history', colorClass: 'log-icon-generic' };
        };
    
        const groupLogsByDate = (logs) => {
            const groups = {};
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const todayStr = today.toISOString().split('T')[0];
            const yesterdayStr = yesterday.toISOString().split('T')[0];
    
            logs.forEach(log => {
                try {
                    if (!log.createdAt) {
                        console.warn('Agent log entry missing createdAt:', log);
                        return;
                    }
                    const logDate = new Date(log.createdAt);
                    if (isNaN(logDate.getTime())) {
                        console.warn('Invalid date in agent log:', log.createdAt);
                        return;
                    }
                    const logDateStr = logDate.toISOString().split('T')[0];
                    let dateKey;
                    if (logDateStr === todayStr) dateKey = 'اليوم';
                    else if (logDateStr === yesterdayStr) dateKey = 'الأمس';
                    else dateKey = logDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                    if (!groups[dateKey]) groups[dateKey] = [];
                    groups[dateKey].push(log);
                } catch (error) {
                    console.error('Error processing agent log entry:', error, log);
                }
            });
            return groups;
        };
    
        const groupedLogs = groupLogsByDate(logs);
        let html = '<h2>سجل النشاط الخاص بالوكيل</h2><div class="log-timeline-v2" id="agent-log-timeline">';
    
        for (const date in groupedLogs) {
            html += `
                <div class="log-date-group">
                    <div class="log-date-header">${date}</div>
                    ${groupedLogs[date].map(log => {
                        return `
                            <div class="log-item-v2">
                                <div class="log-item-icon-v2 ${getLogIconDetails(log.action_type).colorClass}"><i class="fas ${getLogIconDetails(log.action_type).icon}"></i></div>
                                <div class="log-item-content-v2">
                                    <p class="log-description">${log.description}</p>
                                    <p class="log-timestamp">
                                        <i class="fas fa-user"></i> ${log.user_name || 'نظام'}
                                        <span class="log-separator"></span>
                                        <i class="fas fa-clock"></i> ${new Date(log.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    
        html += '</div>';
        return html;
    }
    
    function renderDetailsView(agent) {
        // --- NEW: Permission Check ---
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = currentUserProfile?.role === 'admin';
        // --- MODIFICATION: Allow anyone who can view financials to also edit them, as per user request. ---
        const userPerms = currentUserProfile?.permissions || {};
        const canEditFinancials = isSuperAdmin || isAdmin || userPerms.agents?.view_financials;
    
        const container = document.getElementById('tab-details');
        if (!container) return;
    
        const createFieldHTML = (label, value, fieldName, isEditable = true) => {
            const numericFields = ['competition_bonus', 'deposit_bonus_count', 'deposit_bonus_percentage', 'consumed_balance', 'remaining_balance', 'used_deposit_bonus', 'remaining_deposit_bonus', 'single_competition_balance', 'winners_count', 'prize_per_winner', 'deposit_bonus_winners_count'];
            // --- NEW: Define which fields are financial ---
            const financialFields = ['rank', 'competition_bonus', 'deposit_bonus_count', 'deposit_bonus_percentage', 'consumed_balance', 'remaining_balance', 'used_deposit_bonus', 'remaining_deposit_bonus', 'single_competition_balance', 'winners_count', 'prize_per_winner', 'renewal_period', 'deposit_bonus_winners_count'];
            const isFinancial = financialFields.includes(fieldName);
    
            let displayValue;
            let iconHtml = '';
    
            // --- تعديل: إظهار أيقونة التعديل لأيام التدقيق أيضاً ---
            const isAuditDays = fieldName === 'audit_days';
            if (canEditFinancials || (isAuditDays && canEditProfile)) { // canEditProfile is a broader permission
                 iconHtml = `<span class="inline-edit-trigger" title="قابل للتعديل"><i class="fas fa-pen"></i></span>`;
            }
    
    
    
            if (numericFields.includes(fieldName) || fieldName === 'competitions_per_week') {
                displayValue = (value === null || value === undefined) ? 0 : value;
                if (fieldName === 'prize_per_winner' && typeof displayValue === 'number') displayValue = parseFloat(displayValue).toFixed(2);
                if (fieldName === 'deposit_bonus_percentage') displayValue = `${displayValue}%`;
                if (fieldName === 'competition_bonus') displayValue = `$${displayValue}`;
            } else if (fieldName === 'audit_days') {
                // --- تعديل: عرض أيام التدقيق كعلامات (tags) ---
                const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة',];
                displayValue = (value && value.length > 0) ? value.sort().map(dayIndex => `<span class="day-tag">${dayNames[dayIndex]}</span>`).join('') : '<span class="day-tag-none">غير محدد</span>';
            } else if (fieldName.includes('_date')) {
                displayValue = value ? new Date(value).toLocaleDateString('ar-EG') : 'لم يحدد';
            } else {
                displayValue = value || 'غير محدد';
            }
            return `
                <div class="details-group" data-field="${fieldName}">
                    ${iconHtml}
                    <label>${label}</label> 
                    <p>${displayValue}</p>
                </div>
            `;
        };
    
        const htmlContent = `
            <div class="details-grid">
                <h3 class="details-section-title">الإعدادات الأساسية</h3>
                ${createFieldHTML('المرتبة', agent.rank, 'rank')}
                ${createFieldHTML('بونص المسابقات (تداولي)', agent.competition_bonus, 'competition_bonus')}
                ${createFieldHTML('مرات بونص الإيداع', agent.deposit_bonus_count, 'deposit_bonus_count')}
                ${createFieldHTML('نسبة بونص الإيداع', agent.deposit_bonus_percentage, 'deposit_bonus_percentage')}
                
                <h3 class="details-section-title">الأرصدة</h3>
                ${createFieldHTML('رصيد مستهلك', agent.consumed_balance, 'consumed_balance')}
                ${createFieldHTML('رصيد متبقي', agent.remaining_balance, 'remaining_balance')}
                ${createFieldHTML('بونص إيداع مستخدم', agent.used_deposit_bonus, 'used_deposit_bonus')}
                ${createFieldHTML('بونص إيداع متبقي', agent.remaining_deposit_bonus, 'remaining_deposit_bonus')}
    
                <h3 class="details-section-title">إعدادات المسابقة الواحدة</h3>
                ${createFieldHTML('رصيد المسابقة الواحدة', agent.single_competition_balance, 'single_competition_balance')}
                ${createFieldHTML('عدد الفائزين', agent.winners_count, 'winners_count')}
                ${createFieldHTML('جائزة كل فائز', agent.prize_per_winner, 'prize_per_winner')}
                ${createFieldHTML('عدد فائزين بونص ايداع', agent.deposit_bonus_winners_count, 'deposit_bonus_winners_count')}
                
                <h3 class="details-section-title">التجديد والمدة</h3>
                ${createFieldHTML('يجدد كل', agent.renewal_period, 'renewal_period')}
                ${createFieldHTML('مدة المسابقة', agent.competition_duration, 'competition_duration')}
                ${createFieldHTML('أيام التدقيق', agent.audit_days, 'audit_days')}
                ${createFieldHTML('تاريخ آخر مسابقة', agent.last_competition_date, 'last_competition_date')}
                ${createFieldHTML('عدد المسابقات كل أسبوع', agent.competitions_per_week, 'competitions_per_week')}        </div>
            ${isSuperAdmin ? `
                <div class="details-actions" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                    <button id="trigger-renewal-test-btn" class="btn-danger"><i class="fas fa-history"></i> تجربة التجديد (3 ثواني)</button>
                </div>
            ` : ''}
        `;
    
    
    
        // --- FIX V3: Stable content update ---
        // Clear the container's content and re-add the event listener.
        // This prevents replacing the container itself, which caused content to leak across pages.
        container.innerHTML = htmlContent;
        const eventHandler = (e) => {
            const trigger = e.target.closest('.inline-edit-trigger'); // Defensive: Use closest to handle clicks on icon
            if (trigger) { // Permission is checked inside renderInlineEditor
                const group = trigger.closest('.details-group'); 
                // FIX: Add a null check to prevent race condition errors after a save.
                if (!group) return;
                renderInlineEditor(group, agent);
            }
        };
        
        // Defensive: Manage event listener to prevent duplicates
        container.addEventListener('click', eventHandler);
        profilePageEventListeners.push({ element: container, type: 'click', handler: eventHandler });
    
    
        // --- NEW: Add listener for the test renewal button ---
        const testRenewalBtn = document.getElementById('trigger-renewal-test-btn');
        if (testRenewalBtn) {
            testRenewalBtn.addEventListener('click', async () => {
                testRenewalBtn.disabled = true;
                testRenewalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> سيتم التجديد بعد 3 ثواني...';
    
                setTimeout(async () => {
                    try {
                        const response = await authedFetch(`/api/agents/${agent._id}/renew`, { method: 'POST' });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.message || 'فشل تجديد رصيد الوكيل.');
                        
                        showToast(`تم تجديد رصيد الوكيل ${agent.name} بنجاح.`, 'success');
                        renderAgentProfilePage(agent._id, { activeTab: 'details' }); // Refresh to see changes
                    } catch (error) {
                        showToast(`خطأ: ${error.message}`, 'error');
                        testRenewalBtn.disabled = false;
                        testRenewalBtn.innerHTML = '<i class="fas fa-history"></i> تجربة التجديد (3 ثواني)';
                    }
                }, 3000); // 3 seconds delay
            });
        }
    }
    
    async function renderInlineEditor(groupElement, agent) {
        // --- NEW: Permission Check ---
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = currentUserProfile?.role === 'admin';
        const userPerms = currentUserProfile?.permissions || {};
        const canEditFinancials = isSuperAdmin || isAdmin || userPerms.agents?.view_financials;
        
        const fieldName = groupElement.dataset.field;
        const originalContent = groupElement.innerHTML;
        const currentValue = agent[fieldName];
        const label = groupElement.querySelector('label').textContent;
        let editorHtml = '';
    
        switch (fieldName) {
            case 'rank':
                // تعديل: توحيد شكل وترتيب قائمة المراتب مع صفحة الإضافة
                editorHtml = `<select id="inline-edit-input">
                    <optgroup label="⁕ مراتب الوكلاء الاعتيادية ⁖">
                        ${Object.keys(RANKS_DATA).filter(r => ['BEGINNING', 'GROWTH', 'PRO', 'ELITE'].includes(r)).map(rank => `<option value="${rank}" ${currentValue === rank ? 'selected' : ''}>🔸 ${rank}</option>`).join('')}
                    </optgroup>
                    <optgroup label="⁕ مراتب الوكالة الحصرية ⁖">
                        <option value="وكيل حصري بدون مرتبة" ${currentValue === 'وكيل حصري بدون مرتبة' ? 'selected' : ''}>⭐ وكيل حصري بدون مرتبة</option>
                        <option disabled>──────────</option>
                        ${Object.keys(RANKS_DATA).filter(r => ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'SAPPHIRE', 'EMERALD', 'KING', 'LEGEND'].includes(r)).map(rank => `<option value="${rank}" ${currentValue === rank ? 'selected' : ''}>⭐ ${rank}</option>`).join('')}
                    </optgroup>
                    <optgroup label="⁕ المراكز ⁖">
                        <option value="CENTER" ${currentValue === 'CENTER' ? 'selected' : ''}>🏢 CENTER</option>
                    </optgroup>
                </select>`;
                break;
            case 'classification':
                editorHtml = `<select id="inline-edit-input">
                    <option value="R" ${currentValue === 'R' ? 'selected' : ''}>R</option>
                    <option value="A" ${currentValue === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${currentValue === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${currentValue === 'C' ? 'selected' : ''}>C</option>
                </select>`;
                break;
            case 'renewal_period':
                editorHtml = `<select id="inline-edit-input">
                    <option value="none" ${currentValue === 'none' ? 'selected' : ''}>بدون تجديد</option>
                    <option value="weekly" ${currentValue === 'weekly' ? 'selected' : ''}>أسبوع</option>
                    <option value="biweekly" ${currentValue === 'biweekly' ? 'selected' : ''}>أسبوعين</option>
                    <option value="monthly" ${currentValue === 'monthly' ? 'selected' : ''}>شهر</option>
                </select>`;
                break;
            case 'last_competition_date': // تعديل: السماح بتعديل تاريخ آخر مسابقة
            case 'winner_selection_date': // تعديل: السماح بتعديل تاريخ اختيار الفائز
                editorHtml = `<input type="date" id="inline-edit-input" value="${currentValue || ''}">`;
                break;
            case 'competition_duration': // تعديل: السماح بتعديل مدة المسابقة
                editorHtml = `<select id="inline-edit-input"><option value="24h" ${currentValue === '24h' ? 'selected' : ''}>24 ساعة</option><option value="48h" ${currentValue === '48h' ? 'selected' : ''}>48 ساعة</option></select>`;
                break;
            case 'audit_days':
                editorHtml = `
                    <div class="days-selector-v2" id="inline-edit-input">
                        ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day, index) => `
                            <div class="day-toggle-wrapper">
                                <input type="checkbox" id="day-edit-inline-${index}" value="${index}" class="day-toggle-input" ${(currentValue || []).includes(index) ? 'checked' : ''}>
                                <label for="day-edit-inline-${index}" class="day-toggle-btn">${day}</label>
                            </div>`).join('')}
                    </div>`;
                break;
            default: // for text/number inputs
                editorHtml = `<input type="number" id="inline-edit-input" value="${currentValue || ''}" placeholder="${label}">`;
                break;
        }
    
        groupElement.innerHTML = `
            <label>${label}</label>
            ${editorHtml}
            <div class="inline-edit-actions">
                <button id="inline-save-btn" class="btn-primary"><i class="fas fa-check"></i></button>
                <button id="inline-cancel-btn" class="btn-secondary"><i class="fas fa-times"></i></button>
            </div>
        `;
    
        // --- تعديل: إضافة تحديث فوري لتاريخ اختيار الفائز ---
        const inputElement = groupElement.querySelector('#inline-edit-input');
        if (inputElement && (fieldName === 'last_competition_date' || fieldName === 'competition_duration')) {
            const liveUpdateWinnerDate = () => {
                // --- إصلاح: جلب القيم الحالية من الصفحة مباشرة ---
                // ابحث عن حقل الإدخال النشط لتاريخ آخر مسابقة، أو استخدم القيمة المعروضة إذا لم يكن في وضع التعديل.
                const lastCompDateInput = document.querySelector('.details-group[data-field="last_competition_date"] #inline-edit-input');
                const lastCompDateValue = lastCompDateInput ? lastCompDateInput.value : agent.last_competition_date;
    
                // ابحث عن حقل الإدخال النشط لمدة المسابقة، أو استخدم القيمة المعروضة.
                const durationInput = document.querySelector('.details-group[data-field="competition_duration"] #inline-edit-input');
                const durationValue = durationInput ? durationInput.value : agent.competition_duration;
                
                // ابحث عن عنصر عرض تاريخ اختيار الفائز لتحديثه.
                const winnerDateElement = document.querySelector('.details-group[data-field="winner_selection_date"] p');
    
                if (lastCompDateValue && durationValue && winnerDateElement) {
                    const durationMap = { '24h': 1, '48h': 2, 'monthly': 30 };
                    const durationDays = durationMap[durationValue] || 0;
                    if (durationDays > 0) {
                        try {
                            const newDate = new Date(lastCompDateValue);
                            newDate.setDate(newDate.getDate() + durationDays);
                            winnerDateElement.textContent = newDate.toLocaleDateString('ar-EG');
                        } catch (e) {
                            // تجاهل الأخطاء الناتجة عن إدخال تاريخ غير صالح مؤقتاً
                        }
                    }
                }
            };
    
            // استدعاء الدالة عند تغيير القيمة
            inputElement.addEventListener('change', liveUpdateWinnerDate);
        }
    
        groupElement.querySelector('#inline-cancel-btn').addEventListener('click', () => {
            renderDetailsView(agent);
        });
    
        groupElement.querySelector('#inline-save-btn').addEventListener('click', async () => {
            const input = groupElement.querySelector('#inline-edit-input');
            let newValue = input.value;
            const updateData = {};
    
            // --- DEBUG: Log the field and new value ---
            console.log(`[Inline Edit] Field: "${fieldName}", New Value from input: "${newValue}"`);
    
            
            // --- STEP 5: MIGRATION TO CUSTOM BACKEND ---
            let currentAgent;
            try {
                const response = await authedFetch(`/api/agents/${agent._id}`);
                if (!response.ok) throw new Error('Failed to fetch latest agent data.');
                const result = await response.json();
                currentAgent = result.data;
            } catch (fetchError) {
                showToast('فشل في جلب بيانات الوكيل المحدثة.', 'error');
                console.error(fetchError);
                return;
            }
    
            if (fieldName === 'rank') {
                const rankData = RANKS_DATA[newValue] || {};
                updateData.rank = newValue;
                updateData.competition_bonus = rankData.competition_bonus;
                updateData.deposit_bonus_percentage = rankData.deposit_bonus_percentage;
                updateData.deposit_bonus_count = rankData.deposit_bonus_count;
                // When rank changes, it might affect balances
                // --- تعديل: منطق خاص لمرتبة "بدون مرتبة حصرية" ---
                if (newValue === 'بدون مرتبة حصرية') {
                    updateData.competition_bonus = 60;
                    updateData.remaining_balance = 60 - (currentAgent.consumed_balance || 0)
                    updateData.deposit_bonus_percentage = null;
                    updateData.deposit_bonus_count = null;
                } else {
                    updateData.competition_bonus = rankData.competition_bonus;
                    updateData.remaining_balance = (rankData.competition_bonus || 0) - (currentAgent.consumed_balance || 0);
                }
                updateData.remaining_deposit_bonus = (rankData.deposit_bonus_count || 0) - (currentAgent.used_deposit_bonus || 0);
            } else if (fieldName === 'classification') {
                updateData.classification = newValue;
                // --- NEW: Automatically update competitions_per_week based on classification ---
                const newClassification = newValue.toUpperCase();
                if (newClassification === 'R' || newClassification === 'A') {
                    updateData.competitions_per_week = 2;
                } else if (newClassification === 'B' || newClassification === 'C') {
                    updateData.competitions_per_week = 1;
                }
                updateData.remaining_deposit_bonus = (rankData.deposit_bonus_count || 0) - (currentAgent.used_deposit_bonus || 0);
            } else {
                // --- NEW: Automatically update competition_duration when competitions_per_week changes ---
                if (fieldName === 'competitions_per_week') {
                    const compsPerWeek = parseInt(newValue, 10);
                    if (compsPerWeek === 1) {
                        updateData.competition_duration = '48h';
                    } else if (compsPerWeek === 2) {
                        updateData.competition_duration = '24h';
                    } else if (compsPerWeek === 3) {
                        updateData.competition_duration = '24h'; // Fallback for 16h
                    }
                }
    
                let finalValue;
                if (fieldName === 'audit_days') {
                    finalValue = Array.from(groupElement.querySelectorAll('.day-toggle-input:checked')).map(input => parseInt(input.value, 10));
                } else if (fieldName.includes('_date')) {
                    finalValue = newValue === '' ? null : newValue;
                } else {
                    // --- REWRITE: Professional and robust value parsing ---
                    // Define which fields should be treated as integers vs floats
                    const integerFields = ['deposit_bonus_count', 'used_deposit_bonus', 'remaining_deposit_bonus', 'winners_count', 'competitions_per_week', 'deposit_bonus_winners_count'];
                    const floatFields = ['competition_bonus', 'consumed_balance', 'remaining_balance', 'single_competition_balance', 'prize_per_winner', 'deposit_bonus_percentage'];
    
                    if (integerFields.includes(fieldName)) {
                        const parsedInt = parseInt(newValue, 10);
                        finalValue = isNaN(parsedInt) ? null : parsedInt;
                    } else if (floatFields.includes(fieldName)) {
                        const parsedFloat = parseFloat(newValue);
                        finalValue = isNaN(parsedFloat) ? null : parsedFloat;
                    } else {
                        // For all other fields (like rank, renewal_period, etc.)
                        finalValue = newValue;
                    }
                }
    
                // --- DEBUG: Log the final parsed value ---
                console.log(`[Inline Edit] Final parsed value for "${fieldName}":`, finalValue);
    
                // --- NEW: Automatically calculate single_competition_balance ---
                const winnersCount = parseInt(fieldName === 'winners_count' ? finalValue : currentAgent.winners_count, 10) || 0;
                const prizePerWinner = parseFloat(fieldName === 'prize_per_winner' ? finalValue : currentAgent.prize_per_winner) || 0;
    
                if (fieldName === 'winners_count' || fieldName === 'prize_per_winner') {
                    updateData.single_competition_balance = winnersCount * prizePerWinner;
                }
    
                // --- FIX: Smart updates for financial fields ---
                // Start with the direct update
                updateData[fieldName] = finalValue;
    
                // Get current values for calculation, defaulting to 0 if null/undefined
                const competitionBonus = parseFloat(fieldName === 'competition_bonus' ? finalValue : currentAgent.competition_bonus) || 0;
                const consumedBalance = parseFloat(fieldName === 'consumed_balance' ? finalValue : currentAgent.consumed_balance) || 0;
                const remainingBalance = parseFloat(fieldName === 'remaining_balance' ? finalValue : currentAgent.remaining_balance) || 0;
                
                const depositBonusCount = parseInt(fieldName === 'deposit_bonus_count' ? finalValue : currentAgent.deposit_bonus_count, 10) || 0;
                const usedDepositBonus = parseInt(fieldName === 'used_deposit_bonus' ? finalValue : currentAgent.used_deposit_bonus, 10) || 0;
                const remainingDepositBonus = parseInt(fieldName === 'remaining_deposit_bonus' ? finalValue : currentAgent.remaining_deposit_bonus, 10) || 0;
    
                // Recalculate related fields based on which field was edited
                // This logic is now primarily handled by the backend, but we keep it for immediate UI feedback if needed.
                if (fieldName === 'competition_bonus' || fieldName === 'consumed_balance') {
                    updateData.remaining_balance = competitionBonus - consumedBalance;
                } else if (fieldName === 'remaining_balance') {
                    updateData.consumed_balance = competitionBonus - remainingBalance;
                }
    
                if (fieldName === 'deposit_bonus_count' || fieldName === 'used_deposit_bonus') {
                    updateData.remaining_deposit_bonus = depositBonusCount - usedDepositBonus;
                } else if (fieldName === 'remaining_deposit_bonus') {
                    updateData.used_deposit_bonus = depositBonusCount - remainingDepositBonus;
                }
    
                // --- FIX: Ensure deposit_bonus_winners_count is handled ---
                if (fieldName === 'deposit_bonus_winners_count') {
                    updateData.deposit_bonus_winners_count = finalValue;
                }
    
                // Ensure no negative values are saved for balances
                if (updateData.remaining_balance < 0) updateData.remaining_balance = 0;
                if (updateData.consumed_balance < 0) updateData.consumed_balance = 0;
                if (updateData.remaining_deposit_bonus < 0) updateData.remaining_deposit_bonus = 0;
                if (updateData.used_deposit_bonus < 0) updateData.used_deposit_bonus = 0;
            }
    
            // --- DEBUG: Log the complete data payload being sent to the server ---
            console.log('[Inline Edit] Sending update payload to server:', updateData);
            // --- NEW DEBUG: Log to show why the number is not being saved ---
            console.log(`[DEBUG] The payload for the server is being prepared. Field being edited: "${fieldName}". Does the payload include "deposit_bonus_winners_count"?`, 'deposit_bonus_winners_count' in updateData);
    
    
            try {
                const response = await authedFetch(`/api/agents/${agent._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                if (!response.ok) throw new Error((await response.json()).message || 'فشل تحديث الحقل.');
                const { data: updatedAgent } = await response.json();
    
                // --- ACTIVATED: Log the activity from the frontend to ensure user context is captured. ---
                const oldValue = currentAgent[fieldName];
                const description = `تم تحديث "${label}" من "${oldValue || 'فارغ'}" إلى "${newValue || 'فارغ'}".`;
                await logAgentActivity(currentUserProfile?._id, agent._id, 'DETAILS_UPDATE', description, { field: label, from: oldValue, to: newValue });
    
                showToast('تم حفظ التغيير بنجاح.', 'success');
                // FIX: Always re-render the full profile page to ensure all tabs (especially the log) are updated.
                // This is more reliable than partial updates.
                renderAgentProfilePage(agent._id, { activeTab: 'details' });
            } catch (e) {
                showToast(`فشل تحديث الحقل: ${e.message}`, 'error');
                renderDetailsView(agent); // Revert on error
            }
        });
    }
    
    function calculateNextRenewalDate(agent) {
        if (!agent || !agent.renewal_period || agent.renewal_period === 'none') {
            return null;
        }
        const lastRenewal = agent.last_renewal_date ? new Date(agent.last_renewal_date) : new Date(agent.createdAt);
        let nextRenewalDate = new Date(lastRenewal);
    
        switch (agent.renewal_period) {
            case 'weekly':
                nextRenewalDate.setDate(nextRenewalDate.getDate() + 6);
                break;
            case 'biweekly':
                nextRenewalDate.setDate(nextRenewalDate.getDate() + 13);
                break;
            case 'monthly':
                nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
                nextRenewalDate.setDate(nextRenewalDate.getDate() - 1);
                break;
            default:
                return null;
        }
        return nextRenewalDate;
    }
    
    function updateManualRenewButtonState(agent) {
        const renewalBtn = document.getElementById('manual-renew-btn');
        if (!renewalBtn) return;
    
        const nextRenewalDate = calculateNextRenewalDate(agent);
    
        if (!nextRenewalDate) {
            renewalBtn.style.display = 'none';
            return;
        }
    
        renewalBtn.style.display = 'inline-flex';
    
        if (new Date() >= nextRenewalDate) {
            renewalBtn.disabled = false;
            renewalBtn.classList.add('ready');
        } else {
            renewalBtn.disabled = true;
            renewalBtn.classList.remove('ready');
        }
    }
    
    function formatDuration(ms) {
        if (ms < 0) ms = -ms;
        const time = {
            day: Math.floor(ms / 86400000),
            hour: Math.floor(ms / 3600000) % 24,
            minute: Math.floor(ms / 60000) % 60,
            second: Math.floor(ms / 1000) % 60
        };
        return Object.entries(time).filter(val => val[1] !== 0).map(([key, val]) => `${val} ${key}${val !== 1 ? 's' : ''}`).join(', ');
    }
    
    function displayNextRenewalDate(agent) {
        const displayElement = document.getElementById('renewal-date-display');
        if (!displayElement) return;
    
        const nextRenewalDate = calculateNextRenewalDate(agent);
    
        if (!nextRenewalDate) {
            displayElement.style.display = 'none';
            updateManualRenewButtonState(agent);
            return;
        }
    
        displayElement.style.display = 'flex';
    
        const updateCountdown = () => {
            const now = new Date();
            const diff = nextRenewalDate - now;
    
            if (diff <= 0) {
                console.log('[Renewal] Countdown finished. Checking renewal status...');
                if (isRenewing) {
                    console.log('[Renewal] Blocked: A renewal process is already in progress.');
                    return;
                }
                console.log('[Renewal] Starting renewal process...');
                isRenewing = true; // Set flag
    
                if (renewalCountdownInterval) clearInterval(renewalCountdownInterval);
                
                displayElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>جاري التجديد...</span>`;
                displayElement.classList.add('due');
    
                // Trigger the renewal immediately
                (async () => {
                    try {
                        console.log(`[Renewal] Calling API to renew agent ${agent._id}`);
                        const response = await authedFetch(`/api/agents/${agent._id}/renew`, { method: 'POST' });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'فشل التجديد التلقائي.');
                        }
                        console.log('[Renewal] API call successful. Re-rendering page.');
                        showToast(`تم تجديد رصيد الوكيل ${agent.name} بنجاح!`, 'success');
                        // Re-render the page to show updated values
                        renderAgentProfilePage(agent._id, { activeTab: 'details' });
                    } catch (error) {
                        console.error('[Renewal] API call failed:', error.message);
                        showToast(`فشل التجديد: ${error.message}`, 'error');
                        // Re-render to show the 'due' state again if it fails
                        renderAgentProfilePage(agent._id, { activeTab: 'details' });
                    }
                })();
                return;
            }
    
            if (diff < 1800000) { // Less than 30 minutes
                const minutes = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
                const seconds = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
                displayElement.innerHTML = `<i class="fas fa-hourglass-half fa-spin"></i> <span>التجديد خلال: ${minutes}:${seconds}</span>`;
                displayElement.classList.add('imminent');
            } else {
                // More than 1 minute, show relative time
                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                let relativeTime = '';
                if (days > 1) relativeTime = `في ${days} أيام`;
                else if (days === 1) relativeTime = `خلال يوم`;
                else if (hours > 0) relativeTime = `في ${hours} ساعة`;
                else relativeTime = `في ${Math.ceil(diff / 60000)} دقيقة`;
    
                const absoluteDateString = nextRenewalDate.toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric'
                });
                const fullDateTimeString = `${absoluteDateString} الساعة 5:00 ص`;
    
                displayElement.innerHTML = `<i class="fas fa-calendar-alt"></i> <span>يُجدد ${relativeTime} (${fullDateTimeString})</span>`;
                displayElement.classList.remove('imminent', 'due');
            }
        };
    
        if (renewalCountdownInterval) clearInterval(renewalCountdownInterval);
        updateCountdown(); // Initial call
        renewalCountdownInterval = setInterval(updateCountdown, 1000); // Update every second
    
        updateManualRenewButtonState(agent);
    }
    
    // --- NEW: Agent Analytics Section ---
    async function renderAgentAnalytics(agent, container, dateRange = 'all') {
        container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>'; // This will be migrated later
        let competitions = [];
        let error = null;
    
        try {
            const queryParams = new URLSearchParams({ dateRange });
            const response = await authedFetch(`/api/stats/agent-analytics/${agent._id}?${queryParams.toString()}`);
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || 'فشل تحميل بيانات التحليلات.');
            }
            const result = await response.json();
            competitions = result.competitions;
        } catch (e) {
            error = e;
        }
    
        if (error) {
            container.innerHTML = '<p class="error">فشل تحميل بيانات التحليلات.</p>';
            return;
        }
    
        // --- NEW: Calculate KPIs ---
        const totalCompetitions = competitions.length;
        const totalViews = competitions.reduce((sum, c) => sum + (c.views_count || 0), 0);
        const totalReactions = competitions.reduce((sum, c) => sum + (c.reactions_count || 0), 0);
        const totalParticipants = competitions.reduce((sum, c) => sum + (c.participants_count || 0), 0);
        const avgViews = totalCompetitions > 0 ? totalViews / totalCompetitions : 0;
    
        // --- NEW: Calculate Growth Rate ---
        let growthRate = 0;
        if (competitions.length >= 2) {
            const latest = competitions[0];
            const previous = competitions[1];
            const latestTotal = (latest.views_count || 0) + (latest.reactions_count || 0) + (latest.participants_count || 0);
            const previousTotal = (previous.views_count || 0) + (previous.reactions_count || 0) + (previous.participants_count || 0);
            if (previousTotal > 0) {
                growthRate = ((latestTotal - previousTotal) / previousTotal) * 100;
            }
        }
    
        const kpiCardsHtml = `
            <div class="dashboard-grid-v2" style="margin-bottom: 20px;">
                <div class="stat-card-v2 color-1">
                    <div class="stat-card-v2-icon-bg"><i class="fas fa-eye"></i></div>
                    <p class="stat-card-v2-value">${formatNumber(totalViews)}</p>
                    <h3 class="stat-card-v2-title">إجمالي المشاهدات</h3>
                </div>
                <div class="stat-card-v2 color-2">
                    <div class="stat-card-v2-icon-bg"><i class="fas fa-heart"></i></div>
                    <p class="stat-card-v2-value">${formatNumber(totalReactions)}</p>
                    <h3 class="stat-card-v2-title">إجمالي التفاعلات</h3>
                </div>
                <div class="stat-card-v2 color-3">
                    <div class="stat-card-v2-icon-bg"><i class="fas fa-users"></i></div>
                    <p class="stat-card-v2-value">${formatNumber(totalParticipants)}</p>
                    <h3 class="stat-card-v2-title">إجمالي المشاركات</h3>
                </div>
                <div class="stat-card-v2 color-4">
                    <div class="stat-card-v2-icon-bg"><i class="fas fa-chart-line"></i></div>
                    <p class="stat-card-v2-value">${growthRate.toFixed(1)}%</p>
                    <h3 class="stat-card-v2-title">معدل النمو</h3>
                </div>
            </div>
        `;
    
        // --- NEW: Date Filter and Export Buttons ---
        const analyticsHeaderHtml = `
            <div class="analytics-header">
                <h2><i class="fas fa-chart-line"></i> تحليلات أداء المسابقات</h2>
                <div class="analytics-actions">
                    <div class="filter-buttons">
                        <button class="filter-btn ${dateRange === 'all' ? 'active' : ''}" data-range="all">الكل</button>
                        <button class="filter-btn ${dateRange === '7d' ? 'active' : ''}" data-range="7d">آخر 7 أيام</button>
                        <button class="filter-btn ${dateRange === '30d' ? 'active' : ''}" data-range="30d">آخر 30 يوم</button>
                        <button class="filter-btn ${dateRange === 'month' ? 'active' : ''}" data-range="month">هذا الشهر</button>
                    </div>
                </div>
            </div>
        `;
    
        // --- NEW: Event listener for date filters ---
        container.addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn')) {
                const newRange = e.target.dataset.range;
                renderAgentAnalytics(agent, container, newRange);
            }
        });
    
        // --- FIX: Render chart after the container is in the DOM ---
        renderAgentAnalyticsChart(competitions, dateRange, agent);
    
        if (competitions.length === 0) {
            container.innerHTML = `${analyticsHeaderHtml}<p class="no-results-message">لا توجد بيانات تحليلية في النطاق الزمني المحدد.</p>`;
            return;
        }
    
        container.innerHTML = `
            ${analyticsHeaderHtml}
            ${kpiCardsHtml}
            <div class="analytics-container">
                <div class="chart-container" style="height: 350px; margin-bottom: 30px;">
                    <canvas id="agent-analytics-chart"></canvas>
                </div>
                <div class="table-responsive-container">
                    <table class="modern-table">
                        <thead>
                            <tr>
                                <th>اسم المسابقة</th>
                                <th>تاريخ الإنشاء</th>
                                <th>المشاهدات</th>
                                <th>التفاعلات</th>
                                <th>المشاركات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${competitions.map(c => `
                                <tr>
                                    <td data-label="اسم المسابقة">${c.name}</td>
                                    <td data-label="تاريخ الإنشاء">${new Date(c.created_at).toLocaleDateString('ar-EG')}</td>
                                    <td data-label="المشاهدات">${formatNumber(c.views_count)}</td>
                                    <td data-label="التفاعلات">${formatNumber(c.reactions_count)}</td>
                                    <td data-label="المشاركات">${formatNumber(c.participants_count)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    function renderAgentAnalyticsChart(competitions, dateRange, agent) {
        const ctx = document.getElementById('agent-analytics-chart')?.getContext('2d');
        if (!ctx) return;
    
        // Determine the date range for the chart labels
        const chartLabels = [];
        const dailyData = {};
        const today = new Date();
        let daysInChart = 7; // Default for 'all' or '7d'
    
        if (dateRange === '30d') daysInChart = 30;
        else if (dateRange === 'month') daysInChart = today.getDate();
        else if (dateRange === 'all') {
            const oldestDate = new Date(agent.created_at); // Use agent creation date
            const diffTime = Math.abs(today - oldestDate);
            daysInChart = Math.max(7, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1); // +1 to include today
        }
    
        for (let i = daysInChart - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            chartLabels.push(date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }));
            dailyData[dateString] = { views: 0, reactions: 0, participants: 0 };
        }
    
        competitions.forEach(comp => {
            if (comp.createdAt) { // Check if createdAt exists
                const dateString = new Date(comp.createdAt).toISOString().split('T')[0];
                if (dailyData[dateString]) {
                    dailyData[dateString].views += comp.views_count || 0;
                    dailyData[dateString].reactions += comp.reactions_count || 0;
                    dailyData[dateString].participants += comp.participants_count || 0;
                }
            }
        });
    
        const dailyViews = Object.values(dailyData).map(d => d.views);
        const dailyReactions = Object.values(dailyData).map(d => d.reactions);
        const dailyParticipants = Object.values(dailyData).map(d => d.participants);
    
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [
                    { label: 'المشاهدات', data: dailyViews, borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.2)', fill: true, tension: 0.3 },
                    { label: 'التفاعلات', data: dailyReactions, borderColor: 'rgba(255, 206, 86, 1)', backgroundColor: 'rgba(255, 206, 86, 0.2)', fill: true, tension: 0.3 },
                    { label: 'المشاركات', data: dailyParticipants, borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.3 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
                },
                plugins: { legend: { position: 'top' } },
                interaction: { mode: 'index', intersect: false }
            }
        });
    }
    

    // == users.js ==
    // --- NEW: Handler for presence updates ---
    const handlePresenceUpdateForUsersPage = () => {
        if (window.updateUserPresenceIndicators) {
            window.updateUserPresenceIndicators();
        }
    };
    
    async function renderUsersPage() {
        // --- NEW: Clean up previous listener and add a new one for this page instance ---
        window.removeEventListener('presence-update', handlePresenceUpdateForUsersPage);
        window.addEventListener('presence-update', handlePresenceUpdateForUsersPage);
    
        const appContent = document.getElementById('app-content');
    
        // --- MODIFICATION: Allow both super_admin and admin to access this page ---
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = currentUserProfile?.role === 'admin';
        if (!isSuperAdmin && !isAdmin) {
            appContent.innerHTML = `
                <div class="access-denied-container">
                    <i class="fas fa-lock"></i>
                    <h2>ليس لديك صلاحية وصول</h2>
                    <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
                </div>`;
            return;
        }
    
        // --- MODIFICATION: Only show the "Add User" button if the user has permission (admin or super_admin) ---
        const canAddUser = isSuperAdmin || isAdmin;
        const addUserButtonHtml = canAddUser ? `<button id="add-new-user-btn" class="btn-primary"><i class="fas fa-user-plus"></i> إضافة مستخدم جديد</button>` : '';
    
        appContent.innerHTML = `
            <!-- NEW: Stats Cards Section -->
            <div class="dashboard-grid-v2" id="user-stats-container" style="margin-bottom: 20px;">
                <div class="stat-card-v2 color-1"><div class="stat-card-v2-icon-bg"><i class="fas fa-users"></i></div><p id="total-users-stat" class="stat-card-v2-value">0</p><h3 class="stat-card-v2-title">إجمالي المستخدمين</h3></div>
                <div class="stat-card-v2 color-2"><div class="stat-card-v2-icon-bg"><i class="fas fa-user-check"></i></div><p id="active-users-stat" class="stat-card-v2-value">0</p><h3 class="stat-card-v2-title">المستخدمون النشطون</h3></div>
                <div class="stat-card-v2 color-3"><div class="stat-card-v2-icon-bg"><i class="fas fa-user-shield"></i></div><p id="admin-users-stat" class="stat-card-v2-value">0</p><h3 class="stat-card-v2-title">المسؤولون</h3></div>
                <div class="stat-card-v2 color-4"><div class="stat-card-v2-icon-bg"><i class="fas fa-user-slash"></i></div><p id="inactive-users-stat" class="stat-card-v2-value">0</p><h3 class="stat-card-v2-title">المستخدمون المعطلون</h3></div>
            </div>
    
            <div class="page-header column-header">
                <div class="header-top-row">
                    <h1><i class="fas fa-users-cog"></i> إدارة المستخدمين</h1>
                    ${addUserButtonHtml}
                </div>
                <div class="filters-container">
                    <div class="filter-search-container">
                        <input type="search" id="user-search-input" placeholder="بحث بالاسم أو البريد الإلكتروني..." autocomplete="off">
                        <i class="fas fa-search"></i>
                        <i class="fas fa-times-circle search-clear-btn" id="user-search-clear"></i>
                    </div>
                    <div class="filter-buttons">
                        <button class="filter-btn active" data-status-filter="all">الكل</button>
                        <button class="filter-btn" data-status-filter="active">النشطون</button>
                        <button class="filter-btn" data-status-filter="inactive">المعطلون</button>
                    </div>
                    <div id="user-count" class="item-count-display"></div>
                </div>
            </div>
            <div id="users-list-container">
                <div class="loader-container"><div class="spinner"></div></div>
            </div>
        `;
    
        // Add listener for the new user button
        const addUserBtn = document.getElementById('add-new-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', renderCreateUserModal);
        }
        
        // Attach event listeners for actions (delete, role change) to the persistent container
        attachUserActionListeners();
    
        // Attach search listeners
        setupUserPageFilters([]); // Setup with empty array initially
    
        // NEW: Fetch data asynchronously
        fetchUsersData();
    }
    
    async function fetchUsersData() {
        try {
            const response = await authedFetch('/api/users');
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message);
            }
            const { users } = await response.json();
    
            setupUserPageFilters(users); // Re-setup filters with the complete data
        } catch (error) {
            document.getElementById('users-list-container').innerHTML = `<p class="error">فشل جلب المستخدمين: ${error.message}</p>`;
        }
    }
    
    function renderUserRow(user) {
        // --- إصلاح: استخدام _id بدلاً من id ---
        const isCurrentUser = currentUserProfile && user._id === currentUserProfile.userId;
        const isTargetAdmin = user.role === 'admin';
        const isCurrentUserAdmin = currentUserProfile?.role === 'admin';
        const isCurrentUserSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isTargetSuperAdmin = user.role === 'super_admin'; // نحتفظ بهذا فقط لعرض الشارة
    
        // --- إصلاح: تعريف متغير الحالة في بداية الدالة لتجنب أخطاء الوصول ---
        const isInactive = user.status === 'inactive';
    
        // --- إصلاح: استخدام updatedAt كبديل مؤقت لآخر تسجيل دخول ---
        const lastLogin = user.updatedAt 
            ? new Date(user.updatedAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
            : 'لم يسجل دخول';
    
        const avatarName = encodeURIComponent(user.full_name || user.email || 'User');
        const avatarHtml = user.avatar_url
            ? `<img src="${user.avatar_url}" alt="Avatar" class="avatar-small" loading="lazy">`
            : `<img src="https://ui-avatars.com/api/?name=${avatarName}&background=8A2BE2&color=fff" alt="Avatar" class="avatar-small" loading="lazy">`;
    
        // NEW: Add a crown icon for admins
        const adminIconHtml = isTargetSuperAdmin ? '<div class="admin-crown-icon super-admin" title="مدير عام"><i class="fas fa-gem"></i></div>' : (isTargetAdmin ? '<div class="admin-crown-icon" title="مسؤول"><i class="fas fa-crown"></i></div>' : '');
        // NEW: Add a badge for admins
        const adminBadgeHtml = isTargetSuperAdmin ? '<span class="admin-badge super-admin">مدير عام</span>' : (isTargetAdmin ? '<span class="admin-badge">مسؤول</span>' : null);
        // NEW: Add a badge for employees
        const employeeBadgeHtml = user.role === 'user' ? '<span class="employee-badge">موظف</span>' : '';
    
        // NEW: Add status badge and styles for inactive users
        const statusBadgeHtml = isInactive ? '<span class="status-badge inactive">معطل</span>' : '';
        
        // NEW: Realtime presence indicator
        const onlineIndicatorHtml = `<div class="online-status-indicator" id="online-status-${user._id}" title="غير متصل"></div>`;
    
        return `
            <tr data-user-id="${user._id}" data-user-name="${user.full_name || 'مستخدم'}" data-user-email="${user.email || ''}" class="${isInactive ? 'inactive-row' : ''}">
                <td data-label="المستخدم">
                    <div class="table-user-cell">
                        <div class="user-avatar-container">
                            ${onlineIndicatorHtml}
                            ${avatarHtml}
                            ${adminIconHtml}
                        </div>
                        <div class="user-details">
                            <span class="user-name">${user.full_name || '<em>لم يحدد</em>'} ${adminBadgeHtml || employeeBadgeHtml} ${statusBadgeHtml}</span>
                            <span class="user-email">${user.email || '<em>غير متوفر</em>'}</span>
                        </div>
                    </div>
                </td>
                <td data-label="الصلاحية">
                    ${(() => {
                        // --- تعديل: فقط المدير العام يمكنه تغيير الصلاحيات ---
                        const canChangeRoles = isCurrentUserSuperAdmin;
                        const roleSelectDisabled = isCurrentUser || !canChangeRoles; // المدير العام يمكنه تغيير صلاحية أي شخص إلا نفسه
                        const roleSelectTitle = canChangeRoles ? 'تغيير الصلاحية' : 'فقط المدير العام يملك صلاحية التغيير';
    
                        if (isTargetSuperAdmin) {
                            return `<span class="role-display super-admin" title="لا يمكن تغيير صلاحية المدير العام">مدير عام</span>`;
                        }
                        return `<select class="role-select" data-user-id="${user._id}" ${roleSelectDisabled ? 'disabled' : ''} title="${roleSelectTitle}">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>موظف</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مسؤول</option>
                        </select>`;
                    })()}
                </td>
                <td data-label="آخر تسجيل دخول">${lastLogin}</td>
                ${(() => {
                    const isAdmin = isCurrentUserAdmin || isCurrentUserSuperAdmin;
                    if (!isAdmin) return ''; // لا تعرض عمود الإجراءات لغير المسؤولين
    
                    // --- تعديل: عرض خلية فارغة للمدير العام لمنع أي إجراء ---
                    // --- NEW: Admins cannot edit other admins or super admins ---
                    if (isTargetSuperAdmin || (isCurrentUserAdmin && isTargetAdmin)) {
                        return `<td class="actions-cell"><span class="no-actions-text">${isCurrentUserSuperAdmin ? 'لا يمكن التعديل' : 'صلاحية للمدير العام'}</span></td>`;
                    }
    
                    // عرض الأزرار للمستخدمين العاديين والمسؤولين الآخرين
                    return `<td class="actions-cell">
                        <button class="btn-secondary edit-user-btn" data-user-id="${user._id}" title="تعديل بيانات المستخدم"><i class="fas fa-edit"></i></button>
                        ${/* --- MODIFICATION: Allow admins to manage permissions for users, but not other admins. --- */ ''}
                        <button class="btn-primary permissions-user-btn" data-user-id="${user._id}" title="إدارة الصلاحيات" 
                            ${(isCurrentUserAdmin && isTargetAdmin) || (!isCurrentUserSuperAdmin && !isCurrentUserAdmin) ? 'disabled' : ''}>
                            <i class="fas fa-shield-alt"></i></button>
                        ${/* --- MODIFICATION: Allow admins to delete users, but not other admins. Super admins can delete anyone except themselves. --- */ ''}
                        <button class="btn-danger delete-user-btn" data-user-id="${user._id}" title="حذف المستخدم نهائياً" 
                            ${(isCurrentUserAdmin && isTargetAdmin) || !isCurrentUserSuperAdmin && !isCurrentUserAdmin ? 'disabled' : ''}>
                            <i class="fas fa-trash-alt"></i></button>
                        <label class="custom-checkbox toggle-switch small-toggle" title="${isInactive ? 'تفعيل الحساب' : 'تعطيل الحساب'}" ${!isCurrentUserSuperAdmin ? 'style="display:none;"' : ''}>
                            <input type="checkbox" class="status-toggle" data-user-id="${user._id}" ${!isInactive ? 'checked' : ''}><span class="slider round"></span>
                        </label>
                    </td>`;
                })()}
            </tr>
        `;
    }
    
    let allUsersCache = []; // Cache for user data
    function setupUserPageFilters(allUsers) {
        const searchInput = document.getElementById('user-search-input');
        const clearBtn = document.getElementById('user-search-clear');
        const userCountEl = document.getElementById('user-count');
        const statusFilterButtons = document.querySelectorAll('.filter-buttons .filter-btn');
        const container = document.getElementById('users-list-container'); // The persistent container
    
        if (!searchInput || !container) return;
        allUsersCache = allUsers; // Store users in cache
    
        // --- إصلاح: تعريف متغير صلاحية المدير العام في النطاق الصحيح ---
        const isCurrentUserSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isCurrentUserAdmin = currentUserProfile?.role === 'admin';
    
        const applyFilters = () => {
            if (clearBtn) {
                clearBtn.style.display = searchInput.value ? 'block' : 'none';
            }
    
            const searchTerm = searchInput.value.toLowerCase().trim();
            const activeStatusFilter = document.querySelector('.filter-buttons .filter-btn.active').dataset.statusFilter;
    
            const filteredUsers = allUsers.filter(user => {
                const name = (user.full_name || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
                const matchesStatus = activeStatusFilter === 'all' || (user.status || 'active') === activeStatusFilter;
                return matchesSearch && matchesStatus;
            });
    
            // Re-render the table with filtered users
            if (filteredUsers.length === 0) {
                container.innerHTML = '<p class="no-results-message">لا يوجد مستخدمون يطابقون بحثك.</p>';
            } else {
                container.innerHTML = `
                    <div class="table-responsive-container">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                <th class="user-column">المستخدم</th>
                                    <th>الصلاحية</th>
                                    <th>آخر تسجيل دخول</th>
                                    ${isCurrentUserSuperAdmin || isCurrentUserAdmin ? '<th class="actions-column">الإجراءات</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredUsers.map(user => renderUserRow(user)).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
            
            // Update user count
            if (userCountEl) {
                userCountEl.textContent = `إجمالي: ${filteredUsers.length} مستخدم`;
            }
    
            // NEW: Update stats cards based on the full user list
            document.getElementById('total-users-stat').textContent = formatNumber(allUsers.length);
            document.getElementById('active-users-stat').textContent = formatNumber(allUsers.filter(u => u.status !== 'inactive').length);
            document.getElementById('admin-users-stat').textContent = formatNumber(allUsers.filter(u => u.role === 'admin').length);
            document.getElementById('inactive-users-stat').textContent = formatNumber(allUsers.filter(u => u.status === 'inactive').length);
    
        };
    
        searchInput.addEventListener('input', applyFilters);
    
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                applyFilters();
                searchInput.focus();
            });
        }
    
        if (statusFilterButtons.length) {
            statusFilterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    statusFilterButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    applyFilters();
                });
            });
        }
    
        // Initial call to set up the count and table
        applyFilters();
    
        // NEW: Function to update online status indicators on the page
        window.updateUserPresenceIndicators = () => {
            if (!window.onlineUsers) return;
            allUsersCache.forEach(user => {
                const indicator = document.getElementById(`online-status-${user._id}`);
                if (indicator) {
                    if (window.onlineUsers.has(user._id)) {
                        indicator.classList.add('online');
                        indicator.title = 'متصل الآن';
                    } else {
                        indicator.classList.remove('online');
                        indicator.title = 'غير متصل';
                    }
                }
            });
        };
        window.updateUserPresenceIndicators(); // Initial update
    }
    
    function attachUserActionListeners() {
        const container = document.getElementById('users-list-container');
    
        container.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-user-btn');
            const editBtn = e.target.closest('.edit-user-btn');
            const permissionsBtn = e.target.closest('.permissions-user-btn');
    
            if (editBtn && !editBtn.disabled) {
                const userId = editBtn.dataset.userId;
                const userToEdit = allUsersCache.find(u => u._id === userId);
                if (userToEdit) renderEditUserModal(userToEdit);
            }
    
            if (permissionsBtn && !permissionsBtn.disabled) {
                const userId = permissionsBtn.dataset.userId;
                const userToManage = allUsersCache.find(u => u._id === userId);
                if (userToManage) renderPermissionsModal(userToManage);
            }
    
            if (deleteBtn && !deleteBtn.disabled) {
                const userId = deleteBtn.dataset.userId;
                const row = deleteBtn.closest('tr');
                const userName = row.dataset.userName;
    
                showConfirmationModal(
                    `هل أنت متأكد من حذف المستخدم "<strong>${userName}</strong>"؟<br><small>سيتم حذفه نهائياً من النظام ولا يمكن التراجع عن هذا الإجراء.</small>`,
                    async () => {
                        try {
                            const response = await authedFetch(`/api/users/${userId}`, { method: 'DELETE' });
                            if (!response.ok) {
                                const result = await response.json();
                                throw new Error(result.message);
                            }
                            showToast('تم حذف المستخدم بنجاح.', 'success');
                            await fetchUsersData(); // Refresh list to show changes
                        } catch (error) {
                            showToast(`فشل حذف المستخدم: ${error.message}`, 'error');
                        }
                    },
                    { title: 'تأكيد الحذف النهائي', confirmText: 'حذف', confirmClass: 'btn-danger' }
                );
            }
        });
    
        container.addEventListener('change', async (e) => {
            const roleSelect = e.target.closest('.role-select');
            if (roleSelect && !roleSelect.disabled) {
                const userId = roleSelect.dataset.userId;
                const newRole = roleSelect.value;
                const originalRole = allUsersCache.find(u => u._id === userId)?.role;
    
                try {
                    const response = await authedFetch(`/api/users/${userId}/role`, {
                        method: 'PUT',
                        body: JSON.stringify({ role: newRole })
                    });
                    if (!response.ok) {
                        const result = await response.json();
                        throw new Error(result.message);
                    }
    
                    showToast('تم تحديث صلاحية المستخدم بنجاح.', 'success');
                    // NEW: Notify the user whose role was changed in real-time
                    // This requires a WebSocket setup to be effective.
                    notifyUserOfRoleChange(userId, newRole);
                } catch (error) {
                    showToast(`فشل تحديث الصلاحية: ${error.message}`, 'error');
                    // Revert the select box to the previous value on error without a full page reload
                    if (originalRole) {
                        roleSelect.value = originalRole;
                    }
                }
            }
    
            // NEW: Handle status toggle change
            const statusToggle = e.target.closest('.status-toggle');
            if (statusToggle && !statusToggle.disabled) {
                const userId = statusToggle.dataset.userId;
                const newStatus = statusToggle.checked ? 'active' : 'inactive';
    
                try {
                    const response = await authedFetch(`/api/users/${userId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: newStatus }) // Send status update to backend
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message);
    
                    showToast(`تم ${newStatus === 'active' ? 'تفعيل' : 'تعطيل'} حساب المستخدم.`, 'success');
                    await fetchUsersData(); // Refresh list to show changes
                } catch (error) {
                    showToast(`فشل تحديث الحالة: ${error.message}`, 'error');
                    statusToggle.checked = !statusToggle.checked; // Revert on error
                }
            }
        });
    }
    
    /**
     * NEW: Notifies a specific user that their role has been changed.
     * This function should send a message via WebSocket to the server,
     * which then relays it to the target user.
     * @param {string} userId The ID of the user to notify.
     * @param {string} newRole The new role assigned to the user.
     */
    function notifyUserOfRoleChange(userId, newRole) {
        // This is a placeholder for a real WebSocket implementation.
        // In a real app, you would have a global WebSocket instance, e.g., `socket`.
        // if (socket && socket.readyState === WebSocket.OPEN) {
        //     socket.send(JSON.stringify({
        //         type: 'role_change',
        //         payload: {
        //             targetUserId: userId,
        //             newRole: newRole
        //         }
        //     }));
        // }
    
        // For now, we can simulate this by logging to the console.
        console.log(`[SIMULATION] Notifying user ${userId} of role change to ${newRole}. This would be sent via WebSocket.`);
    }
    
    function renderCreateUserModal() {
        // --- NEW: Professional Create User Modal ---
        const overlay = document.createElement('div');
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    
        overlay.className = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'form-modal-content modal-wide';
        
        modal.innerHTML = `
            <div class="form-modal-header">
                <h2><i class="fas fa-user-plus"></i> إنشاء مستخدم جديد</h2>
                <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
            </div>
            <div class="form-modal-body">
                <form id="create-user-form" class="form-layout-grid">
                    <!-- Avatar Section -->
                    <div class="form-grid-avatar">
                        <div class="profile-avatar-edit large-avatar">
                            <img src="https://ui-avatars.com/api/?name=?&background=8A2BE2&color=fff&size=128" alt="Avatar" id="avatar-preview">
                            <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                        </div>
                        <!-- NEW: Action buttons for avatar moved outside -->
                        <div class="avatar-action-buttons" id="avatar-action-buttons" style="display: none;">
                            <button type="button" id="change-avatar-btn" class="btn-secondary btn-small"><i class="fas fa-edit"></i> تغيير</button>
                            <button type="button" id="delete-avatar-btn" class="btn-danger btn-small"><i class="fas fa-trash"></i> حذف</button>
                        </div>
                    </div>
                    <!-- Fields Section -->
                    <div class="form-grid-fields">
                        <div class="form-group">
                            <label for="new-user-fullname">الاسم الكامل</label>
                            <input type="text" id="new-user-fullname" required>
                        </div>
                        <div class="form-group">
                            <label for="new-user-email">البريد الإلكتروني</label>
                            <input type="email" id="new-user-email" required>
                        </div>
                        <div class="form-group">
                            <label for="new-user-password">كلمة المرور</label>
                            <div class="password-input-wrapper">
                                <input type="password" id="new-user-password" required minlength="8">
                                <button type="button" id="password-toggle-btn" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                            </div>
                            <div class="password-strength-meter">
                                <div class="strength-bar"></div>
                            </div>
                            <div class="password-actions">
                                <button type="button" id="generate-password-btn" class="btn-secondary btn-small">إنشاء كلمة مرور قوية</button>
                            </div>
                        </div>
                        ${isSuperAdmin ? `
                            <div class="form-group">
                                <label for="new-user-role">الصلاحية</label>
                                <select id="new-user-role">
                                    <option value="user" selected>موظف</option>
                                    <option value="admin">مسؤول</option>
                                </select>
                            </div>
                        ` : '<input type="hidden" id="new-user-role" value="user">'
                        }
                    </div>
                    <!-- Actions Section -->
                    <div class="form-grid-actions">
                        <button type="submit" id="create-user-submit-btn" class="btn-primary">
                            <i class="fas fa-check"></i> إنشاء المستخدم
                        </button>
                        <button type="button" id="cancel-create-modal" class="btn-secondary">إلغاء</button>
                    </div>
                </form>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    
        const closeModal = () => overlay.remove();
        modal.querySelector('#close-modal-btn').addEventListener('click', closeModal);
        modal.querySelector('#cancel-create-modal').addEventListener('click', closeModal);
    
        // --- NEW: Add logic for password features ---
        const passwordInput = modal.querySelector('#new-user-password');
        const passwordToggleBtn = modal.querySelector('#password-toggle-btn');
        const generatePasswordBtn = modal.querySelector('#generate-password-btn');
        const strengthBar = modal.querySelector('.strength-bar');
    
        passwordToggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            passwordToggleBtn.querySelector('i').className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'}`;
        });
    
        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            let strength = 0;
            if (password.length >= 8) strength++;
            if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
            if (password.match(/\d/)) strength++;
            if (password.match(/[^a-zA-Z\d]/)) strength++;
            
            strengthBar.className = 'strength-bar';
            if (strength > 0) strengthBar.classList.add(`strength-${strength}`);
        });
    
        generatePasswordBtn.addEventListener('click', () => {
            // --- NEW: Guaranteed strong password generation ---
            const lower = 'abcdefghijklmnopqrstuvwxyz';
            const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const numbers = '0123456789';
            const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
            const all = lower + upper + numbers + symbols;
    
            let newPassword = '';
            // Ensure at least one of each type
            newPassword += lower.charAt(Math.floor(Math.random() * lower.length));
            newPassword += upper.charAt(Math.floor(Math.random() * upper.length));
            newPassword += numbers.charAt(Math.floor(Math.random() * numbers.length));
            newPassword += symbols.charAt(Math.floor(Math.random() * symbols.length));
    
            // Fill the rest of the password
            for (let i = newPassword.length; i < 14; i++) {
                newPassword += all.charAt(Math.floor(Math.random() * all.length));
            }
    
            // Shuffle the password to make it random
            newPassword = newPassword.split('').sort(() => 0.5 - Math.random()).join('');
    
            passwordInput.value = newPassword;
            passwordInput.dispatchEvent(new Event('input')); // Trigger strength check
            navigator.clipboard.writeText(newPassword).then(() => {
                showToast('تم إنشاء ونسخ كلمة مرور قوية.', 'success');
            });
        });
    
        // Avatar preview logic
        const avatarUploadInput = modal.querySelector('#avatar-upload');
        const avatarPreview = modal.querySelector('#avatar-preview');
        const avatarActions = modal.querySelector('#avatar-action-buttons');
        const changeAvatarBtn = modal.querySelector('#change-avatar-btn');
        const deleteAvatarBtn = modal.querySelector('#delete-avatar-btn');
    
        // NEW: Allow clicking the entire avatar container (including the camera icon overlay) to trigger file upload
        const openFileDialog = () => avatarUploadInput.click();
        avatarPreview.closest('.profile-avatar-edit').addEventListener('click', openFileDialog);
        changeAvatarBtn.addEventListener('click', openFileDialog);
    
        deleteAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent re-opening the file dialog
            avatarUploadInput.value = null; // Clear the file input
            avatarPreview.src = 'https://ui-avatars.com/api/?name=?&background=8A2BE2&color=fff&size=128';
            avatarActions.style.display = 'none';
        });
    
        avatarUploadInput.addEventListener('change', () => {
            const file = avatarUploadInput.files[0];
            if (file) {
                avatarPreview.src = URL.createObjectURL(file);
                avatarActions.style.display = 'flex';
            }
            avatarUploadInput.click();
        });
    
        // Form submission logic
        modal.querySelector('#create-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = modal.querySelector('#create-user-submit-btn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';
    
            const newUser = {
                full_name: modal.querySelector('#new-user-fullname').value,
                email: modal.querySelector('#new-user-email').value,
                password: modal.querySelector('#new-user-password').value,
                role: modal.querySelector('#new-user-role').value,
            };
    
            try {
                const response = await authedFetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newUser),
                });
                const result = await response.json();
                if (!response.ok || !result.user) throw new Error(result.message || 'فشل إنشاء المستخدم.');
    
                // Avatar upload logic will be implemented later
    
                showToast('تم إنشاء المستخدم بنجاح.', 'success');
                closeModal();
                await fetchUsersData();
            } catch (error) {
                showToast(`فشل إنشاء المستخدم: ${error.message}`, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check"></i> إنشاء المستخدم';
            }
        });
    }
    
    function renderEditUserModal(user) {
        // --- NEW: Professional Edit User Modal ---
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'form-modal-content modal-wide';
        
        const originalAvatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${user.full_name || user.email}&background=8A2BE2&color=fff&size=128`;
        const isCurrentUserSuperAdmin = currentUserProfile?.role === 'super_admin';
    
        modal.innerHTML = `
            <div class="form-modal-header">
                <h2><i class="fas fa-user-edit"></i> تعديل المستخدم: ${user.full_name}</h2>
                <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
            </div>
            <div class="form-modal-body">
                <form id="edit-user-form" class="form-layout-grid">
                    <!-- Avatar Section -->
                    <div class="form-grid-avatar">
                        <div class="profile-avatar-edit large-avatar">
                            <img src="${originalAvatarUrl}" alt="Avatar" id="avatar-preview">
                            <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                        </div>
                        <!-- NEW: Action buttons for avatar moved outside -->
                        <div class="avatar-action-buttons" id="avatar-action-buttons" style="display: none;">
                            <button type="button" id="change-avatar-btn" class="btn-secondary btn-small"><i class="fas fa-edit"></i> تغيير</button>
                            <button type="button" id="delete-avatar-btn" class="btn-danger btn-small"><i class="fas fa-trash"></i> حذف</button>
                        </div>
                    </div>
                    <!-- Fields Section -->
                    <div class="form-grid-fields">
                        <div class="form-group">
                            <label for="edit-user-fullname">الاسم الكامل</label>
                            <input type="text" id="edit-user-fullname" value="${user.full_name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit-user-email">البريد الإلكتروني</label>
                            <input type="email" id="edit-user-email" value="${user.email || ''}" disabled>
                        </div>
                        <div class="form-group">
                            <label for="edit-user-password">كلمة المرور الجديدة</label>
                            <input type="password" id="edit-user-password" minlength="8" placeholder="اتركه فارغاً لعدم التغيير">
                        </div>
                    </div>
                    <!-- Actions Section -->
                    <div class="form-grid-actions">
                        <button type="submit" id="edit-user-submit-btn" class="btn-primary">
                            <i class="fas fa-save"></i> حفظ التعديلات
                        </button>
                        <button type="button" id="cancel-edit-modal" class="btn-secondary">إلغاء</button>
                    </div>
                </form>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    
        const closeModal = () => overlay.remove();
        modal.querySelector('#close-modal-btn').addEventListener('click', closeModal);
        modal.querySelector('#cancel-edit-modal').addEventListener('click', closeModal);
    
        // --- Avatar Logic ---
        const avatarUploadInput = modal.querySelector('#avatar-upload');
        const avatarPreview = modal.querySelector('#avatar-preview');
        const avatarActions = modal.querySelector('#avatar-action-buttons');
        const changeAvatarBtn = modal.querySelector('#change-avatar-btn');
        const deleteAvatarBtn = modal.querySelector('#delete-avatar-btn');
    
        const openFileDialog = (e) => {
            e.stopPropagation(); // Prevent event bubbling if needed
            avatarUploadInput.click();
        };
        // Allow clicking the entire avatar container to open the file dialog
        avatarPreview.closest('.profile-avatar-edit').addEventListener('click', openFileDialog);
        changeAvatarBtn.addEventListener('click', openFileDialog);
    
        deleteAvatarBtn.addEventListener('click', () => {
            avatarUploadInput.value = null; // Clear the file input
            avatarPreview.src = originalAvatarUrl;
            avatarActions.style.display = 'none';
        });
    
        avatarUploadInput.addEventListener('change', () => {
            const file = avatarUploadInput.files[0];
            if (file) {
                avatarPreview.src = URL.createObjectURL(file);
                avatarActions.style.display = 'flex';
            }
        });
    
        // --- Form Submission Logic ---
        modal.querySelector('#edit-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = modal.querySelector('#edit-user-submit-btn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    
            try {
                const avatarFile = modal.querySelector('#avatar-upload').files[0];
                if (avatarFile) {
                    const formData = new FormData();
                    formData.append('avatar', avatarFile);
    
                    const avatarResponse = await authedFetch(`/api/users/${user._id}/avatar`, {
                        method: 'POST',
                        body: formData
                    });
                    if (!avatarResponse.ok) {
                        throw new Error('فشل رفع الصورة الرمزية.');
                    }
                }
    
                const userData = {
                    full_name: modal.querySelector('#edit-user-fullname').value,
                    password: modal.querySelector('#edit-user-password').value,
                };
    
                // Send other user data update request
                const response = await authedFetch(`/api/users/${user._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });
                if (!response.ok) throw new Error((await response.json()).message);
    
                showToast('تم تحديث بيانات المستخدم بنجاح.', 'success');
                closeModal();
                await fetchUsersData(); // Refresh the user list
            } catch (error) {
                showToast(`فشل تحديث المستخدم: ${error.message}`, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
            }
        });
    }
    
    function renderPermissionsModal(user) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'form-modal-content modal-fullscreen'; // تعديل: استخدام حجم ملء الشاشة
        
        const p = user.permissions || {}; // Short alias for permissions
        // Set defaults for any missing permission structures
        p.agents = p.agents || { view_financials: false, edit_profile: false, edit_financials: false, can_view_competitions_tab: false, can_renew_all_balances: false };
        p.competitions = p.competitions || { manage_comps: 'none', manage_templates: 'none', can_create: false };
    
        modal.innerHTML = `
            <div class="form-modal-header">
                <h2><i class="fas fa-shield-alt"></i> إدارة صلاحيات: ${user.full_name} ${user.role === 'super_admin' ? '<span class="admin-badge super-admin" style="font-size: 1rem; vertical-align: middle; margin-right: 10px;">مدير عام</span>' : ''}</h2>
                <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
            </div>
            <div class="form-modal-body" ${user.role === 'super_admin' ? 'style="pointer-events: none; opacity: 0.7;"' : ''}>
                <form id="permissions-form">
                    <div class="table-responsive-container">
                        <table class="permissions-table">
                            <thead>
                                <tr>
                                    <th>القسم</th>
                                    <th>بدون صلاحية</th>
                                    <th>مشاهدة فقط</th>
                                    <th>تحكم كامل</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="permission-name">
                                        <i class="fas fa-trophy"></i>
                                        <strong>إدارة المسابقات</strong>
                                        <small>التحكم في عرض وتعديل وحذف المسابقات.</small>
                                    </td>
                                    <td><label class="custom-radio"><input type="radio" name="perm_manage_comps" value="none" ${p.competitions.manage_comps === 'none' || !p.competitions.manage_comps || user.role === 'super_admin' ? 'checked' : ''}><span></span></label></td>
                                    <td><label class="custom-radio"><input type="radio" name="perm_manage_comps" value="view" ${p.competitions.manage_comps === 'view' && user.role !== 'super_admin' ? 'checked' : ''}><span></span></label></td>
                                    <td><label class="custom-radio"><input type="radio" name="perm_manage_comps" value="full" ${p.competitions.manage_comps === 'full' || user.role === 'super_admin' ? 'checked' : ''}><span></span></label></td>
                                </tr>
                                <tr>
                                    <td class="permission-name">
                                        <i class="fas fa-file-alt"></i>
                                        <strong>إدارة القوالب</strong>
                                        <small>التحكم في عرض وتعديل وحذف قوالب المسابقات.</small>
                                    </td>
                                    <td><label class="custom-radio"><input type="radio" name="perm_manage_templates" value="none" ${p.competitions.manage_templates === 'none' || !p.competitions.manage_templates || user.role === 'super_admin' ? 'checked' : ''}><span></span></label></td>
                                    <td><label class="custom-radio"><input type="radio" name="perm_manage_templates" value="view" ${p.competitions.manage_templates === 'view' && user.role !== 'super_admin' ? 'checked' : ''}><span></span></label></td>
                                    <td><label class="custom-radio"><input type="radio" name="perm_manage_templates" value="full" ${p.competitions.manage_templates === 'full' || user.role === 'super_admin' ? 'checked' : ''}><span></span></label></td>
                                </tr>
                            </tbody>
                        </table>
                        <table class="permissions-table" style="margin-top: 20px;">
                             <thead>
                                <tr>
                                    <th>صلاحيات خاصة</th>
                                    <th>تفعيل / إلغاء</th>
                                </tr>
                            </thead>
                            <tbody>
                                 <tr>
                                    <td class="permission-name">
                                        <i class="fas fa-sync-alt"></i>
                                        <strong>تجديد رصيد جميع الوكلاء</strong>
                                        <small>السماح للموظف باستخدام زر "تجديد رصيد الوكلاء" في صفحة إدارة الوكلاء.</small>
                                    </td>
                                    <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-agents-renew-all" ${p.agents.can_renew_all_balances || user.role === 'super_admin' ? 'checked' : ''}><span class="slider round"></span></label></td>
                                </tr>
                                 <tr>
                                    <td class="permission-name">
                                        <i class="fas fa-magic"></i>
                                        <strong>إنشاء مسابقة للوكيل</strong>
                                        <small>السماح للموظف بإنشاء مسابقات جديدة للوكلاء.</small>
                                    </td>
                                    <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-competitions-can-create" ${p.competitions.can_create || user.role === 'super_admin' ? 'checked' : ''}><span class="slider round"></span></label></td>
                                </tr>
                                <tr>
                                    <td class="permission-name">
                                        <i class="fas fa-list-alt"></i>
                                        <strong>عرض تبويب مسابقات الوكيل</strong>
                                        <small>السماح للموظف برؤية تبويب "المسابقات" داخل صفحة ملف الوكيل.</small>
                                    </td>
                                    <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-agents-view-competitions" ${p.agents.can_view_competitions_tab || user.role === 'super_admin' ? 'checked' : ''}><span class="slider round"></span></label></td>
                                </tr>
                                <tr>
                                    <td class="permission-name">
                                        <i class="fas fa-eye"></i>
                                        <strong>عرض التفاصيل المالية للوكيل</strong>
                                        <small>السماح للموظف برؤية تبويب "تفاصيل" المالي للوكيل.</small>
                                    </td>
                                    <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-agents-view-financials" ${p.agents.view_financials || user.role === 'super_admin' ? 'checked' : ''}><span class="slider round"></span></label></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="form-actions" style="margin-top: 20px;" ${user.role === 'super_admin' ? 'hidden' : ''}>
                        <button type="submit" id="save-permissions-btn" class="btn-primary"><i class="fas fa-save"></i> حفظ الصلاحيات</button>
                        <button type="button" id="cancel-permissions-modal" class="btn-secondary">إلغاء</button>
                    </div>
                </form>
            </div>
        `;
    
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    
        const closeModal = () => overlay.remove();
        modal.querySelector('#close-modal-btn').addEventListener('click', closeModal);
        modal.querySelector('#cancel-permissions-modal').addEventListener('click', closeModal);
    
        modal.querySelector('#permissions-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = modal.querySelector('#save-permissions-btn');
            if (!submitBtn) return;
    
            // Get original permissions for logging
            const originalPermissions = user.permissions || {};
    
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    
            const permissionsData = {
                agents: {
                    view_financials: modal.querySelector('#perm-agents-view-financials')?.checked || false,
                    edit_profile: false, 
                    edit_financials: false, // This permission is not implemented in the UI yet
                    can_view_competitions_tab: modal.querySelector('#perm-agents-view-competitions')?.checked || false, // This will be read from the new toggle
                    can_renew_all_balances: modal.querySelector('#perm-agents-renew-all')?.checked || false,
                },
                competitions: {
                    manage_comps: modal.querySelector('input[name="perm_manage_comps"]:checked')?.value || 'none',
                    manage_templates: modal.querySelector('input[name="perm_manage_templates"]:checked')?.value || 'none',
                    can_create: modal.querySelector('#perm-competitions-can-create')?.checked || false,
                }
            };
    
            try {
                // The backend will log the change, including old and new values.
                const response = await authedFetch(`/api/users/${user._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ permissions: permissionsData })
                });
                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.message || 'فشل تحديث الصلاحيات.');
                }
    
                showToast('تم تحديث صلاحيات المستخدم بنجاح.', 'success');
                closeModal();
                
                // Important: We must refetch the entire user list so the local cache (`allUsersCache`)
                // is updated with the new permissions. This ensures that if we open the modal
                // again for the same user, it shows the correct, most recent data.
                await fetchUsersData(); // Refresh the user list to reflect changes
            } catch (error) {
                showToast(`فشل تحديث الصلاحيات: ${error.message}`, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ الصلاحيات';
            }
        });
    }
    
    // NEW: Function to render the user's own profile settings page
    async function renderProfileSettingsPage() {
        const appContent = document.getElementById('app-content');
    
        if (!currentUserProfile) {
            appContent.innerHTML = `<p class="error">يجب تسجيل الدخول لعرض هذه الصفحة.</p>`;
            return;
        }
    
        const isSuperAdmin = currentUserProfile.role === 'super_admin';
        const isAdmin = currentUserProfile.role === 'admin';
        const roleBadge = isSuperAdmin ? '<span class="admin-badge super-admin">مدير عام</span>' : (isAdmin ? '<span class="admin-badge">مسؤول</span>' : '<span class="employee-badge">موظف</span>');
    
        appContent.innerHTML = `
            <div class="page-header">
                <h1><i class="fas fa-user-cog"></i> إعدادات الملف الشخصي</h1>
            </div>
    
            <!-- NEW: Profile Header Section for display -->
            <div class="profile-settings-header">
                <div class="profile-avatar-edit large-avatar">
                    <img src="${currentUserProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserProfile.full_name || currentUserProfile.email)}&background=8A2BE2&color=fff&size=128`}" alt="Avatar" id="avatar-preview">
                    <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                </div>
                <div class="profile-header-info">
                    <h2 class="profile-name-display">${currentUserProfile.full_name || 'مستخدم'} ${roleBadge}</h2>
                    <p class="profile-email-display">${currentUserProfile.email || ''}</p>
                </div>
            </div>
    
            <div class="form-container" style="max-width: 800px;">
                <form id="profile-settings-form">
                    ${currentUserProfile.role === 'admin' ? `
                        <h3 class="details-section-title">المعلومات الأساسية</h3>
                        <div class="details-grid" style="grid-template-columns: 1fr; gap: 20px;"><div class="form-group"><label for="profile-full-name">الاسم الكامل</label><input type="text" id="profile-full-name" class="profile-name-input" value="${currentUserProfile.full_name || ''}" required></div></div>
                    ` : ''}
                    
                    <h3 class="details-section-title">تغيير كلمة المرور</h3>
                    <div class="details-grid" style="grid-template-columns: 1fr; gap: 20px;">
                        <div class="form-group">
                            <label for="profile-current-password">كلمة المرور الحالية</label>
                            <div class="password-input-wrapper">
                                <input type="password" id="profile-current-password" placeholder="أدخل كلمة المرور الحالية للتغيير">
                                <button type="button" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                                <div id="current-password-validation-msg" class="validation-status-inline"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="profile-new-password">كلمة المرور الجديدة</label>
                            <div class="password-input-wrapper">
                                <input type="password" id="profile-new-password" placeholder="اتركه فارغاً لعدم التغيير">
                                <button type="button" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                            </div>
                            <div class="password-strength-meter"><div class="strength-bar"></div></div>
                            <div class="password-actions">
                                <button type="button" id="generate-password-btn" class="btn-secondary btn-small">إنشاء كلمة مرور قوية</button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="profile-confirm-password">تأكيد كلمة المرور الجديدة</label>
                            <div class="password-input-wrapper">
                                <input type="password" id="profile-confirm-password">
                                <button type="button" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                                <div id="password-match-error" class="validation-error-inline" style="display: none;">كلمتا المرور غير متطابقتين.</div>
                            </div>
                        </div>
                    </div>
    
                    <div class="form-actions">
                        <button type="submit" id="save-profile-settings-btn" class="btn-primary">
                            <i class="fas fa-save"></i> حفظ التغييرات
                        </button>
                    </div>
                </form>
            </div>
        `;
    
        const form = document.getElementById('profile-settings-form');
        const saveBtn = form.querySelector('#save-profile-settings-btn');
        const newPasswordInput = form.querySelector('#profile-new-password');
        const confirmPasswordInput = form.querySelector('#profile-confirm-password');
        const currentPasswordInput = form.querySelector('#profile-current-password');
        const validationMsgEl = form.querySelector('#current-password-validation-msg');
    
        // --- NEW: Real-time current password validation on blur ---
        currentPasswordInput.addEventListener('blur', async () => {
            const password = currentPasswordInput.value;
    
            // Clear previous message if input is empty
            if (!password) {
                validationMsgEl.innerHTML = '';
                validationMsgEl.className = 'validation-status-inline';
                return;
            }
    
            // Show a loading indicator
            validationMsgEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>جاري التحقق...</span>';
            validationMsgEl.className = 'validation-status-inline checking';
    
            try {
                // TODO: Implement a backend endpoint to verify current password
                // For now, this will always fail or succeed based on a placeholder
                const response = await authedFetch('/api/auth/verify-password', {
                    method: 'POST',
                    body: JSON.stringify({ password: password })
                });
                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.message || 'كلمة المرور الحالية غير صحيحة.');
                    validationMsgEl.innerHTML = '<i class="fas fa-times-circle"></i> <span>كلمة المرور الحالية غير صحيحة.</span>';
                    validationMsgEl.className = 'validation-status-inline error';
                } else {
                    validationMsgEl.innerHTML = '<i class="fas fa-check-circle"></i> <span>كلمة المرور صحيحة.</span>';
                    validationMsgEl.className = 'validation-status-inline success';
                }
            } catch (e) {
                validationMsgEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>حدث خطأ أثناء التحقق.</span>';
                validationMsgEl.className = 'validation-status-inline error';
            }
        });
    
        // --- Avatar Logic ---
        const avatarUploadInput = document.getElementById('avatar-upload');
        const avatarPreview = document.getElementById('avatar-preview');
        const avatarEditContainer = document.querySelector('.profile-settings-header .profile-avatar-edit');
    
        if (avatarEditContainer) {
            avatarEditContainer.addEventListener('click', () => {
                if (currentUserProfile.role === 'admin') {
                    avatarUploadInput.click();
                }
            });
        }
        if (avatarUploadInput) {
            avatarUploadInput.addEventListener('change', () => {
                const file = avatarUploadInput.files[0];
                if (file) avatarPreview.src = URL.createObjectURL(file);
            });
        }
    
        // --- Password Toggles & Strength Meter ---
        form.querySelectorAll('.password-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = btn.closest('.password-input-wrapper').querySelector('input');
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                btn.querySelector('i').className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'}`;
            });
        });
        const strengthBar = form.querySelector('.strength-bar');
        newPasswordInput.addEventListener('input', () => {
            const password = newPasswordInput.value;
            let strength = 0;
            if (password.length >= 8) strength++;
            if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
            if (password.match(/\d/)) strength++;
            if (password.match(/[^a-zA-Z\d]/)) strength++;
            strengthBar.className = 'strength-bar';
            if (strength > 0) strengthBar.classList.add(`strength-${strength}`);
        });
    
        // --- Generate Password Button ---
        const generatePasswordBtn = form.querySelector('#generate-password-btn');
        if (generatePasswordBtn) {
            generatePasswordBtn.addEventListener('click', () => {
                const lower = 'abcdefghijklmnopqrstuvwxyz';
                const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const numbers = '0123456789';
                const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
                const all = lower + upper + numbers + symbols;
                let newPassword = '';
                newPassword += lower.charAt(Math.floor(Math.random() * lower.length));
                newPassword += upper.charAt(Math.floor(Math.random() * upper.length));
                newPassword += numbers.charAt(Math.floor(Math.random() * numbers.length));
                newPassword += symbols.charAt(Math.floor(Math.random() * symbols.length));
                for (let i = newPassword.length; i < 14; i++) {
                    newPassword += all.charAt(Math.floor(Math.random() * all.length));
                }
                newPassword = newPassword.split('').sort(() => 0.5 - Math.random()).join('');
                newPasswordInput.value = newPassword;
                confirmPasswordInput.value = newPassword;
                newPasswordInput.dispatchEvent(new Event('input')); // Trigger strength check
                navigator.clipboard.writeText(newPassword).then(() => {
                    showToast('تم إنشاء ونسخ كلمة مرور قوية.', 'success');
                });
            });
        }
    
        // --- Real-time password match validation ---
        const passwordMatchError = form.querySelector('#password-match-error');
        const validatePasswordMatch = () => {
            if (newPasswordInput.value && confirmPasswordInput.value && newPasswordInput.value !== confirmPasswordInput.value) {
                passwordMatchError.style.display = 'block';
                saveBtn.disabled = true;
            } else {
                passwordMatchError.style.display = 'none';
                saveBtn.disabled = false;
            }
        };
        newPasswordInput.addEventListener('input', validatePasswordMatch);
        confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    
        // --- Disable form elements for non-admins ---
        if (currentUserProfile.role !== 'admin') {
            const fullNameInput = form.querySelector('#profile-full-name');
            if (fullNameInput) fullNameInput.disabled = true;
            avatarEditContainer.style.cursor = 'not-allowed';
            avatarEditContainer.title = 'لا يمكنك تغيير الصورة الشخصية.';
        }
    
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
    
            // --- Submission Logic ---
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    
            const fullNameInput = document.getElementById('profile-full-name');
            const fullName = fullNameInput ? fullNameInput.value : currentUserProfile.full_name;
            const newPassword = newPasswordInput.value; // FIX: Define newPassword variable
            const confirmPassword = document.getElementById('profile-confirm-password').value;
            const currentPassword = document.getElementById('profile-current-password').value;
    
            try {
                // --- Password Validation ---
                if (newPassword && !currentPassword) {
                    throw new Error('يجب إدخال كلمة المرور الحالية لتغييرها.');
                }
                if (newPassword !== confirmPassword) {
                    throw new Error('كلمتا المرور الجديدتان غير متطابقتين.');
                }
    
                // 1. Handle avatar upload if a new file is selected
                const avatarFile = document.getElementById('avatar-upload').files[0];
                let newAvatarUrl = currentUserProfile.avatar_url;
    
                if (avatarFile) {
                    // TODO: Implement backend endpoint for avatar upload
                    // For now, this will be a placeholder
                    console.warn('Avatar upload is not yet implemented in the new backend.');
                    if (true) { // Simulate an error for now
                        throw new Error('فشل رفع الصورة. يرجى المحاولة مرة أخرى.');
                    }
    
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    newAvatarUrl = urlData.publicUrl;
                }
    
                // 2. Update public profile table (users)
                const profileUpdateData = { avatar_url: newAvatarUrl };
                if (currentUserProfile.role === 'admin' && fullNameInput) {
                    profileUpdateData.full_name = fullName;
                }
    
                // TODO: Implement backend endpoint for updating user profile
                const response = await authedFetch(`/api/users/${currentUserProfile._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(profileUpdateData)
                });
                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.message || 'فشل تحديث الملف الشخصي.');
                }
    
    
                // 3. If a new password is provided, verify old and update in auth
                if (newPassword && currentPassword) {
                    // TODO: Implement backend endpoint for changing password
                    console.warn('Password change is not yet implemented in the new backend.');
                    if (true) throw new Error('تغيير كلمة المرور غير متاح حالياً.'); // Simulate error
                }
    
                // 4. Refresh local user profile data to reflect changes
                await fetchUserProfile();
    
                showToast('تم تحديث الملف الشخصي بنجاح.', 'success');
    
                // NEW: If password was changed, clear fields and hide the section
                if (newPassword) {
                    currentPasswordInput.value = '';
                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';
                    validationMsgEl.innerHTML = '';
                    validationMsgEl.className = 'validation-status-inline';
                    form.querySelector('#password-match-error').style.display = 'none';
                    form.querySelector('.strength-bar').className = 'strength-bar';
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                showToast(`فشل تحديث الملف الشخصي: ${error.message}`, 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التغييرات';
            }
        });
    }

    // == tasks.js ==
    // Refactored Tasks Page: Decoupled from Calendar, reliant solely on taskStore.
    (function() {
        // --- Constants and Configuration ---
        const CLASSIFICATIONS = ['R', 'A', 'B', 'C'];
        const OPEN_GROUPS_KEY = 'openTaskGroups';
    
        // --- UI Rendering Functions ---
    
        function getTaskCardHtml(agent, task) {
            const avatarHtml = agent.avatar_url
                ? `<img src="${agent.avatar_url}" alt="Avatar" class="task-agent-avatar" loading="lazy">`
                : `<div class="task-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;
    
            const isAudited = task.audited;
            const isCompetitionSent = task.competition_sent;
            const isComplete = isAudited; // Main completion logic
    
            const depositBonusText = (agent.remaining_deposit_bonus > 0 && agent.deposit_bonus_percentage > 0)
                ? `${agent.remaining_deposit_bonus} ${agent.remaining_deposit_bonus === 1 ? 'مرة' : 'مرات'} بنسبة ${agent.deposit_bonus_percentage}%`
                : 'لا يوجد';
    
            return `
            <div class="task-card ${isComplete ? 'complete' : ''}" data-agent-id="${agent._id}" data-name="${agent.name.toLowerCase()}" data-original-name="${agent.name}" data-agentid-str="${agent.agent_id}">
                <div class="task-card-header" style="cursor: pointer;">
                    <div class="task-card-main">
                        ${avatarHtml}
                        <div class="task-agent-info">
                            <h3 class="${isComplete ? 'has-checkmark' : ''}">${agent.name}<i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i></h3>
                            <p class="task-agent-id" title="نسخ الرقم">${agent.agent_id}</p>
                        </div>
                    </div>
                    <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                </div>
                <div class="task-card-body">
                    <div class="task-stat">
                        <label>الرصيد التداولي:</label>
                        <span>${agent.remaining_balance || 0}</span>
                    </div>
                    <div class="task-stat">
                        <label>بونص الإيداع:</label>
                        <span>${depositBonusText}</span>
                    </div>
                </div>
                <div class="task-card-actions">
                    <div class="action-item ${isAudited ? 'done' : ''}">
                        <label>التدقيق</label>
                        <label class="custom-checkbox toggle-switch">
                            <input type="checkbox" class="audit-check" data-agent-id="${agent._id}" ${isAudited ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                    <div class="action-item ${isAudited && isCompetitionSent ? 'done' : ''}">
                        <label>المسابقة</label>
                        <label class="custom-checkbox toggle-switch">
                            <input type="checkbox" class="competition-check" data-agent-id="${agent._id}" ${isCompetitionSent ? 'checked' : ''} ${!isAudited ? 'disabled' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
            </div>`;
        }
    
        function getTaskGroupHtml(classification, agents, tasksMap, openGroups, highlightedAgentId) {
            if (agents.length === 0) return '';
    
            const completedCount = agents.filter(agent => (tasksMap[agent._id] || {}).audited).length;
            const allComplete = completedCount === agents.length;
            const containsHighlight = highlightedAgentId && agents.some(agent => agent._id == highlightedAgentId);
            const isOpen = openGroups.includes(classification) || containsHighlight;
    
            const agentCardsHtml = agents.map(agent => getTaskCardHtml(agent, tasksMap[agent._id] || {})).join('');
    
            return `
            <details class="task-group ${allComplete ? 'all-complete' : ''}" data-classification="${classification}" ${isOpen ? 'open' : ''}>
                <summary class="task-group-header">
                    <div class="task-group-title">
                        <h2>${classification}</h2>
                        <span class="task-group-progress">${completedCount} / ${agents.length}</span>
                    </div>
                    <div class="task-group-bulk-actions">
                        <label class="custom-checkbox small"><input type="checkbox" class="bulk-audit-check" data-classification="${classification}">
                            <span class="checkmark"></span> تدقيق الكل
                        </label>
                        <label class="custom-checkbox small"><input type="checkbox" class="bulk-competition-check" data-classification="${classification}">
                            <span class="checkmark"></span> مسابقة الكل
                        </label>
                    </div>
                    <div class="task-group-indicators">
                        <i class="fas fa-check-circle group-completion-indicator" title="اكتملت جميع المهام في هذا القسم"></i>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                </summary>
                <div class="task-group-content">${agentCardsHtml}</div>
            </details>`;
        }
    
        function getPageLayoutHtml() {
            return `
            <div class="page-header column-header">
                <div class="header-top-row">
                    <h1>مهمات اليوم</h1>
                    <div class="header-actions-group">
                        <button id="mark-all-audited-btn" class="btn-primary">
                            <i class="fas fa-check-double"></i> تمييز الكل كـ "تم التدقيق"
                        </button>
                    </div>
                </div>
                <div class="agent-filters">
                    <div class="filter-search-container">
                        <input type="search" id="task-search-input" placeholder="بحث بالاسم أو الرقم..." autocomplete="off">
                        <i class="fas fa-search"></i>
                        <i class="fas fa-times-circle search-clear-btn" id="task-search-clear"></i>
                    </div>
                </div>
            </div>
            <div id="tasks-content-wrapper"></div>`;
        }
    
        function getOverviewHtml(agents, tasksMap) {
            const total = agents.length;
            const completed = agents.filter(agent => (tasksMap[agent._id] || {}).audited).length;
            const progress = total > 0 ? (completed / total) * 100 : 0;
    
            return `
            <div class="tasks-overview" id="tasks-overview">
                <div class="progress-donut-chart" style="--p:${progress};--b:10px;--c:var(--primary-color);">
                    <span>${Math.round(progress)}%</span>
                </div>
                <div class="overview-stats">
                    <div class="overview-stat-item" data-stat="total">
                        <h3>${total}</h3>
                        <p><i class="fas fa-tasks"></i> إجمالي مهام اليوم</p>
                    </div>
                    <div class="overview-stat-item" data-stat="completed">
                        <h3>${completed}</h3>
                        <p><i class="fas fa-check-double"></i> مهام مكتملة</p>
                    </div>
                    <div class="overview-stat-item" data-stat="pending">
                        <h3>${total - completed}</h3>
                        <p><i class="fas fa-hourglass-half"></i> مهام متبقية</p>
                    </div>
                </div>
            </div>`;
        }
    
    
        // --- Main Page Class ---
    
        class TasksPage {
            constructor(container) {
                this.container = container;
                this.agents = [];
                this.tasksMap = {};
                this.dayIndex = new Date().getDay();
                this.searchDebounceTimer = null;
    
                // Bind methods
                this.boundHandleEvents = this.handleEvents.bind(this);
            }
    
            async render() {
                this.container.innerHTML = getPageLayoutHtml();
                this.contentWrapper = this.container.querySelector('#tasks-content-wrapper');
                
                this.setupEventListeners();
                
                // FIX: Subscription removed to prevent buggy global UI updates.
                // window.taskStore.subscribe(this.boundUpdateUIFromStore);
    
                await this.fetchAndRenderTasks();
            }
    
            async fetchAndRenderTasks() {
                if (this.dayIndex === 6) { // Saturday
                    this.contentWrapper.innerHTML = '<p class="no-results-message">لا توجد مهام مجدولة في أيام العطلات.</p>';
                    return;
                }
    
                try {
                    const response = await authedFetch('/api/tasks/today');
                    if (!response.ok) throw new Error('Failed to fetch tasks');
                    
                    const { agents, tasksMap } = await response.json();
                    this.agents = agents || [];
                    this.tasksMap = tasksMap || {};
    
                    this.renderAllContent();
    
                } catch (error) {
                    console.error("Error fetching tasks:", error);
                    this.contentWrapper.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات المهام.</p>`;
                }
            }
    
            renderAllContent() {
                if (this.agents.length === 0) {
                    this.contentWrapper.innerHTML = '<p class="no-results-message">لا توجد مهام مجدولة لهذا اليوم.</p>';
                    return;
                }
    
                const groupedAgents = CLASSIFICATIONS.reduce((acc, c) => {
                    acc[c] = this.agents.filter(a => a.classification === c);
                    return acc;
                }, {});
    
                const openGroups = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY)) || ['R', 'A'];
                const highlightedAgentId = new URLSearchParams(window.location.hash.split('?')[1]).get('highlight');
    
                const overviewHtml = getOverviewHtml(this.agents, this.tasksMap);
                const groupsHtml = CLASSIFICATIONS.map(c => 
                    getTaskGroupHtml(c, groupedAgents[c], this.tasksMap, openGroups, highlightedAgentId)
                ).join('');
    
                this.contentWrapper.innerHTML = `${overviewHtml}<div id="task-list-container">${groupsHtml}</div>`;
                
                this.highlightCard(highlightedAgentId);
            }
    
            highlightCard(agentId) {
                if (!agentId) return;
                const card = this.contentWrapper.querySelector(`.task-card[data-agent-id="${agentId}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.classList.add('highlighted');
                }
                // Clean the URL
                history.replaceState(null, '', '#tasks');
            }
    
            setupEventListeners() {
                this.container.addEventListener('click', this.boundHandleEvents);
                this.container.addEventListener('change', this.boundHandleEvents);
                
                const searchInput = this.container.querySelector('#task-search-input');
                searchInput.addEventListener('input', () => {
                    clearTimeout(this.searchDebounceTimer);
                    this.searchDebounceTimer = setTimeout(() => this.filterAgents(searchInput.value), 300);
                });
                
                this.container.querySelector('#task-search-clear').addEventListener('click', () => {
                    searchInput.value = '';
                    this.filterAgents('');
                });
            }
    
            async handleEvents(e) {
                const target = e.target;
                const agentCard = target.closest('.task-card');
                const agentId = agentCard?.dataset.agentId;
    
                // --- Change Events (Toggles) ---
                if (e.type === 'change') {
                    const taskType = target.classList.contains('audit-check') ? 'audited' 
                                   : target.classList.contains('competition-check') ? 'competition_sent' 
                                   : null;
                    if (agentId && taskType) {
                        agentCard.classList.add('is-loading');
                        agentCard.querySelectorAll('input').forEach(i => i.disabled = true);
                        try {
                            await window.taskStore.updateTaskStatus(agentId, this.dayIndex, taskType, target.checked);
                            this.updateSingleCard(agentId); // FIX: Targeted UI update
                        } catch (error) {
                            console.error('Failed to update task', error);
                            showToast('فشل تحديث المهمة.', 'error');
                            target.checked = !target.checked; // Revert on error
                        } finally {
                            agentCard.classList.remove('is-loading');
                            // Re-enable controls, considering dependencies
                            const isAudited = agentCard.querySelector('.audit-check').checked;
                            agentCard.querySelector('.audit-check').disabled = false;
                            const compCheck = agentCard.querySelector('.competition-check');
                            if(compCheck) compCheck.disabled = !isAudited;
                        }
                        return;
                    }
    
                    const bulkTaskType = target.classList.contains('bulk-audit-check') ? 'audited' 
                                       : target.classList.contains('bulk-competition-check') ? 'competition_sent' 
                                       : null;
                    if (bulkTaskType) {
                        this.handleBulkUpdate(target.dataset.classification, bulkTaskType, target.checked);
                        return;
                    }
                }
    
                // --- Click Events ---
                if (e.type === 'click') {
                    if (target.closest('.task-card-header')) {
                        window.location.hash = `#profile/${agentId}`;
                        return;
                    }
                    if (target.id === 'mark-all-audited-btn') {
                        this.handleMarkAllAudited();
                        return;
                    }
                    if (target.closest('.task-group-header')) {
                        this.saveOpenGroupsState();
                        return;
                    }
                }
            }
    
            handleBulkUpdate(classification, taskType, status) {
                showLoader();
                const agentsToUpdate = this.agents.filter(a => a.classification === classification);
                const promises = agentsToUpdate.map(agent => 
                    window.taskStore.updateTaskStatus(agent._id, this.dayIndex, taskType, status)
                );
    
                Promise.all(promises)
                    .then(() => {
                        showToast(`تم تحديث ${agentsToUpdate.length} وكلاء بنجاح.`, 'success');
                        this.fetchAndRenderTasks(); // FIX: Refresh UI after bulk update
                    })
                    .catch(err => {
                        console.error('Bulk update failed:', err);
                        showToast('فشل تحديث بعض الوكلاء.', 'error');
                    })
                    .finally(hideLoader);
            }
    
            handleMarkAllAudited() {
                showConfirmationModal('هل أنت متأكد من تمييز جميع المهام كـ "تم التدقيق"؟', () => {
                    showLoader();
                    const promises = this.agents.map(agent => 
                        window.taskStore.updateTaskStatus(agent._id, this.dayIndex, 'audited', true)
                    );
    
                    Promise.all(promises)
                        .then(() => {
                            showToast('تم تحديث جميع المهام بنجاح.', 'success');
                            this.fetchAndRenderTasks(); // FIX: Refresh UI after bulk update
                        })
                        .catch(err => {
                            console.error('Mark all audited failed:', err);
                            showToast('فشل تحديث بعض المهام.', 'error');
                        })
                        .finally(hideLoader);
                });
            }
            
            filterAgents(searchTerm) {
                const term = searchTerm.toLowerCase().trim();
                const taskListContainer = this.container.querySelector('#task-list-container');
                if (!taskListContainer) return;
    
                this.agents.forEach(agent => {
                    const card = taskListContainer.querySelector(`.task-card[data-agent-id="${agent._id}"]`);
                    if (!card) return;
    
                    const isVisible = term === '' || 
                                      agent.name.toLowerCase().includes(term) || 
                                      agent.agent_id.includes(term);
                    card.style.display = isVisible ? '' : 'none';
                });
    
                // Update group visibility and progress
                CLASSIFICATIONS.forEach(c => {
                    const groupEl = taskListContainer.querySelector(`.task-group[data-classification="${c}"]`);
                    if (!groupEl) return;
    
                    const visibleCards = groupEl.querySelectorAll('.task-card[style=""]');
                    groupEl.style.display = visibleCards.length > 0 ? '' : 'none';
                });
            }
    
            saveOpenGroupsState() {
                const openGroups = Array.from(this.container.querySelectorAll('.task-group[open]'))
                                        .map(el => el.dataset.classification);
                localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(openGroups));
            }
    
            updateSingleCard(agentId) {
                this.tasksMap = window.taskStore.state.tasks || {}; // Refresh state
                const card = this.container.querySelector(`.task-card[data-agent-id="${agentId}"]`);
                if (!card) return;
    
                const task = (this.tasksMap[agentId] || {})[this.dayIndex] || {};
                const isAudited = task.audited;
                const isCompetitionSent = task.competition_sent;
                const isComplete = isAudited;
    
                card.classList.toggle('complete', isComplete);
                card.querySelector('.task-agent-info h3').classList.toggle('has-checkmark', isComplete);
                
                const auditCheck = card.querySelector('.audit-check');
                const competitionCheck = card.querySelector('.competition-check');
                if (auditCheck) auditCheck.checked = isAudited;
                if (competitionCheck) {
                    competitionCheck.checked = isCompetitionSent;
                    competitionCheck.disabled = !isAudited;
                }
    
                auditCheck?.closest('.action-item').classList.toggle('done', isAudited);
                competitionCheck?.closest('.action-item').classList.toggle('done', isAudited && isCompetitionSent);
    
                // Update group and overview stats since a card changed
                this.updateAllGroupProgress();
                this.updateOverview();
            }
    
            updateAllGroupProgress() {
                CLASSIFICATIONS.forEach(c => {
                    const groupEl = this.container.querySelector(`.task-group[data-classification="${c}"]`);
                    if (!groupEl) return;
    
                    const groupAgents = this.agents.filter(a => a.classification === c);
                    const completedCount = groupAgents.filter(a => (this.tasksMap[a._id] || {})[this.dayIndex]?.audited).length;
                    
                    groupEl.querySelector('.task-group-progress').textContent = `${completedCount} / ${groupAgents.length}`;
                    groupEl.classList.toggle('all-complete', completedCount === groupAgents.length);
                });
            }
    
            updateOverview() {
                const overviewEl = this.container.querySelector('#tasks-overview');
                if (!overviewEl) return;
    
                const total = this.agents.length;
                const completed = this.agents.filter(a => (this.tasksMap[a._id] || {})[this.dayIndex]?.audited).length;
                const progress = total > 0 ? (completed / total) * 100 : 0;
    
                overviewEl.querySelector('.progress-donut-chart').style.setProperty('--p', progress);
                overviewEl.querySelector('.progress-donut-chart span').textContent = `${Math.round(progress)}%`;
                overviewEl.querySelector('[data-stat="total"] h3').textContent = total;
                overviewEl.querySelector('[data-stat="completed"] h3').textContent = completed;
                overviewEl.querySelector('[data-stat="pending"] h3').textContent = total - completed;
            }
    
            destroy() {
                console.log('[Tasks Page] Destroying instance and cleaning up listeners.');
                this.container.removeEventListener('click', this.boundHandleEvents);
                this.container.removeEventListener('change', this.boundHandleEvents);
                clearTimeout(this.searchDebounceTimer);
                
                // FIX: Subscription removed
                if (window.taskStore && this.boundUpdateUIFromStore) {
                    window.taskStore.unsubscribe(this.boundUpdateUIFromStore);
                }
            }
        }
    
        window.TasksPage = TasksPage;
    })();

    // == addAgent.js ==
    const RANKS_DATA = {
        // الاعتيادية
        'BEGINNING': { competition_bonus: 60, deposit_bonus_percentage: null, deposit_bonus_count: null },
        'GROWTH': { competition_bonus: 100, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
        'PRO': { competition_bonus: 150, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
        'ELITE': { competition_bonus: 200, deposit_bonus_percentage: 50, deposit_bonus_count: 4 },
        // الحصرية
        'CENTER': { competition_bonus: 300, deposit_bonus_percentage: null, deposit_bonus_count: null },
        'BRONZE': { competition_bonus: 150, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
        'SILVER': { competition_bonus: 230, deposit_bonus_percentage: 40, deposit_bonus_count: 3 },
        'GOLD': { competition_bonus: 300, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
        'PLATINUM': { competition_bonus: 500, deposit_bonus_percentage: 60, deposit_bonus_count: 4 },
        'DIAMOND': { competition_bonus: 800, deposit_bonus_percentage: 75, deposit_bonus_count: 4 },
        'SAPPHIRE': { competition_bonus: 1100, deposit_bonus_percentage: 85, deposit_bonus_count: 4 },
        'EMERALD': { competition_bonus: 2000, deposit_bonus_percentage: 90, deposit_bonus_count: 4 },
        'KING': { competition_bonus: 2500, deposit_bonus_percentage: 95, deposit_bonus_count: 4 },
        'LEGEND': { competition_bonus: Infinity, deposit_bonus_percentage: 100, deposit_bonus_count: Infinity },
        'وكيل حصري بدون مرتبة': { competition_bonus: 60, deposit_bonus_percentage: null, deposit_bonus_count: null },
    };
    
    function renderAddAgentForm() {
        const hash = window.location.hash;
        const urlParams = new URLSearchParams(hash.split('?')[1]);
        const returnPage = urlParams.get('returnTo') || 'manage-agents';
    
        const appContent = document.getElementById('app-content');
        appContent.innerHTML = `
            <div class="page-header"><h1><i class="fas fa-user-plus"></i> إضافة وكيل جديد</h1></div>
            <div class="form-container-v2">
                <form id="add-agent-form">
                    <div class="form-section avatar-section">
                        <div class="profile-avatar-edit large-avatar">
                            <img src="https://ui-avatars.com/api/?name=?&background=8A2BE2&color=fff&size=128" alt="Avatar" id="avatar-preview">
                            <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                        </div>
                    </div>
    
                    <div class="form-section">
                        <h3 class="details-section-title"><i class="fas fa-id-card"></i> المعلومات الأساسية</h3>
                        <div class="details-grid">
                            <div class="form-group"><label for="agent-name">اسم الوكيل</label><input type="text" id="agent-name" required></div>
                            <div class="form-group">
                                <label for="agent-id">رقم الوكالة</label><input type="text" id="agent-id" required>
                                <div id="agent-id-validation" class="validation-message"></div>
                            </div>
                        </div>
                    </div>
    
                    <div class="form-section">
                        <h3 class="details-section-title"><i class="fab fa-telegram-plane"></i> بيانات التلجرام</h3>
                        <div class="details-grid">
                            <div class="form-group"><label for="telegram-channel-url">رابط قناة التلجرام</label><input type="text" id="telegram-channel-url"></div>
                            <div class="form-group"><label for="telegram-group-url">رابط جروب التلجرام</label><input type="text" id="telegram-group-url"></div>
                            <div class="form-group"><label for="telegram-chat-id">معرف الدردشة (Chat ID)</label><input type="text" id="telegram-chat-id" placeholder="مثال: -100123456789"></div>
                            <div class="form-group"><label for="telegram-group-name">اسم مجموعة التلجرام</label><input type="text" id="telegram-group-name"></div>
                        </div>
                    </div>
    
                    <div class="form-section">
                        <h3 class="details-section-title"><i class="fas fa-cogs"></i> إعدادات النظام</h3>
                        <div class="details-grid">
                            <div class="form-group">
                                <label for="agent-classification">التصنيف</label>
                                <select id="agent-classification"><option value="R">R</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
                            </div>
                            <div class="form-group">
                                <label for="agent-rank">المرتبة</label>
                                <select id="agent-rank">
                                    <optgroup label="⁕ مراتب الوكلاء الاعتيادية ⁖">
                                        ${Object.keys(RANKS_DATA).filter(r => ['BEGINNING', 'GROWTH', 'PRO', 'ELITE'].includes(r)).map((rank, index) => `<option value="${rank}" ${index === 0 ? 'selected' : ''}>🔸 ${rank}</option>`).join('')}
                                    </optgroup>
                                    <optgroup label="⁕ مراتب الوكالة الحصرية ⁖">
                                        <option value="وكيل حصري بدون مرتبة">⭐ وكيل حصري بدون مرتبة</option>
                                        <option disabled>──────────</option>
                                        ${Object.keys(RANKS_DATA).filter(r => ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'SAPPHIRE', 'EMERALD', 'KING', 'LEGEND'].includes(r)).map(rank => `<option value="${rank}">⭐ ${rank}</option>`).join('')}
                                    </optgroup>
                                    <optgroup label="⁕ المراكز ⁖">
                                        <option value="CENTER">🏢 CENTER</option>
                                    </optgroup>
                                </select>
                                <div id="rank-hint" class="form-hint">
                                    <!-- Rank details will be shown here -->
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="agent-renewal-period">فترة تجديد الرصيد</label>
                                <select id="agent-renewal-period">
                                    <option value="none" selected>بدون تجديد</option>
                                    <option value="weekly">أسبوعي</option>
                                    <option value="biweekly">كل أسبوعين</option>
                                    <option value="monthly">شهري</option>
                                </select>
                            </div>
                            <div class="form-group" id="competitions-per-week-group">
                                <label for="agent-competitions-per-week">عدد المسابقات كل أسبوع</label>
                                <select id="agent-competitions-per-week">
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group" style="margin-top: 20px;">
                            <label style="margin-bottom: 10px;">أيام التدقيق</label>
                            <div class="days-selector-v2">
                                ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day, index) => `
                                    <div class="day-toggle-wrapper">
                                        <input type="checkbox" id="day-${index}" value="${index}" class="day-toggle-input">
                                        <label for="day-${index}" class="day-toggle-btn">${day}</label>
                                    </div>`).join('')}
                            </div>
                        </div>
                    </div>
    
                    <div class="form-actions-v2">
                        <button type="submit" id="save-agent-btn" class="btn-primary">حفظ الوكيل</button>
                        <button type="button" id="cancel-add-agent" class="btn-secondary">إلغاء</button>
                    </div>
                </form>
            </div>
        `;
    
        // --- الاقتراح: ربط عدد المسابقات الأسبوعية بالتصنيف تلقائياً ---
        const classificationSelect = document.getElementById('agent-classification');
        const competitionsGroup = document.getElementById('competitions-per-week-group');
        const competitionsPerWeekSelect = document.getElementById('agent-competitions-per-week');
    
        const updateCompetitionsPerWeek = () => {
            const classification = classificationSelect.value;
            if (classification === 'R' || classification === 'A') {
                competitionsPerWeekSelect.value = '2';
            } else if (classification === 'B' || classification === 'C') {
                competitionsPerWeekSelect.value = '1';
            }
        };
    
        classificationSelect.addEventListener('change', updateCompetitionsPerWeek);
        // --- MODIFICATION: Call the function on page load to set the initial value and ensure visibility ---
        updateCompetitionsPerWeek();
        // Avatar preview logic
        const avatarUploadInput = document.getElementById('avatar-upload');
        const avatarPreview = document.getElementById('avatar-preview');
        const avatarContainer = avatarPreview.closest('.profile-avatar-edit');
    
        if (avatarContainer) {
            avatarContainer.addEventListener('click', () => avatarUploadInput.click());
        }
    
        avatarUploadInput.addEventListener('change', () => {
            const file = avatarUploadInput.files[0];
            if (file) {
                avatarPreview.src = URL.createObjectURL(file);
            }
        });
    
        // --- الاقتراح أ: التحقق الفوري من رقم الوكالة ---
        const agentIdInput = document.getElementById('agent-id');
        const agentIdValidation = document.getElementById('agent-id-validation');
        agentIdInput.addEventListener('blur', async () => {
            const agentId = agentIdInput.value.trim();
            if (!agentId) {
                agentIdValidation.innerHTML = '';
                agentIdInput.classList.remove('invalid');
                return;
            }
            agentIdValidation.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';
            // --- STEP 3: MIGRATION TO CUSTOM BACKEND ---
            const response = await authedFetch(`/api/agents/check-uniqueness?agent_id=${agentId}`);
            const { exists, error } = await response.json();
    
            if (error) {
                agentIdValidation.innerHTML = '<span class="error-text">خطأ في التحقق</span>';
            } else if (exists) {
                agentIdValidation.innerHTML = '<span class="error-text"><i class="fas fa-times-circle"></i> رقم الوكالة مستخدم بالفعل</span>';
                agentIdInput.classList.add('invalid');
            } else {
                agentIdValidation.innerHTML = '<span class="success-text"><i class="fas fa-check-circle"></i> الرقم متاح</span>';
                agentIdInput.classList.remove('invalid');
            }
        });
    
        // --- الاقتراح ب: إظهار تلميح عند اختيار المرتبة ---
        const rankSelect = document.getElementById('agent-rank');
        const rankHint = document.getElementById('rank-hint');
        const updateRankHint = () => {
            const rank = rankSelect.value;
            const rankData = RANKS_DATA[rank] || {};
            let hintText = '';
            if (rankData.competition_bonus) {
                const bonus = rankData.competition_bonus === Infinity ? 'غير محدود' : `$${rankData.competition_bonus}`;
                hintText += `💰 بونص المسابقات: <strong>${bonus}</strong>`;
            }
            if (rankData.deposit_bonus_count) {
                const count = rankData.deposit_bonus_count === Infinity ? 'غير محدود' : rankData.deposit_bonus_count;
                hintText += ` | 🎁 بونص الإيداع: <strong>${count} مرات</strong> بنسبة <strong>${rankData.deposit_bonus_percentage}%</strong>`;
            }
            if (hintText) {
                rankHint.innerHTML = hintText;
                rankHint.style.display = 'block';
            } else {
                rankHint.style.display = 'none';
            }
        };
    
        rankSelect.addEventListener('change', updateRankHint);
        updateRankHint(); // استدعاء أولي لعرض بيانات المرتبة الافتراضية
    
        document.getElementById('agent-name').addEventListener('input', (e) => {
            avatarPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(e.target.value) || '?'}&background=8A2BE2&color=fff&size=128`;
        });
    
        const cancelButton = document.getElementById('cancel-add-agent');
        cancelButton.addEventListener('click', () => {
            const nameInput = document.getElementById('agent-name');
            const idInput = document.getElementById('agent-id');
    
            if (nameInput.value.trim() !== '' || idInput.value.trim() !== '') {
                showConfirmationModal(
                    'توجد بيانات غير محفوظة. هل تريد المتابعة وإلغاء الإضافة؟',
                    () => {
                        window.location.hash = `#${returnPage}`;
                    }, {
                        title: 'تأكيد الإلغاء',
                        confirmText: 'نعم، إلغاء',
                        confirmClass: 'btn-danger'
                    });
            } else {
                window.location.hash = `#${returnPage}`;
            }
        });
    
        document.getElementById('add-agent-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            // The check is now implicit in the authedFetch call
    
            const rank = document.getElementById('agent-rank').value;
            const rankData = RANKS_DATA[rank] || {};
    
            // --- NEW: Calculate competition_duration based on competitions_per_week ---
            const competitionsPerWeek = parseInt(document.getElementById('agent-competitions-per-week').value, 10);
            let competitionDuration = '48h'; // Default
    
            // --- DEBUG: Log the value read from the form ---
            console.log(`[Add Agent Debug 1] Value for competitionsPerWeek from form: ${competitionsPerWeek}`);
    
            if (competitionsPerWeek === 2) {
                competitionDuration = '24h';
            } else if (competitionsPerWeek === 3) {
                // As 16h is not a standard option, we can default to 24h or handle as needed.
                competitionDuration = '24h';
            }
    
            const selectedDays = Array.from(document.querySelectorAll('.days-selector-v2 input:checked')).map(input => parseInt(input.value, 10));
    
            const newAgentData = {
                name: document.getElementById('agent-name').value,
                agent_id: document.getElementById('agent-id').value,
                classification: document.getElementById('agent-classification').value,
                audit_days: selectedDays,
                rank: rank,
                telegram_channel_url: document.getElementById('telegram-channel-url').value || null,
                telegram_group_url: document.getElementById('telegram-group-url').value || null,
                telegram_chat_id: document.getElementById('telegram-chat-id').value || null,
                telegram_group_name: document.getElementById('telegram-group-name').value || null,
                competition_bonus: rankData.competition_bonus,
                deposit_bonus_percentage: rankData.deposit_bonus_percentage,
                deposit_bonus_count: rankData.deposit_bonus_count,
                remaining_balance: rankData.competition_bonus,
                remaining_deposit_bonus: rankData.deposit_bonus_count,
                renewal_period: document.getElementById('agent-renewal-period').value,
                competitions_per_week: competitionsPerWeek, // --- FIX: Ensure this is added to the payload ---
                competition_duration: competitionDuration, // --- NEW: Add calculated duration ---
                prize_per_winner: 30, // --- NEW: Default prize per winner to $30 ---
            };
    
            // --- DEBUG: Log the created agent data object ---
            console.log('[Add Agent Debug 2] newAgentData object created:', newAgentData);
    
            // --- الاقتراح د: تأكيد قبل الحفظ ---
            const summaryHtml = `
                <div class="confirmation-summary-grid">
                    <div class="summary-item"><strong>الاسم:</strong> ${newAgentData.name}</div>
                    <div class="summary-item"><strong>رقم الوكالة:</strong> ${newAgentData.agent_id}</div>
                    <div class="summary-item"><strong>المرتبة:</strong> ${newAgentData.rank}</div>
                    <div class="summary-item"><strong>التصنيف:</strong> ${newAgentData.classification}</div>
                    <hr>
                    <div class="summary-item"><strong><i class="fas fa-cogs"></i> بيانات تلقائية:</strong></div>
                    <div class="summary-item"><strong>بونص المسابقات:</strong> ${newAgentData.competition_bonus === Infinity ? 'غير محدود' : `$${newAgentData.competition_bonus || 0}`}</div>
                    <div class="summary-item"><strong>بونص الإيداع:</strong> ${newAgentData.deposit_bonus_count === Infinity ? 'غير محدود' : (newAgentData.deposit_bonus_count || 0)} مرات بنسبة ${newAgentData.deposit_bonus_percentage || 0}%</div>
                    <div class="summary-item"><strong>مدة المسابقة:</strong> ${newAgentData.competition_duration}</div>
                    <div class="summary-item"><strong>عدد المسابقات أسبوعياً:</strong> ${newAgentData.competitions_per_week}</div>
                 </div>
                <p>هل أنت متأكد من أن البيانات صحيحة؟</p>
            `;
    
            // --- DEBUG: Log before showing confirmation modal ---
            console.log('[Add Agent Debug 3] Data before showing confirmation modal:', newAgentData);
    
            showConfirmationModal(
                summaryHtml,
                async () => {
                    await saveAgent(newAgentData);
                }, {
                    title: 'مراجعة بيانات الوكيل',
                    confirmText: 'نعم، حفظ',
                    confirmClass: 'btn-primary'
                }
            );
        });
    }
    
    async function saveAgent(newAgentData) {
        const saveBtn = document.getElementById('save-agent-btn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    
        // --- DEBUG: Log the data received by the saveAgent function ---
        console.log('[Add Agent Debug 4] Data received by saveAgent function:', newAgentData);
    
        // --- STEP 3: MIGRATION TO CUSTOM BACKEND ---
        try {
            const rank = newAgentData.rank;
            const rankData = RANKS_DATA[rank] || {};
    
            // إعادة حساب الأرصدة للتأكيد
            newAgentData.competition_bonus = rankData.competition_bonus;
            newAgentData.deposit_bonus_percentage = rankData.deposit_bonus_percentage;
            newAgentData.deposit_bonus_count = rankData.deposit_bonus_count;
            newAgentData.remaining_balance = rankData.competition_bonus;
            newAgentData.remaining_deposit_bonus = rankData.deposit_bonus_count;
            // --- FIX: Preserve competitions_per_week and competition_duration from the form ---
            // The original newAgentData object already has these values. We just need to make sure they are not overwritten.
            // No explicit re-assignment is needed if we don't nullify them.
            
            // --- إصلاح: منطق خاص لمرتبة "وكيل حصري بدون مرتبة" ---
            if (rank === 'وكيل حصري بدون مرتبة') {
                newAgentData.competition_bonus = 60;
                newAgentData.remaining_balance = 60;
                newAgentData.deposit_bonus_percentage = null;
                newAgentData.deposit_bonus_count = null;
                newAgentData.remaining_deposit_bonus = null;
            }
    
            // --- DEBUG: Log the final payload before sending to the server ---
            console.log('[Add Agent Debug 5] Final payload being sent to server:', newAgentData);
    
            // Send data to our new backend API
            const response = await authedFetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAgentData)
            });
    
            const result = await response.json();
    
            if (!response.ok) {
                throw new Error(result.message || 'فشل حفظ الوكيل.');
            }
    
            const insertedAgent = result.data;
    
            // TODO: Re-implement avatar upload. This will require a separate endpoint on the backend
            // that handles file uploads (e.g., using multer) and saves them to a folder or a cloud service like S3.
    
            await logAgentActivity(currentUserProfile?._id, insertedAgent._id, 'AGENT_CREATED', `تم إنشاء وكيل جديد: ${insertedAgent.name}.`);
            showToast('تمت إضافة الوكيل بنجاح!', 'success');
            window.allAgentsData = []; // مسح ذاكرة التخزين المؤقت للوكلاء لإعادة جلبها عند العودة
            // Use replace to avoid adding the 'add-agent' page to history
            const newUrl = window.location.pathname + window.location.search + `#profile/${insertedAgent._id}`; // Use _id from MongoDB
            window.location.replace(newUrl);
    
        } catch (error) {
            console.error('Error saving agent:', error);
            showToast(`فشل إضافة الوكيل: ${error.message}`, 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'حفظ الوكيل';
        }
    }
    
    function renderBulkAddAgentsModal() {
        const modalContent = `
            <div class="form-layout" style="gap: 15px;">
                <div class="form-group">
                    <label for="bulk-agents-data">
                        <i class="fas fa-paste"></i> الصق بيانات الوكلاء هنا
                    </label>
                    <p class="form-hint">
                        يجب أن تكون البيانات مفصولة بمسافة Tab (يمكنك نسخها من جدول Excel).<br>
                        الترتيب المطلوب للأعمدة: <strong>الاسم، رقم الوكالة، التصنيف، المرتبة، فترة التجديد، أيام التدقيق، رابط القناة، رابط الجروب، معرف الدردشة، اسم المجموعة، مدة المسابقة (24h أو 48h)</strong>
                    </p>
                    <textarea id="bulk-agents-data" rows="15" placeholder="مثال:\nأحمد علي\t12345\tR\tGrowth\tweekly\t1,3,5\thttps://t.me/channel\thttps://t.me/group\t-100123\tGroup Name\t48h"></textarea>
                </div>
            </div>
        `;
    
        showConfirmationModal(
            modalContent,
            () => {
                const data = document.getElementById('bulk-agents-data').value;
                handleBulkAddAgents(data);
            },
            {
                title: 'إضافة وكلاء دفعة واحدة',
                confirmText: 'بدء الإضافة',
                confirmClass: 'btn-primary',
                modalClass: 'modal-fullscreen'
            }
        );
    }
    
    async function handleBulkAddAgents(data) {
        const lines = data.trim().split('\n');
        if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
            showToast('لم يتم إدخال أي بيانات.', 'info');
            return;
        }
    
        const allParsedAgents = [];
        const errors = [];
        const validRenewalPeriods = ['none', 'weekly', 'biweekly', 'monthly'];
        
        // --- NEW: Create a lowercase to correct-case map for ranks ---
        const rankMap = Object.keys(RANKS_DATA).reduce((map, rank) => {
            map[rank.toLowerCase()] = rank;
            return map;
        }, {});
        // --- NEW: Mappings for Arabic input ---
        const renewalPeriodMap = {
            'اسبوع': 'weekly', 'أسبوعي': 'weekly',
            'اسبوعين': 'biweekly', 'كل أسبوعين': 'biweekly',
            'شهر': 'monthly', 'شهري': 'monthly',
            'بدون': 'none'
        };
        const auditDayMap = {
            'الاحد': 0, 'الأحد': 0,
            'الاثنين': 1, 'الإثنين': 1,
            'الثلاثاء': 2,
            'الاربعاء': 3, 'الأربعاء': 3,
            'الخميس': 4,
            'الجمعة': 5,
        };
    
        lines.forEach((line, index) => {
            // --- NEW: Skip empty lines ---
            if (!line.trim()) {
                return;
            }
    
            // --- IMPROVEMENT: Trim trailing empty fields to prevent errors from extra columns in Excel ---
            let fields = line.split('\t').map(f => f.trim());
            while (fields.length > 0 && fields[fields.length - 1] === '') {
                fields.pop();
            }
    
            if (fields.length < 4) { // At least Name, ID, Classification, Rank are required
                errors.push(`السطر ${index + 1}: عدد الحقول غير كافٍ.`);
                return;
            }
    
            const [
                name, agent_id, classification, rank, 
                renewal_period = 'none', 
                audit_days_str = '', 
                telegram_channel_url = '', 
                telegram_group_url = '', 
                telegram_chat_id = '', 
                telegram_group_name = '',
                competition_duration = null,
                competitions_per_week_str = ''] = fields; // --- NEW: Read competitions per week ---
    
            if (!name || !agent_id || !classification || !rank) { // --- IMPROVEMENT: More specific error message ---
                errors.push(`السطر ${index + 1}: الحقول الأساسية (الاسم، الرقم، التصنيف، المرتبة) مطلوبة.`);
                return;
            }
    
            const correctRank = rankMap[rank.toLowerCase()];
            if (!correctRank) {
                errors.push(`السطر ${index + 1}: المرتبة "${rank}" غير صالحة.`);
                return;
            }
    
            // --- NEW: Process renewal period with Arabic mapping ---
            const processedRenewalPeriod = renewalPeriodMap[renewal_period.toLowerCase()] || renewal_period.toLowerCase();
            if (!validRenewalPeriods.includes(processedRenewalPeriod)) {
                errors.push(`السطر ${index + 1}: فترة التجديد "${renewal_period}" غير صالحة.`);
                return;
            }
    
            // --- NEW: Process audit days with Arabic mapping ---
            const audit_days = audit_days_str
                .split(/[,/]/) // Split by comma or slash
                .map(dayName => auditDayMap[dayName.trim()])
                .filter(dayIndex => dayIndex !== undefined && dayIndex >= 0 && dayIndex <= 6);
    
            // --- MODIFIED: Validate and normalize competition_duration ---
            let processed_competition_duration = null;
            if (competition_duration) {
                // Normalize input: "24 h" -> "24h", "24" -> "24"
                const normalized = competition_duration.trim().replace(/\s/g, ''); 
                if (normalized.startsWith('24')) {
                    processed_competition_duration = '24h';
                } else if (normalized.startsWith('48')) {
                    processed_competition_duration = '48h'; // --- IMPROVEMENT: More specific error message ---
                } else {
                    errors.push(`السطر ${index + 1}: مدة المسابقة "${competition_duration}" غير صالحة. يجب أن تكون '24h' أو '48h'.`);
                    return;
                }
            }
    
            // --- NEW: Process competitions_per_week ---
            let competitions_per_week = parseInt(competitions_per_week_str, 10);
            if (isNaN(competitions_per_week)) {
                // If not provided or invalid, set it automatically based on classification
                if (classification.toUpperCase() === 'R' || classification.toUpperCase() === 'A') {
                    competitions_per_week = 2;
                } else { // B or C
                    competitions_per_week = 1;
                }
            }
    
            // --- NEW: Calculate competition_duration based on competitions_per_week ---
            let competition_duration_calculated = '48h'; // Default
            if (competitions_per_week === 2) {
                competition_duration_calculated = '24h';
            } else if (competitions_per_week === 3) {
                competition_duration_calculated = '24h'; // Fallback for 16h
            }
            // If a duration is explicitly provided in the sheet, it will override the calculated one.
            const final_competition_duration = processed_competition_duration || competition_duration_calculated;
    
            const rankData = RANKS_DATA[correctRank];
            const newAgent = {
                name,
                agent_id,
                classification: classification.toUpperCase(),
                rank: correctRank,
                renewal_period: processedRenewalPeriod,
                audit_days,
                telegram_channel_url: telegram_channel_url || null,
                telegram_group_url: telegram_group_url || null,
                telegram_chat_id: telegram_chat_id || null,
                telegram_group_name: telegram_group_name || null,
                competition_bonus: rankData.competition_bonus || 0,
                deposit_bonus_percentage: rankData.deposit_bonus_percentage || 0,
                deposit_bonus_count: rankData.deposit_bonus_count || 0,
                remaining_balance: rankData.competition_bonus || 0,
                remaining_deposit_bonus: rankData.deposit_bonus_count || 0,
                consumed_balance: 0,
                used_deposit_bonus: 0,
                status: 'Active',
                competition_duration: final_competition_duration, // --- MODIFIED: Use the final duration ---
                competitions_per_week, // --- NEW: Add the processed value ---
            };
            allParsedAgents.push(newAgent);
        });
    
        if (errors.length > 0) {
            showToast(`تم العثور على ${errors.length} أخطاء في البيانات. يرجى تصحيحها والمحاولة مرة أخرى.`, 'error'); // --- IMPROVEMENT: More specific error message ---
            // Optionally, show a modal with all errors
            return;
        }
    
        // --- NEW: Logic to separate agents for insertion and update ---
        const uniqueAgentsMap = new Map();
        for (const agent of allParsedAgents) {
            // Use agent_id as the unique key to de-duplicate the input list, ensuring the last entry wins.
            uniqueAgentsMap.set(agent.agent_id, agent);
        }
        const uniqueAgents = Array.from(uniqueAgentsMap.values());
        const ignoredForInputDuplication = allParsedAgents.length - uniqueAgents.length;
    
        if (uniqueAgents.length === 0) {
            showToast('لا توجد بيانات صالحة للإضافة أو التحديث.', 'info');
            return;
        }
    
        // --- MODIFIED: Process in chunks to avoid overly long URLs ---
        const CHUNK_SIZE = 100; // Process 100 agents at a time
        let allExistingAgents = [];
        let checkError = null;
    
        // --- NEW: Check for existing agents against the database ---
        for (let i = 0; i < uniqueAgents.length; i += CHUNK_SIZE) {
            const chunk = uniqueAgents.slice(i, i + CHUNK_SIZE);
            const agentIds = chunk.map(a => a.agent_id);
            const query = `agent_ids=${agentIds.join(',')}&select=_id,name,agent_id&limit=${CHUNK_SIZE}`;
            const response = await authedFetch(`/api/agents?${query}`);
            const result = await response.json();
    
            if (!response.ok) {
                checkError = new Error(result.message || 'فشل التحقق من الوكلاء الموجودين.');
                break; // Stop on the first error
            }
            if (result.data) {
                allExistingAgents.push(...result.data);
            }
        }
    
        if (checkError) {
            showToast(`خطأ: ${checkError.message}`, 'error');
            return;
        }
        
        const existingAgentsMap = new Map();
        allExistingAgents.forEach(agent => {
            // --- IMPROVEMENT: Map by both agent_id and name for more robust checking ---
            existingAgentsMap.set(agent.agent_id, agent);
            existingAgentsMap.set(agent.name, agent);
        });
    
        const agentsToInsert = [];
        const agentsToUpdate = [];
    
        uniqueAgents.forEach(agent => {
            const existing = existingAgentsMap.get(agent.agent_id) || existingAgentsMap.get(agent.name);
            if (existing) {
                // Agent exists, add to update list with its database _id
                agentsToUpdate.push({ ...agent, id: existing._id });
            } else {
                // Add to insert list
                agentsToInsert.push(agent);
            }
        });
    
        const totalOperations = agentsToInsert.length + agentsToUpdate.length;
        if (totalOperations === 0) {
            showToast(`تم تجاهل جميع الوكلاء (${allParsedAgents.length}) لوجودهم مسبقاً أو بسبب تكرار في المدخلات.`, 'warning');
            return;
        }
    
        let successCount = 0;
        let errorCount = 0;
        let processedCount = 0;
    
        // --- IMPROVEMENT: More descriptive progress modal ---
        const modalContent = `
            <div class="update-progress-container">
                <i class="fas fa-users-cog update-icon"></i>
                <h3 id="bulk-send-status-text">جاري التهيئة...</h3>
                <div class="progress-bar-outer">
                    <div id="bulk-send-progress-bar-inner" class="progress-bar-inner"></div>
                </div>
            </div>
        `;
        const progressModalOverlay = showProgressModal('إضافة وتحديث الوكلاء', modalContent);
    
        const progressBar = document.getElementById('bulk-send-progress-bar-inner');
        const statusText = document.getElementById('bulk-send-status-text');
    
        // --- NEW: Process agents one by one to show real-time progress and reduce server load ---
        for (const agent of agentsToInsert) {
            processedCount++;
            statusText.innerHTML = `جاري إضافة وكيل: ${agent.name} (${processedCount}/${totalOperations})`;
            try {
                const response = await authedFetch('/api/agents', { method: 'POST', body: JSON.stringify(agent) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                successCount++;
            } catch (e) {
                errorCount++;
            }
            progressBar.style.width = `${(processedCount / totalOperations) * 100}%`;
            await new Promise(resolve => setTimeout(resolve, 500)); // --- NEW: Add 500ms delay ---
        }
    
        for (const agent of agentsToUpdate) {
            processedCount++;
            statusText.innerHTML = `جاري تحديث وكيل: ${agent.name} (${processedCount}/${totalOperations})`;
            try {
                // The agent object already contains the 'id' field needed for the URL
                const response = await authedFetch(`/api/agents/${agent.id}`, { method: 'PUT', body: JSON.stringify(agent) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                successCount++;
            } catch (e) {
                errorCount++;
            }
            progressBar.style.width = `${(processedCount / totalOperations) * 100}%`;
            await new Promise(resolve => setTimeout(resolve, 500)); // --- NEW: Add 500ms delay ---
        }
    
        progressBar.style.backgroundColor = errorCount > 0 ? 'var(--warning-color)' : 'var(--success-color)';
        
        let finalMessage = `اكتملت العملية.<br>`;
        finalMessage += `<strong>${successCount}</strong> عملية ناجحة | <strong>${errorCount}</strong> فشل`;
        const totalIgnored = ignoredForInputDuplication;
        if (totalIgnored > 0) finalMessage += ` | <strong>${totalIgnored}</strong> تم تجاهلهم للتكرار.`;
    
        statusText.innerHTML = finalMessage;
        document.querySelector('.modal-no-actions .update-icon').className = 'fas fa-check-circle update-icon';
        
        await logAgentActivity(null, 'BULK_AGENT_UPSERT', `إضافة جماعية: ${agentsToInsert.length} جديد, ${agentsToUpdate.length} تحديث, ${totalIgnored} تجاهل.`);
        showToast('اكتملت العملية الجماعية.', 'success');
    
        // Refresh the agents list
        allAgentsData = []; // Clear cache
        await renderManageAgentsPage();
    
        // Auto-close progress modal
        setTimeout(() => {
            if (progressModalOverlay) {
                progressModalOverlay.remove();
            }
        }, 4000);
    }
    

    // == activityLog.js ==
    const LOGS_PER_PAGE = 25;
    const LOG_ACTION_TYPES = {
        'AGENT_CREATED': 'إنشاء وكيل',
        'AGENT_DELETED': 'حذف وكيل',
        'AGENT_BULK_DELETE': 'حذف جماعي للوكلاء',
        'PROFILE_UPDATE': 'تحديث ملف شخصي',
        'DETAILS_UPDATE': 'تحديث تفاصيل',
        'MANUAL_RENEWAL': 'تجديد رصيد يدوي',
        'AUTO_RENEWAL': 'تجديد رصيد تلقائي',
        'AGENT_BULK_RENEW': 'تجديد رصيد جماعي',
        'COMPETITION_CREATED': 'إنشاء مسابقة',
        'COMPETITION_UPDATE': 'تحديث مسابقة',
        'COMPETITION_DELETED': 'حذف مسابقة',
        'COMPETITION_EXPIRED': 'انتهاء صلاحية مسابقة',
        'TASK_UPDATE': 'تحديث مهمة',
    };
    
    async function renderActivityLogPage() {
        const appContent = document.getElementById('app-content');
        
        // --- NEW: Permission Check ---
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
    
        // --- MODIFICATION: Restrict access to Admins and Super Admins only ---
        if (!isAdmin) {
            appContent.innerHTML = `
                <div class="access-denied-container">
                    <i class="fas fa-lock"></i>
                    <h2>ليس لديك صلاحية وصول</h2>
                    <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
                </div>`;
            return;
        }
    
        appContent.innerHTML = `
            <div class="page-header column-header">
                <div class="header-top-row">
                    <h1><i class="fas fa-history"></i> سجل نشاط الموقع</h1>
                </div>
                <div class="filters-container">
                    <div class="filter-group">
                        <label for="log-user-filter">فلترة حسب المستخدم</label>
                        <select id="log-user-filter">
                            <option value="all">كل المستخدمين</option>
                            <!-- User options will be populated here -->
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="log-action-filter">فلترة حسب الإجراء</label>
                        <select id="log-action-filter">
                            <option value="all">كل الإجراءات</option>
                            ${Object.entries(LOG_ACTION_TYPES).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="log-sort-select">ترتيب حسب</label>
                        <select id="log-sort-select">
                            <option value="newest">الأحدث أولاً</option>
                            <option value="oldest">الأقدم أولاً</option>
                        </select>
                    </div>
                    <div class="filter-actions">
                        <button id="apply-log-filters" class="btn-primary"><i class="fas fa-filter"></i> تطبيق</button>
                        <button id="reset-log-filters" class="btn-secondary"><i class="fas fa-undo"></i> إعادة تعيين</button>
                    </div>
                </div>
            </div>
            <div id="activity-log-container">
                <div class="loader-container"><div class="spinner"></div></div>
            </div>
        `;
        document.getElementById('apply-log-filters').addEventListener('click', () => fetchAndDisplayLogs(1));
        document.getElementById('reset-log-filters').addEventListener('click', () => {
            ['log-user-filter', 'log-action-filter', 'log-sort-select'].forEach(id => document.getElementById(id).selectedIndex = 0);
            fetchAndDisplayLogs(1);
        });
        await fetchAndDisplayLogs(1);
    }
    
    async function fetchAndDisplayLogs(page) {
        const container = document.getElementById('activity-log-container');
        if (!container) return;
        container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    
        const sortValue = document.getElementById('log-sort-select')?.value || 'newest'; // This element is duplicated, but we handle it.
        const userFilter = document.getElementById('log-user-filter')?.value || 'all';
        const actionFilter = document.getElementById('log-action-filter')?.value || 'all';
    
        try {
            const queryParams = new URLSearchParams({
                page: page,
                limit: LOGS_PER_PAGE,
                sort: sortValue,
                user_id: userFilter,
                action_type: actionFilter,
                populate: 'user' // Request user data to be populated
            });
    
            const response = await authedFetch(`/api/logs?${queryParams.toString()}`);
            if (!response.ok) {
                throw new Error('فشل جلب بيانات السجل.');
            }
            const { data: logs, count } = await response.json();
    
            displayLogsPage(logs || [], page, count || 0);
    
            // --- NEW: Populate user filter if not already populated ---
            const userFilterSelect = document.getElementById('log-user-filter');
            if (userFilterSelect && userFilterSelect.options.length <= 1) {
                const usersResponse = await authedFetch('/api/users?limit=1000&select=full_name,_id');
                if (usersResponse.ok) {
                    const { users } = await usersResponse.json(); // The endpoint returns { users: [...] }
                    // Add a "System" option
                    userFilterSelect.innerHTML += `<option value="system">النظام (تلقائي)</option>`;
                    // --- FIX: Ensure 'users' is an array before iterating ---
                    if (Array.isArray(users)) {
                        users.forEach(user => {
                            const option = new Option(user.full_name, user._id);
                            userFilterSelect.add(option);
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
            container.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }
    
    function displayLogsPage(logs, page, totalCount) {
        const container = document.getElementById('activity-log-container');
        if (!container) return;
    
        page = parseInt(page);
        const totalPages = Math.ceil(totalCount / LOGS_PER_PAGE);
    
        // Reuse the existing log HTML generator from profile.js
        const logHtml = logs.length > 0 ? generateActivityLogHTML(logs) : '<p class="no-results-message">لا توجد سجلات لعرضها.</p>';
    
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = '<div class="pagination-container">';
            const maxVisiblePages = 5; // Max number of page links to show
            let startPage, endPage;
    
            if (totalPages <= maxVisiblePages) {
                startPage = 1;
                endPage = totalPages;
            } else {
                const maxPagesBeforeCurrent = Math.floor(maxVisiblePages / 2);
                const maxPagesAfterCurrent = Math.ceil(maxVisiblePages / 2) - 1;
                if (page <= maxPagesBeforeCurrent) {
                    startPage = 1;
                    endPage = maxVisiblePages;
                } else if (page + maxPagesAfterCurrent >= totalPages) {
                    startPage = totalPages - maxVisiblePages + 1;
                    endPage = totalPages;
                } else {
                    startPage = page - maxPagesBeforeCurrent;
                    endPage = page + maxPagesAfterCurrent;
                }
            }
    
            paginationHtml += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i> السابق</button>`;
    
            if (startPage > 1) {
                paginationHtml += `<button class="page-btn" data-page="1">1</button>`;
                if (startPage > 2) {
                    paginationHtml += `<span class="page-ellipsis">...</span>`;
                }
            }
    
            for (let i = startPage; i <= endPage; i++) {
                paginationHtml += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
    
            paginationHtml += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي <i class="fas fa-chevron-left"></i></button>`;
            paginationHtml += '</div>';
        }
    
        container.innerHTML = `${logHtml}${paginationHtml}`;
    
        // Attach pagination listeners
        container.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newPage = e.currentTarget.dataset.page;
                if (newPage) {
                    fetchAndDisplayLogs(parseInt(newPage));
                }
            });
        });
    }
    
    /**
     * Generates the HTML for a list of activity logs, grouped by date.
     * This function is now self-contained within this file.
     * @param {Array} logs - The array of log objects.
     * @returns {string} The generated HTML string.
     */
    function generateActivityLogHTML(logs) {
        const getLogIconDetails = (actionType) => {
            if (actionType.includes('CREATED')) return { icon: 'fa-user-plus', colorClass: 'log-icon-create' };
            if (actionType.includes('DELETED')) return { icon: 'fa-user-slash', colorClass: 'log-icon-delete' };
            if (actionType.includes('PROFILE_UPDATE')) return { icon: 'fa-user-edit', colorClass: 'log-icon-profile' };
            if (actionType.includes('MANUAL_RENEWAL')) return { icon: 'fa-sync-alt', colorClass: 'log-icon-renewal' };
            if (actionType.includes('DETAILS_UPDATE')) return { icon: 'fa-cogs', colorClass: 'log-icon-details' };
            if (actionType.includes('COMPETITION_CREATED')) return { icon: 'fa-trophy', colorClass: 'log-icon-competition' };
            if (actionType.includes('WINNERS_SELECTION_REQUESTED')) return { icon: 'fa-question-circle', colorClass: 'log-icon-telegram' };
            return { icon: 'fa-history', colorClass: 'log-icon-generic' };
        };
    
        const groupLogsByDate = (logs) => {
            const groups = {};
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
    
            const todayStr = today.toISOString().split('T')[0];
            const yesterdayStr = yesterday.toISOString().split('T')[0];
    
            logs.forEach(log => {
                try {
                    if (!log.createdAt) {
                        console.warn('Log entry missing createdAt:', log);
                        return;
                    }
                    const logDate = new Date(log.createdAt);
                    if (isNaN(logDate.getTime())) {
                        console.warn('Invalid date in log:', log.createdAt);
                        return;
                    }
                    const logDateStr = logDate.toISOString().split('T')[0];
                    let dateKey;
                    if (logDateStr === todayStr) dateKey = 'اليوم';
                    else if (logDateStr === yesterdayStr) dateKey = 'الأمس';
                    else dateKey = logDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                    if (!groups[dateKey]) groups[dateKey] = [];
                    groups[dateKey].push(log);
                } catch (error) {
                    console.error('Error processing log entry:', error, log);
                }
            });
            return groups;
        };
    
        const groupedLogs = groupLogsByDate(logs);
        let html = '<div class="log-timeline-v2" id="site-log-timeline">';
    
        for (const date in groupedLogs) {
            html += `
                <div class="log-date-group">
                    <div class="log-date-header">${date}</div>
                    ${groupedLogs[date].map(log => `
                        <div class="log-item-v2">
                            <div class="log-item-icon-v2 ${getLogIconDetails(log.action_type).colorClass}"><i class="fas ${getLogIconDetails(log.action_type).icon}"></i></div>
                            <div class="log-item-content-v2">
                                <p class="log-description">${log.description}</p>
                                <p class="log-timestamp">
                                    <i class="fas fa-user"></i> ${log.user_name || 'نظام'}
                                    <span class="log-separator"></span>
                                    <i class="fas fa-clock"></i> ${new Date(log.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    
        html += '</div>';
        return html;
    }

    // == analytics.js ==
    // Use the globally available utilities
    const { authedFetch: fetchWithAuth, showToast } = window.utils;
    
    // Ensure Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded. Please include Chart.js before analytics.js');
        throw new Error('Chart.js dependency missing');
    }
    
    // Function to safely configure Chart.js
    function configureChartDefaults() {
        if (!window.Chart) {
            console.error('Chart.js is not loaded');
            return false;
        }
    
        try {
            // Configure basic defaults
            Chart.defaults.font.family = 'Arial, sans-serif';
            Chart.defaults.color = '#333';
    
            // Configure RTL settings safely
            if (Chart.defaults.plugins) {
                if (Chart.defaults.plugins.tooltip) {
                    Chart.defaults.plugins.tooltip.rtl = true;
                }
                if (Chart.defaults.plugins.legend) {
                    Chart.defaults.plugins.legend.rtl = true;
                }
                if (Chart.defaults.plugins.datalabels) {
                    Chart.defaults.plugins.datalabels.rtl = true;
                }
            }
            return true;
        } catch (error) {
            console.error('Error configuring Chart.js defaults:', error);
            return false;
        }
    }
    
    // Chart instances
    let mostFrequentCompetitionsChart;
    let peakHoursChart; // Declare here
    let countryStatsChart; // Declare here
    let topIPsChart; // Declare here
    
    // Configure Chart.js when the script loads
    configureChartDefaults();
    
    // Arabic Labels
    const ARABIC_LABELS = {
        mostFrequentCompetitions: 'المسابقات الأكثر تكرارًا',
        competitionName: 'اسم المسابقة',
        count: 'العدد',
        peakHours: 'ساعات الذروة للتقارير',
        hour: 'الساعة (UTC)',
        reportCount: 'عدد التقارير',
        countryStats: 'إحصائيات التقارير حسب الدولة',
        country: 'الدولة',
        topIPs: 'أكثر عناوين IP استخدامًا',
        ipAddress: 'عنوان IP',
        employeePerformance: 'أداء الموظفين',
        employee: 'الموظف',
        noData: 'لا توجد بيانات لعرضها.',
        errorFetchingData: 'حدث خطأ أثناء جلب البيانات.',
        copySuccess: 'تم نسخ عنوان IP إلى الحافظة!',
        copyFail: 'فشل نسخ عنوان IP.',
    };
    
    // Chart.js configuration is handled at script initialization
    
    // Function to show/hide loading spinner
    function showLoading(element, show) {
        if (element) {
            element.classList.toggle('active', show);
        }
    }
    
    // Function to show/hide error message
    function showError(element, message, show) {
        if (element) {
            element.textContent = message;
            element.classList.toggle('active', show);
        }
    }
    
    // Function to get user role
    function getUserRole() {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            return user?.role;
        } catch (e) {
            console.error("Error parsing user from localStorage", e);
            return null;
        }
    }
    
    // Main data fetching function
    async function fetchAnalyticsData(filter) {
        const mostFrequentCompetitionsLoading = document.getElementById('mostFrequentCompetitionsLoading');
        const employeePerformanceLoading = document.getElementById('employeePerformanceLoading');
        const mostFrequentCompetitionsError = document.getElementById('mostFrequentCompetitionsError');
        const employeePerformanceError = document.getElementById('employeePerformanceError');
        showLoading(mostFrequentCompetitionsLoading, true);
        showLoading(employeePerformanceLoading, true);
        showError(mostFrequentCompetitionsError, '', false);
        showError(employeePerformanceError, '', false);
    
        try {
            // Assuming fetchWithAuth is available globally or imported
            // build query params from provided filter object
            let url = '/api/analytics';
            if (range && typeof range === 'object') {
                const qp = new URLSearchParams();
                if (range.from) qp.set('from', range.from);
                if (range.to) qp.set('to', range.to);
                if (range.range) qp.set('range', range.range);
                url += `?${qp.toString()}`;
            } else if (range) {
                url += `?range=${encodeURIComponent(range)}`;
            }
            const response = await fetchWithAuth(url);
            if (!response.ok) {
                throw new Error(ARABIC_LABELS.errorFetchingData);
            }
            const result = await response.json();
            return result; // backend returns object with analytics fields
        } catch (error) {
            console.error('Error fetching analytics data:', error);
            showError(mostFrequentCompetitionsError, ARABIC_LABELS.errorFetchingData, true);
            showError(employeePerformanceError, ARABIC_LABELS.errorFetchingData, true);
            return null;
        } finally {
            showLoading(mostFrequentCompetitionsLoading, false);
            showLoading(employeePerformanceLoading, false);
        }
    }
    
    // Chart rendering functions (placeholders for now)
    function renderMostFrequentCompetitionsChart(data) {
        const mostFrequentCompetitionsCanvas = document.getElementById('mostFrequentCompetitionsChart');
        const mostFrequentCompetitionsError = document.getElementById('mostFrequentCompetitionsError');
        if (!mostFrequentCompetitionsCanvas) return;
        if (mostFrequentCompetitionsChart) mostFrequentCompetitionsChart.destroy();
    
        if (!data || data.length === 0) {
            showError(mostFrequentCompetitionsError, ARABIC_LABELS.noData, true);
            return;
        }
    
        // support template_name (new aggregation) or competition_name (legacy)
        const labels = data.map(item => item.template_name || item.competition_name || item.template_id || 'غير معروف');
        const counts = data.map(item => item.count);
    
        mostFrequentCompetitionsChart = new Chart(mostFrequentCompetitionsCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: ARABIC_LABELS.count,
                    data: counts,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    title: {
                        display: true,
                        text: ARABIC_LABELS.mostFrequentCompetitions,
                        font: { size: 16 }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => value,
                        color: '#333',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: ARABIC_LABELS.count
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: ARABIC_LABELS.competitionName
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }
    
    function renderPeakHoursChart(data) {
        if (!peakHoursCanvas) return;
        if (peakHoursChart) peakHoursChart.destroy();
    
        if (!data || data.length === 0) {
            showError(peakHoursError, ARABIC_LABELS.noData, true);
            return;
        }
    
        // Ensure all 24 hours are present, filling missing hours with 0
        const allHours = Array.from({ length: 24 }, (_, i) => i);
        const reportCountsByHour = new Array(24).fill(0);
    
        data.forEach(item => {
            if (item.hour >= 0 && item.hour < 24) {
                reportCountsByHour[item.hour] = item.report_count;
            }
        });
    
        peakHoursChart = new Chart(peakHoursCanvas, {
            type: 'line',
            data: {
                labels: allHours.map(h => `${h}:00`),
                datasets: [{
                    label: ARABIC_LABELS.reportCount,
                    data: reportCountsByHour,
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    title: {
                        display: true,
                        text: ARABIC_LABELS.peakHours,
                        font: { size: 16 }
                    },
                    datalabels: {
                        display: false, // Hide datalabels for line chart for cleaner look
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: ARABIC_LABELS.reportCount
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: ARABIC_LABELS.hour
                        }
                    }
                }
            }
        });
    }
    
    function renderCountryStatsChart(data) {
        if (!countryStatsCanvas) return;
        if (countryStatsChart) countryStatsChart.destroy();
    
        if (!data || data.length === 0) {
            showError(countryStatsError, ARABIC_LABELS.noData, true);
            return;
        }
    
        // Take top 10 countries
        const sortedData = [...data].sort((a, b) => b.report_count - a.report_count).slice(0, 10);
        const labels = sortedData.map(item => item.country);
        const counts = sortedData.map(item => item.report_count);
    
        countryStatsChart = new Chart(countryStatsCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: ARABIC_LABELS.reportCount,
                    data: counts,
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    title: {
                        display: true,
                        text: ARABIC_LABELS.countryStats,
                        font: { size: 16 }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => value,
                        color: '#333',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: ARABIC_LABELS.reportCount
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: ARABIC_LABELS.country
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }
    
    function renderTopIPsChart(data) {
        if (!topIPsCanvas) return;
        if (topIPsChart) topIPsChart.destroy();
    
        if (!data || data.length === 0) {
            showError(topIPsError, ARABIC_LABELS.noData, true);
            return;
        }
    
        // Take top 10 IPs
        const sortedData = [...data].sort((a, b) => b.report_count - a.report_count).slice(0, 10);
        const labels = sortedData.map(item => item.ip);
        const counts = sortedData.map(item => item.report_count);
    
        topIPsChart = new Chart(topIPsCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: ARABIC_LABELS.reportCount,
                    data: counts,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    title: {
                        display: true,
                        text: ARABIC_LABELS.topIPs,
                        font: { size: 16 }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => value,
                        color: '#333',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: ARABIC_LABELS.reportCount
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: ARABIC_LABELS.ipAddress
                        }
                    }
                },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const ip = topIPsChart.data.labels[index];
                        navigator.clipboard.writeText(ip)
                            .then(() => {
                                // Assuming showToast is available globally or imported
                                if (typeof showToast === 'function') {
                                    showToast(ARABIC_LABELS.copySuccess, 'success');
                                } else {
                                    alert(ARABIC_LABELS.copySuccess);
                                }
                            })
                            .catch(err => {
                                console.error('Failed to copy IP:', err);
                                if (typeof showToast === 'function') {
                                    showToast(ARABIC_LABELS.copyFail, 'error');
                                } else {
                                    alert(ARABIC_LABELS.copyFail);
                                }
                            });
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }
    
    function renderEmployeePerformanceTable(data) {
        const employeePerformanceTableBody = document.querySelector('#employeePerformanceTable tbody');
        const employeePerformanceCard = document.getElementById('employeePerformanceCard');
        if (!employeePerformanceTableBody) return;
    
        // Clear previous data
        employeePerformanceTableBody.innerHTML = '';
    
        const userRole = getUserRole();
        if (userRole !== 'admin') {
            employeePerformanceCard.style.display = 'none';
            return;
        } else {
            employeePerformanceCard.style.display = 'block';
        }
    
        if (!data || data.length === 0) {
            const row = employeePerformanceTableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 2;
            cell.textContent = ARABIC_LABELS.noData;
            cell.style.textAlign = 'center';
            return;
        }
    
        data.forEach(employee => {
            const row = employeePerformanceTableBody.insertRow();
            const employeeCell = row.insertCell();
            const reportCountCell = row.insertCell();
    
            employeeCell.innerHTML = `
                <div class="employee-info">
                    <span>${employee.username}</span>
                    ${employee.avatar_url ? `<img src="${employee.avatar_url}" alt="${employee.username}" class="employee-avatar">` : ''}
                </div>
            `;
            reportCountCell.textContent = employee.report_count;
        });
    }
    
    // Function to update all charts and table
    async function updateDashboard(filter) {
        const analyticsData = await fetchAnalyticsData(filter);
        if (analyticsData) {
            renderMostFrequentCompetitionsChart(analyticsData.most_frequent_competitions);
            renderEmployeePerformanceTable(analyticsData.employee_performance);
        }
    }
    
    // Initialization
    function init() {
        // DOM Elements - moved inside init()
        const fromDateInput = document.getElementById('fromDate');
        const toDateInput = document.getElementById('toDate');
        const applyDateFilterBtn = document.getElementById('applyDateFilter');
        // Initial load — default to last 7 days
        updateDashboard('7');
    
        // Apply date filter (from/to)
        if (applyDateFilterBtn) {
            applyDateFilterBtn.addEventListener('click', () => {
                const from = fromDateInput?.value || '';
                const to = toDateInput?.value || '';
                if (!from && !to) {
                    // if both empty, fall back to 7-day range
                    updateDashboard('7');
                    return;
                }
                updateDashboard({ from, to });
            });
        }
    }
    

    // == utils.js ==
    
    function translateTelegramError(errorMessage) {
        if (!errorMessage) {
            return 'فشل إرسال غير معروف.';
        }
    
        const lowerCaseError = errorMessage.toLowerCase();
    
        if (lowerCaseError.includes('message and chat id are required')) {
            return 'معرف الدردشة (Chat ID) الخاص بالوكيل غير موجود أو غير صحيح. يرجى مراجعته في صفحة تعديل الوكيل.';
        }
        if (lowerCaseError.includes('chat not found')) {
            return 'فشل العثور على المحادثة. يرجى التأكد من أن معرف الدردشة (Chat ID) صحيح وأن الوكيل قد بدأ محادثة مع البوت.';
        }
        if (lowerCaseError.includes('bot was blocked by the user')) {
            return 'قام الوكيل بحظر البوت. لا يمكن إرسال الرسالة.';
        }
        if (lowerCaseError.includes('user is deactivated')) {
            return 'حساب المستخدم غير نشط في تيليجرام.';
        }
        if (lowerCaseError.includes('chat_id is empty') || lowerCaseError.includes('chat id is empty')) {
            return 'معرف الدردشة (Chat ID) فارغ. يرجى إضافته في ملف الوكيل.';
        }
        if (lowerCaseError.includes('message is too long')) {
            return 'الرسالة طويلة جداً. يرجى اختصارها.';
        }
        if (lowerCaseError.includes('wrong file identifier')) {
            return 'معرف الملف (للصور أو المرفقات) غير صحيح.';
        }
        // A more generic bad request
        if (lowerCaseError.includes('bad request')) {
            return 'طلب غير صالح. قد يكون هناك خطأ في تنسيق الرسالة أو معرف الدردشة.';
        }
    
        // Default fallback
        return `خطأ من تيليجرام: ${errorMessage}`;
    }
    

    // == main.js ==
    // 1. Global variables
    let searchTimeout;
    let currentUserProfile = null; // NEW: To store the current user's profile with role
    window.onlineUsers = new Map(); // NEW: Global map to track online users
    window.appContent = null; // NEW: Make appContent globally accessible
    
    // --- NEW: Global Error Catcher ---
    // This will catch any unhandled errors on the page and send them to the backend for logging.
    window.onerror = function(message, source, lineno, colno, error) {
        const errorData = {
            message: message,
            source: source,
            lineno: lineno,
            colno: colno,
            error: error ? { message: error.message, stack: error.stack } : null,
            url: window.location.href,
        };
    
        // Use sendBeacon for reliability, especially during page unloads/redirects.
        const blob = new Blob([JSON.stringify(errorData)], { type: 'application/json' });
        navigator.sendBeacon('/api/log-error', blob);
    };
    
    // --- Use the shared utility for authenticated API calls ---
    window.authedFetch = window.utils.authedFetch;
    
    // Helper function to update the visual status indicator
    function updateStatus(status, message) {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;
        statusElement.className = 'status-bar'; // Reset classes
        const lastCheckTime = document.getElementById('last-check-time'); // إصلاح: تعريف المتغير
        statusElement.classList.add('status-' + status);
    
        // Update timestamp
        const time = new Date().toLocaleTimeString('ar-EG');
        lastCheckTime.textContent = `آخر فحص: ${time}`;
    }
    
    
    // NEW: Helper function to format numbers with commas
    function formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    
    /**
     * NEW: Global helper to update a single countdown timer element.
     * @param {HTMLElement} el The element containing the data-end-date attribute.
     */
    function updateCountdownTimer(el) {
        const endDateStr = el.dataset.endDate;
        if (!endDateStr) {
            el.innerHTML = ''; // Clear if no date
            return;
        }
    
        const endDate = new Date(endDateStr);
        const diffTime = endDate.getTime() - Date.now();
    
        if (diffTime <= 0) {
            el.innerHTML = `<i class="fas fa-hourglass-end"></i> <span>في انتظار المعالجة...</span>`;
            el.classList.add('expired');
        } else {
            const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
    
            let parts = [];
            if (days > 0) parts.push(`${days} يوم`);
            if (hours > 0) parts.push(`${hours} ساعة`);
            if (minutes > 0 && days === 0) parts.push(`${minutes} دقيقة`); // Show minutes only if less than a day
    
            if (parts.length === 0 && diffTime > 0) {
                parts.push('أقل من دقيقة');
            }
            el.innerHTML = `<i class="fas fa-hourglass-half"></i> <span>متبقي: ${parts.join(' و ')}</span>`;
        }
    }
    
    // NEW: Function to fetch and store the current user's profile
    async function fetchUserProfile() {
        try {
            // Use the /me endpoint to get the current user's profile
            const response = await authedFetch('/api/auth/me');
            if (!response.ok) {
                // If token is invalid/expired, server will return 401
                throw new Error(`Authentication check failed with status: ${response.status}`);
            }
            currentUserProfile = await response.json();
            localStorage.setItem('userProfile', JSON.stringify(currentUserProfile)); // Cache the profile
            return currentUserProfile;
        } catch (error) {
            // --- تعديل: إضافة سجل واضح لسبب إعادة التوجيه ---
            console.error(`%c[AUTH-FAIL] Could not fetch user profile. Reason: ${error.message}`, 'color: red; font-weight: bold;');
            return null;
        }
    }
    
    // --- NEW: Function to update UI elements after successful login ---
    function updateUIAfterLogin(user) {
        if (!user) return;
    
        // --- DEBUG: Log the user profile being used to update the UI ---
        console.log(
            `%c[UI Update] Updating interface for user: "${user.full_name}" with role: "${user.role}"`,
            'color: #28a745; font-weight: bold; border: 1px solid #28a745; padding: 2px 5px; border-radius: 3px;'
        );
    
        const settingsMenu = document.getElementById('settings-menu');
        const userNameDisplay = document.getElementById('user-name');
        const userEmailDisplay = document.getElementById('user-email');
        const userAvatar = document.getElementById('user-avatar');
        const usersNavItem = document.getElementById('nav-users');
        const activityLogNavItem = document.getElementById('nav-activity-log');
    
        if (settingsMenu) settingsMenu.style.display = 'block';
        if (userNameDisplay) userNameDisplay.textContent = user.full_name;
        if (userEmailDisplay) userEmailDisplay.textContent = user.email;
        if (userAvatar) {
            userAvatar.src = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=random`;
        }
    
        // --- MODIFICATION: Show activity log link only to admins and super admins ---
        if (activityLogNavItem) {
            const canViewLogs = user.role === 'super_admin' || user.role === 'admin';
            activityLogNavItem.style.display = canViewLogs ? 'block' : 'none';
        }
    
        // Show admin-only links if the user is a super_admin or admin
        // --- MODIFICATION: Allow admins to see the users link as well ---
        if (usersNavItem && (user.role === 'super_admin' || user.role === 'admin')) {
            usersNavItem.style.display = 'block';
        }
    }
    // NEW: Router function to handle page navigation based on URL hash
    async function handleRouting() {
        showLoader(); // إضافة: إظهار شاشة التحميل في بداية كل عملية تنقل
        // Scroll to the top of the page on every navigation
        window.scrollTo(0, 0);
    
        const hash = window.location.hash || '#home'; // Default to home
        const mainElement = document.querySelector('main');
        window.appContent = document.getElementById('app-content'); // Assign to global
        mainElement.classList.add('page-loading');
    
        // Reset layout classes
        mainElement.classList.remove('full-width');
        appContent.classList.remove('full-height-content');
    
        let renderFunction;
        let navElement;
    
        // Basic routing
        const routes = {
            '#home': { func: renderHomePage, nav: 'nav-home' }, // This should be a class instance call in the future
            '#tasks': { 
                func: async () => {
                    if (window.currentTasksPageInstance) window.currentTasksPageInstance.destroy();
                    window.currentTasksPageInstance = new TasksPage(window.appContent);
                    await window.currentTasksPageInstance.render();
                }, 
                nav: 'nav-tasks' 
            },
            '#add-agent': { func: renderAddAgentForm, nav: null }, // إصلاح: إضافة المسار المفقود
            '#top-agents': { func: renderTopAgentsPage, nav: 'nav-top-agents' }, // NEW: Top Agents page
            '#manage-agents': { func: renderManageAgentsPage, nav: 'nav-manage-agents', adminOnly: false },
            '#competitions/edit': { func: () => {}, nav: 'nav-manage-competitions' }, // Placeholder: Actual function is in competitions.js
            '#competitions': { func: renderCompetitionsPage, nav: 'nav-manage-competitions' },
            '#archived-competitions': { func: renderCompetitionsPage, nav: 'nav-archived-competitions' },
            '#competition-templates': { func: renderCompetitionTemplatesPage, nav: 'nav-competition-templates' },
            '#archived-templates': { func: renderArchivedTemplatesPage, nav: 'nav-competition-templates' }, // Corrected nav item
            '#users': { func: renderUsersPage, nav: 'nav-users', adminOnly: true },
            '#profile-settings': { func: renderProfileSettingsPage, nav: null }, // NEW: Profile settings page
            '#calendar': { func: renderCalendarPage, nav: 'nav-calendar' },
            '#activity-log': { func: renderActivityLogPage, nav: 'nav-activity-log' },
            '#analytics': { func: renderAnalyticsPage, nav: 'nav-analytics' },
            '#statistics': { func: renderStatisticsPage, nav: 'nav-statistics' }
        };
    
        const routeKey = hash.split('/')[0].split('?')[0]; // Get base route e.g., #profile from #profile/123 or #competitions from #competitions/new?agentId=1
        const route = routes[routeKey] || routes['#home'];
    
        renderFunction = route.func;
        navElement = document.getElementById(route.nav);
    
        // Special handling for routes with parameters
        if (hash.startsWith('#profile/')) {
            const agentId = hash.split('/')[1];
            if (agentId) {
                if (typeof renderAgentProfilePage !== 'undefined') {
                    renderFunction = () => renderAgentProfilePage(agentId);
                }
                navElement = null; // No nav item is active on a profile page
            }
        } else if (hash.startsWith('#competitions/edit/')) {
            const competitionId = hash.split('/')[2];
            if (competitionId) {
                renderFunction = () => renderCompetitionEditForm(competitionId);
                navElement = document.getElementById('nav-manage-competitions');
            }
        } else {
            // If we are navigating away from a profile page, stop its countdown timer.
            if (typeof stopRenewalCountdown === 'function') {
                stopRenewalCountdown();
            }
            if (typeof stopCompetitionCountdowns === 'function') {
                stopCompetitionCountdowns();
            }
        }
    
        if (hash.startsWith('#profile/') || hash.startsWith('#competitions/new') || hash.startsWith('#competitions/manage') || hash === '#home' || hash === '#competition-templates' || hash === '#archived-templates' || hash === '#competitions' || hash === '#manage-agents' || hash === '#activity-log' || hash === '#archived-competitions' || hash === '#users' || hash === '#top-agents' || hash === '#analytics' || hash === '#statistics') {
            mainElement.classList.add('full-width');
        } else if (hash === '#calendar') {
            mainElement.classList.add('full-width');
            appContent.classList.add('full-height-content');
        }
    
        setActiveNav(navElement);
    
        try {
            if (renderFunction) {
                await renderFunction();
                mainElement.classList.remove('page-loading');
            }
        } catch (err) {
            console.error("Routing error:", err);
        } finally {
            hideLoader();
        }
    }
    
    // --- إصلاح: إضافة الدالة المفقودة ---
    function setActiveNav(activeElement) {
        // إزالة 'active' من جميع الروابط
        document.querySelectorAll('.nav-link, .dropdown-item').forEach(link => {
            link.classList.remove('active');
        });
    
        if (activeElement) {
            activeElement.classList.add('active');
            // إذا كان الرابط داخل قائمة منسدلة، قم بتحديد القائمة الرئيسية أيضاً
            const parentDropdown = activeElement.closest('.dropdown');
            parentDropdown?.querySelector('.dropdown-toggle')?.classList.add('active');
        }
    }
    
    async function logAgentActivity(userId, agentId, actionType, description, metadata = {}) {
        // This function will be reimplemented later using our own backend.
        console.log(`[FRONTEND LOG] ➡️ محاولة تسجيل نشاط: ${actionType} (Agent: ${agentId || 'N/A'})`);
        try {
            const payload = {
                user_id: userId || currentUserProfile?._id, // Default to current user if not provided
                action_type: actionType,
                description,
                metadata
            };
    
            // Only add agent_id to the payload if it's a valid, non-null value.
            if (agentId) {
                payload.agent_id = agentId;
            }
    
            const response = await authedFetch('/api/logs', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
            console.log(`[FRONTEND LOG] ✅ تم إرسال النشاط بنجاح إلى الخادم.`);
        } catch (error) {
            console.error(`[FRONTEND LOG] ❌ فشل إرسال النشاط إلى الخادم:`, error);
        }
    }
    
    /**
     * NEW: Verifies that the agent's stored Telegram chat ID and group name match the actual data on Telegram.
     * @param {object} agent The agent object containing telegram_chat_id and telegram_group_name.
     * @returns {Promise<{verified: boolean, message: string}>} An object indicating if verification passed.
     */
    async function verifyTelegramChat(agent) {
        if (!agent.telegram_chat_id) {
            const message = 'لا يمكن الإرسال. معرف دردشة التلجرام غير مسجل لهذا الوكيل.';
            showToast(message, 'error');
            return { verified: false, message };
        }
        if (!agent.telegram_group_name) {
            const message = 'لا يمكن الإرسال. اسم مجموعة التلجرام غير مسجل لهذا الوكيل.';
            showToast(message, 'error');
            return { verified: false, message };
        }
    
        try {
            showToast('جاري التحقق من تطابق بيانات مجموعة التلجرام...', 'info');
            const response = await authedFetch(`/api/get-chat-info?chatId=${agent.telegram_chat_id}`);
            const data = await response.json();
    
            if (!response.ok) throw new Error(data.message || 'فشل التحقق من بيانات مجموعة التلجرام.');
    
            const actualGroupName = data.title;
            if (actualGroupName.trim() !== agent.telegram_group_name.trim()) {
                const errorMessage = `<b>خطأ في التحقق:</b> اسم المجموعة المسجل (<b>${agent.telegram_group_name}</b>) لا يطابق الاسم الفعلي (<b>${actualGroupName}</b>). يرجى تصحيح البيانات.`;
                showToast(errorMessage, 'error');
                return { verified: false, message: errorMessage };
            }
            return { verified: true, message: 'تم التحقق من المجموعة بنجاح.' };
        } catch (error) {
            showToast(`فشل التحقق من المجموعة: ${error.message}`, 'error');
            return { verified: false, message: error.message };
        }
    }
    
    // 2. Function to initialize the application session
    async function initializeApp() {
        updateStatus('connected', 'متصل وجاهز');
        showLoader(); // إظهار شاشة التحميل هنا لضمان تغطية عملية التحقق الأولية
    
        // ARCHITECTURAL FIX: Wait for the central store to be ready before proceeding.
        await new Promise(resolve => {
            window.addEventListener('storeReady', resolve, { once: true });
        });
    
        const userProfile = await fetchUserProfile();
        if (userProfile) {
            window.addEventListener('hashchange', handleRouting);
            updateUIAfterLogin(userProfile); // FIX: Pass the fetched user profile to the UI update function
            handleRouting(); // Initial route handling
        } else {
            // --- تعديل: التعامل مع فشل المصادقة الأولية ---
            // إذا فشل جلب ملف المستخدم، فهذا يعني وجود مشكلة في الخادم أو الاتصال بقاعدة البيانات
            hideLoader(); // إخفاء شاشة التحميل
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.innerHTML = `
                    <div class="error-page-container">
                        <i class="fas fa-server fa-3x"></i>
                        <h1>خطأ في الاتصال بالخادم</h1>
                        <p>لا يمكن الوصول إلى بيانات المستخدم. قد يكون الخادم متوقفاً أو هناك مشكلة في الاتصال بقاعدة البيانات.</p>
                        <p><strong>الحل المقترح:</strong> يرجى مراجعة مسؤول النظام والتأكد من أن الخادم يعمل بشكل صحيح وأن رابط قاعدة البيانات (MONGODB_URI) في ملف <code>.env</code> صحيح.</p>
                        <button onclick="location.reload()" class="btn-primary">إعادة المحاولة</button>
                    </div>
                `;
            }
        }
    }
    
    /**
     * NEW: Sets up a listener for real-time messages from the server (e.g., via WebSocket).
     */
    function setupRealtimeListeners() {
        const protocol = window.location.protocol === 'https' ? 'wss' : 'ws';
        const wsUrl = `${protocol}://${window.location.host}`;
        let ws;
    
        function connect() {
            ws = new WebSocket(wsUrl);
    
            ws.onopen = () => {
                console.log('[WebSocket] Connected to server.');
                const token = localStorage.getItem('authToken');
                if (token) {
                    ws.send(JSON.stringify({ type: 'auth', token }));
                }
            };
    
            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    switch (message.type) {
                        case 'agent_renewed':
                            showToast(`تم تجديد رصيد الوكيل ${message.data.agentName} تلقائياً.`, 'success');
                            break;
                        case 'presence_update':
                            // message.data should be an array of online user IDs
                            if (Array.isArray(message.data)) {
                                window.onlineUsers.clear();
                                message.data.forEach(userId => window.onlineUsers.set(userId, true));
                                // Dispatch a global event that the user list can listen to
                                window.dispatchEvent(new CustomEvent('presence-update'));
                            }
                            break;
                        // Add other message types here
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            };
    
            ws.onclose = () => {
                console.log('[WebSocket] Disconnected. Attempting to reconnect in 5 seconds...');
                setTimeout(connect, 5000); // Attempt to reconnect after 5 seconds
            };
    
            ws.onerror = (error) => {
                console.error('[WebSocket] Error:', error);
                ws.close();
            };
        }
    
        connect();
    }
    
    // --- UI Component Functions (Moved from script.js to main.js) ---
    
    function showLoader() {
        document.getElementById('page-loader')?.classList.add('show');
    }
    
    function hideLoader() {
        document.getElementById('page-loader')?.classList.remove('show');
    }
    
    function showConfirmationModal(message, onConfirm, options = {}) {
        const {
            title = null,
            confirmText = 'تأكيد',
            cancelText = 'إلغاء',
            confirmClass = 'btn-primary',
            showCancel = true,
            modalClass = '',
            onRender = null
        } = options;
    
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
    
        const modal = document.createElement('div');
        modal.className = `modal ${modalClass}`;
        modal.innerHTML = `
            ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
            <div class="modal-message">${message}</div>
            <div class="modal-actions">
                <button id="confirm-btn" class="${confirmClass}">${confirmText}</button>
                ${showCancel ? `<button id="cancel-btn" class="btn-secondary">${cancelText}</button>` : ''}
            </div>
        `;
    
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    
        document.getElementById('confirm-btn').onclick = () => {
            // FIX: Execute the callback *before* removing the modal.
            // This ensures that any inputs inside the modal are still accessible to the callback.
            if (onConfirm) onConfirm();
            overlay.remove(); // Now remove the modal.
        };
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) cancelBtn.onclick = () => overlay.remove();
    
        if (onRender) onRender(modal);
    }
    
    // --- NEW: Dedicated function for progress modals ---
    function showProgressModal(title, content) {
        const existingOverlay = document.querySelector('.modal-overlay');
        if (existingOverlay) {
            console.warn('[showProgressModal] A modal is already open. Removing it.');
            existingOverlay.remove();
        }
    
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
    
        const modal = document.createElement('div');
        modal.className = 'modal modal-no-actions'; // Use the class for modals without buttons
        modal.innerHTML = `
            ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
            <div class="modal-message">${content}</div>
        `;
    
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        console.log('[showProgressModal] Progress modal has been appended to the body.');
    
        return overlay; // Return the overlay so it can be closed later
    }
    
    function setupAutoHidingNavbar() {
        let lastScrollTop = 0;
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;
    
        window.addEventListener('scroll', () => {
            // We use pageYOffset for broader browser support
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
            // Add a small threshold (e.g., 10px) to prevent hiding on minor scrolls
            if (scrollTop > lastScrollTop && scrollTop > navbar.offsetHeight) {
                // Scrolling Down
                navbar.classList.add('navbar-hidden');
            } else {
                // Scrolling Up
                navbar.classList.remove('navbar-hidden');
            }
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // For Mobile or negative scrolling
        }, { passive: true }); // Use passive listener for better scroll performance
    }
    // --- New Functions for UI Enhancements ---
    
    // --- NEW: Function to create floating particles for the main app background ---
    function createFloatingParticles() {
        const container = document.getElementById('main-animated-bg');
        if (!container) return;
        // Reduce particle count for better performance inside the app
        const numParticles = 150; 
        const colors = ['color-1', 'color-2', 'color-3'];
        for (let i = 0; i < numParticles; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const size = Math.random() * 2 + 1; // Smaller particles
            particle.classList.add(colors[Math.floor(Math.random() * colors.length)]);
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            // Slower and longer animations
            particle.style.animationDelay = `${Math.random() * 30}s`;
            particle.style.animationDuration = `${Math.random() * 20 + 15}s`;
            container.appendChild(particle);
        }
    }
    
    // Apply theme from localStorage on page load
    function applyInitialTheme() {
        const savedTheme = localStorage.getItem('theme');
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        }
    }
    
    // Setup listeners and dynamic content for the navbar
    function setupNavbar() {
        // NEW: Dark Mode Toggle Logic from dropdown
        const themeToggleHandler = (e) => {
            e.preventDefault(); // Prevent navigation
            if (document.body.classList.contains('dark-mode')) {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            }
        };
        const themeBtnDropdown = document.getElementById('theme-toggle-btn-dropdown');
        if (themeBtnDropdown) themeBtnDropdown.addEventListener('click', themeToggleHandler);
    
        // Logout Button Logic
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showConfirmationModal('هل أنت متأكد من رغبتك في تسجيل الخروج؟', async () => {
                    try {
                        // استدعاء الواجهة الخلفية لتسجيل الخروج (للتوافقية المستقبلية)
                        await authedFetch('/api/auth/logout', { method: 'POST' });
                    } catch (error) {
                        console.warn('Logout API call failed, but proceeding with client-side logout.', error);
                    }
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userProfile');
                    window.location.replace('/login.html');
                }, { title: 'تأكيد تسجيل الخروج' });
            });
        }
    
        // Date Display
        const dateDisplay = document.getElementById('date-display');
        const today = new Date();
        // Using 'ar-EG' for Arabic-Egypt locale for date formatting
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.textContent = today.toLocaleDateString('ar-EG', options);
    
        // Placeholder for search functionality
        const searchInput = document.getElementById('main-search-input');
        const mainSearchClearBtn = document.getElementById('main-search-clear');
    
        searchInput.addEventListener('input', () => {
            if (mainSearchClearBtn) {
                mainSearchClearBtn.style.display = searchInput.value ? 'block' : 'none';
            }
    
            clearTimeout(searchTimeout);
            const searchTerm = searchInput.value.trim();
            const searchResultsContainer = document.getElementById('search-results');
    
            if (searchTerm.length < 2) { // Don't search for less than 2 characters
                searchResultsContainer.classList.remove('visible');
                return;
            }
    
            searchTimeout = setTimeout(async () => {
                // TODO: Replace this with a call to our own backend search endpoint
                const response = await authedFetch(`/api/agents?search=${searchTerm}&limit=5`);
                const { data: agents, error } = await response.json();
    
                if (error) {
                    console.error('Search error:', error);
                    return;
                }
    
                if (agents.length > 0) {
                    searchResultsContainer.innerHTML = agents.map(agent => {
                        const avatarHtml = agent.avatar_url
                            ? `<img src="${agent.avatar_url}" alt="Avatar" class="search-result-avatar">`
                            : `<div class="search-result-avatar-placeholder"><i class="fas fa-user"></i></div>`;
                        return `
                        <div class="search-result-item" data-agent-id="${agent._id}">
                            ${avatarHtml}
                            <div class="search-result-info">
                                <p class="agent-name">${agent.name}</p>
                                <p class="agent-id">#${agent.agent_id}</p>
                            </div>
                            <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                        </div>
                    `}).join('');
                    searchResultsContainer.classList.add('visible');
    
                    // Add click listeners to new items
                    searchResultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                        item.addEventListener('click', async () => {
                            const agentId = item.dataset.agentId;
                            // Use the router for navigation
                            window.location.hash = `profile/${agentId}`;
                            searchResultsContainer.classList.remove('visible');
                            searchInput.value = '';
                            if (mainSearchClearBtn) mainSearchClearBtn.style.display = 'none';
                        });
                    });
                } else {
                    searchResultsContainer.innerHTML = '<div class="search-result-item" style="cursor: default;">لا توجد نتائج</div>';
                    searchResultsContainer.classList.add('visible');
                }
            }, 300); // 300ms debounce
        });
    
        if (mainSearchClearBtn) {
            mainSearchClearBtn.addEventListener('click', () => {
                searchInput.value = '';
                document.getElementById('search-results').classList.remove('visible');
                mainSearchClearBtn.style.display = 'none';
                searchInput.focus();
            });
        }
    
    
        // Navigation Logic
        const navHome = document.getElementById('nav-home');
        const navTasks = document.getElementById('nav-tasks');
        const navManageAgents = document.getElementById('nav-manage-agents');
        const navTopAgents = document.getElementById('nav-top-agents'); // NEW
        const navManageCompetitions = document.getElementById('nav-manage-competitions');
        const navArchivedCompetitions = document.getElementById('nav-archived-competitions');
        const competitionsDropdown = document.getElementById('nav-competitions-dropdown');
        const navCompetitionTemplates = document.getElementById('nav-competition-templates');
        const navArchivedTemplates = document.getElementById('nav-archived-templates');
        const navCalendar = document.getElementById('nav-calendar');
        const navActivityLog = document.getElementById('nav-activity-log');
        const navUsers = document.getElementById('nav-users'); // NEW
        const navProfileSettings = document.getElementById('nav-profile-settings'); // This is a dropdown item
        const navStatistics = document.getElementById('nav-statistics');
        const navAnalytics = document.getElementById('nav-analytics'); // NEW
    
        navLinks = [navHome, navTasks, navManageAgents, navTopAgents, navManageCompetitions, navArchivedCompetitions, navCompetitionTemplates, navCalendar, navUsers, navProfileSettings, navActivityLog, navAnalytics, document.getElementById('logout-btn')];
        
        // NEW: Navigation listeners update the hash, which triggers the router
        if (navHome) navHome.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'home'; });
        if (navTasks) navTasks.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'tasks'; });
        if (navTopAgents) navTopAgents.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'top-agents'; });
        if (navManageAgents) navManageAgents.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'manage-agents'; });
        if (navProfileSettings) navProfileSettings.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'profile-settings'; }); // NEW
        if (navManageCompetitions) navManageCompetitions.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#competitions'; });
        if (navArchivedCompetitions) navArchivedCompetitions.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'archived-competitions'; });
        if (navArchivedTemplates) navArchivedTemplates.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'archived-templates'; });
        if (navCompetitionTemplates) navCompetitionTemplates.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'competition-templates'; });
        if (navActivityLog) navActivityLog.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'activity-log'; });
        if (navUsers) navUsers.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'users'; }); // NEW
        if (navAnalytics) navAnalytics.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'analytics'; }); // NEW
        if (navStatistics) navStatistics.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = 'statistics'; });
    
        // Hide search results when clicking outside
        document.addEventListener('click', (e) => {
            const searchContainer = e.target.closest('.search-container');
            const userDropdownContainer = e.target.closest('.nav-item.dropdown');
    
            if (!searchContainer) {
                document.getElementById('search-results').classList.remove('visible');
            }
    
        });    
    
        // NEW: Prevent settings dropdown toggle from navigating
        const settingsToggle = document.getElementById('nav-settings-dropdown');
        if (settingsToggle) {
            settingsToggle.addEventListener('click', (e) => {
                e.preventDefault(); // يمنع الرابط من تغيير الـ hash والانتقال للصفحة الرئيسية
            });
        }
    }
    
    function renderAddUserForm() {
        const isSuperAdmin = currentUserProfile && currentUserProfile.role === 'super_admin';
    
        const formHtml = `
            <form id="add-user-form" class="styled-form">
                <div class="form-group">
                    <label for="full_name">الاسم الكامل</label>
                    <input type="text" id="full_name" name="full_name" required>
                </div>
                <div class="form-group">
                    <label for="email">البريد الإلكتروني</label>
                    <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                    <label for="password">كلمة المرور</label>
                    <input type="password" id="password" name="password" required>
                </div>
                ${isSuperAdmin ? `
                    <div class="form-group">
                        <label for="role">الدور</label>
                        <select id="role" name="role"><option value="employee">موظف</option><option value="admin">مسؤول</option></select>
                    </div>
                ` : '<input type="hidden" id="role" name="role" value="employee">'}
            </form>
        `;
    
        showConfirmationModal(formHtml, () => {
            const form = document.getElementById('add-user-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
    
            // Handle user creation logic here
            console.log('Creating user with data:', data);
    
        }, {
            title: 'إضافة موظف جديد',
            confirmText: 'إنشاء',
            cancelText: 'إلغاء'
        });
    }
    
    async function renderStatisticsPage() {
        if (!window.appContent) {
            console.error("app-content element not found!");
            return;
        }
        try {
            const response = await fetch('/pages/statistics.html');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            window.appContent.innerHTML = html;
            // Dynamically import and initialize the page's script
                const statsModule = await import('/js/pages/statistics.js');
            if (statsModule && typeof statsModule.init === 'function') {
                statsModule.init();
            } else {
                console.warn('Statistics initialization function not found.');
            }
        } catch (error) {
            console.error("Failed to load statistics page:", error);
            window.appContent.innerHTML = `<p class="error-message">فشل تحميل صفحة الإحصائيات: ${error.message}</p>`;
        }
    }
    
    async function renderAnalyticsPage() {
        if (!window.appContent) {
            console.error("app-content element not found!");
            return;
        }
        try {
            const response = await fetch('/pages/analytics.html');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            window.appContent.innerHTML = html;
            // Dynamically import and initialize the analytics page script
            try {
                const analyticsModule = await import('/js/pages/analytics.js');
                if (analyticsModule && typeof analyticsModule.init === 'function') {
                    analyticsModule.init();
                } else {
                    throw new Error('Analytics dashboard initialization function not found');
                }
            } catch (e) {
                // Re-throw to be caught by outer catch and displayed to the user
                throw e;
            }
        } catch (error) {
            console.error("Failed to load analytics page:", error);
            window.appContent.innerHTML = `<p class="error-message">فشل تحميل صفحة التحليلات: ${error.message}</p>`;
        }
    }
    
    // Main entry point when the page loads
    document.addEventListener('DOMContentLoaded', () => {
        applyInitialTheme();
        setupNavbar();
        setupAutoHidingNavbar();
        initializeApp();
        // NEW: Initialize the real-time listener. This function needs to be
        // implemented with your actual WebSocket logic.
        setupRealtimeListeners();
        createFloatingParticles(); // --- NEW: Add animated background to the main app ---
    
        // --- NEW: Listen for browser online/offline events ---
        window.addEventListener('offline', () => {
            updateStatus('error', 'غير متصل. تحقق من اتصالك بالإنترنت.');
        });
    
        window.addEventListener('online', () => {
            updateStatus('connecting', 'تم استعادة الاتصال. جاري إعادة المزامنة...');
            // Attempt to re-initialize the session
            initializeApp();
        });
    });
    

})(window);
