let agentStats = [];

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
            <div class="leaderboard-filters">
                <div class="filter-group">
                    <label class="filter-label">ترتيب حسب</label>
                    <div class="filter-buttons" data-filter-group="sort">
                        <button class="filter-btn active" data-sort="total_views"><i class="fas fa-eye"></i> المشاهدات</button>
                        <button class="filter-btn" data-sort="total_reactions"><i class="fas fa-heart"></i> التفاعلات</button>
                        <button class="filter-btn" data-sort="total_participants"><i class="fas fa-users"></i> المشاركات</button>
                        <button class="filter-btn" data-sort="growth_rate"><i class="fas fa-chart-line"></i> النمو</button>
                    </div>
                </div>
                <div class="filter-group">
                    <label class="filter-label">فلترة حسب التصنيف</label>
                    <div class="filter-buttons" data-filter-group="classification">
                        <button class="filter-btn active" data-filter="all">الكل</button>
                        <button class="filter-btn classification-badge classification-r" data-filter="R">R</button>
                        <button class="filter-btn classification-badge classification-a" data-filter="A">A</button>
                        <button class="filter-btn classification-badge classification-b" data-filter="B">B</button>
                        <button class="filter-btn classification-badge classification-c" data-filter="C">C</button>
                    </div>
                </div>
                <div class="filter-group">
                    <label class="filter-label">النطاق الزمني</label>
                    <div class="filter-buttons" data-filter-group="date">
                        <button class="filter-btn active" data-range="all">الكل</button>
                        <button class="filter-btn" data-range="week"><i class="fas fa-calendar-week"></i> هذا الأسبوع</button>
                        <button class="filter-btn" data-range="month"><i class="fas fa-calendar-day"></i> هذا الشهر</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="leaderboard-content-container">
        </div>
    `;

    // Initial fetch for all time
    await fetchAndRenderTopAgents('all');

    // --- NEW: Add listener for export button ---
    const exportBtn = document.getElementById('export-top-agents-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => exportTopAgentsToCSV(agentStats));
    }

    // --- NEW: Simplified Filter Listeners ---
    const dateFilterGroup = document.querySelector('.filter-buttons[data-filter-group="date"]');
    dateFilterGroup.addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            dateFilterGroup.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            fetchAndRenderTopAgents(e.target.dataset.range);
        }
    });

    // Setup sort and classification filters to re-apply sorting/filtering on the current data
    const sortFilterGroup = document.querySelector('.filter-buttons[data-filter-group="sort"]');
    const classificationFilterGroup = document.querySelector('.filter-buttons[data-filter-group="classification"]');
    if (sortFilterGroup && classificationFilterGroup) {
        setupTopAgentsFilters();
    }
}

async function fetchAndRenderTopAgents(dateRange = 'all') {
    const container = document.getElementById('leaderboard-content-container');
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    let competitionsQuery = supabase.from('competitions')
        .select('agent_id, views_count, reactions_count, participants_count, created_at')
        .not('views_count', 'is', null)
        .order('created_at', { ascending: false });

    if (dateRange !== 'all') {
        competitionsQuery = competitionsQuery.gte('created_at', getStartDateForRange(dateRange).toISOString());
    }

    const [agentsResult, competitionsResult] = await Promise.all([
        supabase.from('agents').select('id, name, agent_id, avatar_url, classification, rank, created_at'),
        competitionsQuery
    ]);

    if (agentsResult.error || competitionsResult.error) {
        document.getElementById('leaderboard-content-container').innerHTML = '<p class="error">فشل تحميل بيانات الوكلاء.</p>';
        return;
    }

    const agents = agentsResult.data;
    const competitions = competitionsResult.data;

    // Group competitions by agent
    const competitionsByAgent = competitions.reduce((acc, comp) => {
        if (!acc[comp.agent_id]) {
            acc[comp.agent_id] = [];
        }
        acc[comp.agent_id].push(comp);
        return acc;
    }, {});

    agentStats = agents.map(agent => {
        const agentComps = competitionsByAgent[agent.id] || [];
        const total_views = agentComps.reduce((sum, c) => sum + (c.views_count || 0), 0);
        const total_reactions = agentComps.reduce((sum, c) => sum + (c.reactions_count || 0), 0);
        const total_participants = agentComps.reduce((sum, c) => sum + (c.participants_count || 0), 0);

        let growth_rate = 0;
        let trend = 'stable'; // 'up', 'down', 'stable'
        if (agentComps.length >= 2) {
            const latest = agentComps[0];
            const previous = agentComps[1];
            const latestTotal = (latest.views_count || 0) + (latest.reactions_count || 0) + (latest.participants_count || 0);
            const previousTotal = (previous.views_count || 0) + (previous.reactions_count || 0) + (previous.participants_count || 0);
            if (previousTotal > 0) {
                growth_rate = ((latestTotal - previousTotal) / previousTotal) * 100;
                if (growth_rate > 5) trend = 'up';
                else if (growth_rate < -5) trend = 'down';
            }
        }

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

function setupTopAgentsFilters() {
    const sortFilterGroup = document.querySelector('.filter-buttons[data-filter-group="sort"]');
    const classificationFilterGroup = document.querySelector('.filter-buttons[data-filter-group="classification"]');

    // --- NEW: Define classification order for secondary sorting ---
    const classificationOrder = { 'R': 1, 'A': 2, 'B': 3, 'C': 4 };

    const applyFilters = () => {
        const sortKey = sortFilterGroup.querySelector('.active')?.dataset.sort || 'default';
        const classification = classificationFilterGroup.querySelector('.active')?.dataset.filter || 'all';

        let filteredAgents = window.currentAgentStats || [];

        // Filter by classification first
        if (classification !== 'all') {
            filteredAgents = filteredAgents.filter(agent => agent.classification === classification);
        }

        // Sort by the selected metric (primary) and then by classification (secondary)
        filteredAgents.sort((a, b) => {
            if (sortKey === 'default') {
                // Default sort by creation date
                return new Date(b.created_at) - new Date(a.created_at);
            }

            const sortValue = b[sortKey] - a[sortKey];
            if (sortValue !== 0) return sortValue;
            // If metrics are equal, sort by classification order
            const orderA = classificationOrder[a.classification] || 99;
            const orderB = classificationOrder[b.classification] || 99;
            return orderA - orderB;
        });

        displayTopAgents(filteredAgents, sortKey);
    };

    sortFilterGroup.addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            sortFilterGroup.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            applyAndDisplay();
        }
    });

    classificationFilterGroup.addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            classificationFilterGroup.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            applyAndDisplay();
        }
    });
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

    // --- NEW: Separate top 3 and the rest ---
    const topThree = sortedAgents.slice(0, 3);
    const runnersUp = sortedAgents.slice(3);
    const exclusiveRanks = ['Center', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Sapphire', 'Emerald', 'King', 'Legend', 'وكيل حصري بدون مرتبة'];
    const regularRanks = ['Beginning', 'Growth', 'Pro', 'Elite'];
    const exclusiveRunnersUp = runnersUp.filter(agent => exclusiveRanks.includes(agent.rank));
    const regularRunnersUp = runnersUp.filter(agent => regularRanks.includes(agent.rank));
    const topAgentBadge = dateRange === 'week' ? 'وكيل الأسبوع' : (dateRange === 'month' ? 'وكيل الشهر' : '');

    const renderCard = (agent, rank) => {
        const isTopThree = rank <= 3;
        const rankClass = rank === 1 ? 'gold' : (rank === 2 ? 'silver' : 'bronze');
        const trendIcon = agent.trend === 'up' ? '<i class="fas fa-arrow-up trend-up"></i>' : (agent.trend === 'down' ? '<i class="fas fa-arrow-down trend-down"></i>' : '');
        const avatarHtml = agent.avatar_url
            ? `<img src="${agent.avatar_url}" alt="Avatar" class="leaderboard-avatar" loading="lazy">`
            : `<div class="leaderboard-avatar-placeholder"><i class="fas fa-user"></i></div>`;

        return `
            <div class="leaderboard-card ${isTopThree ? `top-rank ${rankClass}` : ''}" onclick="window.location.hash='#profile/${agent.id}'">
                ${rank === 1 ? '<div class="glow-bar"></div>' : ''}
                <div class="leaderboard-rank">
                    ${isTopThree ? `<div class="medal-badge ${rankClass}">${getRankIcon(rank)}</div>` : getRankIcon(rank)}
                </div>
                <div class="leaderboard-main">
                    ${avatarHtml}
                    <div class="leaderboard-agent-info">
                        <h3 class="leaderboard-agent-name">${agent.name} ${trendIcon}</h3>
                        <div class="leaderboard-agent-meta">
                            <span class="leaderboard-agent-id">#${agent.agent_id}</span>
                            <span class="leaderboard-rank-badge">${agent.rank}</span>
                        </div>
                    </div>
                </div>
                <div class="leaderboard-stats">
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
            <div class="leaderboard-card-simple" onclick="window.location.hash='#profile/${agent.id}'">
                <span class="simple-rank">${rank}</span>
                ${avatarHtml}
                <div class="simple-agent-info">
                    <span class="simple-agent-name">${agent.name}</span>
                    <span class="simple-agent-id">#${agent.agent_id}</span>
                </div>
                <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
            </div>
        `;
    };

    container.innerHTML = `
        ${topThree.length > 0 ? `
            <div class="leaderboard-top-three">
                ${topThree.map((agent, index) => renderCard(agent, index + 1)).join('')}
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
                    <div class="leaderboard-simple-list">${regularRunnersUp.map((agent, index) => renderSimpleCard(agent, index + 1)).join('')}</div>
                </div>
            </div>
        ` : ''}
    `;
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

    const headers = ['الترتيب', 'الاسم', 'رقم الوكالة', 'المرتبة', 'التصنيف', 'إجمالي المشاهدات', 'إجمالي التفاعلات', 'إجمالي المشاركات', 'معدل النمو (%)'];
    const rows = agentsToExport.map((agent, index) => [
        index + 1,
        agent.name,
        agent.agent_id,
        agent.rank,
        agent.classification,
        agent.total_views,
        agent.total_reactions,
        agent.total_participants,
        agent.growth_rate.toFixed(2)
    ]);

    let csvContent = "\uFEFF"; // BOM for UTF-8 Excel compatibility
    csvContent += headers.join(',') + '\r\n';
    rows.forEach(rowArray => {
        let row = rowArray.join(',');
        csvContent += row + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Top_Agents_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

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