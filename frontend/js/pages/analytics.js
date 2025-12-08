// --- أكثر مسابقات تفاعلاً ---
// --- دالة عرض modal للسؤال الكامل ---
function showQuestionModal(questionText) {
    let modal = document.getElementById('questionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'questionModal';
        modal.className = 'question-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-question-circle"></i> نص السؤال الكامل</h3>
                    <button class="modal-close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p id="modalQuestionText"></p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary modal-ok-btn">
                        <i class="fas fa-check"></i> حسناً
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const overlay = modal.querySelector('.modal-overlay');
        const closeBtn = modal.querySelector('.modal-close-btn');
        const okBtn = modal.querySelector('.modal-ok-btn');
        overlay.addEventListener('click', window.closeQuestionModal);
        if (closeBtn) closeBtn.addEventListener('click', window.closeQuestionModal);
        if (okBtn) okBtn.addEventListener('click', window.closeQuestionModal);
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') window.closeQuestionModal();
        }, { once: true });
    }
    
    const modalQuestionText = document.getElementById('modalQuestionText');
    if (modalQuestionText) {
        modalQuestionText.textContent = questionText;
    }
    
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

window.closeQuestionModal = function() {
    const modal = document.getElementById('questionModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
};

// دالة تمرير احترافية لأي قسم مع تعويض الهيدر الثابت
function scrollToSection(sectionId, headerOffset = 60) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    // Scroll smoothly to the section top
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // إخفاء الشريط العلوي (header) إذا كان موجودًا
    const header = document.querySelector('header, .main-header, #mainHeader');
    if (header) {
        header.style.transition = 'top 0.4s, opacity 0.4s';
        header.style.top = `-${header.offsetHeight}px`;
        header.style.opacity = '0';
    }

    // تعويض الهيدر الثابت بعد التمرير
    setTimeout(() => {
        const sectionTop = section.getBoundingClientRect().top + window.pageYOffset;
        let scrollTarget = sectionTop - headerOffset;

        // إذا كان هناك جدول داخل القسم، تأكد أن رأس الجدول ظاهر بالكامل
        const table = section.querySelector('table');
        if (table) {
            const tableRect = table.getBoundingClientRect();
            const tableHead = table.querySelector('thead');
            if (tableHead) {
                // احسب موضع رأس الجدول بالنسبة للصفحة
                const theadRect = tableHead.getBoundingClientRect();
                const theadTop = theadRect.top + window.pageYOffset;
                // إذا لم يكن رأس الجدول ظاهرًا بعد التمرير، عدل الهدف
                if (theadTop < window.pageYOffset + headerOffset || theadTop > window.pageYOffset + window.innerHeight) {
                    scrollTarget = theadTop - headerOffset;
                }
            }
        }

        window.scrollTo({
            top: scrollTarget,
            behavior: 'smooth'
        });

        // إعادة إظهار الشريط العلوي بعد فترة قصيرة أو عند العودة للأعلى
        if (header) {
            setTimeout(() => {
                header.style.top = '';
                header.style.opacity = '';
            }, 1200);

            // إظهار الشريط عند العودة للأعلى
            const onScroll = () => {
                if (window.scrollY < 50) {
                    header.style.top = '';
                    header.style.opacity = '';
                    window.removeEventListener('scroll', onScroll);
                }
            };
            window.addEventListener('scroll', onScroll);
        }
    }, 400);
}

// تفعيل التمرير لجميع أزرار الاختصارات التي تحمل data-section
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-section]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const targetId = btn.getAttribute('data-section');
            if (targetId) {
                e.preventDefault();
                scrollToSection(targetId);
            }
        });
    });
});

// ============================================
// دوال مساعدة لفلاتر التاريخ الخاصة بكل قسم
// ============================================

/**
 * إعداد فلتر التاريخ لقسم معين
 * @param {string} sectionName - اسم القسم (مثل: completedCompetitions, agentGrowth, إلخ)
 * @param {Function} updateCallback - دالة يتم استدعاؤها عند تطبيق الفلتر
 */
