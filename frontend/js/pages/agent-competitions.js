// agent-competitions.js - صفحة تفاصيل مسابقات الوكيل
// ملاحظة: هذه الصفحة تعمل كسكربت Module ويعتمد على دوال عامة على النافذة (window)
// مثل window.authedFetch و window.showToast التي يتم توفيرها من utils.js

// --- المتغيرات العامة ---
let agentData = null;
let allCompetitions = [];
let filteredCompetitions = [];
let currentStatusFilter = 'all'; // Filter by competition status
let agentWinnersCache = null; // Cache winners per agent to avoid repeated fetches

// دالة إشعارات محلية، تستخدم showToast إن وجدت وإلا تستخدم alert كحل احتياطي
function notify(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        // fallback بسيط بدون تنسيق في حال عدم توفر showToast
        if (type === 'error' || type === 'warning') {
            alert(message);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
}

// --- التهيئة عند تحميل الصفحة ---
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

// --- Confirm & navigation helper (moved from inline HTML to avoid CSP issues) ---
function confirmViewWinners(){
    console.log('[agent-competitions] view-winners button clicked');
    const agentId = new URLSearchParams(window.location.search).get('agent_id');
    console.log('[agent-competitions] resolved agent_id:', agentId);
    if(!agentId){ console.warn('[agent-competitions] agent_id missing'); notify('معرف الوكيل غير موجود','error'); return; }

    console.log('[agent-competitions] creating custom confirm overlay');
    const overlay = document.createElement('div');
    overlay.className = 'wr-confirm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);z-index:10000;';

    const modal = document.createElement('div');
    modal.className = 'wr-confirm-modal';
    modal.style.cssText = 'background:var(--card-bg-color);padding:22px;border-radius:12px;max-width:520px;width:90%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);';

    modal.innerHTML = `
        <div style="font-size:28px;margin-bottom:8px;color:var(--text-color)">تأكيد</div>
        <div style="color:var(--text-secondary-color);margin-bottom:18px">سيتم الانتقال إلى صفحة عرض الفائزين. هل تريد المتابعة؟</div>
        <div style="display:flex;gap:12px;justify-content:center"> 
            <button id="wr-confirm-cancel" class="wr-btn wr-btn-secondary">إلغاء</button>
            <button id="wr-confirm-ok" class="wr-btn wr-btn-primary">متابعة</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const helpEl = document.getElementById('view-winners-help');

    function cleanup(){ if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); }

    overlay.addEventListener('click',(e)=>{ if(e.target===overlay){ console.log('[agent-competitions] overlay clicked (outside modal)'); cleanup(); showCancelHelp(); } });

    document.getElementById('wr-confirm-ok').addEventListener('click', ()=>{
        console.log('[agent-competitions] user confirmed navigation to agent-winners');
        cleanup();
        const target = 'agent-winners.html?agent_id=' + encodeURIComponent(agentId);
        console.log('[agent-competitions] navigating to', target);
        window.location.href = target;
    });

    document.getElementById('wr-confirm-cancel').addEventListener('click', ()=>{
        console.log('[agent-competitions] user canceled navigation to agent-winners');
        cleanup(); showCancelHelp();
    });

    function showCancelHelp(){
        console.log('[agent-competitions] showing cancel help message');
        if(!helpEl) return;
        helpEl.style.display = 'block';
        helpEl.innerHTML = `تم الإلغاء. إذا لم يفتح زر \"عرض الفائزين\" <a id="view-winners-help-link" href="agent-winners.html?agent_id=${encodeURIComponent(agentId)}" style="color:#064e3b;font-weight:700;margin-right:8px;">اضغط هنا لفتحه</a>`;
        const helpLink = document.getElementById('view-winners-help-link');
        if(helpLink){ helpLink.addEventListener('click', (ev)=>{ console.log('[agent-competitions] help-link clicked, navigating to agent-winners'); }); }
        setTimeout(()=>{ if(helpEl){ helpEl.style.display='none'; helpEl.innerHTML=''; } }, 10000);
    }
}

// --- دالة التهيئة الرئيسية ---
async function initializePage() {
    // تفعيل الوضع الليلي لهذه الصفحة
    try { document.body.classList.add('dark-mode'); } catch (e) {}
    // الحصول على agent_id من URL
    const urlParams = new URLSearchParams(window.location.search);
    const agentId = urlParams.get('agent_id');
    
    if (!agentId) {
        notify('معرف الوكيل غير صحيح', 'error');
        setTimeout(() => {
            window.location.href = 'analytics.html';
        }, 2000);
        return;
    }
    
    // زر العودة
    
    // إضافة معالجات أزرار فلتر الحالة
    document.querySelectorAll('.competition-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            applyStatusFilter(filter);
        });
    });
    
    // البحث في المسابقات
    const searchInput = document.getElementById('searchCompetitions');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterCompetitions(e.target.value);
        });
    }

    // Attach view-winners button listener (the button exists in the page template)
    const viewWinnersBtn = document.getElementById('view-winners-btn');
    if (viewWinnersBtn) {
        viewWinnersBtn.addEventListener('click', (e) => {
            // Prevent default action if any
            e.preventDefault();
            confirmViewWinners();
        });
    }
    
    // جلب بيانات الوكيل والمسابقات
    await fetchAgentData(agentId);
}

