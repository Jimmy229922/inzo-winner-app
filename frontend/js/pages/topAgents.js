// topAgents.js - Updated: 2025-11-16 with Clear Filter Button
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
                <div class="filter-group custom-date-filter">
                    <label class="filter-label"><i class="fas fa-calendar-alt"></i> نطاق مخصص</label>
                    <div class="date-inputs-row">
                        <div class="date-input-wrapper">
                            <label class="date-label">من</label>
                            <input type="date" id="topAgentsCustomFrom" class="date-input" />
                        </div>
                        <div class="date-input-wrapper">
                            <label class="date-label">إلى</label>
                            <input type="date" id="topAgentsCustomTo" class="date-input" />
                        </div>
                        <button id="applyCustomDateFilter" class="btn-primary" style="height: 40px; align-self: flex-end;">
                            <i class="fas fa-filter"></i> تطبيق
                        </button>
                        <button id="clearCustomDateFilter" class="btn-secondary" style="height: 40px; align-self: flex-end;">
                            <i class="fas fa-times"></i> مسح
                        </button>
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

    // --- NEW: Custom date filter ---
    const applyCustomDateBtn = document.getElementById('applyCustomDateFilter');
    const clearCustomDateBtn = document.getElementById('clearCustomDateFilter');
    const customFromInput = document.getElementById('topAgentsCustomFrom');
    const customToInput = document.getElementById('topAgentsCustomTo');
    
    if (applyCustomDateBtn) {
        applyCustomDateBtn.addEventListener('click', () => {
            const from = customFromInput.value;
            const to = customToInput.value;
            
            if (!from || !to) {
                showToast('الرجاء اختيار تاريخ البداية والنهاية', 'warning');
                return;
            }
            
            if (new Date(from) > new Date(to)) {
                showToast('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'error');
                return;
            }
            
            // Deactivate preset date buttons
            const dateFilterGroup = document.querySelector('.filter-buttons[data-filter-group="date"]');
            dateFilterGroup?.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            
            fetchAndRenderTopAgents('custom', from, to);
            showToast('تم تطبيق الفلتر المخصص', 'success');
        });
    }

    if (clearCustomDateBtn) {
        clearCustomDateBtn.addEventListener('click', () => {
            // Reset date inputs only
            customFromInput.value = '';
            customToInput.value = '';
            
            // Reactivate "all" date filter button and fetch all agents
            const dateFilterGroup = document.querySelector('.filter-buttons[data-filter-group="date"]');
            if (dateFilterGroup) {
                dateFilterGroup.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                const allBtn = dateFilterGroup.querySelector('[data-range="all"]');
                if (allBtn) allBtn.classList.add('active');
            }
            
            // Fetch and display all agents (without date filter)
            fetchAndRenderTopAgents('all');
            
            showToast('تم مسح فلتر التاريخ المخصص', 'info');
        });
    }

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
        const btn = e.target.closest('.filter-btn');
        if (!btn || !dateFilterGroup.contains(btn)) return;
        const prev = dateFilterGroup.querySelector('.active'); if (prev) prev.classList.remove('active');
        btn.classList.add('active');
        fetchAndRenderTopAgents(btn.dataset.range);
    });
    sortFilterGroup?.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn || !sortFilterGroup.contains(btn)) return;
        const prev = sortFilterGroup.querySelector('.active'); if (prev) prev.classList.remove('active');
        btn.classList.add('active');
        applyAndDisplay(); // إعادة الفرز والتصفية على البيانات الحالية
    });
    classificationFilterGroup?.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn || !classificationFilterGroup.contains(btn)) return;
        const prev = classificationFilterGroup.querySelector('.active'); if (prev) prev.classList.remove('active');
        btn.classList.add('active');
        applyAndDisplay(); // إعادة الفرز والتصفية على البيانات الحالية
    });
    // (metric selector removed per user request — always show all metrics inline)
}

async function fetchAndRenderTopAgents(dateRange = 'all', customFrom = null, customTo = null) {
    const container = document.getElementById('leaderboard-content-container');
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    try {
        console.log('='.repeat(80));
    /* logs suppressed: fetching top agents */
        
        const queryParams = new URLSearchParams();
        
        if (dateRange === 'custom' && customFrom && customTo) {
            queryParams.set('from', customFrom);
            queryParams.set('to', customTo);
        } else {
            queryParams.set('dateRange', dateRange);
        }
        
        const response = await authedFetch(`/api/stats/top-agents?${queryParams.toString()}`);

    /* logs suppressed: response status and ok */

        if (!response.ok) {
            const errorResult = await response.json();
            /* logs suppressed: error response */
            throw new Error(errorResult.message || 'فشل تحميل بيانات الوكلاء.');
        }

        const result = await response.json();
    /* logs suppressed: API result details */
        
    const topAgentsData = result.data || result; // استخراج البيانات من property "data" إذا كانت موجودة
        
    /* logs suppressed: extracted topAgents data */
        console.log('='.repeat(80));

        // The rest of the logic remains the same, but we need to adjust for _id
        processAndDisplayTopAgents(topAgentsData);
    } catch (error) {
    /* logs suppressed: catch block error */
        container.innerHTML = `<p class="error">${error.message}</p>`;
    }
}