function setupSectionDateFilter(sectionName, updateCallback) {
    const fromDateInput = document.getElementById(`${sectionName}FromDate`);
    const toDateInput = document.getElementById(`${sectionName}ToDate`);
    const applyBtn = document.getElementById(`apply${capitalizeFirst(sectionName)}Filter`);
    const clearBtn = document.getElementById(`clear${capitalizeFirst(sectionName)}Filter`);

    if (!fromDateInput || !toDateInput || !applyBtn || !clearBtn) {
        console.warn(`[setupSectionDateFilter] عناصر فلتر ${sectionName} غير موجودة`);
        return;
    }

    // زر تطبيق الفلتر
    applyBtn.addEventListener('click', () => {
        const from = fromDateInput.value;
        const to = toDateInput.value;

        // التحقق من صحة البيانات
        if (!from && !to) {
            showToast('الرجاء اختيار تاريخ واحد على الأقل', 'warning');
            return;
        }

        if (from && to && new Date(from) > new Date(to)) {
            showToast('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'error');
            return;
        }

        // تطبيق الفلتر
        if (updateCallback) {
            updateCallback();
            showToast('تم تطبيق الفلتر بنجاح', 'success');
        }
    });

    // زر مسح الفلتر
    clearBtn.addEventListener('click', () => {
        fromDateInput.value = '';
        toDateInput.value = '';
        
        if (updateCallback) {
            updateCallback();
            showToast('تم مسح الفلتر', 'info');
        }
    });
}

/**
 * الحصول على فلتر التاريخ لقسم معين
 * @param {string} sectionName - اسم القسم
 * @returns {Object|string} كائن يحتوي على from و to، أو '30' كافتراضي
 */
function getSectionDateFilter(sectionName) {
    const fromDateInput = document.getElementById(`${sectionName}FromDate`);
    const toDateInput = document.getElementById(`${sectionName}ToDate`);

    if (!fromDateInput || !toDateInput) {
        return '30'; // الافتراضي
    }

    const from = fromDateInput.value;
    const to = toDateInput.value;

    if (from && to) {
        return { from, to };
    } else if (from || to) {
        return { from: from || undefined, to: to || undefined };
    }

    return '30'; // الافتراضي
}

/**
 * تحويل الحرف الأول إلى حرف كبير
 * @param {string} str - النص
 * @returns {string} النص مع حرف كبير في البداية
 */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// --- أكثر مسابقات تفاعلاً ---
async function fetchAndRenderMostInteractiveCompetitions() {
    const listEl = document.getElementById('mostInteractiveCompetitionsList');
    const errorEl = document.getElementById('mostInteractiveCompetitionsError');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading-spinner active"></div><p style="margin:8px 0 0; color:var(--text-secondary-color)">جاري تحميل بيانات المسابقات الأكثر تفاعلاً...</p>';
    if (errorEl) errorEl.textContent = '';

    try {
        const sortSelect = document.getElementById('mostInteractiveSortBy');
        const limitSelect = document.getElementById('mostInteractiveLimit');
        const sortBy = sortSelect ? sortSelect.value : 'views';
        const limit = limitSelect ? parseInt(limitSelect.value, 10) : 50;

        // Build date params - استخدام فلتر القسم الخاص
        let query = '';
        const fromDateInput = document.getElementById('mostInteractiveFromDate');
        const toDateInput = document.getElementById('mostInteractiveToDate');
        const fromVal = fromDateInput?.value;
        const toVal = toDateInput?.value;
        if (fromVal && toVal) { query += `from=${fromVal}&to=${toVal}`; }
        else { query += 'range=30'; }
        query += `&limit=${limit}&sort=${sortBy}`;

        const res = await fetchWithAuth(`/api/stats/interactive-competitions?${query}`);
        if (!res.ok) {
            await res.text().catch(()=> '');
            throw new Error('فشل في جلب البيانات');
        }
        const data = await res.json();
        let competitions = Array.isArray(data?.data) ? data.data : [];

        competitions = competitions.map(c => ({
            views_count: c.views_count ?? 0,
            reactions_count: c.reactions_count ?? 0,
            participants_count: c.participants_count ?? 0,
            send_count: c.send_count ?? c.competitions_count ?? 0,
            type: (c.template_type ?? c.type) ?? 'غير محدد',
            correct_answer: c.correct_answer ?? 'غير متوفر',
            question: c.question || c.template_name || 'غير متوفر'
        }));

        const comparators = {
            views: (a,b) => b.views_count - a.views_count,
            reactions: (a,b) => b.reactions_count - a.reactions_count,
            participants: (a,b) => b.participants_count - a.participants_count,
            sends: (a,b) => b.send_count - a.send_count
        };
        competitions.sort(comparators[sortBy] || comparators.views);
        competitions = competitions.slice(0, limit);

        if (!competitions.length) {
            listEl.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد بيانات متاحة ضمن الفترة المحددة.</p></div>';
            return;
        }

        const typeLegacyMap = { general: 'مميزات', trading: 'تفاعلية', deposit: 'إيداع' };
        const itemsHtml = competitions.map((comp, idx) => {
            const raw = (comp.type || '').toString().trim();
            const isArabic = raw === 'مميزات' || raw === 'تفاعلية' || raw === 'إيداع';
            const displayType = isArabic ? raw : (typeLegacyMap[raw.toLowerCase()] || 'غير محدد');
            let badgeKey = 'unknown';
            if (displayType === 'مميزات') badgeKey = 'features';
            else if (displayType === 'تفاعلية') badgeKey = 'interactive';
            else if (displayType === 'إيداع') badgeKey = 'deposit';
            const engagement = (comp.views_count > 0) ? Math.min(100, Math.round((comp.participants_count / comp.views_count) * 100)) : 0;
            const qFull = (comp.question || 'غير متوفر').toString();
            const aFull = (comp.correct_answer || 'غير متوفر').toString();
            const escapedQ = qFull.replace(/\"/g,'&quot;');
            return `
              <div class="interactive-item" data-index="${idx+1}">
                <div class="item-rank"><span class="index-badge">${idx+1}</span></div>
                <div class="item-main">
                  <div class="item-question question-cell" title="${escapedQ}" data-fulltext="${escapedQ}">
                    <i class="fas fa-question-circle"></i>
                    <span class="question-text">${qFull}</span>
                    <span class="answer-badge">الإجابة: ${aFull}</span>
                  </div>
                  <div class="item-meta">
                    <span class="type-badge ${badgeKey}">${displayType}</span>
                    <span class="metric-chip"><i class="fas fa-paper-plane"></i> ${ (comp.send_count ?? 0).toLocaleString('ar-EG') }</span>
                    <span class="metric-chip"><i class="fas fa-eye"></i> ${ (comp.views_count ?? 0).toLocaleString('ar-EG') }</span>
                    <span class="metric-chip"><i class="fas fa-bolt"></i> ${ (comp.reactions_count ?? 0).toLocaleString('ar-EG') }</span>
                    <span class="metric-chip"><i class="fas fa-users"></i> ${ (comp.participants_count ?? 0).toLocaleString('ar-EG') }</span>
                  </div>
                  <div class="engagement-bar" title="معدل التفاعل">
                    <div class="fill" style="width:${engagement}%"></div>
                    <span class="pct">${engagement}%</span>
                  </div>
                </div>
              </div>
            `;
        }).join('');
        listEl.innerHTML = itemsHtml;

        // Modal for question full text
        try {
            const container = document.getElementById('mostInteractiveCompetitionsList');
            if (container && !container._questionClickBound) {
                container.addEventListener('click', (ev) => {
                    const cell = ev.target.closest('.question-cell');
                    if (!cell) return;
                    const full = cell.getAttribute('data-fulltext') || cell.textContent || '';
                    const content = `
                        <div class="dark-expand-modal-wrapper">
                            <div class="dark-expand-modal">
                                <div class="dark-expand-modal-header">
                                    <i class="fas fa-question-circle" style="color:#4fa3ff"></i> السؤال الكامل
                                </div>
                                <div class="dark-expand-modal-body"><pre>${full}</pre></div>
                            </div>
                        </div>`;
                    if (typeof showConfirmationModal === 'function') {
                        showConfirmationModal(content, async () => true, { title: '', confirmText: '<i class="fas fa-times"></i> إغلاق', showCancel: false });
                    } else { alert(full); }
                });
                container._questionClickBound = true;
            }
        } catch (_) { /* ignore */ }
    } catch (err) {
        listEl.innerHTML = '<div class="empty-state error"><i class="fas fa-exclamation-triangle"></i><p>تعذر تحميل البيانات.</p></div>';
        if (errorEl) {
            errorEl.textContent = 'حدث خطأ أثناء تحميل أكثر المسابقات تفاعلاً';
            errorEl.classList.add('active');
        }
    }
}
// Use the globally available utilities
const { authedFetch: fetchWithAuth, showToast } = window.utils;

// DEBUG gate: disable verbose logs in production to keep UI smooth
const DEBUG = false;
const dlog = DEBUG ? (..._args) => {} : null;

// Helper: truncate long text safely
function truncateText(str, max) {
    if (!str) return '';
    const s = String(str);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// Ensure Chart.js is loaded
if (typeof Chart === 'undefined') {
    try { showToast && showToast('Chart.js غير محمل. يرجى تضمينه قبل analytics.js', 'error'); } catch (_) {}
    throw new Error('Chart.js dependency missing');
}

// Register the ChartDataLabels plugin
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// Function to safely configure Chart.js
function configureChartDefaults() {
    if (!window.Chart) {
        return false;
    }

    try {
        // Configure basic defaults
        Chart.defaults.font.family = 'Arial, sans-serif';
        Chart.defaults.color = '#fff';

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
        return false;
    }
}

// Chart instances
let mostFrequentCompetitionsChart;
let agentGrowthChart;
let agentClassificationChart;
let competitionPerformanceChart;

// Declare canvas and error elements globally for access in rendering functions
let agentGrowthCanvas, agentClassificationCanvas, competitionPerformanceCanvas;
let agentGrowthError, agentClassificationError, competitionPerformanceError;

// Comparison mode state
let isComparisonMode = false;
let comparisonData = {
    period1: null,
    period2: null
};

// Configure Chart.js when the script loads
configureChartDefaults();

// Arabic Labels
const ARABIC_LABELS = {
    mostFrequentCompetitions: 'المسابقات الأكثر تكرارًا',
    competitionName: 'اسم المسابقة',
    count: 'العدد',
    agentGrowth: 'نمو الوكلاء (آخر 6 أشهر)',
    newAgents: 'وكلاء جدد',
    agentClassification: 'توزيع تصنيفات الوكلاء',
    competitionPerformance: 'أداء المسابقات (حسب التفاعل)',
    views: 'المشاهدات',
    // activityDistribution: 'توزيع الأنشطة في النظام',
    action: 'الإجراء',
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
        return null;
    }
}

// Helper function to format date to YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Function to calculate comparison periods
function calculateComparisonPeriods(type) {
    const today = new Date();
    let period1Start, period1End, period2Start, period2End;

    switch (type) {
        case 'week':
            // Current week (Sunday to Saturday)
            const currentDayOfWeek = today.getDay();
            period1End = new Date(today);
            period1Start = new Date(today);
            period1Start.setDate(today.getDate() - currentDayOfWeek);
            
            // Previous week
            period2End = new Date(period1Start);
            period2End.setDate(period2End.getDate() - 1);
            period2Start = new Date(period2End);
            period2Start.setDate(period2End.getDate() - 6);
            break;

        case 'month':
            // Current month
            period1Start = new Date(today.getFullYear(), today.getMonth(), 1);
            period1End = new Date(today);
            
            // Previous month
            period2Start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            period2End = new Date(today.getFullYear(), today.getMonth(), 0);
            break;

        case 'quarter':
            // Current quarter
            const currentQuarter = Math.floor(today.getMonth() / 3);
            period1Start = new Date(today.getFullYear(), currentQuarter * 3, 1);
            period1End = new Date(today);
            
            // Previous quarter
            const prevQuarter = currentQuarter - 1;
            const prevQuarterYear = prevQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
            const prevQuarterMonth = prevQuarter < 0 ? 9 : prevQuarter * 3;
            period2Start = new Date(prevQuarterYear, prevQuarterMonth, 1);
            period2End = new Date(prevQuarterYear, prevQuarterMonth + 3, 0);
            break;

        default:
            return null;
    }

    return {
        period1: {
            from: formatDate(period1Start),
            to: formatDate(period1End)
        },
        period2: {
            from: formatDate(period2Start),
            to: formatDate(period2End)
        }
    };
}

// Function to calculate percentage change
function calculatePercentageChange(current, previous) {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous * 100).toFixed(1);
}

// Main data fetching function
async function fetchAnalyticsData(filter) {
    // Show loaders for all cards
    document.querySelectorAll('.loading-spinner').forEach(spinner => showLoading(spinner, true));
    document.querySelectorAll('.error-message').forEach(err => showError(err, '', false));

    // Show skeleton loaders for KPIs - optimized
    const kpiContainer = document.getElementById('analytics-kpi-cards');
    if (kpiContainer) {
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        const skeletonHTML = '<div class="stat-card-v2 loading"><div class="skeleton-line" style="width: 40%;"></div><div class="skeleton-line" style="width: 80%;"></div></div>';
        const temp = document.createElement('div');
        temp.innerHTML = skeletonHTML.repeat(6);
        while (temp.firstChild) {
            fragment.appendChild(temp.firstChild);
        }
        kpiContainer.innerHTML = '';
        kpiContainer.appendChild(fragment);
    }


    try {
        // Assuming fetchWithAuth is available globally or imported
        // build query params from provided filter object
        let url = '/api/analytics';
    dlog && dlog('DEBUG: fetchAnalyticsData - initial filter:', filter);
        const qp = new URLSearchParams();
        qp.append('_t', Date.now()); // Cache busting

        if (filter) {
            if (typeof filter === 'object') {
                const from = filter.from;
                const to = filter.to;
                const rangeValue = filter.range; // Renamed to avoid potential conflict, though unlikely

                if (from) qp.set('from', from);
                if (to) qp.set('to', to);
                if (rangeValue) qp.set('range', rangeValue);
            } else { // filter is a string (e.g., '7')
                qp.set('range', filter);
            }
        }

        const queryString = qp.toString();
        if (queryString) {
            url += `?${queryString}`;
        }

    dlog && dlog('DEBUG: fetchAnalyticsData - constructed URL:', url);
        const response = await fetchWithAuth(url);
        if (!response.ok) {
            throw new Error(ARABIC_LABELS.errorFetchingData);
        }
        const result = await response.json();
        return result; // backend returns object with analytics fields
    } catch (error) {
        try { showToast && showToast(ARABIC_LABELS.errorFetchingData, 'error'); } catch (_) {}
        document.querySelectorAll('.chart-card').forEach(card => {
            const errorEl = card.querySelector('.error-message');
            if (errorEl) showError(errorEl, ARABIC_LABELS.errorFetchingData, true);
        });
        return null;
    } finally {
        // Hide all loaders
        document.querySelectorAll('.loading-spinner').forEach(spinner => showLoading(spinner, false));
    }
}

// Fetch data for comparison mode
async function fetchComparisonData(period1, period2) {
    try {
        showToast('جاري تحميل بيانات المقارنة...', 'info');
        
        // Fetch both periods in parallel
        const [data1, data2] = await Promise.all([
            fetchAnalyticsData(period1),
            fetchAnalyticsData(period2)
        ]);

        if (!data1 || !data2) {
            throw new Error('فشل في جلب بيانات المقارنة');
        }

        comparisonData = {
            period1: data1,
            period2: data2,
            periodInfo: { period1, period2 }
        };

        renderComparisonView();
        showToast('تم تحميل بيانات المقارنة بنجاح', 'success');
        
    } catch (error) {
        showToast('حدث خطأ أثناء جلب بيانات المقارنة', 'error');
    }
}

function renderKpiCards(data) {
    const container = document.getElementById('analytics-kpi-cards');
    if (!container || !data) {
        return;
    }

    // Log bonus deposit status
    dlog && dlog('[ANALYTICS-KPI] 🎯 === تقرير البيانات ===');
    dlog && dlog('[ANALYTICS-KPI] 📊 جميع البيانات المستلمة:', JSON.stringify(data, null, 2));
    dlog && dlog('[ANALYTICS-KPI] 💰 بيانات الأرصدة الممنوحة:', data.granted_balances);
    dlog && dlog('[ANALYTICS-KPI] 📈 total_competitions_sent:', data.total_competitions_sent);
    dlog && dlog('[ANALYTICS-KPI] 👥 new_agents_in_period:', data.new_agents_in_period);
    dlog && dlog('[ANALYTICS-KPI] 📝 total_activities:', data.total_activities);
    dlog && dlog('[ANALYTICS-KPI] ==================');

    // Extract granted balances data
    const grantedBalances = data.granted_balances || {};
    const tradingBonus = grantedBalances.trading_bonus || { total_amount: 0, winners_count: 0 };
    const depositBonus = grantedBalances.deposit_bonus || [];
    const depositWinners = depositBonus.reduce((sum, b) => sum + (b.winners_count || 0), 0);
    const tradingWinners = tradingBonus.winners_count || 0;
    const totalWinners = depositWinners + tradingWinners;
    const depositRatio = totalWinners > 0 ? ((depositWinners / totalWinners) * 100).toFixed(1) : '0.0';
    
    dlog && dlog('[ANALYTICS-KPI] 💵 Trading Bonus:', tradingBonus);
    dlog && dlog('[ANALYTICS-KPI] 🎁 Deposit Bonus:', depositBonus);

    container.innerHTML = `
        <div class="stat-card-v2">
            <p class="stat-card-v2-value">${data.total_competitions_sent ?? '0'}</p>
            <h3 class="stat-card-v2-title">إجمالي المسابقات (الفترة المحددة)</h3>
        </div>
        <div class="stat-card-v2">
            <p class="stat-card-v2-value">${data.new_agents_in_period ?? '0'}</p>
            <h3 class="stat-card-v2-title">وكلاء جدد (الفترة المحددة)</h3>
        </div>
        <div class="stat-card-v2">
            <p class="stat-card-v2-value">${depositRatio}%</p>
            <h3 class="stat-card-v2-title">نسبة أرصدة ممنوحة (نسبة إيداع)</h3>
        </div>
        <div class="stat-card-v2">
            <p class="stat-card-v2-value" style="color: var(--accent-color)">$${tradingBonus.total_amount?.toLocaleString() ?? '0'}</p>
            <h3 class="stat-card-v2-title">أرصدة ممنوحة (بونص تداولي)</h3>
        </div>
        <div class="stat-card-v2">
            <p class="stat-card-v2-value">${tradingBonus.winners_count ?? '0'}</p>
            <h3 class="stat-card-v2-title">عدد فائزين (بونص تداولي)</h3>
        </div>
        <div class="stat-card-v2">
            <p class="stat-card-v2-value">${depositBonus.reduce((sum, b) => sum + (b.winners_count || 0), 0)}</p>
            <h3 class="stat-card-v2-title">إجمالي فائزين (بونص إيداع)</h3>
        </div>
    `;
    
    dlog && dlog('[ANALYTICS-KPI] ✅ KPI cards rendered successfully');
}

// --- NEW: Fetch top agent per classification and render table ---
async function fetchTopAgentsPerClassification() {
    const bodyEl = document.getElementById('topAgentsByClassBody');
    const errorEl = document.getElementById('topAgentsByClassError');
    if (!bodyEl) return;
    bodyEl.innerHTML = '<tr class="loading-row"><td colspan="7"><div class="loading-spinner active"></div><p>جاري تحميل أبرز الوكلاء...</p></td></tr>';
    errorEl && (errorEl.textContent = '');

    const classifications = ['R','A','B','C'];
    try {
        // استخدام فلتر التاريخ الخاص بالقسم
        const fromDateInput = document.getElementById('topAgentsFromDate');
        const toDateInput = document.getElementById('topAgentsToDate');
        const fromVal = fromDateInput?.value;
        const toVal = toDateInput?.value;
        let dateQuery = '';
        if (fromVal && toVal) {
            dateQuery = `&from=${fromVal}&to=${toVal}`;
        }

        // اجلب حتى 5 وكلاء لكل تصنيف لحساب أفضلهم بنظام نقاط مركب
        const results = await Promise.all(classifications.map(c => fetchWithAuth(`/api/stats/top-agents?classification=${c}&limit=5${dateQuery}`)));
        // Permission check: if any returns 403 show message
        if (results.every(r => r.status === 403)) {
            bodyEl.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--error-color)"><i class="fas fa-lock"></i> لا تمتلك صلاحية عرض أبرز الوكلاء.</td></tr>';
            return;
        }
        const jsonData = await Promise.all(results.map(async r => {
            if (!r.ok) {
                await r.text();
                return { data: [] }; // graceful fallback per classification
            }
            return r.json();
        }));
        // cache
        topAgentsLastJson = jsonData;

        // ensure metric controls exist (insert once)
        const card = document.getElementById('topAgentsByClassCard');
        if (card && document.getElementById('topAgentsMetricControls')) {
            document.getElementById('topAgentsMetricControls').remove();
        }
        
        const rowsHtml = classifications.map((c, idx) => {
            const dataArr = jsonData[idx]?.data || [];
            if (!Array.isArray(dataArr) || dataArr.length === 0) {
                return `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary-color)">لا توجد بيانات متاحة للتصنيف ${c}</td></tr>`;
            }
            // حساب النقاط المركبة: مزيج موزون من المقاييس
            // أوزان افتراضية: المشاهدات 0.25، التفاعلات 0.30، المشاركات 0.30، عدد المسابقات 0.15
            // تطبيع نسبي داخل نفس التصنيف لتجنب هيمنة رقم واحد كبير.
            const maxViews = Math.max(...dataArr.map(a => a.total_views || 0), 1);
            const maxReactions = Math.max(...dataArr.map(a => a.total_reactions || 0), 1);
            const maxParticipants = Math.max(...dataArr.map(a => a.total_participants || 0), 1);
            const maxCompetitions = Math.max(...dataArr.map(a => a.competition_count || 0), 1);

            const scored = dataArr.map(a => {
                const v = (a.total_views || 0) / maxViews;
                const r = (a.total_reactions || 0) / maxReactions;
                const p = (a.total_participants || 0) / maxParticipants;
                const comp = (a.competition_count || 0) / maxCompetitions;
                const score = (v * 0.25) + (r * 0.30) + (p * 0.30) + (comp * 0.15);
                return { ...a, _score: score };
            });

            // ترتيب تنازلي حسب النقاط ثم تفاعلات ثم مشاركات ثم مشاهدات كمعايير كسر التعادل
            scored.sort((a,b) => {
                if (b._score !== a._score) return b._score - a._score;
                if ((b.total_reactions||0) !== (a.total_reactions||0)) return (b.total_reactions||0) - (a.total_reactions||0);
                if ((b.total_participants||0) !== (a.total_participants||0)) return (b.total_participants||0) - (a.total_participants||0);
                return (b.total_views||0) - (a.total_views||0);
            });

            const top = scored[0];
            const scoreDisplay = (top._score * 100).toFixed(1); // تحويله لنسبة مئوية لسهولة القراءة

            return `<tr>
                <td>
                    <a href="#profile/${top._id}" class="agent-link">${top.name || 'غير معروف'}</a>
                </td>
                <td><span class="classification-badge classification-${c.toLowerCase()}">${c}</span></td>
                <td>${top.total_views ?? 0}</td>
                <td>${top.total_reactions ?? 0}</td>
                <td>${top.total_participants ?? 0}</td>
                <td>${top.competition_count ?? 0}</td>
                <td><span class="agent-score" title="مزيج موزون من المشاهدات والتفاعلات والمشاركات وعدد المسابقات">${scoreDisplay}</span></td>
            </tr>`;
        }).join('');
        bodyEl.innerHTML = rowsHtml;
        // set table class to control column visibility
        try {
            const table = document.getElementById('topAgentsByClassTable');
            if (table) {
                table.classList.remove('metric-views','metric-reactions','metric-participants');
                table.classList.add('metric-'+topAgentsMetric);
            }
        } catch(_){}
    } catch (err) {
        bodyEl.innerHTML = '<tr><td colspan="7">تعذر تحميل البيانات.</td></tr>';
        if (errorEl) {
            errorEl.textContent = 'حدث خطأ أثناء تحميل أبرز الوكلاء لكل تصنيف';
            errorEl.classList.add('active');
        }
    }
}