// --- جلب بيانات الوكيل ---
async function fetchAgentData(agentId) {
    try {
        const res = await window.authedFetch(`/api/agents/${agentId}/competitions-summary`);
        if (!res.ok) {
            throw new Error('فشل في جلب بيانات الوكيل');
        }

        const responseData = await res.json();

        // For debugging:
        console.log('Fetched Agent Data for Competitions Page:', responseData);

        // Set global variables
        agentData = responseData; // Set the global variable
        allCompetitions = responseData.competitions || [];

        // --- FIX: Recalculate statistics on frontend to ensure all fields (views, reactions, etc.) are present ---
        // The backend might not send all of them or might send 0s if not calculated.
        const frontendStats = calculateStatistics(allCompetitions);
        agentData.statistics = { ...responseData.statistics, ...frontendStats };

        // Check if agent exists
        if (!responseData || !responseData.agent) {
            notify('الوكيل غير موجود', 'error');
            setTimeout(() => {
                window.location.href = 'analytics.html';
            }, 2000);
            return;
        }

        filteredCompetitions = [...allCompetitions];

        // Render all components
        renderAgentHeader(responseData);
        // renderEnhancedStatistics(); // Removed as it's empty
        renderCompetitionsStatusCounters(responseData);
        renderCompetitionsTable();

    } catch (error) {
        console.error('Error fetching agent data:', error);
        notify('حدث خطأ أثناء تحميل البيانات', 'error');

        const headerInfo = document.getElementById('agentHeaderInfo');
        if (headerInfo) {
            headerInfo.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>حدث خطأ أثناء تحميل بيانات الوكيل</p>
                </div>
            `;
        }
    }
}

// --- عرض معلومات الوكيل في الهيدر ---
function renderAgentHeader(data) {
    const agentNameEl = document.getElementById('agentName');
    const heroStatsEl = document.getElementById('heroStats');

    if (data && data.agent) {
        if (agentNameEl) {
            agentNameEl.textContent = data.agent.name || 'اسم الوكيل غير متوفر';
        }

        // إزالة heroStats كما طلب المستخدم
        if (heroStatsEl) {
            heroStatsEl.innerHTML = '';
        }
    } else {
        if (agentNameEl) {
            agentNameEl.textContent = 'اسم الوكيل غير متوفر';
        }
        if (heroStatsEl) {
            heroStatsEl.innerHTML = '';
        }
    }
}

// --- حساب الإحصائيات من المسابقات ---
function calculateStatistics(competitions) {
    if (!competitions || !Array.isArray(competitions)) {
        return {
            total_competitions: 0,
            compliance_rate: 0,
            compliant_competitions: 0,
            total_views: 0,
            total_reactions: 0,
            total_participants: 0,
            active_competitions: 0,
            completed_competitions: 0,
            pending_competitions: 0
        };
    }

    const total_competitions = competitions.length;
    const compliant_competitions = competitions.filter(c => c.is_compliant === true).length;
    const compliance_rate = total_competitions > 0 ? Math.round((compliant_competitions / total_competitions) * 100) : 0;

    const total_views = competitions.reduce((sum, c) => sum + (c.views_count || 0), 0);
    const total_reactions = competitions.reduce((sum, c) => sum + (c.reactions_count || 0), 0);
    const total_participants = competitions.reduce((sum, c) => sum + (c.participants_count || 0), 0);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const active_competitions = competitions.filter(c => {
        const status = c.status;
        const isActive = c.is_active === true;
        const endsAt = c.ends_at ? new Date(c.ends_at) : null;
        return (status === 'active' || status === 'sent' || isActive) && (!endsAt || endsAt >= now);
    }).length;

    const completed_competitions = competitions.filter(c => c.status === 'completed').length;

    const pending_competitions = competitions.filter(c => {
        if (c.status === 'awaiting_winners') return true;
        const status = c.status;
        const isActive = c.is_active === true;
        const endsAt = c.ends_at ? new Date(c.ends_at) : null;
        const winners = c.winners_count || 0;
        return (status === 'active' || status === 'sent' || isActive) && endsAt && endsAt < now && winners === 0;
    }).length;

    return {
        total_competitions,
        compliance_rate,
        compliant_competitions,
        total_views,
        total_reactions,
        total_participants,
        active_competitions,
        completed_competitions,
        pending_competitions
    };
}

// --- عرض عدادات حالة المسابقات (نشطة / منتهية) ---
function renderCompetitionsStatusCounters(data) {
    const container = document.getElementById('competitionsStatusCounters');
    if (!container || !data) return;

    const stats = data.statistics || {};
    const totals = {
        active: stats.active_competitions || 0,
        completed: stats.completed_competitions || 0,
        awaiting_winners: stats.pending_competitions || 0, // Changed from awaiting_winners_competitions
    };

    // Build enhanced stat cards like the top statistics
    const card = (label, value, hint = '', icon = '', colorClass = 'gradient-purple') => `
        <div class="stat-card-enhanced">
            <div class="stat-icon-wrapper ${colorClass}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="stat-details">
                <div class="stat-label">${label}</div>
                <div class="stat-value-large">${value.toLocaleString('ar-EG')}</div>
                ${hint ? `<div class="stat-meta">${hint}</div>` : ''}
            </div>
        </div>
    `;

    let topCards = '';
    if (stats) {
        const complianceRate = stats.compliance_rate || 0;
        const totalComps = stats.total_competitions || 0;
        const compliantComps = stats.compliant_competitions || 0;
        const totalViews = stats.total_views || 0;
        const totalReactions = stats.total_reactions || 0;
        const totalParticipants = stats.total_participants || 0;
        
        let complianceColor = '#e74c3c';
        let complianceIcon = 'fa-times-circle';
        if (complianceRate >= 80) {
            complianceColor = '#27ae60';
            complianceIcon = 'fa-check-circle';
        } else if (complianceRate >= 50) {
            complianceColor = '#f39c12';
            complianceIcon = 'fa-exclamation-circle';
        }

        topCards = `
            ${card('إجمالي المسابقات', totalComps, '', 'fa-trophy', 'gradient-purple')}
            <div class="stat-card-enhanced compliance-card">
                <div class="stat-icon-wrapper" style="background: ${complianceColor};">
                    <i class="fas ${complianceIcon}"></i>
                </div>
                <div class="stat-details">
                    <div class="stat-label">نسبة الالتزام</div>
                    <div class="stat-value-large" style="color: ${complianceColor};">${complianceRate}%</div>
                    <div class="stat-meta">${compliantComps} من ${totalComps} مسابقة</div>
                </div>
            </div>
            ${card('إجمالي المشاهدات', totalViews, '', 'fa-eye', 'gradient-blue')}
            ${card('إجمالي التفاعلات', totalReactions, '', 'fa-heart', 'gradient-pink')}
            ${card('إجمالي المشاركات', totalParticipants, '', 'fa-users', 'gradient-teal')}
            ${card('معدل النمو', `${totalViews > 0 ? Math.round((totalParticipants / totalViews) * 100) : 0}%`, '', 'fa-chart-line', 'gradient-mint')}
        `;
    }

    container.innerHTML = `
        ${topCards}
        ${card('نشطة الآن', totals.active, '', 'fa-play-circle', 'gradient-green')}
        ${card('مكتملة', totals.completed, '', 'fa-check-circle', 'gradient-blue')}
        ${card('بانتظار الفائزين', totals.awaiting_winners, '', 'fa-clock', 'gradient-yellow')}
    `;

    // Add simple styles if not already present (keeps layout consistent)
    const styleId = 'agent-competitions-status-counters-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .competitions-status-counters { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px; }

            /* Enhanced stat cards like the top statistics */
            .stat-card-enhanced {
                background: var(--card-bg-color, #fff);
                border-radius: 16px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                border: 1px solid var(--border-color, #e1e5e9);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                display: flex;
                align-items: center;
                gap: 16px;
            }

            .stat-card-enhanced:hover {
                transform: translateY(-3px);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
            }

            .stat-icon-wrapper {
                width: 50px;
                height: 50px;
                border-radius: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 1.4rem;
                flex-shrink: 0;
            }

            .stat-details {
                flex: 1;
                min-width: 0;
            }

            .stat-label {
                font-size: 0.9rem;
                color: var(--text-secondary-color, #666);
                margin-bottom: 4px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .stat-value-large {
                font-size: 1.9rem;
                font-weight: 800;
                color: var(--text-primary-color, #1a1a1a);
                margin-bottom: 2px;
            }

            .stat-meta {
                font-size: 0.8rem;
                color: var(--text-secondary-color, #888);
                font-weight: 500;
            }

            /* Gradient backgrounds */
            .gradient-purple { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); }
            .gradient-green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
            .gradient-orange { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
            .gradient-blue { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); }
            .gradient-gray { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); }
            .gradient-dark-gray { background: linear-gradient(135deg, #374151 0%, #1f2937 100%); }
            .gradient-pink { background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); }
            .gradient-teal { background: linear-gradient(135deg, #14b8a6 0%, #0f766e 100%); }
            .gradient-mint { background: linear-gradient(135deg, #6ee7b7 0%, #047857 100%); }
            .gradient-yellow { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); }

            @media (max-width: 768px) {
                .competitions-status-counters { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
                .stat-card-enhanced { padding: 16px; }
                .stat-icon-wrapper { width: 45px; height: 45px; font-size: 1.2rem; }
                .stat-value-large { font-size: 1.6rem; }
            }

            /* Dark mode support for enhanced stat cards */
            .dark-mode .stat-card-enhanced {
                background: var(--card-bg-color, #1e1e1e);
                border-color: var(--border-color, #333);
            }

            .dark-mode .stat-label {
                color: var(--text-secondary-color, #cccccc);
            }

            .dark-mode .stat-value-large {
                color: var(--text-primary-color, #ffffff);
            }

            .dark-mode .stat-meta {
                color: var(--text-secondary-color, #aaaaaa);
            }
        `;
        document.head.appendChild(style);
    }
}

// --- فلترة المسابقات حسب الحالة ---
function applyStatusFilter(status) {
    currentStatusFilter = status;
    
    // Update active button
    document.querySelectorAll('.competition-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === status) {
            btn.classList.add('active');
        }
    });
    
    // Apply filter
    const nowFilter = new Date();
    nowFilter.setHours(0,0,0,0);
    const isDerivedAwaitingWinners = (comp) => {
        if (!comp || !comp.ends_at) return false;
        const endsAt = new Date(comp.ends_at);
        if (endsAt >= nowFilter) return false;
        const winners = comp.winners_count || 0;
        if (winners > 0) return false;
        const st = (comp.status || '').toString();
        return ['active','sent'].includes(st) || comp.is_active === true;
    };

    if (status === 'all') {
        filteredCompetitions = [...allCompetitions];
    } else if (status === 'active') {
        filteredCompetitions = allCompetitions.filter(comp => (
            (comp.status === 'active' || comp.status === 'sent' || (comp.is_active === true && comp.status !== 'completed' && comp.status !== 'archived'))
            && (!comp.ends_at || new Date(comp.ends_at) >= nowFilter)
        ));
    } else if (status === 'awaiting_winners') {
        filteredCompetitions = allCompetitions.filter(comp => comp.status === 'awaiting_winners' || isDerivedAwaitingWinners(comp));
    } else {
        filteredCompetitions = allCompetitions.filter(comp => comp.status === status);
    }
    
    // Apply search filter if exists
    const searchTerm = document.getElementById('searchCompetitions')?.value?.trim().toLowerCase();
    if (searchTerm) {
        filteredCompetitions = filteredCompetitions.filter(comp => {
            const questionText = (comp.description || comp.name || '').toLowerCase();
            const templateName = (comp.template_id?.name || '').toLowerCase();
            return questionText.includes(searchTerm) || templateName.includes(searchTerm);
        });
    }
    
    renderCompetitionsTable();
}

