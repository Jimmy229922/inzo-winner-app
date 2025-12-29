// topAgents.js - Updated: 2025-11-16 with Clear Filter Button
let agentStats = [];
let selectedAgentsForComparison = [];
let isTopAgentsComparisonMode = false;

// --- Debugging: enable detailed logs for this page ---
// Enable by running in DevTools console:
//   window.__setTopAgentsDebug(true)
// Or set localStorage key:
//   localStorage.setItem('debugTopAgents', '1')
// Or add query param:
//   ?debugTopAgents=1
let _topAgentsDebugOverride = null;
const readTopAgentsDebugFlag = () => {
    try {
        const fromStorage = typeof localStorage !== 'undefined' && localStorage.getItem('debugTopAgents') === '1';
        const fromQuery = typeof window !== 'undefined' && new URLSearchParams(window.location.search || '').get('debugTopAgents') === '1';
        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        // Default ON in local dev so issues are visible without extra steps.
        return !!(fromStorage || fromQuery || isLocalhost);
    } catch (_) {
        return false;
    }
};

const topAgentsDebug = {
    get enabled() { return _topAgentsDebugOverride !== null ? !!_topAgentsDebugOverride : readTopAgentsDebugFlag(); },
    log: (...args) => { if (topAgentsDebug.enabled) console.log(...args); },
    warn: (...args) => { if (topAgentsDebug.enabled) console.warn(...args); },
    error: (...args) => { if (topAgentsDebug.enabled) console.error(...args); },
    groupCollapsed: (label) => { if (topAgentsDebug.enabled) console.groupCollapsed(label); },
    groupEnd: () => { if (topAgentsDebug.enabled) console.groupEnd(); },
    table: (data) => { if (topAgentsDebug.enabled && typeof console.table === 'function') console.table(data); },
};

window.__setTopAgentsDebug = (enabled) => {
    try {
        _topAgentsDebugOverride = !!enabled;
        localStorage.setItem('debugTopAgents', enabled ? '1' : '0');
        console.log(`[TopAgents][debug] ${enabled ? 'enabled' : 'disabled'} (no reload needed; navigate or re-open #top-agents)`);
    } catch (e) {
        console.warn('[TopAgents][debug] failed to write localStorage', e);
    }
};

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

// --- NEW: Animate Value Function ---
function animateValue(obj, start, end, duration) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        obj.innerHTML = formatNumber(value);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = formatNumber(end); // Ensure final value is exact
        }
    };
    window.requestAnimationFrame(step);
}