// Render KPI cards with comparison
function renderKpiCardsComparison(data1, data2) {
    const container = document.getElementById('analytics-kpi-cards');
    if (!container || !data1 || !data2) return;

    const kpis = [
        {
            title: 'إجمالي المسابقات',
            icon: 'fa-paper-plane',
            color: 'color-1',
            value1: data1.total_competitions_sent ?? 0,
            value2: data2.total_competitions_sent ?? 0
        },
        {
            title: 'وكلاء جدد',
            icon: 'fa-user-plus',
            color: 'color-2',
            value1: data1.new_agents_in_period ?? 0,
            value2: data2.new_agents_in_period ?? 0
        },
        {
            title: 'إجمالي الأنشطة',
            icon: 'fa-history',
            color: 'color-3',
            value1: data1.total_activities ?? 0,
            value2: data2.total_activities ?? 0
        }
    ];

    container.innerHTML = kpis.map(kpi => {
        const percentageChange = calculatePercentageChange(kpi.value1, kpi.value2);
        const isPositive = percentageChange > 0;
        const isNegative = percentageChange < 0;
        const changeClass = isPositive ? 'positive' : isNegative ? 'negative' : 'neutral';
        const arrow = isPositive ? '↑' : isNegative ? '↓' : '→';

        return `
            <div class="stat-card-v2 comparison-mode">
                <p class="stat-card-v2-value">${kpi.value1}</p>
                <h3 class="stat-card-v2-title">${kpi.title}</h3>
                <div class="stat-comparison-indicator">
                    <div class="comparison-badge ${changeClass}">
                        <span class="comparison-arrow">${arrow}</span>
                        <span class="comparison-percentage">${Math.abs(percentageChange)}%</span>
                    </div>
                    <span style="color: var(--text-secondary-color); font-size: 0.85em;">
                        مقارنة بـ ${kpi.value2}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// --- Hook into existing analytics render flow: after main analytics data fetched ---
// We locate a suitable point: after KPI cards or at end of initial render function.
// If a global init exists we patch its call site. For simplicity we'll invoke from window load hash route via a small timeout.
window.addEventListener('load', () => {
    // Always fetch on page load to support standalone analytics.html
    setTimeout(() => {
        try { fetchTopAgentsPerClassification && fetchTopAgentsPerClassification(); } catch (_) {}
        fetchAndRenderMostInteractiveCompetitions();
    }, 300);
});

// Also re-fetch when hash changes to analytics
window.addEventListener('hashchange', () => {
    if (location.hash === '#analytics') {
        try { fetchTopAgentsPerClassification && fetchTopAgentsPerClassification(); } catch (_) {}
        fetchAndRenderMostInteractiveCompetitions();
    }
});

// أحداث تفاعل أدوات القسم
window.addEventListener('change', (e) => {
    if (e.target && (e.target.id === 'mostInteractiveSortBy' || e.target.id === 'mostInteractiveLimit')) {
        fetchAndRenderMostInteractiveCompetitions();
    }
});
window.addEventListener('click', (e) => {
    if (e.target && (e.target.id === 'mostInteractiveRefresh' || e.target.closest('#mostInteractiveRefresh'))) {
        fetchAndRenderMostInteractiveCompetitions();
    }
});

// Global variables for competitions table
let currentCompetitionsPage = 1;
let competitionsPerPage = 10;
let allCompetitionsData = [];
let filteredCompetitionsData = [];
let currentFilter = 'all';
// Top agents metric selection (views|reactions|participants)
let topAgentsMetric = 'views';
let topAgentsLastJson = null; // cache last fetched per-class data

// Helper function to translate base competition type (legacy)
function translateCompetitionType(type) {
    const translations = {
        'trading': 'بونص تداولي',
        'deposit': 'بونص إيداع',
        'general': 'عامة',
        'مميزات': 'مميزات',
        'تفاعلية': 'تفاعلية'
    };
    return translations[type] || type || 'غير محدد';
}

// Helper function to translate template competition_type to Arabic (preferred)
function translateTemplateCompetitionType(comp) {
    const t = comp?.competition_type;
    if (t === 'standard') return 'مميزات';
    if (t === 'special') return 'تفاعلية';
    return null;
}

// Render Completed Competitions Table with performance optimization
function renderCompletedCompetitionsTable(competitions) {
    const tbody = document.getElementById('completedCompetitionsTableBody');
    const errorEl = document.getElementById('completedCompetitionsError');
    
    if (!tbody) return;
    
    if (!competitions || competitions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-secondary-color);">
                    <i class="fas fa-inbox" style="font-size: 3em; margin-bottom: 15px; display: block;"></i>
                    لا توجد مسابقات مكتملة في الفترة المحددة
                </td>
            </tr>
        `;
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(competitions.length / competitionsPerPage);
    const startIndex = (currentCompetitionsPage - 1) * competitionsPerPage;
    const endIndex = startIndex + competitionsPerPage;
    const paginatedData = competitions.slice(startIndex, endIndex);
    
    // Update summary statistics
    updateCompetitionsSummary(competitions);
    
    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    const temp = document.createElement('tbody');
    
    // Render table rows with optimized string building
    temp.innerHTML = paginatedData.map((comp, index) => {
        const globalIndex = startIndex + index + 1;
        const engagementRate = comp.views > 0 ? ((comp.participations / comp.views) * 100).toFixed(1) : 0;
        const engagementClass = engagementRate >= 70 ? 'high' : engagementRate >= 40 ? 'medium' : 'low';
        const classificationClass = comp.classification ? comp.classification.toLowerCase() : '';
        const completedDate = comp.completed_at ? new Date(comp.completed_at).toLocaleDateString('ar-EG') : 'غير محدد';
        const displayType = translateTemplateCompetitionType(comp) || translateCompetitionType(comp.type);
        
        return `
            <tr>
                <td data-label="#">${globalIndex}</td>
                <td data-label="سؤال المسابقة">
                    <span class="competition-question" title="${comp.question || 'غير متوفر'}" data-full-question="${(comp.question || 'غير متوفر').replace(/"/g,'&quot;')}">
                        ${comp.question || 'غير متوفر'}
                    </span>
                </td>
                <td data-label="النوع">
                    <span class="competition-type-badge">${displayType}</span>
                </td>
                <td data-label="التصنيف">
                    <span class="competition-classification-badge ${classificationClass}">${comp.classification || 'غير محدد'}</span>
                </td>
                <td data-label="مرات الإرسال">
                    <span class="stat-number send-count" data-question="${(comp.question || 'غير متوفر').replace(/"/g,'&quot;')}"><i class="fas fa-paper-plane"></i> ${comp.send_count || 0}</span>
                </td>
                <td data-label="المشاهدات">
                    <span class="stat-number"><i class="fas fa-eye"></i> ${comp.views || 0}</span>
                </td>
                <td data-label="المشاركات">
                    <span class="stat-number"><i class="fas fa-users"></i> ${comp.participations || 0}</span>
                </td>
                <td data-label="معدل التفاعل">
                    <span class="engagement-rate ${engagementClass}">
                        <i class="fas fa-chart-line"></i> ${engagementRate}%
                    </span>
                </td>
                <td data-label="تاريخ الانتهاء">
                    <span class="competition-date">${completedDate}</span>
                </td>
            </tr>
        `;
    }).join('');
    
    // Clear and append efficiently
    tbody.innerHTML = '';
    tbody.appendChild(temp.firstChild ? temp : document.createTextNode(''));
    while (temp.firstChild) {
        tbody.appendChild(temp.firstChild);
    }
    
    // Update pagination
    requestAnimationFrame(() => updatePagination(totalPages));
}

// Enhance question click to show full text in a modal to avoid layout overflow while keeping accessibility
if (!window.__analyticsQuestionModalHooked) {
    window.__analyticsQuestionModalHooked = true;
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.competition-question');
        if (target && target.dataset.fullQuestion) {
            const existing = document.querySelector('.modal-overlay[data-modal="question-full-text"]');
            if (existing) existing.remove();

            const fullText = target.dataset.fullQuestion;
            // Create lightweight modal
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.setAttribute('data-modal', 'question-full-text');
            const modal = document.createElement('div');
            modal.className = 'form-modal-content';
            modal.style.maxWidth = '700px';
            modal.innerHTML = `
                <div class="form-modal-header">
                    <h3 style="margin:0; font-size:1.1em;"><i class="fas fa-question-circle"></i> نص المسابقة الكامل</h3>
                    <button class="btn-icon-action" id="close-question-modal" title="إغلاق">&times;</button>
                </div>
                <div class="form-modal-body" style="max-height:60vh; overflow-y:auto;">
                    <p style="line-height:1.6; white-space:pre-line;">${fullText}</p>
                </div>
                <div class="form-actions" style="text-align:left; padding:10px 20px 20px;">
                    <button class="btn-secondary" id="close-question-modal-btn">إغلاق</button>
                </div>
            `;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            const close = () => overlay.remove();
            modal.querySelector('#close-question-modal').addEventListener('click', close);
            modal.querySelector('#close-question-modal-btn').addEventListener('click', close);
        }
    });
}