// --- عرض جدول المسابقات ---
function renderCompetitionsTable() {
    const tableBody = document.getElementById('allCompetitionsTableBody');
    if (!tableBody) return;
    
    // تحقق إذا كان الوكيل ليس لديه أي مسابقات أصلاً
    if (!allCompetitions || allCompetitions.length === 0) {
        const agentName = agentData?.agent?.name || 'هذا الوكيل';
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 60px 20px;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
                        <i class="fas fa-trophy" style="font-size: 64px; color: var(--text-secondary-color); opacity: 0.3;"></i>
                        <div style="max-width: 500px;">
                            <h3 style="margin: 0 0 10px 0; color: var(--text-color); font-size: 1.3em;">لا توجد مسابقات لهذا الوكيل</h3>
                            <p style="margin: 0; color: var(--text-secondary-color); font-size: 1em; line-height: 1.6;">
                                <strong>${agentName}</strong> لم يتم إرسال أي مسابقات له بعد.<br>
                                يمكنك إنشاء مسابقة جديدة من قسم المسابقات.
                            </p>
                        </div>
                        <button id="create-first-competition-btn" class="btn btn-primary" style="margin-top: 10px;">
                            <i class="fas fa-plus-circle"></i> إنشاء مسابقة جديدة
                        </button>
                    </div>
                </td>
            </tr>
        `;
        
        // Add event listener for the create button
        const createBtn = document.getElementById('create-first-competition-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (!agentData?.agent?.is_auditing_enabled) {
                    notify('عذراً، لا يمكن إنشاء مسابقة قبل إتمام عملية التدقيق لهذا الوكيل.', 'error');
                    return;
                }
                window.location.hash = `competitions/new?agentId=${agentData?.agent?._id || ''}`;
            });
        }
        return;
    }
    
    // إذا كانت المسابقات موجودة لكن الفلتر فارغ
    if (filteredCompetitions.length === 0) {
        const filterLabel = {
            'all': 'الكل',
            'active': 'نشطة',
            'awaiting_winners': 'بانتظار الفائزين',
            'completed': 'مكتملة',
            'archived': 'مؤرشفة'
        }[currentStatusFilter] || 'الفلتر الحالي';
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px;">
                    <i class="fas fa-filter" style="font-size: 48px; color: var(--text-secondary-color); margin-bottom: 16px; opacity: 0.5;"></i>
                    <p style="color: var(--text-secondary-color); font-size: 1.1em;">لا توجد مسابقات "<strong>${filterLabel}</strong>"</p>
                    <button onclick="applyStatusFilter('all')" class="btn btn-secondary" style="margin-top: 10px;">
                        <i class="fas fa-times-circle"></i> إلغاء الفلتر
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    const rowsHtml = filteredCompetitions.map((comp, index) => {
        // تنسيق التواريخ
        const createdDate = comp.createdAt ? new Date(comp.createdAt).toLocaleDateString('ar-EG') : '-';
        const endsDate = comp.ends_at ? new Date(comp.ends_at).toLocaleDateString('ar-EG') : '-';
        const processedDate = comp.processed_at ? new Date(comp.processed_at).toLocaleDateString('ar-EG') : '-';
        
        // تحديد لون الالتزام
        let complianceColor = comp.is_compliant ? '#27ae60' : '#e74c3c';
        let complianceIcon = comp.is_compliant ? 'fa-check-circle' : 'fa-times-circle';
        let complianceText = comp.is_compliant ? 'ملتزم' : 'غير ملتزم';
        
        if (!comp.processed_at) {
            complianceColor = '#95a5a6';
            complianceIcon = 'fa-clock';
            complianceText = 'قيد الانتظار';
        }
        
        // تحديد حالة المسابقة
        const statusMap = {
            'sent': 'مرسلة',
            'active': 'نشطة',
            'awaiting_winners': 'في انتظار الفائزين',
            'completed': 'مكتملة',
            'archived': 'مؤرشفة'
        };
        const statusText = statusMap[comp.status] || comp.status;
        
        // اختصار السؤال - استخدام الاسم (السؤال) بدلاً من الوصف (القالب الكامل)
        const questionText = comp.name || comp.description || 'غير متوفر';
        const shortQuestion = questionText.length > 60 
            ? questionText.substring(0, 60) + '...' 
            : questionText;
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <div class="question-cell" title="${questionText}">
                        ${shortQuestion}
                    </div>
                </td>
                <td>${createdDate}</td>
                <td>${endsDate}</td>
                <td>${processedDate}</td>
                <td>
                    <span class="compliance-badge" style="color: ${complianceColor};">
                        <i class="fas ${complianceIcon}"></i> ${complianceText}
                    </span>
                </td>
                <td><span class="stat-number">${(comp.views_count || 0).toLocaleString('ar-EG')}</span></td>
                <td><span class="stat-number">${(comp.reactions_count || 0).toLocaleString('ar-EG')}</span></td>
                <td><span class="stat-number">${(comp.participants_count || 0).toLocaleString('ar-EG')}</span></td>
                <td><span class="status-badge status-${comp.status}" data-competition-id="${comp._id}" ${comp.status === 'awaiting_winners' ? 'style=\"cursor:pointer\" title=\"إدخال الإحصائيات\"' : ''}>${statusText}</span></td>
                <td>
                    <button class="btn-icon-action view-winners-btn" data-competition-id="${comp._id}" title="عرض فائزين هذه المسابقة">
                        <i class="fas fa-trophy"></i>
                    </button>
                    <button class="btn-icon-action view-videos-btn" data-competition-id="${comp._id}" title="عرض فيديوهات الفائزين">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon-action delete-competition-btn" data-competition-id="${comp._id}" data-competition-name="${(comp.name || comp.description || 'هذه المسابقة').substring(0, 50)}" title="حذف المسابقة">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rowsHtml;

    // Add click event listeners for question cells
    setupQuestionClickHandlers();
    
    // Add click event listeners for delete buttons
    setupDeleteHandlers();

    // Add click event listeners for view winners per competition
    setupViewWinnersButtons();
    
    // Add click event listeners for view videos
    setupViewVideosButtons();

    // إضافة حدث النقر على حالة "في انتظار الفائزين" لفتح نافذة الإدخال
    const awaitingBadges = tableBody.querySelectorAll('.status-badge.status-awaiting_winners');
    awaitingBadges.forEach(badge => {
        badge.addEventListener('click', (e) => {
            const compId = badge.getAttribute('data-competition-id');
            const comp = filteredCompetitions.find(c => c._id === compId);
            if (comp) {
                showCompetitionModal(comp);
            }
        });
    });
}

// --- إعداد معالجات الحذف ---
function setupDeleteHandlers() {
    const deleteBtns = document.querySelectorAll('.delete-competition-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const competitionId = btn.dataset.competitionId;
            const competitionName = btn.dataset.competitionName;
            
            // Use custom modal instead of native confirm
            showCustomDeleteConfirm(competitionName, async () => {
                try {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    
                    const res = await window.authedFetch(`/api/competitions/${competitionId}`, {
                        method: 'DELETE'
                    });
                    
                    if (!res.ok) {
                        throw new Error('فشل في حذف المسابقة');
                    }
                    
                    notify('تم حذف المسابقة بنجاح', 'success');
                    
                    // Remove from arrays
                    allCompetitions = allCompetitions.filter(c => c._id !== competitionId);
                    filteredCompetitions = filteredCompetitions.filter(c => c._id !== competitionId);
                    
                    // Update statistics
                    agentData.statistics = calculateStatistics(allCompetitions);
                    
                    // Re-render
                    renderCompetitionsStatusCounters(agentData);
                    renderCompetitionsTable();
                } catch (error) {
                    console.error('Error updating stats:', error);
                    notify('حدث خطأ أثناء تحديث الإحصائيات', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                }
            });
        });
    });
}

// Custom Confirm Modal for Deletion
function showCustomDeleteConfirm(competitionName, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'wr-confirm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);z-index:10000;animation:fadeIn 0.2s ease;';

    const modal = document.createElement('div');
    modal.className = 'wr-confirm-modal';
    modal.style.cssText = 'background:var(--card-bg-color, #1e293b);padding:24px;border-radius:16px;max-width:450px;width:90%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.4);border:1px solid var(--border-color, #334155);transform:translateY(0);animation:slideUp 0.3s ease;';

    modal.innerHTML = `
        <div style="font-size:48px;margin-bottom:16px;">🗑️</div>
        <h3 style="font-size:22px;margin:0 0 10px 0;color:var(--text-color, #fff);font-weight:700;">تأكيد الحذف</h3>
        <p style="color:var(--text-secondary-color, #94a3b8);margin-bottom:8px;font-size:16px;line-height:1.5;">هل أنت متأكد من حذف المسابقة:</p>
        <div style="background:rgba(239,68,68,0.1);color:#ef4444;padding:10px;border-radius:8px;margin-bottom:20px;font-weight:600;font-size:15px;">"${competitionName}"</div>
        <p style="color:#ef4444;margin-bottom:24px;font-size:14px;font-weight:600;">⚠️ لا يمكن التراجع عن هذا الإجراء!</p>
        <div style="display:flex;gap:12px;justify-content:center"> 
            <button id="wr-confirm-cancel" style="padding:10px 20px;border-radius:8px;border:1px solid var(--border-color, #475569);background:transparent;color:var(--text-color, #fff);cursor:pointer;font-weight:600;transition:all 0.2s;">إلغاء</button>
            <button id="wr-confirm-ok" style="padding:10px 20px;border-radius:8px;border:none;background:#ef4444;color:white;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(239,68,68,0.3);transition:all 0.2s;">نعم، احذفها</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = () => {
        overlay.style.opacity = '0';
        setTimeout(() => {
            if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 200);
    };

    overlay.addEventListener('click', (e) => {
        if(e.target === overlay) cleanup();
    });

    document.getElementById('wr-confirm-cancel').addEventListener('click', cleanup);

    document.getElementById('wr-confirm-ok').addEventListener('click', () => {
        cleanup();
        onConfirm();
    });
}

// فتح صفحة الفائزين لفئة مسابقة واحدة
function setupViewWinnersButtons() {
    const btns = document.querySelectorAll('.view-winners-btn');
    const agentId = (agentData && agentData.agent && (agentData.agent._id || agentData.agent.id)) || new URLSearchParams(window.location.search).get('agent_id');
    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const competitionId = btn.getAttribute('data-competition-id');
            if (!agentId || !competitionId) {
                notify('بيانات غير مكتملة لفتح الفائزين', 'error');
                return;
            }
            showCompetitionWinnersModal(agentId, competitionId, 'list');
        });
    });
}