async function renderTopAgentsPage() {
    if (topAgentsDebug.enabled) {
        console.log('[TopAgents][debug] renderTopAgentsPage()', {
            hash: window.location.hash,
            search: window.location.search,
            debugTopAgents: (typeof localStorage !== 'undefined') ? localStorage.getItem('debugTopAgents') : null,
        });

        // Cross-check: how many agents exist in the system vs how many the leaderboard endpoint returns.
        // This helps detect "missing agents" being a backend-data issue vs frontend filtering.
        try {
            const agentsRes = await authedFetch('/api/agents?limit=1&select=_id');
            if (agentsRes.ok) {
                const agentsJson = await agentsRes.json();
                const totalAgentsCount = agentsJson?.count;
                console.log('[TopAgents][debug] /api/agents count:', totalAgentsCount);
            } else {
                console.warn('[TopAgents][debug] /api/agents count request failed:', agentsRes.status);
            }
        } catch (e) {
            console.warn('[TopAgents][debug] /api/agents count request error:', e?.message || e);
        }
    }

    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1 class="leaderboard-title"><i class="fas fa-chart-bar"></i> أبرز الوكلاء</h1>
                <div class="header-actions-group">
                    <button id="compare-agents-btn" class="btn-secondary"><i class="fas fa-balance-scale"></i> مقارنة</button>
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
        
        <!-- Comparison Floating Bar -->
        <div id="comparison-floating-bar" class="comparison-floating-bar">
            <div class="selected-agents-preview" id="selected-agents-preview"></div>
            <span id="comparison-count-text">تم اختيار 0 من 3</span>
            <button id="show-comparison-modal-btn" class="btn-primary">عرض المقارنة</button>
            <button id="cancel-comparison-btn" class="btn-secondary"><i class="fas fa-times"></i></button>
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
        // console.log('='.repeat(80));
    /* logs suppressed: fetching top agents */
        
        const queryParams = new URLSearchParams();

        // Fetch a sufficiently large leaderboard so agents don't "disappear" due to a small default limit.
        // Keep it reasonable for production (large legacy datasets) while allowing override for debugging.
        let limit = 100;
        try {
            const sp = new URLSearchParams(window.location.search || '');
            const q = parseInt(sp.get('topAgentsLimit') || '', 10);
            const s = parseInt((typeof localStorage !== 'undefined' ? localStorage.getItem('topAgentsLimit') : '') || '', 10);
            const override = Number.isFinite(q) ? q : (Number.isFinite(s) ? s : NaN);
            if (Number.isFinite(override) && override > 0 && override <= 5000) {
                limit = override;
            }
        } catch (_) { /* ignore */ }
        queryParams.set('limit', String(limit));
        
        if (dateRange === 'custom' && customFrom && customTo) {
            queryParams.set('from', customFrom);
            queryParams.set('to', customTo);
        } else {
            queryParams.set('dateRange', dateRange);
        }

        const url = `/api/stats/top-agents?${queryParams.toString()}`;
        topAgentsDebug.log('[TopAgents][debug] Fetching top agents:', url);

        const response = await authedFetch(url);

    /* logs suppressed: response status and ok */

        if (!response.ok) {
            const errorResult = await response.json();
            /* logs suppressed: error response */
            throw new Error(errorResult.message || 'فشل تحميل بيانات الوكلاء.');
        }

        const result = await response.json();
    /* logs suppressed: API result details */
        
    const topAgentsData = result.data || result; // استخراج البيانات من property "data" إذا كانت موجودة

    if (topAgentsDebug.enabled) {
        const count = Array.isArray(topAgentsData) ? topAgentsData.length : null;
        topAgentsDebug.log('[TopAgents][debug] /top-agents received:', { isArray: Array.isArray(topAgentsData), count });
        if (Array.isArray(topAgentsData) && topAgentsData.length > 0) {
            topAgentsDebug.table(
                topAgentsData.slice(0, 15).map(a => ({
                    _id: a?._id,
                    agent_id: a?.agent_id,
                    name: a?.name,
                    rank: a?.rank,
                    classification: a?.classification,
                    is_exclusive: a?.is_exclusive,
                    competition_count: a?.competition_count,
                    total_views: a?.total_views,
                    total_reactions: a?.total_reactions,
                    total_participants: a?.total_participants,
                }))
            );
        }
    }
        
    /* logs suppressed: extracted topAgents data */
        // console.log('='.repeat(80));

        // The rest of the logic remains the same, but we need to adjust for _id
        processAndDisplayTopAgents(topAgentsData);
    } catch (error) {
    /* logs suppressed: catch block error */
        container.innerHTML = `<p class="error">${error.message}</p>`;
    }
}