// Click handler: show recipients for a completed competition when clicking send count
if (!window.__analyticsRecipientsHooked) {
    window.__analyticsRecipientsHooked = true;
    document.addEventListener('click', async (e) => {
        const el = e.target.closest('.send-count');
        if (!el) return;

        const question = el.getAttribute('data-question') || '';
        if (!question) return;

        // Build date filter from the current analytics filter controls
        let query = `question=${encodeURIComponent(question)}`;
        const fromInput = document.getElementById('fromDate');
        const toInput = document.getElementById('toDate');
        const activeRangeBtn = document.querySelector('.filter-btn.active[data-range]');
        if (fromInput && toInput && fromInput.value && toInput.value) {
            query += `&from=${encodeURIComponent(fromInput.value)}&to=${encodeURIComponent(toInput.value)}`;
        } else if (activeRangeBtn) {
            const range = activeRangeBtn.getAttribute('data-range');
            if (range) query += `&range=${encodeURIComponent(range)}`;
        } else {
            query += `&range=30`;
        }

        try {
            showToast && showToast('جاري تحميل قائمة الوكلاء...', 'info');
            const res = await fetchWithAuth(`/api/stats/completed-competition-recipients?${query}`);
            if (!res.ok) {
                const msg = await res.text().catch(()=> '');
                throw new Error(msg || 'فشل في جلب قائمة الوكلاء');
            }
            const data = await res.json();
            let agents = Array.isArray(data.agents) ? data.agents : [];

            // Sort agents: count desc then name asc for readability
            agents = agents
                .map(a => ({ name: a.name || 'غير معروف', count: Number(a.count) || 0 }))
                .sort((a, b) => {
                    if (b.count !== a.count) return b.count - a.count;
                    return a.name.localeCompare(b.name, 'ar');
                });

            // Build modal content
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.setAttribute('data-modal', 'competition-recipients');
            // اجعل خلفية الشاشة غير شفافة بالكامل
            overlay.style.background = 'rgba(0, 0, 0, 0.95)';
            overlay.style.backdropFilter = 'blur(4px)';
            const modal = document.createElement('div');
            modal.className = 'form-modal-content';
            modal.style.maxWidth = '700px';

            const formatAgentsCount = (n) => {
                if (n === 1) return '1 وكيل';
                if (n === 2) return '2 وكيلان';
                return `${n} وكلاء`;
            };

            const tableRows = agents.length
                ? agents.map((a, idx) => `
                        <tr>
                            <td style="text-align:center; color:var(--text-secondary-color)">${idx+1}</td>
                            <td>${a.name}</td>
                            <td style="text-align:center; white-space:nowrap;">x${a.count}</td>
                        </tr>`).join('')
                : `<tr><td colspan="3" style="text-align:center; color:var(--text-secondary-color)">لا توجد أسماء ضمن الفترة المحددة</td></tr>`;

            modal.innerHTML = `
                <div class="form-modal-header">
                    <h3 style="margin:0; font-size:1.05em;"><i class="fas fa-paper-plane"></i> أسماء الوكلاء الذين استلموا هذه المسابقة</h3>
                    <button class="btn-icon-action" id="close-recipients-modal" title="إغلاق">&times;</button>
                </div>
                <div class="form-modal-body" style="max-height:60vh; overflow-y:auto;">
                    <div style="margin-bottom:10px; color:var(--text-secondary-color);">
                        <div><strong>السؤال:</strong> <span style="white-space:pre-wrap;">${question}</span></div>
                        <div><strong>الإجمالي:</strong> ${formatAgentsCount(agents.length)}</div>
                    </div>
                    <div class="table-responsive" style="margin-top:8px;">
                        <table style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr>
                                    <th style="width:56px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1);">#</th>
                                    <th style="text-align:right; border-bottom:1px solid rgba(255,255,255,0.1);">الاسم</th>
                                    <th style="width:120px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1);">مرات الاستلام</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="form-actions" style="text-align:left; padding:10px 20px 20px;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-start;">
                        <button class="btn-secondary" id="copy-recipients-btn"><i class="fas fa-copy"></i> نسخ الأسماء</button>
                        <button class="btn-secondary" id="close-recipients-modal-btn">إغلاق</button>
                    </div>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            const close = () => overlay.remove();
            modal.querySelector('#close-recipients-modal').addEventListener('click', close);
            modal.querySelector('#close-recipients-modal-btn').addEventListener('click', close);

            // Copy recipients to clipboard: one per line, include count if > 1
            const copyBtn = modal.querySelector('#copy-recipients-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        const text = agents.length ? agents.map(a => a.count > 1 ? `${a.name} x${a.count}` : a.name).join('\n') : '';
                        if (!text) {
                            showToast && showToast('لا توجد بيانات لنسخها', 'info');
                            return;
                        }
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(text);
                        } else {
                            const ta = document.createElement('textarea');
                            ta.value = text;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            ta.remove();
                        }
                        showToast && showToast('تم نسخ الأسماء إلى الحافظة', 'success');
                    } catch (_) {
                        showToast && showToast('تعذر نسخ الأسماء', 'error');
                    }
                });
            }

            // تمت إزالة زر وتنزيل CSV حسب الطلب
        } catch (err) {
            try { showToast && showToast('تعذر تحميل قائمة الوكلاء', 'error'); } catch(_) {}
        }
    });
}

// Update competitions summary statistics
function updateCompetitionsSummary(competitions) {
    const totalCompetitions = competitions.length;
    const totalViews = competitions.reduce((sum, comp) => sum + (comp.views || 0), 0);
    const totalParticipations = competitions.reduce((sum, comp) => sum + (comp.participations || 0), 0);
    
    document.getElementById('totalCompetitions').textContent = totalCompetitions;
    document.getElementById('totalViews').textContent = totalViews.toLocaleString('ar-EG');
    document.getElementById('totalParticipations').textContent = totalParticipations.toLocaleString('ar-EG');
}

// Update pagination controls
function updatePagination(totalPages) {
    document.getElementById('currentPage').textContent = currentCompetitionsPage;
    document.getElementById('totalPages').textContent = totalPages;
    
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        prevBtn.disabled = currentCompetitionsPage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentCompetitionsPage >= totalPages;
    }
}

// Filter competitions by classification
function filterCompetitions(filterType) {
    currentFilter = filterType;
    currentCompetitionsPage = 1; // Reset to first page
    
    if (filterType === 'all') {
        filteredCompetitionsData = [...allCompetitionsData];
    } else {
        // Normalize classification values to ensure case-insensitive matching and trim spaces.
        const wanted = filterType.toUpperCase();
        filteredCompetitionsData = allCompetitionsData.filter(comp => {
            const cls = (comp.classification || '').toString().trim().toUpperCase();
            return cls === wanted;
        });
    }
    
    renderCompletedCompetitionsTable(filteredCompetitionsData);
}


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
                backgroundColor: 'rgba(0, 123, 255, 0.6)', // Vibrant blue
                borderColor: 'rgba(0, 123, 255, 1)', // Vibrant blue
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
                    color: '#fff',
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

function renderCompetitionsByDayChart(data) {
    if (!agentGrowthCanvas) return;
    if (agentGrowthChart) agentGrowthChart.destroy();

    if (!data || data.length === 0) {
        showError(agentGrowthError, ARABIC_LABELS.noData, true);
        return;
    }

    const labels = data.map(item => item.day);
    const counts = data.map(item => item.count);

    agentGrowthChart = new Chart(agentGrowthCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'عدد المسابقات',
                data: counts,
                backgroundColor: 'rgba(33, 150, 243, 0.6)',
                borderColor: 'rgba(33, 150, 243, 1)',
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
                    text: 'إحصائيات المسابقات حسب اليوم',
                    font: { size: 16 },
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: (value) => value,
                    color: '#fff',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'عدد المسابقات'
                    },
                    ticks: { precision: 0 }
                },
                x: {
                    title: {
                        display: true,
                        text: 'اليوم'
                    }
                }
            },
            onClick: (event, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const dayName = labels[index];
                    // Build URL with current filter parameters
                    // Determine a safe base path whether we're on pages/analytics.html or index.html#analytics
                    let basePath;
                    const path = window.location.pathname || '';
                    if (path.includes('/pages/')) {
                        basePath = path.replace(/[^\/]*$/, ''); // keep trailing slash
                        basePath += 'day-competitions.html';
                    } else {
                        // When running inside the SPA (index.html), navigate to the standalone page under /pages
                        basePath = '/pages/day-competitions.html';
                    }
                    let url = `${basePath}?day=${encodeURIComponent(dayName)}`;
                    
                    // Get current filter parameters
                    const fromInput = document.getElementById('fromDate');
                    const toInput = document.getElementById('toDate');
                    const activeRangeBtn = document.querySelector('.filter-button.active[data-range]');
                    
                    if (fromInput && toInput && fromInput.value && toInput.value) {
                        url += `&from=${fromInput.value}&to=${toInput.value}`;
                    } else if (activeRangeBtn) {
                        const range = activeRangeBtn.dataset.range;
                        url += `&range=${range}`;
                    }
                    
                    window.location.href = url;
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Render granted balances section
function renderGrantedBalances(data) {
    const tradingBonusAmount = document.getElementById('tradingBonusAmount');
    const tradingBonusWinners = document.getElementById('tradingBonusWinners');
    const depositBonusTableBody = document.getElementById('depositBonusTableBody');
    const grantedBalancesError = document.getElementById('grantedBalancesError');

    if (!data) {
        if (grantedBalancesError) {
            showError(grantedBalancesError, ARABIC_LABELS.noData, true);
        }
        return;
    }

    // Clear previous error
    if (grantedBalancesError) {
        showError(grantedBalancesError, '', false);
    }

    // Debug Log for Granted Balances
    console.log('%c[Analytics] Granted Balances Update:', 'color: #00ff00; font-weight: bold; font-size: 12px;');
    console.log('Trading Bonus Data:', data.trading_bonus);
    console.log('Total Amount:', data.trading_bonus?.total_amount);
    console.log('Winners Count:', data.trading_bonus?.winners_count);
    console.log('Breakdown:', data.trading_bonus?.breakdown);
    console.log('[Deposit Bonus] Raw details from DB:', data.deposit_bonus_details);
    console.log('[Deposit Bonus] Totals by band:', (data.deposit_bonus || []).map(b => ({ value: b.bonus_value ?? b.percentage, winners: b.winners_count })));

    // Update trading bonus
    if (tradingBonusAmount) {
        tradingBonusAmount.textContent = `$${data.trading_bonus?.total_amount?.toLocaleString() || 0}`;
    }
    if (tradingBonusWinners) {
        tradingBonusWinners.textContent = data.trading_bonus?.winners_count || 0;
    }

    // Remove trading bonus breakdown controls per latest requirement
    document.getElementById('toggleTradingBreakdown')?.remove();
    document.getElementById('tradingBonusBreakdownContainer')?.remove();

    // Update deposit bonus table - show aggregated list
    if (depositBonusTableBody) {
        const details = Array.isArray(data.deposit_bonus_details) ? data.deposit_bonus_details : [];
        const REQUIRED_PERCENTAGES = [40, 50, 60, 75, 85, 90, 95, 100];
        const percentTotals = details.reduce((acc, item) => {
            const rawValue = typeof item.bonus_value === 'string' ? parseFloat(item.bonus_value) : item.bonus_value;
            if (!Number.isFinite(rawValue)) {
                return acc;
            }
            const winners = Number(item.total_winners) || 0;
            acc[rawValue] = (acc[rawValue] || 0) + winners;
            return acc;
        }, {});

        const normalizedRows = [];
        REQUIRED_PERCENTAGES.forEach((pct) => {
            normalizedRows.push({ bonus_value: pct, total_winners: percentTotals[pct] || 0, required: true });
            delete percentTotals[pct];
        });

        Object.keys(percentTotals)
            .map((key) => Number(key))
            .filter((pct) => Number.isFinite(pct))
            .sort((a, b) => a - b)
            .forEach((pct) => {
                normalizedRows.push({ bonus_value: pct, total_winners: percentTotals[pct] || 0, required: false });
            });

        const rowsHtml = normalizedRows.map((item) => `
            <tr>
                <td style="font-weight:bold; color:#10b981;">
                    ${item.bonus_value}%${item.required ? '' : ' *'}
                </td>
                <td>${item.total_winners}</td>
            </tr>
        `).join('');

        const tableWrapper = depositBonusTableBody.closest('.deposit-bonus-table');
        if (tableWrapper) tableWrapper.style.display = 'block';
        depositBonusTableBody.innerHTML = rowsHtml;
    }
}

// Render weekly excellence section
function renderWeeklyExcellence(data) {
    const weeklyExcellenceTableBody = document.getElementById('weeklyExcellenceTableBody');
    const weeklyExcellenceError = document.getElementById('weeklyExcellenceError');

    if (!data) {
        if (weeklyExcellenceError) {
            showError(weeklyExcellenceError, ARABIC_LABELS.noData, true);
        }
        return;
    }

    // Clear previous error
    if (weeklyExcellenceError) {
        showError(weeklyExcellenceError, '', false);
    }

    if (weeklyExcellenceTableBody) {
        const currentWeek = data.current_week || {};
        const previousWeek = data.previous_week || {};
        const change = data.change || {};

        // Helper function to format change percentage with color
        const formatChange = (changeValue) => {
            const value = parseFloat(changeValue) || 0;
            const sign = value >= 0 ? '+' : '';
            const colorClass = value >= 0 ? 'positive-change' : 'negative-change';
            return `<span class="${colorClass}">${sign}${value}%</span>`;
        };

        const rowsHtml = `
            <tr>
                <td><strong>عدد المسابقات</strong></td>
                <td>${currentWeek.competitions_count || 0}</td>
                <td>${previousWeek.competitions_count || 0}</td>
                <td>${formatChange(change.competitions_change)}</td>
            </tr>
            <tr>
                <td><strong>عدد المشاركات</strong></td>
                <td>${currentWeek.total_participations || 0}</td>
                <td>${previousWeek.total_participations || 0}</td>
                <td>${formatChange(change.participations_change)}</td>
            </tr>
        `;

        weeklyExcellenceTableBody.innerHTML = rowsHtml;
    }
}

function renderAgentClassificationChart(data) {
    if (!agentClassificationCanvas) return;
    if (agentClassificationChart) agentClassificationChart.destroy();

    if (!data || Object.keys(data).length === 0) {
        showError(agentClassificationError, ARABIC_LABELS.noData, true);
        return;
    }

    const labels = Object.keys(data);
    const counts = Object.values(data);

    agentClassificationChart = new Chart(agentClassificationCanvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: ARABIC_LABELS.count,
                data: counts,
                backgroundColor: ['#4CAF50', '#F4A261', '#2196F3', '#9C27B0', '#795548'],
                borderColor: 'var(--card-bg-color)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: ARABIC_LABELS.agentClassification,
                    font: { size: 16 }
                },
                legend: {
                    position: 'bottom',
                },
                datalabels: {
                    color: '#fff',
                    formatter: (value, context) => {
                        const sum = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        const percentage = (value / sum * 100).toFixed(0) + '%';
                        return percentage;
                    },
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function renderCompetitionPerformanceChart(data) {
    if (!competitionPerformanceCanvas) return;
    if (competitionPerformanceChart) competitionPerformanceChart.destroy();

    if (!data || data.length === 0) {
        showError(competitionPerformanceError, ARABIC_LABELS.noData, true);
        return;
    }

    const labels = data.map(item => item.template_name || 'غير معروف');
    const counts = data.map(item => item.total_views);

    competitionPerformanceChart = new Chart(competitionPerformanceCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: ARABIC_LABELS.views,
                data: counts,
                backgroundColor: 'rgba(244, 162, 97, 0.6)',
                borderColor: 'rgba(244, 162, 97, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: ARABIC_LABELS.competitionPerformance,
                    font: { size: 16 }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    color: '#fff'
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: ARABIC_LABELS.views }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}


// Global variables for Rank Changes Pagination
let allRankChangesData = [];
let currentRankChangesPage = 1;
const RANK_CHANGES_PER_PAGE = 7;

// Function to fetch and render agent rank changes
async function fetchAndRenderRankChanges(filter) {
    const rankChangesTableBody = document.getElementById('rankChangesTableBody');
    const rankChangesError = document.getElementById('rankChangesError');
    
    if (!rankChangesTableBody) return;
    
    // Initialize purge button after elements are loaded
    initRankChangesPurgeButton();
    
    try {
        // Build query params
        let url = '/api/stats/rank-changes?limit=100'; // Increased limit to fetch more for client-side pagination
        
        if (filter) {
            if (typeof filter === 'object') {
                if (filter.from) url += `&from=${filter.from}`;
                if (filter.to) url += `&to=${filter.to}`;
            } else if (filter !== 'all') {
                // For range filters, calculate dates
                const endDate = new Date();
                const startDate = new Date();
                
                if (filter === 'year') {
                    startDate.setMonth(0, 1);
                } else {
                    const days = parseInt(filter) || 30;
                    startDate.setDate(startDate.getDate() - days);
                }
                
                url += `&from=${startDate.toISOString().split('T')[0]}&to=${endDate.toISOString().split('T')[0]}`;
            }
        }
        
        const response = await fetchWithAuth(url);
        if (!response.ok) {
            throw new Error('فشل جلب بيانات تغييرات المرتبة');
        }
        
        const result = await response.json();
        allRankChangesData = result.rankChanges || [];
        currentRankChangesPage = 1; // Reset to first page
        
        renderRankChangesPage(currentRankChangesPage);

    } catch (error) {
        console.error('Error fetching rank changes:', error);
        if (rankChangesError) {
            showError(rankChangesError, 'حدث خطأ أثناء جلب البيانات', true);
        }
        if (rankChangesTableBody) {
            rankChangesTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red;">فشل تحميل البيانات</td></tr>`;
        }
    }
}

function renderRankChangesPage(page) {
    const rankChangesTableBody = document.getElementById('rankChangesTableBody');
    if (!rankChangesTableBody) return;

    if (allRankChangesData.length === 0) {
        rankChangesTableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 30px;">
                    <i class="fas fa-info-circle" style="font-size: 48px; color: #95a5a6; margin-bottom: 10px;"></i>
                    <p style="color: #7f8c8d; font-size: 16px;">لا توجد تغييرات في المراتب خلال هذه الفترة</p>
                </td>
            </tr>
        `;
        renderRankChangesPaginationControls();
        return;
    }

    const startIndex = (page - 1) * RANK_CHANGES_PER_PAGE;
    const endIndex = startIndex + RANK_CHANGES_PER_PAGE;
    const pageData = allRankChangesData.slice(startIndex, endIndex);

    // Check if user is super_admin
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isSuperAdmin = currentUser.role === 'super_admin';
    
    // Render table rows with truncated reason/action and click-to-expand
    rankChangesTableBody.innerHTML = pageData.map((change, index) => {
        const globalIndex = startIndex + index + 1;
        const date = new Date(change.createdAt);
        const formattedDate = date.toLocaleDateString('ar-EG', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const truncate = (text, max=50) => {
            if (!text) return '';
            const t = String(text);
            return t.length > max ? t.slice(0, max) + '…' : t;
        };
        const esc = (s='') => String(s)
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#39;');
        const classification = change.classification || change.agent_classification || change.class || 'غير محدد';
        const classificationSlug = classification ? classification.toString().trim().toLowerCase() : 'unknown';
        
        // Determine if this is a rank change or classification change
        const isClassificationChange = change.change_type === 'classification';
        
        // Ensure we have valid strings for ranks
        const oldRank = change.old_rank ? String(change.old_rank) : '---';
        const newRank = change.new_rank ? String(change.new_rank) : '---';

        let changeDisplay = '';
        if (isClassificationChange) {
            // Display classification change from → to (Reversed for RTL: New <- Old)
            changeDisplay = `
                <td colspan="2" style="text-align: center;">
                    <div style="display: flex; justify-content: center; align-items: center; gap: 8px;">
                        <span class="classification-badge classification-${(change.old_classification || '').toLowerCase()}">${esc(change.old_classification || 'غير محدد')}</span>
                        <i class="fas fa-arrow-left" style="color: #4fa3ff;"></i>
                        <span class="classification-badge classification-${(change.new_classification || '').toLowerCase()}">${esc(change.new_classification || 'غير محدد')}</span>
                    </div>
                    <div style="font-size: 11px; color: #7f8c8d; margin-top: 4px;">تغيير التصنيف</div>
                </td>
            `;
        } else {
            // Display rank change - Using inline styles to debug visibility
            changeDisplay = `
                <td colspan="2" style="text-align: center; vertical-align: middle;">
                    <span style="color: #2ecc71; font-weight: bold; padding: 4px 8px; background: rgba(46, 204, 113, 0.1); border-radius: 4px;">${newRank}</span>
                    <i class="fas fa-arrow-left" style="color: #7f8c8d; margin: 0 8px;"></i>
                    <span style="color: #e74c3c; font-weight: bold; padding: 4px 8px; background: rgba(231, 76, 60, 0.1); border-radius: 4px;">${oldRank}</span>
                </td>
            `;
        }
        
        return `
            <tr>
                <td>${globalIndex}</td>
                <td><strong>${esc(change.agent_name)}</strong></td>
                <td>${esc(change.agent_number)}</td>
                <td><span class="classification-badge classification-${classificationSlug}">${esc(classification)}</span></td>
                ${changeDisplay}
                <td><div class="reason-cell" data-fulltext="${esc(change.reason)}">${truncate(change.reason, 60)}</div></td>
                <td><div class="action-cell" data-fulltext="${esc(change.action_taken)}">${truncate(change.action_taken, 60)}</div></td>
                <td style="white-space: nowrap;">${formattedDate}</td>
                <td style="text-align: center;">
                    <button class="btn btn-danger btn-sm delete-rank-change-btn" data-change-id="${change._id}" title="حذف هذا التغيير">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Attach click handlers for expanding full text
    rankChangesTableBody.querySelectorAll('.reason-cell, .action-cell').forEach(el => {
        el.style.cursor = 'pointer';
        el.title = 'انقر لعرض النص كاملًا';
        el.addEventListener('click', () => {
            const full = el.getAttribute('data-fulltext') || '';
            const label = el.classList.contains('reason-cell') ? 'السبب' : 'الإجراء';
            if (typeof showConfirmationModal === 'function') {
                const styled = `
                    <div class="dark-expand-modal-wrapper">
                        <div class="dark-expand-modal">
                            <div class="dark-expand-modal-header">
                                <i class="fas fa-align-left" style="color:#4fa3ff"></i>${label} الكامل
                            </div>
                            <div class="dark-expand-modal-body">
                                <pre>${full}</pre>
                            </div>
                        </div>
                    </div>`;
                showConfirmationModal(styled, async () => true, { title: '', confirmText: '<i class="fas fa-times"></i> إغلاق', showCancel: false });
            } else { alert(full); }
        });
    });

    // Attach delete handlers
    rankChangesTableBody.querySelectorAll('.delete-rank-change-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const changeId = btn.getAttribute('data-change-id');
            if (!changeId) return;
            
            const confirmDelete = await new Promise(resolve => {
                if (typeof showConfirmationModal === 'function') {
                    showConfirmationModal('هل أنت متأكد من حذف هذا السجل؟', async () => {
                        resolve(true);
                    }, { title: 'تأكيد الحذف', confirmText: 'حذف', cancelText: 'إلغاء' });
                } else {
                    resolve(confirm('هل أنت متأكد من حذف هذا السجل؟'));
                }
            });

            if (confirmDelete) {
                try {
                    const res = await fetchWithAuth(`/api/stats/rank-changes/${changeId}`, { method: 'DELETE' });
                    if (res.ok) {
                        showToast('تم حذف السجل بنجاح', 'success');
                        // Remove from local data and re-render
                        allRankChangesData = allRankChangesData.filter(item => item._id !== changeId);
                        renderRankChangesPage(currentRankChangesPage);
                    } else {
                        showToast('فشل حذف السجل', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    showToast('حدث خطأ أثناء الحذف', 'error');
                }
            }
        });
    });

    renderRankChangesPaginationControls();
}

function renderRankChangesPaginationControls() {
    const table = document.getElementById('rankChangesTable');
    if (!table) return;
    
    let paginationContainer = document.getElementById('rankChangesPagination');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'rankChangesPagination';
        paginationContainer.className = 'pagination-controls';
        paginationContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 15px; direction: ltr;';
        table.parentNode.insertAdjacentElement('afterend', paginationContainer);
    }

    const totalPages = Math.ceil(allRankChangesData.length / RANK_CHANGES_PER_PAGE);
    
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';
    paginationContainer.innerHTML = `
        <button id="nextRankPage" class="btn btn-secondary btn-sm" ${currentRankChangesPage === totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
            التالي <i class="fas fa-chevron-right"></i>
        </button>
        <span style="font-weight: bold; color: var(--text-primary-color);">
            صفحة ${currentRankChangesPage} من ${totalPages}
        </span>
        <button id="prevRankPage" class="btn btn-secondary btn-sm" ${currentRankChangesPage === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
            <i class="fas fa-chevron-left"></i> السابق
        </button>
    `;

    document.getElementById('prevRankPage')?.addEventListener('click', () => {
        if (currentRankChangesPage > 1) {
            currentRankChangesPage--;
            renderRankChangesPage(currentRankChangesPage);
        }
    });

    document.getElementById('nextRankPage')?.addEventListener('click', () => {
        if (currentRankChangesPage < totalPages) {
            currentRankChangesPage++;
            renderRankChangesPage(currentRankChangesPage);
        }
    });
}