// فتح صفحة فيديوهات الفائزين لفئة مسابقة واحدة
function setupViewVideosButtons() {
    const btns = document.querySelectorAll('.view-videos-btn');
    const agentId = (agentData && agentData.agent && (agentData.agent._id || agentData.agent.id)) || new URLSearchParams(window.location.search).get('agent_id');
    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const competitionId = btn.getAttribute('data-competition-id');
            if (!agentId || !competitionId) {
                notify('بيانات غير مكتملة لفتح الفيديوهات', 'error');
                return;
            }
            showCompetitionWinnersModal(agentId, competitionId, 'videos');
        });
    });
}

// Fetch winners for an agent with simple cache
async function fetchAgentWinnersForAgent(agentId) {
    if (agentWinnersCache && agentWinnersCache.agentId === agentId) {
        return agentWinnersCache.data;
    }
    try {
        const res = await window.authedFetch(`/api/agents/${encodeURIComponent(agentId)}/winners`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('فشل في جلب الفائزين');
        const data = await res.json();
        agentWinnersCache = { agentId, data };
        return data;
    } catch (e) {
        console.error('[agent-competitions] fetchAgentWinnersForAgent error', e);
        throw e;
    }
}

// Show a modal with winners of a specific competition
async function showCompetitionWinnersModal(agentId, competitionId, mode = 'list') {
    let modal = document.getElementById('competition-winners-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'competition-winners-modal';
        modal.className = 'cw-modal-overlay';
        modal.innerHTML = `
            <div class="cw-modal">
                <div class="cw-modal-header">
                    <h3 class="cw-modal-title" id="cw-modal-title"><i class="fas fa-trophy"></i> فائزين هذه المسابقة</h3>
                    <button class="cw-close" id="cw-modal-close" title="إغلاق">&times;</button>
                </div>
                <div class="cw-modal-body" id="cw-modal-body">
                    <div class="cw-loading"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>
                </div>
            </div>`;
        document.body.appendChild(modal);

        // Inject styles once
        if (!document.getElementById('cw-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'cw-modal-styles';
            style.textContent = `
            .cw-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10050}
            .cw-modal{width:min(680px,95vw);background:var(--card-bg-color,#0f1724);border:1px solid var(--border-color,#1f2937);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.4);overflow:hidden}
            .cw-modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border-color,#1f2937)}
            .cw-modal-title{margin:0;font-size:1.05rem;color:var(--text-color,#e6eef8);display:flex;align-items:center;gap:8px}
            .cw-close{background:transparent;border:none;color:var(--text-secondary,#94a3b8);font-size:1.4rem;cursor:pointer;padding:4px 8px;border-radius:8px}
            .cw-close:hover{background:#0b1220;color:#fff}
            .cw-modal-body{padding:14px}
            .cw-loading{color:var(--text-secondary,#94a3b8);text-align:center;padding:18px}
            .cw-winner-list{display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow:auto}
            .cw-winner-item{display:flex;align-items:center;justify-content:space-between;background:var(--card-bg,#0b1220);border:1px solid var(--border-color,#1f2937);border-radius:10px;padding:10px 12px}
            .cw-winner-left{display:flex;flex-direction:column;gap:2px}
            .cw-name{font-weight:700;color:var(--text-color,#e6eef8)}
            .cw-email{font-size:.85rem;color:var(--text-secondary,#94a3b8)}
            .cw-meta{display:flex;align-items:center;gap:8px}
            .cw-account{font-family:monospace;background:#111827;color:#e6eef8;padding:4px 8px;border-radius:6px;font-size:.85rem}
            .cw-date{color:var(--text-secondary,#94a3b8);font-size:.8rem}
            .cw-empty{padding:24px;text-align:center;color:var(--text-secondary,#94a3b8)}
            .cw-video-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; max-height: 60vh; overflow: auto; }
            .cw-video-card { background: var(--card-bg, #0b1220); border: 1px solid var(--border-color, #1f2937); border-radius: 10px; overflow: hidden; }
            .cw-video-header { padding: 10px; border-bottom: 1px solid var(--border-color, #1f2937); font-weight: bold; color: var(--text-color, #e6eef8); }
            .cw-video-player { width: 100%; aspect-ratio: 16/9; background: #000; }
            .cw-video-footer { padding: 10px; text-align: center; }
            .cw-download-link { color: #3b82f6; text-decoration: none; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 5px; }
            .cw-download-link:hover { text-decoration: underline; }
            `;
            document.head.appendChild(style);
        }
        document.getElementById('cw-modal-close').addEventListener('click', () => {
            hideCompetitionWinnersModal();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideCompetitionWinnersModal();
        });
    }

    const bodyEl = document.getElementById('cw-modal-body');
    const titleEl = document.getElementById('cw-modal-title');
    
    if (mode === 'videos') {
        titleEl.innerHTML = '<i class="fas fa-video"></i> فيديوهات الفائزين';
    } else {
        titleEl.innerHTML = '<i class="fas fa-trophy"></i> فائزين هذه المسابقة';
    }

    bodyEl.innerHTML = '<div class="cw-loading"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
    modal.style.display = 'flex';

    try {
        const data = await fetchAgentWinnersForAgent(agentId);
        const comps = Array.isArray(data?.competitions) ? data.competitions : [];
        const comp = comps.find(c => String(c.id) === String(competitionId));
        if (!comp) {
            bodyEl.innerHTML = '<div class="cw-empty">لا يوجد فائزون لهذه المسابقة حتى الآن</div>';
            return;
        }
        const winners = Array.isArray(comp.winners) ? comp.winners : [];
        if (winners.length === 0) {
            bodyEl.innerHTML = '<div class="cw-empty">لا يوجد فائزون لهذه المسابقة حتى الآن</div>';
            return;
        }

        if (mode === 'videos') {
             const winnersWithVideos = winners.filter(w => w.video_url || (w.meta && w.meta.video_url));
             if (winnersWithVideos.length === 0) {
                 bodyEl.innerHTML = '<div class="cw-empty">لا توجد فيديوهات مسجلة لهذه المسابقة</div>';
                 return;
             }
             
             const listHtml = winnersWithVideos.map(w => {
                 const videoUrl = w.video_url || (w.meta && w.meta.video_url);
                 return `
                    <div class="cw-video-card">
                        <div class="cw-video-header">
                            <span class="cw-video-winner">${w.name}</span>
                        </div>
                        <video src="${videoUrl}" controls class="cw-video-player" preload="metadata"></video>
                        <div class="cw-video-footer">
                            <a href="${videoUrl}" download="winner_${w.name}.webm" class="cw-download-link"><i class="fas fa-download"></i> تحميل الفيديو</a>
                        </div>
                    </div>
                 `;
             }).join('');
             
             bodyEl.innerHTML = `<div class="cw-video-grid">${listHtml}</div>`;
        } else {
            const listHtml = winners.map(w => {
                const email = w.email || (w.meta && w.meta.email) || '';
                const date = w.selected_at ? new Date(w.selected_at).toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
                const videoUrl = w.video_url || (w.meta && w.meta.video_url);
                
                return `
                    <div class="cw-winner-item">
                        <div class="cw-winner-left">
                            <div class="cw-name">${w.name || '—'}</div>
                            <div class="cw-email">${email || ''}</div>
                            ${videoUrl ? `<button class="cw-video-btn js-play-video" data-video-url="${videoUrl}" title="مشاهدة الفيديو"><i class="fas fa-play-circle"></i> مشاهدة الفيديو</button>` : ''}
                        </div>
                        <div class="cw-meta">
                            <span class="cw-account">${w.account_number || '—'}</span>
                            <span class="cw-date">${date}</span>
                        </div>
                    </div>`;
            }).join('');
            bodyEl.innerHTML = `<div class="cw-winner-list">${listHtml}</div>`;

            // Add event listeners for video buttons
            bodyEl.querySelectorAll('.js-play-video').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const url = btn.getAttribute('data-video-url');
                    if (url) {
                        playVideoInModal(url);
                    }
                });
            });
        }
        
        // Add video button styles if needed
        if (!document.getElementById('cw-video-styles')) {
            const s = document.createElement('style');
            s.id = 'cw-video-styles';
            s.textContent = `
                .cw-video-btn {
                    background: #3b82f6; color: white; border: none; padding: 4px 10px; 
                    border-radius: 4px; font-size: 0.8rem; cursor: pointer; margin-top: 4px;
                    display: inline-flex; align-items: center; gap: 4px;
                }
                .cw-video-btn:hover { background: #2563eb; }
            `;
            document.head.appendChild(s);
        }
    } catch (e) {
        bodyEl.innerHTML = '<div class="cw-empty">تعذر تحميل الفائزين، حاول مرة أخرى</div>';
    }
}

