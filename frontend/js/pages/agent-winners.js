// Agent Winners Page JavaScript
let agentWinnersData = null;
let allWinners = [];

// --- تهيئة الصفحة ---
async function initializeWinnersPage() {
    try {
        // Ensure overlay and modal are hidden on page load (avoid accidental visibility)
        try {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay && !overlay.classList.contains('hidden')) overlay.classList.add('hidden');
            const modal = document.getElementById('confirmDeleteModal');
            if (modal && !modal.classList.contains('hidden')) modal.classList.add('hidden');
        } catch (e) {
            console.warn('[agent-winners] failed to ensure overlay/modal hidden on load', e);
        }
        // الحصول على معرف الوكيل من URL
        const urlParams = new URLSearchParams(window.location.search);
        const agentId = urlParams.get('agent_id');
        const importFlag = urlParams.get('import_from_roulette');
        const filterCompetitionId = urlParams.get('competition_id');

        console.log('[agent-winners] initializeWinnersPage ->', { agentId, importFlag });

        if (!agentId) {
            notify('معرف الوكيل غير موجود', 'error');
            return;
        }

        // تحميل بيانات الوكيل والاسطر العلوية ثم بيانات الفائزين
        try { await loadAgentHeader(agentId); } catch (e) { console.warn('[agent-winners] loadAgentHeader failed', e); }
        await fetchAgentWinners(agentId);

        // إذا كانت هناك بيانات مصدرة من روليت في localStorage فاستوردها
        try {
            if (importFlag === '1' || importFlag === 'true') {
                const key = `agent_winners_import_${agentId}`;
                const raw = localStorage.getItem(key);
                console.log('[agent-winners] import key present, key=', key, 'raw=', raw && raw.slice ? raw.slice(0, 200) : raw);
                if (raw) {
                    const obj = JSON.parse(raw);
                    console.log('[agent-winners] parsed import object', { count: Array.isArray(obj.winners) ? obj.winners.length : 0 });
                    if (obj && Array.isArray(obj.winners) && obj.winners.length > 0) {
                        // دمج الفائزين المستوردين مع العرض الحالي (ضع المستوردين في أعلى القائمة)
                        obj.winners.forEach(w => {
                            // Avoid duplicates by id
                            if (!allWinners.find(existing => existing.id === w.id)) {
                                allWinners.unshift(w);
                                console.log('[agent-winners] imported winner added', { id: w.id, name: w.name });
                            }
                        });
                        renderWinnersStatistics();
                        renderWinnersTable();
                        notify('تم استيراد الفائزين من الروليت بنجاح', 'success');
                    }
                    // Optionally remove the key after import
                    localStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.warn('[agent-winners] Import from roulette failed', e);
        }

        // إذا تم تمرير competition_id، طبّق الفلترة مباشرة
        if (filterCompetitionId) {
            try {
                const filtered = allWinners.filter(w => String(w.competition_id) === String(filterCompetitionId));
                if (filtered.length > 0) {
                    renderWinnersStatistics();
                    renderWinnersTable(filtered);
                } else {
                    // If no winners for this competition, still render empty state scoped to filter
                    renderWinnersStatistics();
                    renderWinnersTable([]);
                }
            } catch (e) { /* ignore */ }
        }

        // تهيئة البحث
        initializeSearch();

        // ربط زر إرسال الهوية والكليشة
        const sendDetailsBtn = document.getElementById('sendWinnersDetailsBtn');
        if (sendDetailsBtn) {
            sendDetailsBtn.addEventListener('click', sendWinnersDetailsToAgent);
            console.log('[agent-winners] Send winners details button listener attached');
        }

    } catch (error) {
        console.error('Error initializing winners page:', error);
        notify('حدث خطأ أثناء تحميل الصفحة', 'error');
    }
}

// Load agent info and populate hero header
async function loadAgentHeader(agentId) {
    if (!agentId) return;
    try {
        const resp = await authedFetch(`/api/agents/${encodeURIComponent(agentId)}`, { headers: { 'Content-Type': 'application/json' } });
        if (!resp.ok) return;
        const body = await resp.json();
        const agent = body && body.data ? body.data : null;
        if (!agent) return;
        const nameEl = document.getElementById('agentHeaderName');
        const codeEl = document.getElementById('agentHeaderCode');
        if (nameEl) nameEl.textContent = agent.name || '—';
        if (codeEl) codeEl.textContent = agent.agent_id ? `(#${agent.agent_id})` : (agent._id ? `(#${String(agent._id).slice(-6)})` : '(#—)');
    } catch (e) {
        console.warn('[agent-winners] loadAgentHeader error', e);
    }
}

// --- جلب بيانات فائزي الوكيل ---
async function fetchAgentWinners(agentId) {
    try {
        const url = `/api/agents/${encodeURIComponent(agentId)}/winners`;
        console.log('[agent-winners] fetchAgentWinners -> requesting', url);
        try { console.log('[agent-winners] token for request:', !!getToken()); } catch (e) {}
        const response = await authedFetch(url, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('[agent-winners] fetch response status', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[agent-winners] fetched data summary', { competitions: Array.isArray(data.competitions) ? data.competitions.length : 0 });
        agentWinnersData = data;

        // تجميع جميع الفائزين
        allWinners = [];
        if (data.competitions) {
            // Sort competitions by date descending (newest first)
            data.competitions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            data.competitions.forEach(competition => {
                if (competition.winners && Array.isArray(competition.winners)) {
                    competition.winners.forEach(winner => {
                        allWinners.push({
                            ...winner,
                            competition_title: competition.title,
                            competition_question: competition.question || null,
                            competition_id: competition.id,
                            win_date: winner.selected_at || competition.created_at
                        });
                    });
                }
            });
        }

        console.log('[agent-winners] total winners after fetch', allWinners.length);

        // Populate competition filter
        populateCompetitionFilter(data.competitions);

        // Apply default filter (latest competition) if no specific filter provided
        const filterSelect = document.getElementById('competitionFilter');
        const urlParams = new URLSearchParams(window.location.search);
        const filterCompetitionId = urlParams.get('competition_id');

        if (filterCompetitionId) {
             // If URL has filter, use it
             if (filterSelect) filterSelect.value = filterCompetitionId;
             filterWinnersByCompetition(filterCompetitionId);
        } else if (filterSelect && filterSelect.options.length > 1) { // > 1 because of "All" option
             // Select the second option (first actual competition, which is the latest due to sort)
             filterSelect.selectedIndex = 1;
             filterWinnersByCompetition(filterSelect.value);
        } else {
             // عرض البيانات (all)
             renderWinnersStatistics();
             renderWinnersTable();
        }

    } catch (error) {
        console.error('Error fetching agent winners:', error);
        notify('حدث خطأ أثناء تحميل بيانات الفائزين', 'error');
    }
}

function populateCompetitionFilter(competitions) {
    const select = document.getElementById('competitionFilter');
    if (!select) return;

    // Clear existing options except "All"
    select.innerHTML = '<option value="all">كل المسابقات</option>';

    if (!competitions || !Array.isArray(competitions)) return;

    competitions.forEach(comp => {
        const option = document.createElement('option');
        option.value = comp.id;
        const date = new Date(comp.created_at).toLocaleDateString('ar-EG');
        option.textContent = `${comp.title} (${date})`;
        select.appendChild(option);
    });

    // Add event listener
    select.addEventListener('change', (e) => {
        filterWinnersByCompetition(e.target.value);
    });
}

function filterWinnersByCompetition(competitionId) {
    if (competitionId === 'all') {
        renderWinnersStatistics(allWinners);
        renderWinnersTable(allWinners);
    } else {
        const filtered = allWinners.filter(w => String(w.competition_id) === String(competitionId));
        renderWinnersStatistics(filtered);
        renderWinnersTable(filtered);
    }
}

// --- عرض إحصائيات الفائزين ---
function renderWinnersStatistics(winners = allWinners) {
    const statsGrid = document.getElementById('winnersStatsGrid');
    if (!statsGrid) return;

    const totalWinners = winners.length;
    
    // حساب عدد فائزين بونص الإيداع
    const depositBonusWinners = winners.filter(w => 
        w.prize_type === 'deposit_bonus' || 
        w.prize_type === 'deposit' ||
        (w.meta && (w.meta.prize_type === 'deposit_bonus' || w.meta.prize_type === 'deposit'))
    ).length;
    
    // حساب عدد فائزين بونص تداولي
    const tradingBonusWinners = winners.filter(w => 
        w.prize_type === 'trading_bonus' || 
        w.prize_type === 'trading' ||
        (w.meta && (w.meta.prize_type === 'trading_bonus' || w.meta.prize_type === 'trading'))
    ).length;

    const statCards = [
        {
            icon: 'fa-trophy',
            value: totalWinners,
            label: 'إجمالي الفائزين',
            color: '#6366f1'
        },
        {
            icon: 'fa-coins',
            value: depositBonusWinners,
            label: 'فائزو بونص الإيداع',
            color: '#14b8a6'
        },
        {
            icon: 'fa-chart-line',
            value: tradingBonusWinners,
            label: 'فائزو بونص التداول',
            color: '#0ea5e9'
        },
        {
            icon: 'fa-calendar-check',
            value: new Set(winners.map(w => w.competition_id)).size,
            label: 'عدد المسابقات',
            color: '#8b5cf6'
        }
    ];

    statsGrid.innerHTML = '';

    statCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'winner-stat-card';
        cardElement.innerHTML = `
            <div class="stat-icon" style="color: ${card.color}">
                <i class="fas ${card.icon}"></i>
            </div>
            <div class="stat-value">${card.value.toLocaleString('ar-EG')}</div>
            <div class="stat-label">${card.label}</div>
        `;
        statsGrid.appendChild(cardElement);
    });
}

// --- عرض جدول الفائزين ---
function renderWinnersTable(winners = allWinners) {
    const tableBody = document.getElementById('winnersTableBody');
    if (!tableBody) return;

    if (winners.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-trophy" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                    لا يوجد فائزون حتى الآن
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = '';

    winners.forEach(winner => {
        const row = document.createElement('tr');

        const winDate = new Date(winner.win_date);
        const formattedDate = winDate.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const email = winner.email || (winner.meta && winner.meta.email) || '';
        const nationalId = winner.national_id || (winner.meta && winner.meta.national_id) || '';
        const nationalIdImage = winner.national_id_image || '';
        
        // تحديد نوع الجائزة وعرضها بشكل مناسب
        const prizeType = winner.prize_type || (winner.meta && winner.meta.prize_type) || '';
        let prizeTypeDisplay = '—';
        let prizeTypeClass = '';
        
        if (prizeType === 'deposit_bonus' || prizeType === 'deposit') {
            prizeTypeDisplay = '<i class="fas fa-coins"></i> بونص إيداع';
            prizeTypeClass = 'prize-deposit';
        } else if (prizeType === 'deposit_prev') {
            prizeTypeDisplay = '<i class="fas fa-coins"></i> بونص إيداع (فائز سابق)';
            prizeTypeClass = 'prize-deposit';
        } else if (prizeType === 'trading_bonus' || prizeType === 'trading') {
            prizeTypeDisplay = '<i class="fas fa-chart-line"></i> بونص تداولي';
            prizeTypeClass = 'prize-trading';
        }

        row.innerHTML = `
            <td>
                <div class="winner-name">${winner.name || 'غير محدد'}</div>
            </td>
            <td>
                <span class="winner-account">${winner.account_number || 'غير محدد'}</span>
            </td>
            <td>
                <div class="winner-email">${email || '—'}</div>
            </td>
            <td>
                <div class="winner-national-id">${nationalId || '—'}</div>
            </td>
            <td>
                ${nationalIdImage ? `<a href="${nationalIdImage}" target="_blank" class="btn-view-image"><i class="fas fa-image"></i> عرض</a>` : '—'}
            </td>
            <td>
                <span class="prize-type-badge ${prizeTypeClass}">${prizeTypeDisplay}</span>
            </td>
            <td>
                <div class="competition-title">${winner.competition_title || 'غير محدد'}</div>
            </td>
            <td>
                <div class="competition-question" title="${(winner.competition_question || '').replace(/"/g,'&quot;')}">
                    ${winner.competition_question ? (winner.competition_question.length > 80 ? (winner.competition_question.substring(0,80) + '…') : winner.competition_question) : '—'}
                </div>
            </td>
            <td>
                <span class="win-date">${formattedDate}</span>
            </td>
            <td>
                <div class="winner-actions">
                    <button class="winner-action-btn" onclick="viewWinnerDetails('${winner.id}')">
                        <i class="fas fa-eye"></i> عرض
                    </button>
                    <button class="winner-action-btn" onclick="contactWinner('${winner.account_number}')">
                        <i class="fas fa-envelope"></i> تواصل
                    </button>
                        <button class="winner-action-btn btn-transparent delete-btn" title="Delete" data-winner-id="${winner.id}" data-comp-id="${winner.competition_id || ''}">
                            <i class="fas fa-trash"></i> حذف
                        </button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// --- عرض تفاصيل الفائز ---
async function viewWinnerDetails(winnerId) {
    // Try to find the winner locally first
    let winner = allWinners.find(w => w.id === winnerId);

    if (!winner) {
        // If not found, try reloading winners from the API (using agent_id from URL)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const agentId = urlParams.get('agent_id');
            if (agentId) {
                await fetchAgentWinners(agentId);
                winner = allWinners.find(w => w.id === winnerId);
            }
        } catch (e) {
            console.warn('[agent-winners] viewWinnerDetails: failed to refresh winners', e);
        }
    }

    if (!winner) {
        notify('الفائز غير موجود', 'error');
        return;
    }

    // You can expand this to show a modal with full details
    notify(`عرض تفاصيل الفائز: ${winner.name}`, 'info');
}

// Delete a winner (calls backend)
async function deleteWinner(winnerId, competitionId) {
    console.log('[agent-winners] deleteWinner called', { winnerId, competitionId });
    // Confirmation is handled by the custom modal; proceed to delete

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const agentId = urlParams.get('agent_id');
        if (!agentId) return notify('معرف الوكيل غير موجود', 'error');

        const resp = await authedFetch(`/api/agents/${encodeURIComponent(agentId)}/winners/${encodeURIComponent(winnerId)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            console.error('Delete API error', resp.status, txt);
            return notify('فشل حذف الفائز', 'error');
        }

        // remove from local list and re-render
        const idx = allWinners.findIndex(w => String(w.id) === String(winnerId));
        if (idx !== -1) allWinners.splice(idx, 1);
        renderWinnersStatistics();
        renderWinnersTable();
        notify('تم حذف الفائز بنجاح', 'success');
    } catch (e) {
        console.error('[agent-winners] Delete network error', e);
        notify('خطأ في الاتصال أثناء الحذف', 'error');
    }
}

function goToAgentCompetitions() {
    console.log('[agent-winners] goToAgentCompetitions called');
    const agentId = new URLSearchParams(window.location.search).get('agent_id');
    if (!agentId) return;
    const targetUrl = 'agent-competitions.html?agent_id=' + encodeURIComponent(agentId);
    // Use location.replace to avoid creating duplicate history entries
    window.location.replace(targetUrl);
}

// Expose some functions to global scope so inline onclick handlers work
function goToAgentCompetitions() {
    const agentId = new URLSearchParams(window.location.search).get('agent_id');
    if (!agentId) return;
    const targetUrl = 'agent-competitions.html?agent_id=' + encodeURIComponent(agentId);
    // Use location.replace to avoid creating duplicate history entries
    window.location.replace(targetUrl);
}

// expose
try {
    window.viewWinnerDetails = viewWinnerDetails;
    window.contactWinner = contactWinner;
    window.deleteWinner = deleteWinner;
    window.goToAgentCompetitions = goToAgentCompetitions;
} catch (e) {
                // Setup event listeners to reliably capture clicks and surface logs to F12 console.
                try {
                    const backBtn = document.getElementById('backToCompetitionsBtn');
                    if (backBtn) {
                                backBtn.addEventListener('click', function (ev) {
                                    console.log('[agent-winners] back button event listener fired');
                                    ev.preventDefault();
                                    // show loading overlay for a short duration
                                    try {
                                        const overlay = document.getElementById('loadingOverlay');
                                        if (overlay) overlay.classList.remove('hidden');
                                    } catch (e) { /* ignore */ }
                                    setTimeout(() => {
                                        if (window.goToAgentCompetitions) {
                                            window.goToAgentCompetitions();
                                        } else {
                                            const agentId = new URLSearchParams(window.location.search).get('agent_id');
                                            if (agentId) {
                                                const targetUrl = 'agent-competitions.html?agent_id=' + encodeURIComponent(agentId);
                                                window.location.replace(targetUrl);
                                            }
                                        }
                                    }, 1100);
                                });
                            }

                    const tableBody = document.querySelector('#winnersTableBody');
                    if (tableBody) {
                        tableBody.addEventListener('click', function (ev) {
                            const btn = ev.target.closest && ev.target.closest('.delete-btn');
                            if (btn) {
                                        const winnerId = btn.getAttribute('data-winner-id');
                                        const compId = btn.getAttribute('data-comp-id');
                                        console.log('[agent-winners] delete button click captured (delegation) ->', { winnerId, compId });
                                        // Open custom confirm modal
                                        const modal = document.getElementById('confirmDeleteModal');
                                        if (modal) {
                                            modal.classList.remove('hidden');
                                            modal.setAttribute('aria-hidden', 'false');
                                            modal.dataset.winnerId = winnerId;
                                            modal.dataset.compId = compId;
                                        } else {
                                            // fallback to direct delete if modal not present
                                            if (confirm('حذف الفائز؟')) {
                                                if (window.deleteWinner) window.deleteWinner(winnerId, compId);
                                            }
                                        }
                                    }
                        });
                    }
                    // Wire up modal confirm/cancel buttons
                    try {
                        const modal = document.getElementById('confirmDeleteModal');
                        const confirmBtn = document.getElementById('confirmDeleteBtn');
                        const cancelBtn = document.getElementById('cancelDeleteBtn');
                        if (confirmBtn && modal) {
                            confirmBtn.addEventListener('click', function () {
                                const winnerId = modal.dataset.winnerId;
                                const compId = modal.dataset.compId;
                                modal.classList.add('hidden');
                                modal.setAttribute('aria-hidden', 'true');
                                if (window.deleteWinner) window.deleteWinner(winnerId, compId);
                            });
                        }
                        if (cancelBtn && modal) {
                            cancelBtn.addEventListener('click', function () {
                                modal.classList.add('hidden');
                                modal.setAttribute('aria-hidden', 'true');
                            });
                        }
                    } catch (e) {
                        console.warn('[agent-winners] modal wiring failed', e);
                    }
                } catch (err) {
                    console.error('[agent-winners] Error setting up event delegation', err);
                }
    // ignore if window not available in this execution context
}

// --- مساعدات ---
function getToken() {
    // Support both legacy `token` and newer `authToken` storage keys
    return localStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('authToken') || sessionStorage.getItem('token');
}

// --- تهيئة البحث ---
function initializeSearch() {
    const searchInput = document.getElementById('searchWinners');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = (e.target.value || '').toLowerCase().trim();

        if (!searchTerm) {
            renderWinnersTable(allWinners);
            return;
        }

        const filteredWinners = allWinners.filter(winner =>
            (winner.name && winner.name.toLowerCase().includes(searchTerm)) ||
            (winner.account_number && winner.account_number.includes(searchTerm)) ||
            (winner.competition_title && winner.competition_title.toLowerCase().includes(searchTerm)) ||
            (winner.competition_question && winner.competition_question.toLowerCase().includes(searchTerm))
        );

        renderWinnersTable(filteredWinners);
    });
}

function notify(message, type = 'info') {
    // يمكن استخدام نظام الإشعارات الموجود
    console.log(`${type}: ${message}`);
    alert(message);
}

// --- إرسال بيانات الفائزين مع صور الهوية للوكيل ---
async function sendWinnersDetailsToAgent() {
    try {
        // الحصول على معرف الوكيل من URL
        const urlParams = new URLSearchParams(window.location.search);
        const agentId = urlParams.get('agent_id');

        if (!agentId) {
            notify('معرف الوكيل غير موجود', 'error');
            return;
        }

        if (!allWinners || allWinners.length === 0) {
            notify('لا يوجد فائزون لإرسالهم', 'warning');
            return;
        }

        // تصفية الفائزين الذين لديهم معرفات في قاعدة البيانات
        const validWinners = allWinners.filter(w => w._id || w.id);
        
        if (validWinners.length === 0) {
            notify('لم يتم العثور على معرفات الفائزين في قاعدة البيانات', 'error');
            return;
        }

        // رسالة تأكيد للمستخدم
        const confirmMessage = `سيتم إرسال بيانات الفائزين (${validWinners.length}) مع صور الهوية والكليشة إلى مجموعة الوكيل على تلجرام.\n\nهل أنت متأكد؟`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        // استخراج معرفات الفائزين
        const winnerIds = validWinners.map(w => w._id || w.id);

        console.log('[agent-winners] Sending winners details...', { agentId, winnerIds });

        // إرسال الطلب إلى الـ API
        const response = await authedFetch(`/api/agents/${encodeURIComponent(agentId)}/send-winners-details`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ winnerIds })
        });

        if (!response.ok) {
            const errorData = await response.json();
            notify(`فشل الإرسال: ${errorData.message || 'خطأ غير معروف'}`, 'error');
            return;
        }

        const result = await response.json();
        notify('تم إرسال بيانات الفائزين مع صور الهوية بنجاح إلى مجموعة الوكيل', 'success');
        console.log('[agent-winners] Winners details sent successfully', result);

    } catch (error) {
        console.error('[agent-winners] Error sending winners details:', error);
        notify('حدث خطأ أثناء إرسال بيانات الفائزين: ' + error.message, 'error');
    }
}

// --- بدء التشغيل ---
document.addEventListener('DOMContentLoaded', initializeWinnersPage);