// Function to update all charts and table with performance optimization
async function updateDashboard(filter) {
    const analyticsData = await fetchAnalyticsData(filter);
    if (analyticsData) {
    dlog && dlog('Analytics Data:', analyticsData);
    dlog && dlog('Completed Competitions:', analyticsData.completed_competitions);
        
        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
            // Always pass full analytics object so KPI cards can access granted_balances
            renderKpiCards(analyticsData);
        });
        
        // Render table with virtual scrolling support
        requestAnimationFrame(() => {
            if (analyticsData.completed_competitions) {
                allCompetitionsData = analyticsData.completed_competitions;
                filteredCompetitionsData = [...allCompetitionsData];
                dlog && dlog('Rendering table with', filteredCompetitionsData.length, 'competitions');
                renderCompletedCompetitionsTable(filteredCompetitionsData);
            } else {
                renderCompletedCompetitionsTable([]);
            }
        });
        
        // Defer heavy chart rendering
        setTimeout(() => {
            renderCompetitionsByDayChart(analyticsData.competitions_by_day);
        }, 100);
        
        setTimeout(() => {
            renderGrantedBalances(analyticsData.granted_balances);
            renderWeeklyExcellence(analyticsData.weekly_excellence);
        }, 200);
        
        setTimeout(() => {
            renderCompetitionPerformanceChart(analyticsData.competition_performance);
        }, 300);
        
        // Lazy load interactive competitions
        setTimeout(async () => {
            try {
                await fetchAndRenderMostInteractiveCompetitions();
            } catch (e) { /* ignore */ }
        }, 400);
        
        // Lazy load rank changes
        setTimeout(async () => {
            await fetchAndRenderRankChanges(filter);
        }, 500);
    }
}