function hideCompetitionWinnersModal() {
    const modal = document.getElementById('competition-winners-modal');
    if (!modal) return;
    modal.style.display = 'none';
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
}

function addModalStyles() { /* موجودة سابقاً في النسخة الأصلية؛ إن كانت موجودة لن نعيد تعريفها */ }

function filterCompetitions(searchTerm) {
    let filtered = [...allCompetitions];
    if (currentStatusFilter !== 'all') {
        if (currentStatusFilter === 'active') {
            filtered = filtered.filter(comp => comp.status === 'active' || comp.status === 'sent' || comp.is_active === true);
        } else {
            filtered = filtered.filter(comp => comp.status === currentStatusFilter);
        }
    }
    if (searchTerm && searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(comp => {
            const question = (comp.description || comp.name || '').toLowerCase();
            const templateName = (comp.template_id?.name || '').toLowerCase();
            return question.includes(term) || templateName.includes(term);
        });
    }
    filteredCompetitions = filtered;
    renderCompetitionsTable();
}

// --- إعداد معالجات النقر على الأسئلة ---
function setupQuestionClickHandlers() {
    const questionCells = document.querySelectorAll('.question-cell.clickable');
    questionCells.forEach(cell => {
        cell.addEventListener('click', (e) => {
            const competitionIndex = parseInt(e.target.dataset.competitionIndex);
            const competition = filteredCompetitions[competitionIndex];
            if (competition) {
                showCompetitionModal(competition);
            }
        });
    });
}

