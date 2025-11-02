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