// Render comparison view
async function renderComparisonView() {
    if (!comparisonData.period1 || !comparisonData.period2) return;

    const data1 = comparisonData.period1;
    const data2 = comparisonData.period2;
    // 1. KPI Cards (enhanced: derive comparison object if backend didn't provide .kpis)
    const kpis1 = data1.kpis || {
        total_competitions_sent: data1.total_competitions_sent,
        new_agents_in_period: data1.new_agents_in_period,
        total_activities: data1.total_activities
    };
    const kpis2 = data2.kpis || {
        total_competitions_sent: data2.total_competitions_sent,
        new_agents_in_period: data2.new_agents_in_period,
        total_activities: data2.total_activities
    };
    renderKpiCardsComparison(kpis1, kpis2);

    // 2. Completed competitions table – show period1 data, but add small comparison badge if template appears in both
    if (Array.isArray(data1.completed_competitions)) {
        allCompetitionsData = data1.completed_competitions.map(comp => {
            const match = (data2.completed_competitions||[]).find(c => c.template_id === comp.template_id);
            if (match) {
                return {
                    ...comp,
                    _comparison: {
                        views_change: (comp.views||0) - (match.views||0),
                        participations_change: (comp.participations||0) - (match.participations||0)
                    }
                };
            }
            return comp;
        });
        filteredCompetitionsData = [...allCompetitionsData];
        renderCompletedCompetitionsTable(filteredCompetitionsData);
        // Inject comparison badges after render
        try {
            document.querySelectorAll('#completedCompetitionsTableBody tr').forEach(row => {
                const idx = row.querySelector('td[data-label="#"]');
                const questionCell = row.querySelector('td[data-label="سؤال المسابقة"]');
                if (!questionCell) return;
                const compIndex = parseInt(idx?.textContent||'0',10)-1;
                const compObj = filteredCompetitionsData[compIndex];
                if (compObj && compObj._comparison) {
                    const badge = document.createElement('span');
                    const v = compObj._comparison.views_change;
                    const p = compObj._comparison.participations_change;
                    const cls = (v>0||p>0) ? 'positive' : (v<0||p<0) ? 'negative' : 'neutral';
                    badge.className = 'comparison-mini-badge '+cls;
                    badge.title = 'مقارنة بالفترة الثانية: تغير المشاهدات والمشاركات';
                    badge.textContent = `${v>=0?'+':''}${v}V / ${p>=0?'+':''}${p}P`;
                    questionCell.appendChild(badge);
                }
            });
        } catch(_){}
    } else {
        renderCompletedCompetitionsTable([]);
    }

    // 3. Most frequent competitions chart comparison (already dual)
    renderMostFrequentCompetitionsChartComparison(
        data1.most_frequent_competitions,
        data2.most_frequent_competitions
    );

    // 4. Competitions by day – overlay both periods for visual diff
    if (agentGrowthCanvas && Array.isArray(data1.competitions_by_day)) {
        if (agentGrowthChart) agentGrowthChart.destroy();
        const daysSet = new Set();
        (data1.competitions_by_day||[]).forEach(d=>daysSet.add(d.day));
        (data2.competitions_by_day||[]).forEach(d=>daysSet.add(d.day));
        const labels = Array.from(daysSet);
        const counts1 = labels.map(l => (data1.competitions_by_day||[]).find(d=>d.day===l)?.count || 0);
        const counts2 = labels.map(l => (data2.competitions_by_day||[]).find(d=>d.day===l)?.count || 0);
        agentGrowthChart = new Chart(agentGrowthCanvas, {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'الفترة الأولى', data: counts1, backgroundColor: 'rgba(76,175,80,0.6)', borderColor: 'rgba(76,175,80,1)', borderWidth:1 },
                { label: 'الفترة الثانية', data: counts2, backgroundColor: 'rgba(33,150,243,0.6)', borderColor: 'rgba(33,150,243,1)', borderWidth:1 }
            ]},
            options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:true}, title:{display:true, text:'مقارنة عدد المسابقات حسب اليوم'} }, scales:{ y:{ beginAtZero:true, ticks:{precision:0} } } },
            plugins: [ChartDataLabels]
        });
    }

    // 5. Agent classification – show percentage change between periods if both available
    if (agentClassificationCanvas && data1.agent_classification && data2.agent_classification) {
        if (agentClassificationChart) agentClassificationChart.destroy();
        const allKeys = Array.from(new Set([...Object.keys(data1.agent_classification), ...Object.keys(data2.agent_classification)]));
        const vals1 = allKeys.map(k => data1.agent_classification[k]||0);
        const vals2 = allKeys.map(k => data2.agent_classification[k]||0);
        agentClassificationChart = new Chart(agentClassificationCanvas, {
            type: 'bar',
            data: { labels: allKeys, datasets: [
                { label: 'الفترة الأولى', data: vals1, backgroundColor: 'rgba(244,162,97,0.6)', borderColor:'rgba(244,162,97,1)' },
                { label: 'الفترة الثانية', data: vals2, backgroundColor: 'rgba(153,102,255,0.6)', borderColor:'rgba(153,102,255,1)' }
            ]},
            options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:true}, title:{display:true, text:'مقارنة تصنيفات الوكلاء'} } },
            plugins:[ChartDataLabels]
        });
    } else {
        renderAgentClassificationChart(data1.agent_classification);
    }

    // 6. Competition performance – overlay both periods
    if (competitionPerformanceCanvas && Array.isArray(data1.competition_performance)) {
        if (competitionPerformanceChart) competitionPerformanceChart.destroy();
        const templateSet = new Set();
        (data1.competition_performance||[]).forEach(d=>templateSet.add(d.template_name||'غير معروف'));
        (data2.competition_performance||[]).forEach(d=>templateSet.add(d.template_name||'غير معروف'));
        const labels = Array.from(templateSet);
        const views1 = labels.map(l => (data1.competition_performance||[]).find(d=> (d.template_name||'غير معروف')===l)?.total_views || 0);
        const views2 = labels.map(l => (data2.competition_performance||[]).find(d=> (d.template_name||'غير معروف')===l)?.total_views || 0);
        competitionPerformanceChart = new Chart(competitionPerformanceCanvas, {
            type: 'bar',
            data: { labels, datasets:[
                { label:'الفترة الأولى', data: views1, backgroundColor:'rgba(255,99,132,0.6)', borderColor:'rgba(255,99,132,1)', borderWidth:1 },
                { label:'الفترة الثانية', data: views2, backgroundColor:'rgba(54,162,235,0.6)', borderColor:'rgba(54,162,235,1)', borderWidth:1 }
            ]},
            options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:true}, title:{display:true, text:'مقارنة أداء المسابقات'} } },
            plugins:[ChartDataLabels]
        });
    }

    // 7. Granted balances – show both sets side by side (simple table build inside existing container)
    try {
        const depositBonusTableBody = document.getElementById('depositBonusTableBody');
        if (depositBonusTableBody && data1.granted_balances && data2.granted_balances) {
            const wrap = depositBonusTableBody.closest('.deposit-bonus-table');
            if (wrap) wrap.style.display = 'block';
            const list1 = Array.isArray(data1.granted_balances.deposit_bonus_dynamic) ? data1.granted_balances.deposit_bonus_dynamic : [];
            const list2 = Array.isArray(data2.granted_balances.deposit_bonus_dynamic) ? data2.granted_balances.deposit_bonus_dynamic : [];
            const percSet = new Set();
            list1.forEach(d=>percSet.add(d.percentage));
            list2.forEach(d=>percSet.add(d.percentage));
            const rows = Array.from(percSet).sort((a,b)=>a-b).map(p => {
                const r1 = list1.find(d=>d.percentage==p)?.winners_count||0;
                const r2 = list2.find(d=>d.percentage==p)?.winners_count||0;
                const diff = r1 - r2;
                const cls = diff>0?'positive':diff<0?'negative':'neutral';
                return `<tr><td>${p}%</td><td class="comparison ${cls}">${r1}</td><td class="comparison ${cls}">${r2}</td><td class="diff ${cls}">${diff>=0?'+':''}${diff}</td></tr>`;
            }).join('');
            depositBonusTableBody.innerHTML = rows || '<tr><td colspan="4">لا يوجد فائزون في أي فترة.</td></tr>';
        } else {
            renderGrantedBalances(data1.granted_balances);
        }
        // Trading bonus simple comparison
        const tradingBonusAmount = document.getElementById('tradingBonusAmount');
        const tradingBonusWinners = document.getElementById('tradingBonusWinners');
        if (tradingBonusAmount && data1.granted_balances?.trading_bonus) {
            const tb1 = data1.granted_balances.trading_bonus.total_amount||0;
            const tb2 = data2.granted_balances?.trading_bonus?.total_amount||0;
            tradingBonusAmount.innerHTML = `$${tb1.toLocaleString()} <span class="mini-diff ${(tb1-tb2)>0?'positive':(tb1-tb2)<0?'negative':'neutral'}">${(tb1-tb2)>=0?'+':''}${tb1-tb2}</span>`;
        }
        if (tradingBonusWinners && data1.granted_balances?.trading_bonus) {
            const w1 = data1.granted_balances.trading_bonus.winners_count||0;
            const w2 = data2.granted_balances?.trading_bonus?.winners_count||0;
            tradingBonusWinners.innerHTML = `${w1} <span class="mini-diff ${(w1-w2)>0?'positive':(w1-w2)<0?'negative':'neutral'}">${(w1-w2)>=0?'+':''}${w1-w2}</span>`;
        }
    } catch(_){}

    // 8. Weekly excellence – fetch data for both periods with comparison columns
    try {
        const weeklyExcellenceTableBody = document.getElementById('weeklyExcellenceTableBody');
        if (weeklyExcellenceTableBody) {
            // Fetch fresh weekly excellence data for both periods
            const params1 = new URLSearchParams();
            if (comparisonData.periodInfo.period1.from) params1.set('from', comparisonData.periodInfo.period1.from);
            if (comparisonData.periodInfo.period1.to) params1.set('to', comparisonData.periodInfo.period1.to);
            const params2 = new URLSearchParams();
            if (comparisonData.periodInfo.period2.from) params2.set('from', comparisonData.periodInfo.period2.from);
            if (comparisonData.periodInfo.period2.to) params2.set('to', comparisonData.periodInfo.period2.to);
            
            const [resp1, resp2] = await Promise.all([
                fetchWithAuth(`/api/analytics?${params1.toString()}`),
                fetchWithAuth(`/api/analytics?${params2.toString()}`)
            ]);
            
            let we1 = null, we2 = null;
            if (resp1.ok) {
                const d1 = await resp1.json();
                we1 = d1.weekly_excellence;
            }
            if (resp2.ok) {
                const d2 = await resp2.json();
                we2 = d2.weekly_excellence;
            }
            
            if (we1 && we2) {
                const cw1 = we1.current_week||{};
                const cw2 = we2.current_week||{};
                const compDiff = (cw1.competitions_count||0) - (cw2.competitions_count||0);
                const partDiff = (cw1.total_participations||0) - (cw2.total_participations||0);
                weeklyExcellenceTableBody.innerHTML = `
                    <tr>
                        <td><strong>عدد المسابقات</strong></td>
                        <td>${cw1.competitions_count||0}</td>
                        <td>${cw2.competitions_count||0}</td>
                        <td><span class="diff-badge ${compDiff>0?'positive':compDiff<0?'negative':'neutral'}">${compDiff>=0?'+':''}${compDiff}</span></td>
                    </tr>
                    <tr>
                        <td><strong>عدد المشاركات</strong></td>
                        <td>${cw1.total_participations||0}</td>
                        <td>${cw2.total_participations||0}</td>
                        <td><span class="diff-badge ${partDiff>0?'positive':partDiff<0?'negative':'neutral'}">${partDiff>=0?'+':''}${partDiff}</span></td>
                    </tr>`;
            } else {
                renderWeeklyExcellence(data1.weekly_excellence);
            }
        }
    } catch(_){ renderWeeklyExcellence(data1.weekly_excellence); }

    // 9. Rank changes – display only period1 but attach modal comparison when row clicked
    try {
        if (Array.isArray(data1.rank_changes) && Array.isArray(data2.rank_changes)) {
            // If backend names differ (rankChanges) unify
            const rc1 = data1.rank_changes || data1.rankChanges || [];
            const rc2 = data2.rank_changes || data2.rankChanges || [];
            // Simple render of period1
            fetchAndRenderRankChanges(comparisonData.periodInfo.period1);
            // Attach comparison modal enrich after slight delay
            setTimeout(() => {
                const body = document.getElementById('rankChangesTableBody');
                if (!body) return;
                const map2 = new Map(rc2.map(r=>[r.agent_id+'|'+r.createdAt, r]));
                body.querySelectorAll('tr').forEach(tr => {
                    const agentNameCell = tr.children[1];
                    if (!agentNameCell) return;
                    tr.addEventListener('click', () => {
                        const agent = agentNameCell.textContent.trim();
                        const matches1 = rc1.filter(r=>r.agent_name===agent);
                        const matches2 = rc2.filter(r=>r.agent_name===agent);
                        const diffCount = matches1.length - matches2.length;
                        const cls = diffCount>0?'positive':diffCount<0?'negative':'neutral';
                        const html = `<div class="rank-compare-modal"><h3>مقارنة تغييرات مرتبة الوكيل: ${agent}</h3><p>الفترة الأولى: ${matches1.length} / الفترة الثانية: ${matches2.length} <span class="diff-badge ${cls}">${diffCount>=0?'+':''}${diffCount}</span></p></div>`;
                        if (typeof showConfirmationModal === 'function') {
                            showConfirmationModal(html, async ()=>true, { title:'', confirmText:'إغلاق', showCancel:false });
                        } else { alert(html.replace(/<[^>]+>/g,'')); }
                    });
                });
            }, 600);
        } else {
            fetchAndRenderRankChanges(comparisonData.periodInfo.period1);
        }
    } catch(_){}
    
    // 10. Most Interactive Competitions – fetch both periods and show comparison side-by-side
    try {
        const listEl = document.getElementById('mostInteractiveCompetitionsList');
        if (listEl) {
            listEl.innerHTML = '<div class="loading-spinner active"></div><p style="margin:8px 0 0; color:var(--text-secondary-color)">جاري تحميل المقارنة...</p>';
            
            const sortSelect = document.getElementById('mostInteractiveSortBy');
            const limitSelect = document.getElementById('mostInteractiveLimit');
            const sortBy = sortSelect ? sortSelect.value : 'views';
            const limit = limitSelect ? parseInt(limitSelect.value, 10) : 50;
            
            const params1 = new URLSearchParams();
            params1.set('from', comparisonData.periodInfo.period1.from);
            params1.set('to', comparisonData.periodInfo.period1.to);
            params1.set('limit', limit);
            params1.set('sort', sortBy);
            
            const params2 = new URLSearchParams();
            params2.set('from', comparisonData.periodInfo.period2.from);
            params2.set('to', comparisonData.periodInfo.period2.to);
            params2.set('limit', limit);
            params2.set('sort', sortBy);
            
            const [resp1, resp2] = await Promise.all([
                fetchWithAuth(`/api/stats/interactive-competitions?${params1.toString()}`),
                fetchWithAuth(`/api/stats/interactive-competitions?${params2.toString()}`)
            ]);
            
            let comps1 = [], comps2 = [];
            if (resp1.ok) {
                const d1 = await resp1.json();
                comps1 = Array.isArray(d1?.data) ? d1.data : [];
            }
            if (resp2.ok) {
                const d2 = await resp2.json();
                comps2 = Array.isArray(d2?.data) ? d2.data : [];
            }
            
            // Normalize both sets
            const normalize = (arr) => arr.map(c => ({
                question: c.question || c.template_name || 'غير متوفر',
                views: c.views_count ?? 0,
                reactions: c.reactions_count ?? 0,
                participants: c.participants_count ?? 0,
                sends: c.send_count ?? c.competitions_count ?? 0,
                type: (c.template_type ?? c.type) ?? 'غير محدد',
                answer: c.correct_answer ?? 'غير متوفر'
            }));
            comps1 = normalize(comps1);
            comps2 = normalize(comps2);
            
            // Build merged list: for each question in period1, find match in period2
            const merged = comps1.map(c1 => {
                const c2 = comps2.find(x => x.question === c1.question) || {views:0, reactions:0, participants:0, sends:0};
                return {
                    question: c1.question,
                    type: c1.type,
                    answer: c1.answer,
                    views1: c1.views,
                    views2: c2.views,
                    reactions1: c1.reactions,
                    reactions2: c2.reactions,
                    participants1: c1.participants,
                    participants2: c2.participants,
                    sends1: c1.sends,
                    sends2: c2.sends
                };
            });
            
            // Sort merged by chosen metric period1
            const metricKey = { views: 'views1', reactions: 'reactions1', participants: 'participants1', sends: 'sends1' }[sortBy] || 'views1';
            merged.sort((a, b) => b[metricKey] - a[metricKey]);
            
            if (merged.length === 0) {
                listEl.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد بيانات متاحة ضمن الفترة المحددة.</p></div>';
            } else {
                const typeLegacyMap = { general: 'مميزات', trading: 'تفاعلية', deposit: 'إيداع' };
                const itemsHtml = merged.slice(0, limit).map((comp, idx) => {
                    const raw = (comp.type || '').toString().trim();
                    const isArabic = raw === 'مميزات' || raw === 'تفاعلية' || raw === 'إيداع';
                    const displayType = isArabic ? raw : (typeLegacyMap[raw.toLowerCase()] || 'غير محدد');
                    let badgeKey = 'unknown';
                    if (displayType === 'مميزات') badgeKey = 'features';
                    else if (displayType === 'تفاعلية') badgeKey = 'interactive';
                    else if (displayType === 'إيداع') badgeKey = 'deposit';
                    
                    const vDiff = comp.views1 - comp.views2;
                    const rDiff = comp.reactions1 - comp.reactions2;
                    const pDiff = comp.participants1 - comp.participants2;
                    const sDiff = comp.sends1 - comp.sends2;
                    
                    const diffCls = (v) => v>0?'positive':v<0?'negative':'neutral';
                    const escapedQ = (comp.question || 'غير متوفر').replace(/\"/g,'&quot;');
                    
                    return `
                      <div class="interactive-item comparison-mode" data-index="${idx+1}">
                        <div class="item-rank"><span class="index-badge">${idx+1}</span></div>
                        <div class="item-main">
                          <div class="item-question question-cell" title="${escapedQ}" data-fulltext="${escapedQ}">
                            <i class="fas fa-question-circle"></i>
                            <span class="question-text">${comp.question}</span>
                            <span class="answer-badge">الإجابة: ${comp.answer}</span>
                          </div>
                          <div class="item-meta comparison-meta">
                            <span class="type-badge ${badgeKey}">${displayType}</span>
                            <div class="metric-comparison">
                              <span class="metric-chip period1"><i class="fas fa-paper-plane"></i> ${comp.sends1.toLocaleString('ar-EG')}</span>
                              <span class="metric-chip period2">${comp.sends2.toLocaleString('ar-EG')}</span>
                              <span class="mini-diff ${diffCls(sDiff)}">${sDiff>=0?'+':''}${sDiff}</span>
                            </div>
                            <div class="metric-comparison">
                              <span class="metric-chip period1"><i class="fas fa-eye"></i> ${comp.views1.toLocaleString('ar-EG')}</span>
                              <span class="metric-chip period2">${comp.views2.toLocaleString('ar-EG')}</span>
                              <span class="mini-diff ${diffCls(vDiff)}">${vDiff>=0?'+':''}${vDiff}</span>
                            </div>
                            <div class="metric-comparison">
                              <span class="metric-chip period1"><i class="fas fa-bolt"></i> ${comp.reactions1.toLocaleString('ar-EG')}</span>
                              <span class="metric-chip period2">${comp.reactions2.toLocaleString('ar-EG')}</span>
                              <span class="mini-diff ${diffCls(rDiff)}">${rDiff>=0?'+':''}${rDiff}</span>
                            </div>
                            <div class="metric-comparison">
                              <span class="metric-chip period1"><i class="fas fa-users"></i> ${comp.participants1.toLocaleString('ar-EG')}</span>
                              <span class="metric-chip period2">${comp.participants2.toLocaleString('ar-EG')}</span>
                              <span class="mini-diff ${diffCls(pDiff)}">${pDiff>=0?'+':''}${pDiff}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    `;
                }).join('');
                listEl.innerHTML = itemsHtml;
            }
        }
    } catch(_){}
}