// --- عرض نافذة منبثقة لتفاصيل المسابقة ---
function showCompetitionModal(competition) {
    // Create modal HTML if it doesn't exist
    let modal = document.getElementById('competition-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'competition-modal';
        modal.className = 'competition-modal';
        modal.innerHTML = `
            <div class="competition-modal-content">
                <div class="competition-modal-header">
                    <div class="modal-title-wrapper">
                        <h2 id="competition-modal-title" class="competition-modal-title">تفاصيل المسابقة</h2>
                        <div class="modal-subtitle" id="competition-modal-subtitle"></div>
                    </div>
                    <button class="competition-modal-close" id="competition-modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="competition-modal-body" id="competition-modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add close event listeners
        document.getElementById('competition-modal-close').addEventListener('click', hideCompetitionModal);
        modal.addEventListener('click', (e) => {
            (window.logDebug || console.debug)('[agent-competitions] competition modal click', { target: e.target, hasChild: modal.classList.contains('has-child-modal') });
            // Don't close if question modal is open
            if (modal.classList.contains('has-child-modal')) {
                (window.logDebug || console.debug)('[agent-competitions] competition modal click ignored because child modal open');
                return;
            }
            if (e.target === modal) {
                (window.logDebug || console.debug)('[agent-competitions] competition modal backdrop clicked - hiding');
                hideCompetitionModal();
            }
        });

        // Add modal styles
        addModalStyles();
    }

    // Populate modal with competition data
    populateCompetitionModal(competition);

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// --- إخفاء النافذة المنبثقة ---
function hideCompetitionModal() {
    const modal = document.getElementById('competition-modal');
    if (!modal) return;
    // If a child question modal is open, do not close the parent
    const questionModal = document.getElementById('question-modal');
    if (questionModal && questionModal.style.display === 'flex') {
        return;
    }
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// --- ملء النافذة المنبثقة ببيانات المسابقة ---
function populateCompetitionModal(competition) {
    const modalBody = document.getElementById('competition-modal-body');
    if (!modalBody) return;

    // Format dates
    const createdDate = competition.createdAt ? new Date(competition.createdAt).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : '-';

    const endsDate = competition.ends_at ? new Date(competition.ends_at).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : '-';

    const processedDate = competition.processed_at ? new Date(competition.processed_at).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : '-';

    // Status and compliance
    const statusMap = {
        'sent': 'مرسلة',
        'active': 'نشطة',
        'awaiting_winners': 'في انتظار الفائزين',
        'completed': 'مكتملة',
        'archived': 'مؤرشفة'
    };
    const statusText = statusMap[competition.status] || competition.status;

    let complianceColor = competition.is_compliant ? '#27ae60' : '#e74c3c';
    let complianceIcon = competition.is_compliant ? 'fa-check-circle' : 'fa-times-circle';
    let complianceText = competition.is_compliant ? 'ملتزم' : 'غير ملتزم';

    if (!competition.processed_at) {
        complianceColor = '#95a5a6';
        complianceIcon = 'fa-clock';
        complianceText = 'قيد الانتظار';
    }

    // Template info
    const templateName = competition.template_name || 'غير محدد';

    const questionText = competition.description || competition.name || 'غير متوفر';
    const isLongText = questionText.length > 200;
    // تحديد ما إذا كانت المسابقة في حالة انتظار الفائزين لإظهار مدخلات الأرقام
    const isAwaitingWinners = competition.status === 'awaiting_winners';

    modalBody.innerHTML = `
        <div class="competition-details-grid">
            <div class="detail-section">
                <h3 class="visually-hidden">السؤال</h3>
                <div class="detail-content">
                    <div class="competition-question-container">
                        <p class="competition-question" id="open-question-modal" style="cursor:default; color:inherit; text-decoration:none;" title="">
                            ${questionText}
                        </p>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3><i class="fas fa-info-circle"></i> المعلومات الأساسية</h3>
                <div class="detail-content">
                    <div class="detail-row">
                        <span class="detail-label">الحالة:</span>
                        <span class="detail-value status-badge status-${competition.status}">${statusText}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">القالب:</span>
                        <span class="detail-value">${templateName}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">تاريخ الإرسال:</span>
                        <span class="detail-value">${createdDate}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">تاريخ الانتهاء:</span>
                        <span class="detail-value">${endsDate}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">تاريخ التأكيد:</span>
                        <span class="detail-value">${processedDate}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3><i class="fas fa-chart-bar"></i> الإحصائيات</h3>
                <div class="detail-content">
                    ${isAwaitingWinners ? `
                    <div class="stats-edit-wrapper">
                        <p class="stats-edit-hint">أدخل القيم النهائية قبل إعلان الفائزين. جميع الحقول أرقام صحيحة صفر أو أعلى.</p>
                        <div class="stats-edit-grid">
                            <div class="stats-edit-item">
                                <label for="views_count_input">المشاهدات</label>
                                <div class="input-icon-wrap">
                                    <i class="fas fa-eye"></i>
                                    <input type="number" min="0" id="views_count_input" value="${competition.views_count || 0}" data-competition-id="${competition._id}" />
                                </div>
                            </div>
                            <div class="stats-edit-item">
                                <label for="reactions_count_input">التفاعلات</label>
                                <div class="input-icon-wrap">
                                    <i class="fas fa-heart"></i>
                                    <input type="number" min="0" id="reactions_count_input" value="${competition.reactions_count || 0}" data-competition-id="${competition._id}" />
                                </div>
                            </div>
                            <div class="stats-edit-item">
                                <label for="participants_count_input">المشاركات</label>
                                <div class="input-icon-wrap">
                                    <i class="fas fa-users"></i>
                                    <input type="number" min="0" id="participants_count_input" value="${competition.participants_count || 0}" data-competition-id="${competition._id}" />
                                </div>
                            </div>
                            <div class="stats-edit-item readonly">
                                <label>عدد الفائزين</label>
                                <div class="readonly-box"><i class="fas fa-trophy"></i><span>${competition.winners_count || 0}</span></div>
                            </div>
                        </div>
                        <div class="stats-edit-actions">
                            <button id="save-stats-btn" class="btn btn-primary"><i class="fas fa-save"></i> حفظ الإحصائيات</button>
                        </div>
                        <div class="stats-edit-status" id="stats-edit-status"></div>
                    </div>
                    ` : `
                    <div class="stats-view-grid">
                        <div class="stat-block"><i class="fas fa-eye"></i><span class="label">المشاهدات</span><span class="value">${(competition.views_count || 0).toLocaleString('ar-EG')}</span></div>
                        <div class="stat-block"><i class="fas fa-heart"></i><span class="label">التفاعلات</span><span class="value">${(competition.reactions_count || 0).toLocaleString('ar-EG')}</span></div>
                        <div class="stat-block"><i class="fas fa-users"></i><span class="label">المشاركات</span><span class="value">${(competition.participants_count || 0).toLocaleString('ar-EG')}</span></div>
                        <div class="stat-block"><i class="fas fa-trophy"></i><span class="label">عدد الفائزين</span><span class="value">${(competition.winners_count || 0).toLocaleString('ar-EG')}</span></div>
                    </div>
                    `}
                </div>
            </div>

            <div class="detail-section">
                <h3><i class="fas fa-check-circle"></i> حالة الالتزام</h3>
                <div class="detail-content">
                    <div class="compliance-status" style="color: ${complianceColor};">
                        <i class="fas ${complianceIcon}"></i>
                        <span>${complianceText}</span>
                    </div>
                    ${competition.compliance_details ? `
                        <div class="compliance-details">
                            <div class="detail-row">
                                <span class="detail-label">التاريخ المتوقع للتأكيد:</span>
                                <span class="detail-value">${competition.compliance_details.expected_confirmation_date ?
                                    new Date(competition.compliance_details.expected_confirmation_date).toLocaleDateString('ar-EG') : '-'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">حالة التأكيد:</span>
                                <span class="detail-value">${getConfirmationStatusText(competition.compliance_details.confirmation_status)}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    if (isAwaitingWinners) {
        setupStatsEditHandlers(competition._id);
        const firstInput = document.getElementById('views_count_input');
        if (firstInput) firstInput.focus();
        injectStatsEditStyles();
    }

    // Set header question prominently (truncate if very long)
    const headerTitle = document.getElementById('competition-modal-title');
    const headerSubtitle = document.getElementById('competition-modal-subtitle');
    if (headerTitle) {
        headerTitle.textContent = 'السؤال';
    }
    if (headerSubtitle) {
        const maxLen = 140;
        const displayText = questionText.length > maxLen ? questionText.substring(0, maxLen) + '…' : questionText;
        headerSubtitle.textContent = displayText;
        headerSubtitle.title = questionText;
    }
    
    // Add click event listener for question
    // Question popup disabled per user request: removing clickable behavior
    const questionElement = modalBody.querySelector('.competition-question');
    if (questionElement) {
        questionElement.removeAttribute('data-question-text');
    }
}

// --- Setup Stat Input Handlers ---
function setupStatsEditHandlers(competitionId) {
    const saveBtn = document.getElementById('save-stats-btn');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', async () => {
        const views = parseInt(document.getElementById('views_count_input').value, 10);
        const reactions = parseInt(document.getElementById('reactions_count_input').value, 10);
        const participants = parseInt(document.getElementById('participants_count_input').value, 10);
        if ([views, reactions, participants].some(v => isNaN(v) || v < 0)) {
            notify('يجب أن تكون جميع القيم أرقاماً صحيحة صفر أو أعلى', 'error');
            return;
        }
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الحفظ';
        try {
            // تعديل المسار ليستخدم تحديث المسابقة مباشرة بدون /stats لأن المسار الصحيح هو PUT /api/competitions/:id
            // عند حفظ الإحصائيات في مرحلة "في انتظار الفائزين" نُكمل حالة المسابقة إلى مكتملة
            const res = await window.authedFetch(`/api/competitions/${competitionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    views_count: views,
                    reactions_count: reactions,
                    participants_count: participants,
                    status: 'completed'
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'فشل في حفظ الإحصائيات');
            }
            notify('تم حفظ الإحصائيات وتم إكمال المسابقة بنجاح', 'success');
            const competition = allCompetitions.find(c => c._id === competitionId);
            if (competition) {
                competition.views_count = views;
                competition.reactions_count = reactions;
                competition.participants_count = participants;
                competition.status = 'completed';
            }
            const filtered = filteredCompetitions.find(c => c._id === competitionId);
            if (filtered) {
                filtered.views_count = views;
                filtered.reactions_count = reactions;
                filtered.participants_count = participants;
                filtered.status = 'completed';
            }
            
            // Update statistics
            agentData.statistics = calculateStatistics(allCompetitions);
            
            renderCompetitionsStatusCounters(agentData);
            
            // Force immediate re-render of the table with the updated data
            // We need to ensure filteredCompetitions reflects the change if we are in 'all' or 'completed' view
            if (currentStatusFilter === 'all' || currentStatusFilter === 'completed') {
                // No need to re-filter, just re-render
                renderCompetitionsTable();
            } else {
                // If we were in 'awaiting_winners', the item should disappear or move.
                // Re-apply filter to be safe
                applyStatusFilter(currentStatusFilter);
            }

            const statusBox = document.getElementById('stats-edit-status');
            if (statusBox) {
                statusBox.textContent = 'تم التحديث';
                statusBox.className = 'stats-edit-status success';
            }
            // إغلاق النافذة بعد الإكمال
            hideCompetitionModal();
        } catch (e) {
            notify('حدث خطأ أثناء حفظ الإحصائيات', 'error');
            const statusBox = document.getElementById('stats-edit-status');
            if (statusBox) {
                statusBox.textContent = 'فشل الحفظ';
                statusBox.className = 'stats-edit-status error';
            }
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ الإحصائيات';
        }
    });
}