function processAndDisplayTopAgents(agents, competitions) {
    console.log('='.repeat(80));
    /* logs suppressed: processAndDisplayTopAgents diagnostics */
    
    // Validate that agents is an array
    if (!Array.isArray(agents)) {
    /* logs suppressed: agents is not an array */
        const container = document.getElementById('leaderboard-content-container');
        container.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i><p>خطأ في تحميل البيانات: البيانات المستلمة ليست بالشكل الصحيح</p></div>';
        return;
    }
    
    if (agents.length === 0) {
    /* logs suppressed: agents array is empty */
        const container = document.getElementById('leaderboard-content-container');
        container.innerHTML = '<div class="no-results-message"><i class="fas fa-ghost"></i><p>لا توجد بيانات وكلاء متاحة.</p></div>';
        return;
    }
    
    // Group competitions by agent
    // --- FIX: The backend now sends a single array with stats already calculated ---
    agentStats = agents.map(agent => {
        const total_views = agent.total_views || 0;
        const total_reactions = agent.total_reactions || 0;
        const total_participants = agent.total_participants || 0;

        let growth_rate = 0;
        let trend = 'stable'; // 'up', 'down', 'stable'
        
        // --- NEW: Growth Rate Calculation ---
        // Growth is calculated as the change between the current period's total interactions
        // and the previous period's total interactions.
        const current_total = (agent.total_views || 0) + (agent.total_reactions || 0) + (agent.total_participants || 0);
        const previous_total = (agent.previous_total_views || 0) + (agent.previous_total_reactions || 0) + (agent.previous_total_participants || 0);

        if (previous_total > 0) {
            growth_rate = ((current_total - previous_total) / previous_total) * 100;
        } else if (current_total > 0) {
            growth_rate = 100; // Growth from 0 to a positive number is 100%
        }

        if (growth_rate > 5) trend = 'up';
        else if (growth_rate < -5) trend = 'down';

        return {
            ...agent,
            total_views, total_reactions, total_participants,
            growth_rate,
            trend
        };
    });

    /* logs suppressed: agentStats mapping */
    console.log('='.repeat(80));

    // Store globally for filtering
    window.currentAgentStats = agentStats;

    // Initial render
    applyAndDisplay();
}
function applyAndDisplay() {
    console.log('='.repeat(80));
    /* logs suppressed: applyAndDisplay called */
    
    const sortKey = document.querySelector('.filter-buttons[data-filter-group="sort"] .active')?.dataset.sort || 'total_views';
    const classification = document.querySelector('.filter-buttons[data-filter-group="classification"] .active')?.dataset.filter || 'all';
    let sortedAgents = [...(window.currentAgentStats || [])];

    /* logs suppressed: applyAndDisplay inputs */

    // 1. Filter by classification
    if (classification !== 'all') {
        sortedAgents = sortedAgents.filter(agent => agent.classification === classification);
    /* logs suppressed: after classification filter */
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

    /* logs suppressed: after sort and calling display */
    console.log('='.repeat(80));

    // 3. Display the final sorted and filtered list
    displayTopAgents(sortedAgents, sortKey);
}


function displayTopAgents(sortedAgents, sortKey) {
    console.log('='.repeat(80));
    /* logs suppressed: displayTopAgents called */
    
    const container = document.getElementById('leaderboard-content-container');
    console.log('Container found:', !!container);
    const allContainers = document.querySelectorAll('#leaderboard-content-container');
    console.log('Number of containers with this ID:', allContainers.length);
    if (container) {
        console.log('Container current innerHTML length:', container.innerHTML.length);
    }
    const dateRange = document.querySelector('.filter-buttons[data-filter-group="date"] .active')?.dataset.range || 'all';

    /* logs suppressed: container found and dateRange */

    if (!container) {
    /* logs suppressed: container not found */
        return;
    }
    // --- NEW: Clear previous content and add a loading state ---
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';


    if (!sortedAgents || sortedAgents.length === 0) {
    /* logs suppressed: no agents to display */
        container.innerHTML = '<div class="no-results-message"><i class="fas fa-ghost"></i><p>لا توجد بيانات لعرضها حسب الفلاتر المحددة.</p></div>';
        return;
    }
    
    /* logs suppressed: continuing display logic */
    console.log('='.repeat(80));

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

    // Debug logging
    console.log('Top Agents Debug:');
    console.log('Total agents:', sortedAgents.length);
    console.log('Top 3:', topThree.map(a => ({name: a.name, rank: a.rank})));
    console.log('Runners up:', runnersUp.length);
    console.log('Exclusive runners up:', exclusiveRunnersUp.length, exclusiveRunnersUp.map(a => ({name: a.name, rank: a.rank})));
    console.log('Regular runners up:', regularRunnersUp.length, regularRunnersUp.map(a => ({name: a.name, rank: a.rank})));
    console.log('Unfiltered runners up:', runnersUp.filter(agent => !exclusiveRanks.includes(agent.rank) && !regularRanks.includes(agent.rank)).map(a => ({name: a.name, rank: a.rank})));

    // --- NEW: Podium data preparation for top 3 overall ---
    const podiumData = {
        first: topThree[0],
        second: topThree[1],
        third: topThree[2]
    };
    // Order for flexbox display: 2nd, 1st, 3rd
    const podiumOrder = [podiumData.second, podiumData.first, podiumData.third].filter(Boolean);

    const topAgentBadge = dateRange === 'week' ? 'وكيل الأسبوع' : (dateRange === 'month' ? 'وكيل الشهر' : 'وكيل الموسم');

    /* logs suppressed: breakdown counts */

    const renderCard = (agent, rank, sortKey) => {
        try {
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
                            <div class="leaderboard-agent-meta" data-agent-id-copy="${agent.agent_id || 'N/A'}" title="نسخ الرقم">
                                <span class="leaderboard-agent-id">#${agent.agent_id || 'N/A'}</span>
                            </div>
                            <div class="leaderboard-agent-classification">
                                <span class="classification-badge classification-${(agent.classification || '').toLowerCase()}">${agent.classification || ''}</span>
                            </div>
                        </div>
                </div>
                <div class="leaderboard-stats-grid">
                    ${(() => {
                        const metricKeys = ['total_views','total_reactions','total_participants'];
                        const isMetricSort = metricKeys.includes(sortKey);
                        // If sorting by a metric and this agent is not top 3, show only that metric
                        if (isMetricSort && rank > 3) {
                            if (sortKey === 'total_views') {
                                return `<div class="stat-item"><span class="stat-value">${formatNumber(agent.total_views)}</span><span class="stat-label"><i class="fas fa-eye"></i> مشاهدات</span></div>`;
                            }
                            if (sortKey === 'total_reactions') {
                                return `<div class="stat-item"><span class="stat-value">${formatNumber(agent.total_reactions)}</span><span class="stat-label"><i class="fas fa-heart"></i> تفاعلات</span></div>`;
                            }
                            if (sortKey === 'total_participants') {
                                return `<div class="stat-item"><span class="stat-value">${formatNumber(agent.total_participants)}</span><span class="stat-label"><i class="fas fa-users"></i> مشاركات</span></div>`;
                            }
                        }
                        // Otherwise show all three
                        return `
                            <div class="stat-item"><span class="stat-value">${formatNumber(agent.total_views)}</span><span class="stat-label"><i class="fas fa-eye"></i> مشاهدات</span></div>
                            <div class="stat-item"><span class="stat-value">${formatNumber(agent.total_reactions)}</span><span class="stat-label"><i class="fas fa-heart"></i> تفاعلات</span></div>
                            <div class="stat-item"><span class="stat-value">${formatNumber(agent.total_participants)}</span><span class="stat-label"><i class="fas fa-users"></i> مشاركات</span></div>
                        `;
                    })()}
                </div>
                ${(rank === 1 && topAgentBadge) ? `<div class="top-agent-banner">${topAgentBadge}</div>` : ''}
            </div>
        `;
        } catch (error) {
            /* logs suppressed: error in renderCard */
            return '<div class="error-card">خطأ في عرض البطاقة</div>';
        }
    };

    const renderSimpleCard = (agent, rank, sortKey) => {
        try {
            const avatarHtml = agent.avatar_url
                ? `<img src="${agent.avatar_url}" alt="Avatar" class="leaderboard-avatar-simple" loading="lazy">`
                : `<div class="leaderboard-avatar-placeholder-simple"><i class="fas fa-user"></i></div>`;

            return `
                <div class="leaderboard-card-simple" data-agent-id="${agent._id}" style="cursor: pointer;">
                    <span class="simple-rank">${rank}</span>
                    ${avatarHtml}
                    <div class="simple-agent-info">
                        <span class="simple-agent-name">${agent.name}</span>
                        <span class="simple-agent-id" data-agent-id-copy="${agent.agent_id || 'N/A'}" title="نسخ الرقم">#${agent.agent_id || 'N/A'}</span>
                        <span class="simple-agent-classification"><span class="classification-badge classification-${(agent.classification || '').toLowerCase()}">${agent.classification || ''}</span></span>
                    </div>
                    <div class="simple-agent-stats">
                        ${(() => {
                            const metricKeys = ['total_views','total_reactions','total_participants'];
                            const isMetricSort = metricKeys.includes(sortKey);
                            if (isMetricSort && rank > 3) {
                                if (sortKey === 'total_views') return `<span class="simple-stat"><i class="fas fa-eye"></i> ${formatNumber(agent.total_views)}</span>`;
                                if (sortKey === 'total_reactions') return `<span class="simple-stat"><i class="fas fa-heart"></i> ${formatNumber(agent.total_reactions)}</span>`;
                                if (sortKey === 'total_participants') return `<span class="simple-stat"><i class="fas fa-users"></i> ${formatNumber(agent.total_participants)}</span>`;
                            }
                            return `
                                <span class="simple-stat"><i class="fas fa-eye"></i> ${formatNumber(agent.total_views)}</span>
                                <span class="simple-stat"><i class="fas fa-heart"></i> ${formatNumber(agent.total_reactions)}</span>
                                <span class="simple-stat"><i class="fas fa-users"></i> ${formatNumber(agent.total_participants)}</span>
                            `;
                        })()}
                    </div>
                </div>
            `;
        } catch (error) {
            /* logs suppressed: error in renderSimpleCard */
            return '<div class="error-card-simple">خطأ</div>';
        }
    };

    try {
        container.innerHTML = `
            ${podiumOrder.length > 0 ? `
                <div class="leaderboard-podium">
                    ${podiumOrder.map((agent) => {
                        const actualRank = sortedAgents.findIndex(a => a._id === agent._id) + 1;
                        return renderCard(agent, actualRank, sortKey);
                    }).join('')}
                </div>
            ` : ''}
            
            ${runnersUp.length > 0 ? `
                <hr class="leaderboard-divider">
                <div class="leaderboard-bottom-sections">
                    <div class="leaderboard-list-section">
                        <h2 class="leaderboard-section-title"><i class="fas fa-crown"></i> الوكلاء الحصريين</h2>
                        <div class="leaderboard-simple-list">
                            ${exclusiveRunnersUp.length > 0 ? exclusiveRunnersUp.map((agent, index) => {
                                const actualRank = sortedAgents.findIndex(a => a._id === agent._id) + 1;
                                return renderSimpleCard(agent, actualRank, sortKey);
                            }).join('') : '<p class="no-results-message">لا يوجد وكلاء حصريين لعرضهم.</p>'}
                        </div>
                    </div>
                    <div class="leaderboard-list-section">
                        <h2 class="leaderboard-section-title"><i class="fas fa-users"></i> الوكلاء الاعتياديين</h2>
                        <div class="leaderboard-simple-list">
                             ${regularRunnersUp.length > 0 ? regularRunnersUp.map((agent, index) => {
                                const actualRank = sortedAgents.findIndex(a => a._id === agent._id) + 1;
                                return renderSimpleCard(agent, actualRank, sortKey);
                            }).join('') : '<p class="no-results-message">لا يوجد وكلاء اعتياديين لعرضهم.</p>'}
                        </div>
                    </div>
                </div>
            ` : ''}
        `;

    /* logs suppressed: rendered summary */
        console.log('='.repeat(80));
    } catch (error) {
    /* logs suppressed: error rendering HTML */
        container.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i><p>حدث خطأ في عرض البيانات</p></div>';
        return;
    }

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

// --- NEW: Export to Excel Functionality (Professional) ---
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

    // Check if XLSX library is loaded
    if (typeof XLSX === 'undefined') {
        console.error('XLSX library not loaded');
        showToast('مكتبة Excel غير محملة. يرجى إعادة تحميل الصفحة.', 'error');
        return;
    }

    try {
        // Prepare data for Excel
        const dataForSheet = agentsToExport.map((agent, index) => ({
            'الترتيب': index + 1,
            'اسم الوكيل': agent.name || '-',
            'رقم الوكالة': agent.agent_id || '-',
            'المرتبة': agent.rank || '-',
            'التصنيف': agent.classification || '-',
            'إجمالي المشاهدات': agent.total_views || 0,
            'إجمالي التفاعلات': agent.total_reactions || 0,
            'إجمالي المشاركات': agent.total_participants || 0,
            'عدد المسابقات': agent.competition_count || 0,
            'معدل النمو (%)': (agent.growth_rate || 0).toFixed(2)
        }));

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(dataForSheet);

        // Set column widths
        ws['!cols'] = [
            { wch: 10 },  // الترتيب
            { wch: 25 },  // اسم الوكيل
            { wch: 15 },  // رقم الوكالة
            { wch: 18 },  // المرتبة
            { wch: 12 },  // التصنيف
            { wch: 22 },  // إجمالي المشاهدات
            { wch: 22 },  // إجمالي التفاعلات
            { wch: 22 },  // إجمالي المشاركات
            { wch: 18 },  // عدد المسابقات
            { wch: 20 }   // معدل النمو
        ];

        // Get range
        const range = XLSX.utils.decode_range(ws['!ref']);

        // Style all cells
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellAddress]) continue;

                // Initialize style object
                if (!ws[cellAddress].s) ws[cellAddress].s = {};

                // Header row styling (R === 0)
                if (R === 0) {
                    ws[cellAddress].s = {
                        font: { 
                            bold: true, 
                            sz: 14,
                            color: { rgb: "FFFFFF" }
                        },
                        fill: { 
                            fgColor: { rgb: "2E7D32" } // Dark green
                        },
                        alignment: { 
                            horizontal: "center", 
                            vertical: "center",
                            wrapText: true
                        },
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    };
                } else {
                    // Data rows styling
                    const isEvenRow = (R % 2 === 0);
                    
                    ws[cellAddress].s = {
                        font: { 
                            sz: 11
                        },
                        fill: { 
                            fgColor: { rgb: isEvenRow ? "F5F5F5" : "FFFFFF" } // Alternating row colors
                        },
                        alignment: { 
                            horizontal: "center", 
                            vertical: "center"
                        },
                        border: {
                            top: { style: "thin", color: { rgb: "E0E0E0" } },
                            bottom: { style: "thin", color: { rgb: "E0E0E0" } },
                            left: { style: "thin", color: { rgb: "E0E0E0" } },
                            right: { style: "thin", color: { rgb: "E0E0E0" } }
                        }
                    };

                    // Special styling for top 3 ranks
                    if (C === 0) { // Rank column
                        const rank = ws[cellAddress].v;
                        if (rank === 1) {
                            ws[cellAddress].s.fill = { fgColor: { rgb: "FFD700" } }; // Gold
                            ws[cellAddress].s.font.bold = true;
                            ws[cellAddress].s.font.color = { rgb: "000000" };
                        } else if (rank === 2) {
                            ws[cellAddress].s.fill = { fgColor: { rgb: "C0C0C0" } }; // Silver
                            ws[cellAddress].s.font.bold = true;
                        } else if (rank === 3) {
                            ws[cellAddress].s.fill = { fgColor: { rgb: "CD7F32" } }; // Bronze
                            ws[cellAddress].s.font.bold = true;
                            ws[cellAddress].s.font.color = { rgb: "FFFFFF" };
                        }
                    }

                    // Number formatting for numeric columns
                    if (C >= 5 && C <= 8) { // Numeric columns
                        ws[cellAddress].z = '#,##0'; // Thousands separator
                    } else if (C === 9) { // Growth rate
                        ws[cellAddress].z = '0.00"%"';
                    }
                }
            }
        }

        // Set row heights
        ws['!rows'] = [];
        ws['!rows'][0] = { hpt: 25 }; // Header row height

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'أبرز الوكلاء');

        // Add metadata
        wb.Props = {
            Title: 'تقرير أبرز الوكلاء',
            Subject: 'تقرير إحصائيات الوكلاء',
            Author: 'IB Competition System',
            CreatedDate: new Date()
        };

        // Generate filename with date and time
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `تقرير_ابرز_الوكلاء_${dateStr}_${timeStr}.xlsx`;

        // Download file
        XLSX.writeFile(wb, filename);
        
        showToast('تم تصدير البيانات بنجاح إلى Excel! 📊', 'success');
    } catch (err) {
        console.error('Failed to export to Excel:', err);
        showToast('فشل تصدير الملف. يرجى المحاولة مرة أخرى.', 'error');
    }
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