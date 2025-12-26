// Day Competitions Page Script

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const dayName = urlParams.get('day');
const from = urlParams.get('from');
const to = urlParams.get('to');
const range = urlParams.get('range');

if (!dayName) {
    window.location.href = '../index.html#analytics';
}

document.getElementById('dayName').textContent = dayName;

// Set date range text
if (from && to) {
    document.getElementById('dateRange').textContent = `من ${from} إلى ${to}`;
} else {
    // Always show clarifying text that we are viewing competitions for the selected day only
    document.getElementById('dateRange').textContent = 'المسابقات خلال هذا اليوم';
}

let allCompetitions = [];
let currentFilter = 'all';

// Fetch and display competitions
async function loadCompetitions() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const competitionsGrid = document.getElementById('competitionsGrid');

    loadingSpinner.classList.add('active');
    errorMessage.classList.remove('active');
    competitionsGrid.innerHTML = '';

    try {
        let url = `/api/stats/competitions-by-day/${encodeURIComponent(dayName)}`;
        const params = new URLSearchParams();
        if (from && to) {
            params.append('from', from);
            params.append('to', to);
        } else if (range) {
            params.append('range', range);
        }
        if (params.toString()) {
            url += '?' + params.toString();
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) {
            throw new Error('فشل في تحميل البيانات');
        }

        const data = await response.json();
        allCompetitions = data.competitions || [];

        // Update stats
        updateStats(allCompetitions);

        // Display competitions
        displayCompetitions(allCompetitions);

    } catch (error) {
        // Suppressed console per no-console policy; show user-friendly message only
        errorMessage.textContent = 'حدث خطأ في تحميل المسابقات. يرجى المحاولة مرة أخرى.';
        errorMessage.classList.add('active');
    } finally {
        loadingSpinner.classList.remove('active');
    }
}

function updateStats(competitions) {
    const total = competitions.length;
    const totalParticipants = competitions.reduce((sum, c) => sum + (c.participants_count || 0), 0);
    const totalViews = competitions.reduce((sum, c) => sum + (c.views_count || 0), 0);
    const totalDepositWinners = competitions.reduce((sum, c) => sum + (c.deposit_winners_count || 0), 0);

    document.getElementById('totalCompetitions').textContent = total;
    document.getElementById('totalParticipants').textContent = totalParticipants;
    document.getElementById('totalViews').textContent = totalViews;
    document.getElementById('totalDepositWinners').textContent = totalDepositWinners;
}

function displayCompetitions(competitions) {
    const competitionsGrid = document.getElementById('competitionsGrid');

    if (competitions.length === 0) {
        competitionsGrid.innerHTML = `
            <div class="no-data" style="grid-column: 1/-1;">
                <i class="fas fa-inbox"></i>
                <p>لا توجد مسابقات ${currentFilter !== 'all' ? 'بهذا الفلتر' : 'في هذا اليوم'}</p>
            </div>
        `;
        return;
    }

    competitionsGrid.innerHTML = competitions.map(comp => {
        // Derive template competition type (standard/special) -> Arabic text
        const templateType = comp.competition_type || null; // from backend projection
        const templateTypeTextMap = { standard: 'مميزات', special: 'تفاعلية' };
    const templateTypeText = templateTypeTextMap[templateType] || null;
    // Separate classifications: agent vs competition
    const competitionClassText = comp.classification || 'غير محدد';
    const agentClassText = comp.agent_classification || 'غير محدد';
        const typeText = templateTypeText || getTypeText(comp.type);

        return `
        <div class="competition-card" data-id="${comp._id}">
            <div class="competition-image">
             <img src="${comp.image_url || '../images/competition_bg.jpg'}" 
                 alt="صورة المسابقة"
                 data-fallback="../images/competition_bg.jpg">
                <span class="competition-status status-${comp.status}">
                    ${getStatusText(comp.status)}
                </span>
            </div>
            <div class="competition-body">
                <h3 class="competition-title">${comp.question || 'بدون عنوان'}</h3>
                <div class="competition-meta">
                    <div class="meta-row">
                        <i class="fas fa-user"></i>
                        <span><strong>اسم الوكيل:</strong> ${comp.agent_name || 'غير محدد'}</span>
                    </div>
                    <div class="meta-row">
                        <i class="fas fa-user-tag"></i>
                        <span><strong>تصنيف الوكيل:</strong> ${agentClassText}</span>
                    </div>
                    <div class="meta-row">
                        <i class="fas fa-tags"></i>
                        <span><strong>تصنيف المسابقة:</strong> ${competitionClassText}</span>
                    </div>
                    <div class="meta-row type-row">
                        <i class="fas fa-shapes"></i>
                        <span class="competition-type-text"><strong>النوع:</strong> ${typeText}</span>
                    </div>
                    <div class="meta-row">
                        <i class="fas fa-calendar"></i>
                        <span><strong>التاريخ:</strong> ${formatDate(comp.createdAt)}</span>
                    </div>
                    ${comp.deposit_winners_count > 0 ? `
                    <div class="meta-row">
                        <i class="fas fa-gift"></i>
                        <span>
                            فائزين بونص الإيداع: <strong>${comp.deposit_winners_count}</strong>
                            ${comp.deposit_bonus_percentage ? `(${comp.deposit_bonus_percentage}%)` : ''}
                        </span>
                    </div>
                    ` : ''}
                </div>
                <div class="competition-stats">
                    <div class="stat-item">
                        <i class="fas fa-eye"></i>
                        <span>${comp.views_count || 0}</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-users"></i>
                        <span>${comp.participants_count || 0}</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-trophy"></i>
                        <span>${comp.winners_count || 0}</span>
                    </div>
                    ${comp.total_cost ? `
                    <div class="stat-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span>$${comp.total_cost}</span>
                    </div>
                    ` : '<div class="stat-item"></div>'}
                </div>
            </div>
        </div>
    `}).join('');

    // Add click event to cards
    document.querySelectorAll('.competition-card').forEach(card => {
        card.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            if (id) {
                window.location.href = `./competition-details.html?id=${id}`;
            }
        });
    });
}

function filterCompetitions(status) {
    currentFilter = status;
    const filtered = status === 'all' 
        ? allCompetitions 
        : allCompetitions.filter(c => c.status === status);
    displayCompetitions(filtered);
}

function getStatusText(status) {
    const statusMap = {
        'sent': 'مرسلة',
        'active': 'نشطة',
        'awaiting_winners': 'بانتظار الفائزين',
        'completed': 'مكتملة',
        'archived': 'مؤرشفة'
    };
    return statusMap[status] || status;
}

function getTypeText(type) {
    const typeMap = {
        'trading': 'بونص تداولي',
        'deposit': 'بونص إيداع',
        'general': 'عامة'
    };
    return typeMap[type] || type;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Back button
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            history.back();
        });
    }

    // Image fallback handler to replace inline onerror (CSP-safe)
    const attachImageFallbacks = () => {
        document.querySelectorAll('.competition-card img[data-fallback]')
            .forEach(img => {
                const fallback = img.getAttribute('data-fallback');
                const applyOnce = () => {
                    if (img.__fallbackApplied) return;
                    img.__fallbackApplied = true;
                    img.src = fallback;
                };
                img.addEventListener('error', applyOnce, { once: true });
            });
    };

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterCompetitions(this.dataset.filter);
            // Re-attach fallbacks for any newly rendered images
            attachImageFallbacks();
        });
    });

    // Load competitions
    loadCompetitions().then(() => {
        // Ensure fallback listeners are bound after first render
        attachImageFallbacks();
    });
});