// Render most frequent competitions chart with comparison
function renderMostFrequentCompetitionsChartComparison(data1, data2) {
    const mostFrequentCompetitionsCanvas = document.getElementById('mostFrequentCompetitionsChart');
    const mostFrequentCompetitionsError = document.getElementById('mostFrequentCompetitionsError');
    if (!mostFrequentCompetitionsCanvas) return;
    if (mostFrequentCompetitionsChart) mostFrequentCompetitionsChart.destroy();

    if (!data1 || data1.length === 0) {
        showError(mostFrequentCompetitionsError, ARABIC_LABELS.noData, true);
        return;
    }

    // Combine templates from both periods
    const templates = new Set();
    data1.forEach(item => templates.add(item.template_name || item.competition_name || 'غير معروف'));
    data2?.forEach(item => templates.add(item.template_name || item.competition_name || 'غير معروف'));
    
    const labels = Array.from(templates);
    const counts1 = labels.map(label => {
        const item = data1.find(d => (d.template_name || d.competition_name) === label);
        return item ? item.count : 0;
    });
    const counts2 = labels.map(label => {
        const item = data2?.find(d => (d.template_name || d.competition_name) === label);
        return item ? item.count : 0;
    });

    mostFrequentCompetitionsChart = new Chart(mostFrequentCompetitionsCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'الفترة الأولى',
                    data: counts1,
                    backgroundColor: 'rgba(76, 175, 80, 0.6)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 1
                },
                {
                    label: 'الفترة الثانية',
                    data: counts2,
                    backgroundColor: 'rgba(33, 150, 243, 0.6)',
                    borderColor: 'rgba(33, 150, 243, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'مقارنة المسابقات الأكثر تكراراً',
                    font: { size: 16 }
                },
                datalabels: {
                    display: false
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

// Initialization
export function init() {
    // DOM Elements - moved inside init()
    const fromDateInput = document.getElementById('fromDate');
    const toDateInput = document.getElementById('toDate');
    const applyDateFilterBtn = document.getElementById('applyDateFilter');
    const clearDateFilterBtn = document.getElementById('clearDateFilter');
    const quickFiltersContainer = document.getElementById('quick-date-filters');

    // Comparison mode elements
    const comparisonModeToggle = document.getElementById('comparisonModeToggle');
    const normalFilters = document.getElementById('normalFilters');
    const comparisonFilters = document.getElementById('comparisonFilters');
    const quickComparisonButtons = document.querySelector('.quick-comparison-buttons');
    const applyComparisonBtn = document.getElementById('applyComparisonFilter');
    const clearComparisonBtn = document.getElementById('clearComparisonFilter');
    
    const period1FromInput = document.getElementById('period1From');
    const period1ToInput = document.getElementById('period1To');
    const period2FromInput = document.getElementById('period2From');
    const period2ToInput = document.getElementById('period2To');

    // Assign global canvas and error elements
    agentGrowthCanvas = document.getElementById('agentGrowthChart');
    agentClassificationCanvas = document.getElementById('agentClassificationChart');
    competitionPerformanceCanvas = document.getElementById('competitionPerformanceChart');
    // activityDistributionCanvas تمت إزالته مع القسم

    agentGrowthError = document.getElementById('agentGrowthError');
    agentClassificationError = document.getElementById('agentClassificationError');
    competitionPerformanceError = document.getElementById('competitionPerformanceError');
    // activityDistributionError تمت إزالته مع القسم

    // Initial load — default to last 30 days
    updateDashboard('30');

    // Toggle comparison mode
    if (comparisonModeToggle) {
        comparisonModeToggle.addEventListener('change', (e) => {
            isComparisonMode = e.target.checked;
            
            if (isComparisonMode) {
                normalFilters.style.display = 'none';
                comparisonFilters.style.display = 'flex';
                showToast('تم تفعيل وضع المقارنة', 'info');
            } else {
                normalFilters.style.display = 'flex';
                comparisonFilters.style.display = 'none';
                // Reset to normal view
                updateDashboard('30');
                showToast('تم إلغاء وضع المقارنة', 'info');
            }
        });
    }

    // Quick comparison buttons
    if (quickComparisonButtons) {
        quickComparisonButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.comparison-btn');
            if (!btn) return;

            const comparisonType = btn.dataset.comparison;
            const periods = calculateComparisonPeriods(comparisonType);
            
            if (periods) {
                // Update UI
                document.querySelectorAll('.comparison-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Fetch comparison data
                fetchComparisonData(periods.period1, periods.period2);
            }
        });
    }

    // Apply custom comparison
    if (applyComparisonBtn) {
        applyComparisonBtn.addEventListener('click', () => {
            const period1From = period1FromInput?.value;
            const period1To = period1ToInput?.value;
            const period2From = period2FromInput?.value;
            const period2To = period2ToInput?.value;

            // Validation
            if (!period1From || !period1To || !period2From || !period2To) {
                showToast('الرجاء إدخال جميع التواريخ', 'warning');
                return;
            }

            if (new Date(period1From) > new Date(period1To)) {
                showToast('تاريخ البداية للفترة الأولى يجب أن يكون قبل تاريخ النهاية', 'error');
                return;
            }

            if (new Date(period2From) > new Date(period2To)) {
                showToast('تاريخ البداية للفترة الثانية يجب أن يكون قبل تاريخ النهاية', 'error');
                return;
            }

            // Clear active quick comparison buttons
            document.querySelectorAll('.comparison-btn').forEach(b => b.classList.remove('active'));

            // Fetch comparison data
            const period1 = { from: period1From, to: period1To };
            const period2 = { from: period2From, to: period2To };
            fetchComparisonData(period1, period2);
        });
    }

    // Clear comparison
    if (clearComparisonBtn) {
        clearComparisonBtn.addEventListener('click', () => {
            // Clear comparison inputs
            period1FromInput.value = '';
            period1ToInput.value = '';
            period2FromInput.value = '';
            period2ToInput.value = '';
            
            // Clear active quick comparison buttons
            document.querySelectorAll('.comparison-btn').forEach(b => b.classList.remove('active'));
            
            // Reset comparison data
            comparisonData = { period1: null, period2: null };
            
            // Clear date filter inputs
            if (fromDateInput) fromDateInput.value = '';
            if (toDateInput) toDateInput.value = '';
            
            // Reset to default 30 days and activate its button
            if (quickFiltersContainer) {
                quickFiltersContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                quickFiltersContainer.querySelector('[data-range="30"]').classList.add('active');
            }
            
            // Reload dashboard with default data (30 days)
            updateDashboard('30');
            
            showToast('تم مسح المقارنة والعودة للوضع الافتراضي', 'info');
        });
    }

    // Apply date filter (from/to)
    if (applyDateFilterBtn) {
        applyDateFilterBtn.addEventListener('click', () => {
            const from = fromDateInput?.value || '';
            const to = toDateInput?.value || '';

            // Validation: Check if at least one date is provided
            if (!from && !to) {
                showToast('الرجاء اختيار تاريخ واحد على الأقل', 'warning');
                return;
            }

            // Validation: Check if 'from' is before or equal to 'to'
            if (from && to && new Date(from) > new Date(to)) {
                showToast('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'error');
                return;
            }

            // Deactivate quick filter buttons
            quickFiltersContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));

            updateDashboard({ from, to });
            showToast('تم تطبيق الفلتر بنجاح', 'success');
        });
    }

    // Clear date filter
    if (clearDateFilterBtn) {
        clearDateFilterBtn.addEventListener('click', () => {
            fromDateInput.value = '';
            toDateInput.value = '';
            
            // Reset to default 30 days and activate its button
            quickFiltersContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            quickFiltersContainer.querySelector('[data-range="30"]').classList.add('active');
            
            updateDashboard('30');
            showToast('تم مسح الفلتر', 'info');
        });
    }

    // Quick date filters
    if (quickFiltersContainer) {
        quickFiltersContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                const range = e.target.dataset.range;
                
                // Clear custom date inputs
                fromDateInput.value = '';
                toDateInput.value = '';
                
                // Update active state
                quickFiltersContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                updateDashboard(range);
            }
        });
    }
    
    // Competition filter buttons
    const competitionFilterButtons = document.querySelector('.competition-filter-buttons');
    if (competitionFilterButtons) {
        competitionFilterButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.competition-filter-btn');
            if (!btn) return;
            
            const filterType = btn.dataset.filter;
            
            // Update active state
            document.querySelectorAll('.competition-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Filter competitions
            filterCompetitions(filterType);
        });
    }
    
    // Pagination buttons
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentCompetitionsPage > 1) {
                currentCompetitionsPage--;
                renderCompletedCompetitionsTable(filteredCompetitionsData);
                // Scroll to table
                document.getElementById('completedCompetitionsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredCompetitionsData.length / competitionsPerPage);
            if (currentCompetitionsPage < totalPages) {
                currentCompetitionsPage++;
                renderCompletedCompetitionsTable(filteredCompetitionsData);
                // Scroll to table
                document.getElementById('completedCompetitionsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // NEW: بعد اكتمال تهيئة صفحة التحليلات، اجلب أبرز الوكلاء لكل تصنيف
    fetchTopAgentsPerClassification();
    
    // NEW: جلب بيانات الوكلاء والمسابقات
    fetchAndRenderAgentsCompetitions();
    
    // NEW: إضافة event listeners لفلترة الوكلاء حسب التصنيف
    const agentsCompetitionsFilterButtons = document.querySelectorAll('#agentsCompetitionsCard .competition-filter-btn');
    if (agentsCompetitionsFilterButtons.length > 0) {
        agentsCompetitionsFilterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                agentsCompetitionsFilterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const filterType = e.target.dataset.filter;
                fetchAndRenderAgentsCompetitions(filterType);
            });
        });
    }

    // ============================================
    // فلاتر التاريخ لكل قسم من الأقسام
    // ============================================

    // 1. فلتر تقرير المسابقات المكتملة
    setupSectionDateFilter(
        'completedCompetitions',
        () => {
            const filter = getSectionDateFilter('completedCompetitions');
            fetchAnalyticsData(filter).then(data => {
                if (data && data.completed_competitions) {
                    allCompetitionsData = data.completed_competitions;
                    filteredCompetitionsData = [...allCompetitionsData];
                    // إعادة تطبيق الفلتر النشط
                    const activeFilter = document.querySelector('#completedCompetitionsCard .competition-filter-btn.active');
                    const filterType = activeFilter ? activeFilter.dataset.filter : 'all';
                    filterCompetitions(filterType);
                }
            });
        }
    );

    // 2. فلتر إحصائيات المسابقات المرسلة / يوم
    setupSectionDateFilter(
        'agentGrowth',
        () => {
            const filter = getSectionDateFilter('agentGrowth');
            fetchAnalyticsData(filter).then(data => {
                if (data) {
                    renderCompetitionsByDayChart(data.competitions_by_day);
                }
            });
        }
    );

    // 3. فلتر الأرصدة الممنوحة
    setupSectionDateFilter(
        'grantedBalances',
        () => {
            const filter = getSectionDateFilter('grantedBalances');
            fetchAnalyticsData(filter).then(data => {
                if (data) {
                    renderGrantedBalances(data.granted_balances);
                }
            });
        }
    );

    // 4. فلتر التميز الأسبوعي
    setupSectionDateFilter(
        'weeklyExcellence',
        () => {
            const filter = getSectionDateFilter('weeklyExcellence');
            fetchAnalyticsData(filter).then(data => {
                if (data) {
                    renderWeeklyExcellence(data.weekly_excellence);
                }
            });
        }
    );

    // 5. فلتر تغييرات مراتب الوكلاء
    setupSectionDateFilter(
        'rankChanges',
        () => {
            const filter = getSectionDateFilter('rankChanges');
            fetchAndRenderRankChanges(filter);
        }
    );

    // 6. فلتر أكثر مسابقات تفاعلاً
    setupSectionDateFilter(
        'mostInteractive',
        () => {
            fetchAndRenderMostInteractiveCompetitions();
        }
    );

    // 7. فلتر أبرز الوكلاء لكل تصنيف
    setupSectionDateFilter(
        'topAgents',
        () => {
            fetchTopAgentsPerClassification();
        }
    );

    // 8. فلتر الوكلاء والمسابقات المرسلة
    setupSectionDateFilter(
        'agentsCompetitions',
        () => {
            const filterBtn = document.querySelector('#agentsCompetitionsCard .competition-filter-btn.active');
            const classification = filterBtn ? filterBtn.dataset.filter : 'all';
            fetchAndRenderAgentsCompetitions(classification);
        }
    );
}