function processAndDisplayTopAgents(agents, competitions) {
    // console.log('='.repeat(80));
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
    // console.log('='.repeat(80));

    // Store globally for filtering
    window.currentAgentStats = agentStats;

    // Initial render
    applyAndDisplay();
}
function applyAndDisplay() {
    // console.log('='.repeat(80));
    /* logs suppressed: applyAndDisplay called */
    
    const sortKey = document.querySelector('.filter-buttons[data-filter-group="sort"] .active')?.dataset.sort || 'total_views';
    const classification = document.querySelector('.filter-buttons[data-filter-group="classification"] .active')?.dataset.filter || 'all';
    let sortedAgents = [...(window.currentAgentStats || [])];

    topAgentsDebug.groupCollapsed(`[TopAgents] applyAndDisplay | sort=${sortKey} | classification=${classification} | total=${sortedAgents.length}`);
    if (topAgentsDebug.enabled) {
        const classCounts = sortedAgents.reduce((acc, a) => {
            const key = (a?.classification ?? 'N/A');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        topAgentsDebug.log('Classification counts (before filter):', classCounts);
    }

    /* logs suppressed: applyAndDisplay inputs */

    // 1. Filter by classification
    if (classification !== 'all') {
        sortedAgents = sortedAgents.filter(agent => agent.classification === classification);
    /* logs suppressed: after classification filter */
    }

    topAgentsDebug.log('After classification filter count:', sortedAgents.length);

    // 2. Sort the filtered list
    const classificationOrder = { 'R': 1, 'A': 2, 'B': 3, 'C': 4 };
    sortedAgents.sort((a, b) => {
        const sortValue = b[sortKey] - a[sortKey];
        if (sortValue !== 0) return sortValue;
        const orderA = classificationOrder[a.classification] || 99;
        const orderB = classificationOrder[b.classification] || 99;
        return orderA - orderB;
    });

    if (topAgentsDebug.enabled) {
        topAgentsDebug.table(
            sortedAgents.slice(0, 10).map((a, idx) => ({
                idx: idx + 1,
                _id: a?._id,
                name: a?.name,
                rank: a?.rank,
                classification: a?.classification,
                is_exclusive: a?.is_exclusive,
                total_views: a?.total_views,
                total_reactions: a?.total_reactions,
                total_participants: a?.total_participants,
                growth_rate: a?.growth_rate,
            }))
        );
    }

    /* logs suppressed: after sort and calling display */
    // console.log('='.repeat(80));

    // 3. Display the final sorted and filtered list
    displayTopAgents(sortedAgents, sortKey);

    topAgentsDebug.groupEnd();
}


function displayTopAgents(sortedAgents, sortKey) {
    // console.log('='.repeat(80));
    /* logs suppressed: displayTopAgents called */
    
    const container = document.getElementById('leaderboard-content-container');
    /* console.log('Container found:', !!container);
    const allContainers = document.querySelectorAll('#leaderboard-content-container');
    console.log('Number of containers with this ID:', allContainers.length);
    if (container) {
        console.log('Container current innerHTML length:', container.innerHTML.length);
    } */
    const dateRange = document.querySelector('.filter-buttons[data-filter-group="date"] .active')?.dataset.range || 'all';

    topAgentsDebug.groupCollapsed(`[TopAgents] displayTopAgents | sort=${sortKey} | dateRange=${dateRange} | count=${sortedAgents?.length || 0}`);
    topAgentsDebug.log('Container exists:', !!container);

    /* logs suppressed: container found and dateRange */

    if (!container) {
    /* logs suppressed: container not found */
        return;
    }
    // --- NEW: Skeleton Loading State ---
    container.innerHTML = `
        <div class="leaderboard-podium">
            <div class="skeleton-card" style="width: 30%; height: 300px;"></div>
            <div class="skeleton-card" style="width: 36%; height: 350px;"></div>
            <div class="skeleton-card" style="width: 30%; height: 300px;"></div>
        </div>
        <div class="leaderboard-list-section">
            <div class="skeleton-card" style="width: 100%; height: 100px; margin-bottom: 10px;"></div>
            <div class="skeleton-card" style="width: 100%; height: 100px; margin-bottom: 10px;"></div>
            <div class="skeleton-card" style="width: 100%; height: 100px; margin-bottom: 10px;"></div>
        </div>
    `;


    if (!sortedAgents || sortedAgents.length === 0) {
    /* logs suppressed: no agents to display */
        container.innerHTML = '<div class="no-results-message"><i class="fas fa-ghost"></i><p>لا توجد بيانات لعرضها حسب الفلاتر المحددة.</p></div>';
        return;
    }
    
    /* logs suppressed: continuing display logic */
    topAgentsDebug.log('='.repeat(80));

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

    const normalizeRank = (rank) => {
        if (rank === null || rank === undefined) return '';
        const trimmed = String(rank).trim();
        // Only uppercase latin-based ranks; keep Arabic as-is
        return /[A-Za-z]/.test(trimmed) ? trimmed.toUpperCase() : trimmed;
    };

    const exclusiveRankSet = new Set(exclusiveRanks.map(normalizeRank));
    const regularRankSet = new Set(regularRanks.map(normalizeRank));

    const isExclusiveByLegacySignals = (agent) => {
        const rankKey = normalizeRank(agent?.rank);
        const classKey = String(agent?.classification || '').trim().toUpperCase();
        if (classKey === 'EXCLUSIVE' || classKey === 'E') return true;
        if (exclusiveRankSet.has(rankKey)) return true;
        // Heuristic for legacy Arabic/strings
        const raw = String(agent?.rank || '').trim();
        if (raw.includes('حصري') || raw.toLowerCase().includes('exclusive')) return true;
        return false;
    };

    const isExclusiveAgent = (agent) => {
        // Prefer backend-computed flag when available
        if (typeof agent?.is_exclusive === 'boolean') return agent.is_exclusive;
        return isExclusiveByLegacySignals(agent);
    };
    
    const orderAgentsByRank = (agents, rankOrder) => {
        const orderMap = rankOrder.reduce((acc, rank, idx) => {
            acc[normalizeRank(rank)] = idx;
            return acc;
        }, {});
        return agents.slice().sort((a, b) => {
            const aRank = normalizeRank(a.rank);
            const bRank = normalizeRank(b.rank);
            const aOrder = orderMap.hasOwnProperty(aRank) ? orderMap[aRank] : Number.MAX_SAFE_INTEGER;
            const bOrder = orderMap.hasOwnProperty(bRank) ? orderMap[bRank] : Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            const metricDiff = (b[sortKey] || 0) - (a[sortKey] || 0);
            if (metricDiff !== 0) return metricDiff;
            return (a.name || '').localeCompare(b.name || '', 'ar');
        });
    };

    const exclusiveRunnersUp = orderAgentsByRank(
        runnersUp.filter(agent => isExclusiveAgent(agent)),
        exclusiveRanks
    );

    const baseRegularRunnersUp = orderAgentsByRank(
        runnersUp.filter(agent => !isExclusiveAgent(agent) && regularRankSet.has(normalizeRank(agent.rank))),
        regularRanks
    );

    // IMPORTANT: Any agent not matching either list used to be dropped entirely.
    // To avoid "missing" agents, we bucket unknown/missing ranks by exclusivity (backend flag if present).
    const unknownExclusiveRunnersUp = orderAgentsByRank(
        runnersUp.filter(agent => {
            const rankKey = normalizeRank(agent.rank);
            return !exclusiveRankSet.has(rankKey) && !regularRankSet.has(rankKey) && isExclusiveAgent(agent);
        }),
        []
    );
    const unknownRegularRunnersUp = orderAgentsByRank(
        runnersUp.filter(agent => {
            const rankKey = normalizeRank(agent.rank);
            return !exclusiveRankSet.has(rankKey) && !regularRankSet.has(rankKey) && !isExclusiveAgent(agent);
        }),
        []
    );

    const regularRunnersUp = baseRegularRunnersUp.concat(unknownRegularRunnersUp);
    const finalExclusiveRunnersUp = exclusiveRunnersUp.concat(unknownExclusiveRunnersUp);

    if (topAgentsDebug.enabled) {
        topAgentsDebug.log('Top 3 count:', topThree.length);
        topAgentsDebug.table(topThree.map((a, idx) => ({
            idx: idx + 1,
            _id: a?._id,
            name: a?.name,
            rank: a?.rank,
            classification: a?.classification,
            is_exclusive: a?.is_exclusive,
            total_views: a?.total_views,
            total_reactions: a?.total_reactions,
            total_participants: a?.total_participants,
        })));

        topAgentsDebug.log('Runners up count:', runnersUp.length);
        topAgentsDebug.log('Exclusive runners up count:', finalExclusiveRunnersUp.length);
        topAgentsDebug.log('Regular runners up count:', baseRegularRunnersUp.length);
        topAgentsDebug.log('Unknown-rank exclusive count:', unknownExclusiveRunnersUp.length);
        topAgentsDebug.log('Unknown-rank regular count:', unknownRegularRunnersUp.length);

        const showUnknown = (label, list) => {
            if (!list || list.length === 0) return;
            topAgentsDebug.warn(label);
            topAgentsDebug.table(
                list.slice(0, 50).map(a => ({
                    _id: a?._id,
                    name: a?.name,
                    rank: a?.rank,
                    rankKey: normalizeRank(a?.rank),
                    classification: a?.classification,
                    is_exclusive: a?.is_exclusive,
                    total_views: a?.total_views,
                    total_reactions: a?.total_reactions,
                    total_participants: a?.total_participants,
                }))
            );
        };

        showUnknown('Unknown/missing-rank agents bucketed as EXCLUSIVE:', unknownExclusiveRunnersUp);
        showUnknown('Unknown/missing-rank agents bucketed as REGULAR:', unknownRegularRunnersUp);
    }

    // Debug logging
    /* console.log('Top Agents Debug:');
    console.log('Total agents:', sortedAgents.length);
    console.log('Top 3:', topThree.map(a => ({name: a.name, rank: a.rank})));
    console.log('Runners up:', runnersUp.length);
    console.log('Exclusive runners up:', exclusiveRunnersUp.length, exclusiveRunnersUp.map(a => ({name: a.name, rank: a.rank})));
    console.log('Regular runners up:', regularRunnersUp.length, regularRunnersUp.map(a => ({name: a.name, rank: a.rank})));
    console.log('Unfiltered runners up:', runnersUp.filter(agent => !exclusiveRanks.includes(agent.rank) && !regularRanks.includes(agent.rank)).map(a => ({name: a.name, rank: a.rank}))); */

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

            // Determine if agent is exclusive
            const isExclusive = isExclusiveAgent(agent);
            const exclusiveTitle = agent.agency_type || (isExclusive ? "وكيل حصري" : "وكيل اعتيادي");
            const exclusiveBadge = isExclusive 
                ? `<div class="exclusive-badge" title="${exclusiveTitle}"><i class="fas fa-crown"></i></div>` 
                : `<div class="regular-badge" title="${exclusiveTitle}"><i class="fas fa-star"></i></div>`;

            // --- NEW: Special Badges Logic ---
            const isHotStreak = agent.growth_rate > 15;
            const isNewcomer = agent.growth_rate === 100 && agent.total_views < 5000; // Heuristic for newcomer

            let specialBadgesHtml = '';
            if (isHotStreak) specialBadgesHtml += `<div class="special-badge badge-hot"><i class="fas fa-fire"></i> Hot Streak</div>`;
            if (isNewcomer) specialBadgesHtml += `<div class="special-badge badge-new"><i class="fas fa-star"></i> New</div>`;

            return `
                <div class="leaderboard-card ${isTopThree ? `top-rank ${rankClass}` : ''}" data-agent-id="${agent._id}" style="cursor: pointer;">
                    ${specialBadgesHtml}
                    <div class="leaderboard-rank">
                        ${isTopThree ? `<div class="medal-badge ${rankClass}">${getRankIcon(rank)}</div>` : getRankIcon(rank)}
                    </div>
                    ${rank === 1 ? '<div class="glow-bar"></div>' : ''}
                    <div class="leaderboard-agent-profile">
                        <div style="position: relative;">
                            ${avatarHtml}
                            ${exclusiveBadge}
                        </div>
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
                        
                        // Special layout for Top 3
                        if (isTopThree) {
                             return `
                                <div class="stat-item top-stat-item">
                                    <span class="stat-label"><i class="fas fa-eye"></i> مشاهدات</span>
                                    <span class="stat-value" data-animate-to="${agent.total_views}">0</span>
                                </div>
                                <div class="stat-item top-stat-item">
                                    <span class="stat-label"><i class="fas fa-heart"></i> تفاعلات</span>
                                    <span class="stat-value" data-animate-to="${agent.total_reactions}">0</span>
                                </div>
                                <div class="stat-item top-stat-item">
                                    <span class="stat-label"><i class="fas fa-users"></i> مشاركات</span>
                                    <span class="stat-value" data-animate-to="${agent.total_participants}">0</span>
                                </div>
                            `;
                        }

                        // If sorting by a metric and this agent is not top 3, show only that metric
                        if (isMetricSort && rank > 3) {
                            if (sortKey === 'total_views') {
                                return `<div class="stat-item"><span class="stat-value" data-animate-to="${agent.total_views}">0</span><span class="stat-label"><i class="fas fa-eye"></i> مشاهدات</span></div>`;
                            }
                            if (sortKey === 'total_reactions') {
                                return `<div class="stat-item"><span class="stat-value" data-animate-to="${agent.total_reactions}">0</span><span class="stat-label"><i class="fas fa-heart"></i> تفاعلات</span></div>`;
                            }
                            if (sortKey === 'total_participants') {
                                return `<div class="stat-item"><span class="stat-value" data-animate-to="${agent.total_participants}">0</span><span class="stat-label"><i class="fas fa-users"></i> مشاركات</span></div>`;
                            }
                        }
                        // Otherwise show all three
                        return `
                            <div class="stat-item"><span class="stat-value" data-animate-to="${agent.total_views}">0</span><span class="stat-label"><i class="fas fa-eye"></i> مشاهدات</span></div>
                            <div class="stat-item"><span class="stat-value" data-animate-to="${agent.total_reactions}">0</span><span class="stat-label"><i class="fas fa-heart"></i> تفاعلات</span></div>
                            <div class="stat-item"><span class="stat-value" data-animate-to="${agent.total_participants}">0</span><span class="stat-label"><i class="fas fa-users"></i> مشاركات</span></div>
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

            // Determine if agent is exclusive
            const isExclusive = isExclusiveAgent(agent);
            const exclusiveTitle = agent.agency_type || (isExclusive ? "وكيل حصري" : "وكيل اعتيادي");
            const exclusiveIcon = isExclusive 
                ? `<i class="fas fa-crown" style="color: #f1c40f; margin-left: 5px;" title="${exclusiveTitle}"></i>` 
                : `<i class="fas fa-star" style="color: #95a5a6; margin-left: 5px;" title="${exclusiveTitle}"></i>`;

            return `
                <div class="leaderboard-card-simple" data-agent-id="${agent._id}" style="cursor: pointer;">
                    <span class="simple-rank">${rank}</span>
                    ${avatarHtml}
                    <div class="simple-agent-info">
                        <span class="simple-agent-name">${agent.name} ${exclusiveIcon}</span>
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
                            ${finalExclusiveRunnersUp.length > 0 ? finalExclusiveRunnersUp.map((agent, index) => {
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

    if (topAgentsDebug.enabled) {
        const podiumCards = container.querySelectorAll('.leaderboard-podium [data-agent-id]').length;
        const simpleCards = container.querySelectorAll('.leaderboard-card-simple[data-agent-id]').length;
        topAgentsDebug.log('Rendered cards:', { podiumCards, simpleCards });
    }

    // --- NEW: Trigger Animations ---
    const animatedElements = container.querySelectorAll('[data-animate-to]');
    animatedElements.forEach(el => {
        const targetValue = parseInt(el.dataset.animateTo, 10);
        if (!isNaN(targetValue)) {
            animateValue(el, 0, targetValue, 1500);
        }
    });

    // --- NEW: Event Delegation for CSP Compliance ---
    container.addEventListener('click', (e) => {
        // Comparison Selection Logic
        if (isTopAgentsComparisonMode) {
            const card = e.target.closest('[data-agent-id]');
            if (card) {
                e.stopPropagation();
                e.preventDefault();
                toggleAgentSelection(card.dataset.agentId);
            }
            return;
        }

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

    // --- NEW: Comparison Button Logic ---
    const compareBtn = document.getElementById('compare-agents-btn');
    if (compareBtn) {
        // Remove old listener if exists (simple way is to clone)
        const newBtn = compareBtn.cloneNode(true);
        compareBtn.parentNode.replaceChild(newBtn, compareBtn);
        
        newBtn.addEventListener('click', () => {
            isTopAgentsComparisonMode = !isTopAgentsComparisonMode;
            const container = document.getElementById('leaderboard-content-container');
            const floatingBar = document.getElementById('comparison-floating-bar');
            
            if (isTopAgentsComparisonMode) {
                container.classList.add('selection-mode');
                floatingBar.classList.add('active');
                newBtn.classList.add('active');
                showToast('اختر ما يصل إلى 3 وكلاء للمقارنة', 'info');
            } else {
                container.classList.remove('selection-mode');
                floatingBar.classList.remove('active');
                newBtn.classList.remove('active');
                selectedAgentsForComparison = [];
                updateComparisonUI();
                // Remove selected class from all cards
                document.querySelectorAll('.leaderboard-card.selected, .leaderboard-card-simple.selected').forEach(el => el.classList.remove('selected'));
            }
        });
    }

    topAgentsDebug.groupEnd();

    // --- NEW: Comparison Floating Bar Logic ---
    document.getElementById('cancel-comparison-btn')?.addEventListener('click', () => {
        isTopAgentsComparisonMode = false;
        document.getElementById('leaderboard-content-container').classList.remove('selection-mode');
        document.getElementById('comparison-floating-bar').classList.remove('active');
        document.getElementById('compare-agents-btn').classList.remove('active');
        selectedAgentsForComparison = [];
        updateComparisonUI();
        document.querySelectorAll('.leaderboard-card.selected, .leaderboard-card-simple.selected').forEach(el => el.classList.remove('selected'));
    });

    document.getElementById('show-comparison-modal-btn')?.addEventListener('click', showComparisonModal);
    } catch (error) {
        console.error('Error rendering top agents:', error);
        container.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i><p>حدث خطأ في عرض البيانات</p></div>';
    }
}

// --- NEW: Comparison Logic Functions ---
function toggleAgentSelection(agentId) {
    const index = selectedAgentsForComparison.indexOf(agentId);
    const card = document.querySelector(`[data-agent-id="${agentId}"]`);
    
    if (index > -1) {
        // Deselect
        selectedAgentsForComparison.splice(index, 1);
        if (card) card.classList.remove('selected');
    } else {
        // Select
        if (selectedAgentsForComparison.length >= 3) {
            showToast('يمكنك مقارنة 3 وكلاء كحد أقصى', 'warning');
            return;
        }
        selectedAgentsForComparison.push(agentId);
        if (card) card.classList.add('selected');
    }
    updateComparisonUI();
}

function updateComparisonUI() {
    const previewContainer = document.getElementById('selected-agents-preview');
    const countText = document.getElementById('comparison-count-text');
    
    if (!previewContainer || !countText) return;

    previewContainer.innerHTML = '';
    countText.textContent = `تم اختيار ${selectedAgentsForComparison.length} من 3`;

    selectedAgentsForComparison.forEach(id => {
        const agent = window.currentAgentStats.find(a => a._id === id);
        if (agent) {
            const img = document.createElement('img');
            img.src = agent.avatar_url || 'assets/images/default-avatar.png';
            img.className = 'selected-agent-thumb';
            previewContainer.appendChild(img);
        }
    });
}

function showComparisonModal() {
    if (selectedAgentsForComparison.length < 2) {
        showToast('يرجى اختيار وكيلين على الأقل للمقارنة', 'warning');
        return;
    }

    const agents = selectedAgentsForComparison.map(id => window.currentAgentStats.find(a => a._id === id)).filter(Boolean);
    
    // Determine winners for each category
    const maxViews = Math.max(...agents.map(a => a.total_views || 0));
    const maxReactions = Math.max(...agents.map(a => a.total_reactions || 0));
    const maxParticipants = Math.max(...agents.map(a => a.total_participants || 0));
    const maxGrowth = Math.max(...agents.map(a => a.growth_rate || 0));

    const modalContent = `
        <div class="comparison-modal-content">
            <div class="comparison-header">
                <h2><i class="fas fa-balance-scale"></i> مقارنة الوكلاء</h2>
                <button class="close-modal-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="comparison-table-wrapper">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>المقياس</th>
                            ${agents.map(agent => `
                                <th>
                                    <div class="comparison-agent-header">
                                        <div class="agent-avatar-wrapper">
                                            ${agent.avatar_url 
                                                ? `<img src="${agent.avatar_url}" alt="${agent.name}">` 
                                                : `<div class="default-avatar-placeholder"><i class="fas fa-user-astronaut"></i></div>`
                                            }
                                            <div class="agent-rank-badge rank-${agent.rank}">${agent.rank || '-'}</div>
                                        </div>
                                        <span class="agent-name">${agent.name}</span>
                                        <span class="classification-badge classification-${(agent.classification || '').toLowerCase()}">${agent.classification || ''}</span>
                                    </div>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="metric-label"><i class="fas fa-trophy"></i> المرتبة</td>
                            ${agents.map(agent => `<td><span class="rank-value">${agent.rank || '-'}</span></td>`).join('')}
                        </tr>
                        <tr>
                            <td class="metric-label"><i class="fas fa-eye"></i> المشاهدات</td>
                            ${agents.map(agent => {
                                const isWinner = (agent.total_views || 0) === maxViews;
                                return `<td class="${isWinner ? 'comparison-winner' : ''}">
                                    <div class="stat-value-wrapper">
                                        ${formatNumber(agent.total_views)}
                                        ${isWinner ? '<i class="fas fa-crown winner-icon"></i>' : ''}
                                    </div>
                                </td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            <td class="metric-label"><i class="fas fa-heart"></i> التفاعلات</td>
                            ${agents.map(agent => {
                                const isWinner = (agent.total_reactions || 0) === maxReactions;
                                return `<td class="${isWinner ? 'comparison-winner' : ''}">
                                    <div class="stat-value-wrapper">
                                        ${formatNumber(agent.total_reactions)}
                                        ${isWinner ? '<i class="fas fa-crown winner-icon"></i>' : ''}
                                    </div>
                                </td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            <td class="metric-label"><i class="fas fa-users"></i> المشاركات</td>
                            ${agents.map(agent => {
                                const isWinner = (agent.total_participants || 0) === maxParticipants;
                                return `<td class="${isWinner ? 'comparison-winner' : ''}">
                                    <div class="stat-value-wrapper">
                                        ${formatNumber(agent.total_participants)}
                                        ${isWinner ? '<i class="fas fa-crown winner-icon"></i>' : ''}
                                    </div>
                                </td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            <td class="metric-label"><i class="fas fa-chart-line"></i> معدل النمو</td>
                            ${agents.map(agent => {
                                const isWinner = (agent.growth_rate || 0) === maxGrowth;
                                return `<td class="${isWinner ? 'comparison-winner' : ''}">
                                    <div class="stat-value-wrapper">
                                        ${(agent.growth_rate || 0).toFixed(1)}%
                                        ${isWinner ? '<i class="fas fa-crown winner-icon"></i>' : ''}
                                    </div>
                                </td>`;
                            }).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    Swal.fire({
        html: modalContent,
        showConfirmButton: false,
        width: '1000px',
        background: 'transparent',
        customClass: {
            popup: 'no-bg-popup'
        },
        didOpen: () => {
            const closeBtn = document.querySelector('.close-modal-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => Swal.close());
            }
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