function injectStatsEditStyles() {
    const styleId = 'stats-edit-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
    /* Centering modal */
    .competition-modal { align-items:flex-start; justify-content:center; padding:40px 20px; }
    .competition-modal-content { max-width:760px; width:100%; margin:0 auto; max-height:90vh; display:flex; flex-direction:column; }
    .competition-modal-header { flex:0 0 auto; display:flex; align-items:flex-start; gap:16px; }
    .modal-title-wrapper { flex:1 1 auto; display:flex; flex-direction:column; gap:4px; }
    .competition-modal-title { margin:0; font-size:0.9rem; font-weight:600; color:#8b949e; letter-spacing:.8px; }
    .modal-subtitle { font-size:1.05rem; font-weight:700; line-height:1.5; color:#e6edf3; max-height:4.5em; overflow:hidden; position:relative; }
    .modal-subtitle::after { content:''; position:absolute; bottom:0; right:0; left:0; height:24px; background:linear-gradient(180deg, rgba(22,27,34,0) 0%, rgba(22,27,34,1) 90%); }
    .competition-modal-close { background:transparent; border:none; color:#8b949e; font-size:1.1rem; cursor:pointer; padding:6px; border-radius:8px; }
    .competition-modal-close:hover { background:#30363d; color:#fff; }
    .visually-hidden { position:absolute !important; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
    .competition-modal-body { flex:1 1 auto; overflow-y:auto; padding-right:6px; }
    .competition-modal-body::-webkit-scrollbar { width:8px; }
    .competition-modal-body::-webkit-scrollbar-track { background:#0d1117; border-radius:4px; }
    .competition-modal-body::-webkit-scrollbar-thumb { background:#30363d; border-radius:4px; }
    .competition-modal-body::-webkit-scrollbar-thumb:hover { background:#3b82f6; }
    /* Stats edit wrapper */
    .stats-edit-wrapper { display:flex; flex-direction:column; gap:22px; background:var(--card-bg-color,#161b22); padding:28px 26px; border:1px solid var(--border-color,#2d333b); border-radius:18px; box-shadow:0 8px 24px rgba(0,0,0,.35); }
    .stats-edit-hint { margin:0; font-size:0.85rem; color:var(--text-secondary-color,#8b949e); line-height:1.4; }
    .stats-edit-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:20px; }
    .stats-edit-item { display:flex; flex-direction:column; gap:10px; }
    .stats-edit-item label { font-size:0.8rem; font-weight:700; letter-spacing:.6px; color:var(--text-secondary-color,#8b949e); text-align:center; }
    .input-icon-wrap { position:relative; display:flex; align-items:center; }
    .input-icon-wrap i { position:absolute; left:14px; color:#64748b; font-size:1rem; pointer-events:none; }
    .input-icon-wrap input { width:100%; padding:14px 16px 14px 46px; background:linear-gradient(135deg,#0d1117 0%,#161b22 100%); border:1px solid var(--border-color,#30363d); border-radius:14px; color:var(--text-color,#e6edf3); font-size:1rem; font-weight:600; transition:all .25s ease; text-align:left; direction:ltr; }
    .input-icon-wrap input:hover { border-color:#475569; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
    .input-icon-wrap input:focus { outline:none; border-color:#3b82f6; box-shadow:0 0 0 4px rgba(59,130,246,0.35); }
    .input-icon-wrap input::-webkit-outer-spin-button, .input-icon-wrap input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .input-icon-wrap input[type=number] { -moz-appearance:textfield; }
    .stats-edit-item.readonly .readonly-box { display:flex; align-items:center; gap:6px; background:#1f242b; border:1px dashed #374151; padding:8px 10px; border-radius:8px; font-size:0.9rem; color:#e6edf3; }
    .stats-edit-item.readonly .readonly-box i { color:#fbbf24; }
    .stats-edit-actions { display:flex; justify-content:center; }
    #save-stats-btn { display:inline-flex; align-items:center; gap:8px; font-size:0.95rem; padding:14px 24px; border-radius:14px; font-weight:600; background:linear-gradient(135deg,#2563eb,#1d4ed8); }
    #save-stats-btn:hover { filter:brightness(1.1); }
    .stats-edit-status { font-size:0.7rem; min-height:14px; }
    .stats-edit-status.success { color:#10b981; }
    .stats-edit-status.error { color:#ef4444; }
    .stats-view-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:18px; }
    .stat-block { background:var(--card-bg-color,#1f242b); border:1px solid var(--border-color,#30363d); padding:16px 14px; border-radius:14px; display:flex; flex-direction:column; gap:10px; align-items:center; }
    .stat-block i { color:#64748b; font-size:1rem; }
    .stat-block .label { font-size:0.7rem; text-transform:uppercase; letter-spacing:.6px; color:#8b949e; }
    .stat-block .value { font-size:1.25rem; font-weight:700; color:#e6edf3; }
    @media (max-width:600px){ .stats-edit-grid{grid-template-columns:1fr 1fr;} .stats-view-grid{grid-template-columns:1fr 1fr;} }
    `;
    document.head.appendChild(style);
}

// --- تشغيل الفيديو في نافذة منبثقة ---
function playVideoInModal(videoUrl) {
    let modal = document.getElementById('video-player-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'video-player-modal';
        modal.className = 'cw-modal-overlay';
        modal.style.zIndex = '10060'; // Higher than winners modal
        modal.innerHTML = `
            <div class="cw-modal" style="width: min(800px, 95vw);">
                <div class="cw-modal-header">
                    <h3 class="cw-modal-title"><i class="fas fa-play-circle"></i> مشغل الفيديو</h3>
                    <button class="cw-close" id="video-player-close">&times;</button>
                </div>
                <div class="cw-modal-body" style="padding: 0; background: #000;">
                    <video id="video-player-element" controls style="width: 100%; height: auto; max-height: 80vh; display: block;"></video>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const closeBtn = document.getElementById('video-player-close');
        const videoEl = document.getElementById('video-player-element');
        
        const closeVideo = () => {
            videoEl.pause();
            videoEl.src = '';
            modal.style.display = 'none';
        };
        
        closeBtn.addEventListener('click', closeVideo);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeVideo();
        });
    }
    
    const videoEl = document.getElementById('video-player-element');
    videoEl.src = videoUrl;
    modal.style.display = 'flex';
    videoEl.play().catch(e => console.log('Auto-play prevented:', e));
}