// --- دالة جلب وعرض الوكلاء والمسابقات ---
const fetchAndRenderAgentsCompetitions = (classification = 'all') => {
    (async () => {
    const tableBody = document.getElementById('agentsCompetitionsTableBody');
    const errorEl = document.getElementById('agentsCompetitionsError');
    
    if (!tableBody) return;
    
    // عرض حالة التحميل
    tableBody.innerHTML = `
        <tr class="loading-row">
            <td colspan="9">
                <div class="loading-spinner active"></div>
                <p>جاري تحميل بيانات الوكلاء والمسابقات...</p>
            </td>
        </tr>
    `;
    if (errorEl) errorEl.textContent = '';
    
    try {
        // بناء معاملات الاستعلام - استخدام فلتر القسم الخاص
        let query = '';
        const fromDateInput = document.getElementById('agentsCompetitionsFromDate');
        const toDateInput = document.getElementById('agentsCompetitionsToDate');
        const fromVal = fromDateInput?.value;
        const toVal = toDateInput?.value;
        
        if (fromVal && toVal) {
            query += `from=${fromVal}&to=${toVal}`;
        } else {
            query += 'range=30';
        }
        
        if (classification && classification !== 'all') {
            query += `&classification=${classification}`;
        }
        
        // جلب البيانات من API
        const res = await fetchWithAuth(`/api/stats/agents-competitions?${query}`);
        if (!res.ok) {
            throw new Error('فشل في جلب بيانات الوكلاء والمسابقات');
        }
        
        const data = await res.json();
        const agents = data.agents || [];
        const stats = data.aggregated_stats || {};
        
        // تحديث الإحصائيات المجمعة
        updateAgentsCompetitionsStats(stats);
        
        // عرض الوكلاء في الجدول
        if (agents.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px;">
                        <i class="fas fa-inbox" style="font-size: 48px; color: var(--text-secondary-color); margin-bottom: 16px;"></i>
                        <p>لا توجد بيانات متاحة للفترة المحددة</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        const rowsHtml = agents.map((item, index) => {
            const agent = item.agent;
            const latestComp = item.latest_competition;
            const stats = item.statistics;
            
            if (!latestComp) return '';
            
            // اختصار السؤال - استخدام الاسم (السؤال) بدلاً من الوصف (القالب الكامل)
            const questionText = latestComp.name || latestComp.description || 'غير متوفر';
            const shortQuestion = questionText.length > 50 
                ? questionText.substring(0, 50) + '...' 
                : questionText;
            
            // تحديد لون نسبة الالتزام
            let complianceColor = '#e74c3c'; // أحمر
            if (stats.compliance_rate >= 80) complianceColor = '#27ae60'; // أخضر
            else if (stats.compliance_rate >= 50) complianceColor = '#f39c12'; // برتقالي
            
            // تحديد أيقونة التصنيف
            const classIcons = {
                'R': 'fa-crown',
                'A': 'fa-star',
                'B': 'fa-certificate',
                'C': 'fa-medal'
            };
            const classIcon = classIcons[agent.classification] || 'fa-tag';
            
            return `
                <tr class="agent-row" data-agent-id="${agent._id}">
                    <td>${index + 1}</td>
                    <td>
                        <div class="agent-info" style="display: flex; align-items: center; gap: 10px;">
                            ${agent.avatar_url 
                                ? `<img src="${agent.avatar_url}" alt="${agent.name}" class="agent-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">` 
                                : '<div class="agent-avatar-placeholder" style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">' + agent.name.charAt(0) + '</div>'
                            }
                            <a href="/pages/agent-competitions.html?agent_id=${agent._id}" class="agent-name-link" style="color: var(--primary-color); text-decoration: none; font-weight: 600;">
                                ${agent.name}
                            </a>
                        </div>
                    </td>
                    <td><span class="agent-id-badge">${agent.agent_id}</span></td>
                    <td>
                        <div class="question-cell question-clickable" title="${questionText}" data-question="${questionText.replace(/"/g, '&quot;')}" style="cursor: pointer; color: var(--primary-color);">
                            ${shortQuestion}
                        </div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="compliance-bar" style="flex: 1; height: 8px; background: #2c3e50; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${stats.compliance_rate}%; height: 100%; background: ${complianceColor}; transition: width 0.3s;"></div>
                            </div>
                            <span style="font-weight: 600; color: ${complianceColor};">${stats.compliance_rate}%</span>
                        </div>
                    </td>
                    <td><span class="stat-number">${(latestComp.views_count || 0).toLocaleString('ar-EG')}</span></td>
                    <td><span class="stat-number">${(latestComp.reactions_count || 0).toLocaleString('ar-EG')}</span></td>
                    <td><span class="stat-number">${(latestComp.participants_count || 0).toLocaleString('ar-EG')}</span></td>
                    <td><span class="classification-badge class-${agent.classification}"><i class="fas ${classIcon}"></i> ${agent.classification}</span></td>
                </tr>
            `;
        }).filter(row => row !== '').join('');
        
        tableBody.innerHTML = rowsHtml;
        
        // إضافة event listeners للأسئلة لفتح modal
        const questionCells = tableBody.querySelectorAll('.question-clickable');
        questionCells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                const questionText = e.target.dataset.question || e.target.getAttribute('title') || 'غير متوفر';
                showQuestionModal(questionText);
            });
        });
        
    } catch (error) {
        console.error('Error fetching agents competitions:', error);
        if (errorEl) {
            errorEl.textContent = 'حدث خطأ أثناء تحميل البيانات. يرجى المحاولة مرة أخرى.';
        }
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--error-color);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <p>حدث خطأ أثناء تحميل البيانات</p>
                </td>
            </tr>
        `;
    }
        
    })();
}

// --- دالة تحديث الإحصائيات المجمعة ---
function updateAgentsCompetitionsStats(stats) {
    const totalAgentsEl = document.getElementById('totalAgentsWithCompetitions');
    const totalCompetitionsEl = document.getElementById('totalAgentCompetitions');
    const totalViewsEl = document.getElementById('totalAgentViews');
    const totalReactionsEl = document.getElementById('totalAgentReactions');
    const totalParticipantsEl = document.getElementById('totalAgentParticipants');
    const averageComplianceEl = document.getElementById('averageCompliance');
    
    if (totalAgentsEl) totalAgentsEl.textContent = (stats.total_agents || 0).toLocaleString('ar-EG');
    if (totalCompetitionsEl) totalCompetitionsEl.textContent = (stats.total_competitions || 0).toLocaleString('ar-EG');
    if (totalViewsEl) totalViewsEl.textContent = (stats.total_views || 0).toLocaleString('ar-EG');
    if (totalReactionsEl) totalReactionsEl.textContent = (stats.total_reactions || 0).toLocaleString('ar-EG');
    if (totalParticipantsEl) totalParticipantsEl.textContent = (stats.total_participants || 0).toLocaleString('ar-EG');
    if (averageComplianceEl) averageComplianceEl.textContent = `${stats.average_compliance_rate || 0}%`;
}

// ============================================
// Delete Single Rank Change
// ============================================
async function handleDeleteRankChange(changeId, currentFilter) {
    if (!confirm('هل أنت متأكد من حذف هذا التغيير؟\n\nلا يمكن التراجع عن هذا الإجراء.')) {
        return;
    }

    try {
        const response = await fetchWithAuth(`/api/stats/rank-changes/${changeId}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message || 'تم حذف التغيير بنجاح', 'success');
            // Reload the table with current filter
            await fetchAndRenderRankChanges(currentFilter);
        } else {
            showToast(data.message || 'فشل حذف التغيير', 'error');
        }
    } catch (error) {
        console.error('Error deleting rank change:', error);
        showToast('حدث خطأ أثناء حذف التغيير', 'error');
    }
}

// ============================================
// Purge Rank Changes (Super Admin Only)
// ============================================
let rankChangesPurgeInitialized = false;

async function initRankChangesPurgeButton() {
    if (rankChangesPurgeInitialized) return; // Prevent multiple initializations
    
    const purgeBtn = document.getElementById('purgeRankChangesBtn');
    if (!purgeBtn) return;

    // Check user role
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isSuperAdmin = currentUser.role === 'super_admin';

    if (isSuperAdmin) {
        purgeBtn.style.display = 'inline-block';
        purgeBtn.addEventListener('click', handlePurgeRankChanges);
        rankChangesPurgeInitialized = true;
    }
}

async function handlePurgeRankChanges() {
    if (!confirm('هل أنت متأكد من حذف جميع تغييرات المراتب والتصنيفات؟ هذا الإجراء لا يمكن التراجع عنه!')) {
        return;
    }

        try {
            const response = await fetchWithAuth('/api/stats/rank-changes', {
                method: 'DELETE',
            });        const data = await response.json();

        if (response.ok) {
            showToast(data.message || 'تم حذف جميع تغييرات المراتب بنجاح', 'success');
            // Reload rank changes section
            fetchAndRenderRankChanges();
        } else {
            showToast(data.message || 'فشل حذف تغييرات المراتب', 'error');
        }
    } catch (error) {
        console.error('Error purging rank changes:', error);
        showToast('حدث خطأ أثناء حذف تغييرات المراتب', 'error');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initRankChangesPurgeButton);

// --- دالة عرض modal للسؤال الكامل ---


