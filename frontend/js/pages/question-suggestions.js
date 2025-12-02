// ==========================
// نظام اقتراح الأسئلة - للموظفين
// ==========================

let currentUser = null;
let myStats = null;

// ==========================
// التهيئة عند تحميل الصفحة
// ==========================
function initQuestionSuggestions() {
    // Check if we're on the correct page
    if (!document.getElementById('suggestionForm')) {
        return; // Not on question-suggestions.html, skip initialization
    }
    
    getCurrentUser();
    loadMyStats();
    loadMySuggestions();
    setupFormSubmission();
    setupFilters();
    checkForNotifications();
    setupCustomCategoryToggle();
}

// ==========================
// التحقق من وجود تقييمات جديدة
// ==========================
async function checkForNotifications() {
    try {
        const response = await utils.authedFetch('/api/question-suggestions/my-suggestions?status=');
        const data = await response.json();
        
        if (data.success && data.data) {
            const unnotified = data.data.filter(s => 
                !s.employee_notified && 
                s.status !== 'pending' && 
                s.evaluation && 
                s.evaluation.feedback
            );
            
            if (unnotified.length > 0) {
                utils.showToast(`لديك ${unnotified.length} تقييم جديد على اقتراحاتك!`, 'info');
                
                // تحديث حالة الإشعار
                for (const suggestion of unnotified) {
                    // تعديل: المسار الصحيح في الراوتر هو /notify/:id وليس /mark-notified/:id
                    await utils.authedFetch(`/api/question-suggestions/notify/${suggestion._id}`, {
                        method: 'PUT'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error checking notifications:', error);
    }
}

// ==========================
// الحصول على بيانات المستخدم الحالي
// ==========================
async function getCurrentUser() {
    try {
        const response = await utils.authedFetch('/api/users/me');
        const data = await response.json();
        
        if (data.success && data.user) {
            currentUser = data.user;
            document.getElementById('employeeName').textContent = currentUser.full_name;
        }
    } catch (error) {
        console.error('Error fetching current user:', error);
        utils.showToast('حدث خطأ في جلب بيانات المستخدم', 'error');
    }
}

// ==========================
// تحميل الإحصائيات
// ==========================
async function loadMyStats() {
    try {
        const response = await utils.authedFetch('/api/question-suggestions/my-stats');
        const data = await response.json();
        
        if (data.success) {
            myStats = data.data;
            displayStats(myStats);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function displayStats(stats) {
    const statPending = document.getElementById('statPending');
    const statApproved = document.getElementById('statApproved');
    const statRejected = document.getElementById('statRejected');
    const statRevision = document.getElementById('statRevision');
    
    if (statPending) statPending.textContent = stats.pending || 0;
    if (statApproved) statApproved.textContent = stats.approved || 0;
    if (statRejected) statRejected.textContent = stats.rejected || 0;
    if (statRevision) statRevision.textContent = stats.needs_revision || 0;
}

// Removed unused displayStars function

// ==========================
// تحميل اقتراحات الموظف
// ==========================
async function loadMySuggestions(status = '') {
    try {
        let url = '/api/question-suggestions/my-suggestions';
        if (status) {
            url += `?status=${status}`;
        }
        
        const response = await utils.authedFetch(url);
        const data = await response.json();
        
        if (data.success) {
            displayMySuggestions(data.data);
        }
    } catch (error) {
        console.error('Error loading suggestions:', error);
        utils.showToast('حدث خطأ في تحميل الاقتراحات', 'error');
    }
}

function displayMySuggestions(suggestions) {
    const container = document.getElementById('suggestionsContainer');
    
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                <p class="text-muted">لا توجد اقتراحات بعد</p>
                <p class="text-muted small">قم بإضافة اقتراح سؤال جديد من الأعلى</p>
            </div>
        `;
        return;
    }
    // تجميع حسب الحالة
    const groups = {
        pending: [],
        approved: [],
        rejected: [],
        needs_revision: []
    };
    for (const s of suggestions) {
        if (groups[s.status]) {
            groups[s.status].push(s);
        } else {
            // حالات غير متوقعة
            if (!groups['pending']) groups['pending'] = [];
            groups['pending'].push(s);
        }
    }
    const titles = {
        pending: 'قيد المراجعة',
        approved: 'مقبولة',
        rejected: 'مرفوضة',
        needs_revision: 'تحتاج تعديل'
    };
    let html = '';
    Object.keys(groups).forEach(status => {
        const list = groups[status];
        if (list.length === 0) return; // لا تظهر القسم الفارغ
        html += `
            <div class="status-group ${status}" data-status="${status}">
                <div class="status-group-header" role="button" tabindex="0" aria-expanded="true">
                    <span class="toggle-icon"><i class="fas fa-chevron-down"></i></span>
                    <i class="fas fa-layer-group"></i>
                    <span class="group-title">${titles[status]}</span>
                    <span class="count">(${list.length})</span>
                </div>
                <div class="status-group-body">
                    ${list.map(item => createSuggestionCard(item)).join('')}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function createSuggestionCard(suggestion) {
    const statusBadge = getStatusBadge(suggestion.status);
    const hasEvaluation = suggestion.evaluation && suggestion.evaluation.feedback;
    const date = new Date(suggestion.createdAt).toLocaleDateString('ar-EG');
        const isNewEvaluation = !suggestion.employee_notified && hasEvaluation && suggestion.status !== 'pending';
        const newBadge = isNewEvaluation ? '<span class="badge bg-danger">جديد!</span>' : '';
    const categoryDisplay = suggestion.category === 'other' && suggestion.custom_category
        ? `<span class="category-badge">${suggestion.custom_category}</span>`
        : `<span class="category-badge">${getCategoryLabel(suggestion.category)}</span>`;
    
    return `
        <div class="suggestion-card ${suggestion.status} ${isNewEvaluation ? 'new-evaluation' : ''}">
            <div class="card-header">
                <div>
                                        ${newBadge}
                    ${statusBadge}
                    ${categoryDisplay}
                    <span class="difficulty-badge ${suggestion.difficulty}">${getDifficultyLabel(suggestion.difficulty)}</span>
                </div>
                <div class="date">${date}</div>
            </div>
            
            <div class="card-body">
                <div class="question-text">
                    <strong>السؤال:</strong>
                    <p>${suggestion.question}</p>
                </div>
                
                <div class="answer-text">
                    <strong>الإجابة الصحيحة:</strong>
                    <p class="text-success">${suggestion.correct_answer}</p>
                </div>
                
                ${hasEvaluation ? `
                    <div class="evaluation-section">
                        <div class="evaluation-header">
                            <i class="fas fa-clipboard-check"></i>
                            <strong>التقييم:</strong>
                        </div>
                        ${suggestion.evaluation.rating ? `
                            <div class="rating-display">
                                ${getRatingStars(suggestion.evaluation.rating)}
                                <span>${suggestion.evaluation.rating}/5</span>
                            </div>
                        ` : ''}
                        ${suggestion.evaluation.feedback ? `
                            <div class="feedback-text">
                                <i class="fas fa-comment-dots"></i>
                                ${suggestion.evaluation.feedback}
                            </div>
                        ` : ''}
                        <div class="reviewer-info">
                            <i class="fas fa-user-tie"></i>
                            تم التقييم بواسطة: ${suggestion.evaluation.reviewed_by_name}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function getStatusBadge(status) {
    const badges = {
        pending: '<span class="status-badge pending"><i class="fas fa-clock"></i> قيد المراجعة</span>',
        approved: '<span class="status-badge approved"><i class="fas fa-check-circle"></i> مقبول</span>',
        rejected: '<span class="status-badge rejected"><i class="fas fa-times-circle"></i> مرفوض</span>',
        needs_revision: '<span class="status-badge needs-revision"><i class="fas fa-edit"></i> يحتاج تعديل</span>'
    };
    return badges[status] || '';
}

function getCategoryLabel(category) {
    const labels = {
        general: 'عام',
        technical: 'تقني',
        trading: 'تداول',
        market: 'سوق',
        other: 'أخرى'
    };
    return labels[category] || category;
}

function getDifficultyLabel(difficulty) {
    const labels = {
        easy: 'سهل',
        medium: 'متوسط',
        hard: 'صعب'
    };
    return labels[difficulty] || difficulty;
}

function getRatingStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            html += '<i class="fas fa-star text-warning"></i>';
        } else {
            html += '<i class="far fa-star text-muted"></i>';
        }
    }
    return html;
}

// ==========================
// إرسال اقتراح جديد
// ==========================
function setupFormSubmission() {
    const form = document.getElementById('suggestionForm');
    if (!form) return; // Form not found, skip
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const question = document.getElementById('question').value.trim();
        const answer = document.getElementById('correct_answer').value.trim();
        const category = document.getElementById('category').value;
        const difficulty = document.getElementById('difficulty').value;
        const custom_category = document.getElementById('custom_category')?.value.trim() || '';
        const additional_notes = document.getElementById('additional_notes')?.value.trim() || '';
        
        if (!question || !answer) {
            utils.showToast('يرجى إدخال السؤال والإجابة', 'warning');
            return;
        }
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
        
        try {
            const payload = { 
                question, 
                correct_answer: answer, 
                category, 
                difficulty,
                additional_notes
            };
            if (category === 'other') {
                payload.custom_category = custom_category;
            }
            const response = await utils.authedFetch('/api/question-suggestions/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (data.success) {
                utils.showToast('تم إرسال الاقتراح بنجاح! سيتم مراجعته قريباً', 'success');
                form.reset();
                loadMyStats();
                loadMySuggestions();
            } else {
                utils.showToast(data.message || 'حدث خطأ', 'error');
            }
        } catch (error) {
            console.error('Error submitting suggestion:', error);
            utils.showToast('حدث خطأ في إرسال الاقتراح', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الاقتراح';
        }
    });
}

// ==========================
// إظهار/إخفاء التصنيف المخصص
// ==========================
function setupCustomCategoryToggle() {
    const categorySelect = document.getElementById('category');
    const customGroup = document.getElementById('customCategoryGroup');
    if (!categorySelect || !customGroup) return;
    categorySelect.addEventListener('change', function() {
        if (this.value === 'other') {
            customGroup.style.display = 'block';
        } else {
            customGroup.style.display = 'none';
            const customInput = document.getElementById('custom_category');
            if (customInput) customInput.value = '';
        }
    });
}

// ==========================
// الفلاتر
// ==========================
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const status = this.dataset.status;
            loadMySuggestions(status);
        });
    });
}

// ==========================
// التهيئة عند تحميل الصفحة
// ==========================
document.addEventListener('DOMContentLoaded', initQuestionSuggestions);

// إضافة نمط مبسط للمجموعات إن لم يكن موجوداً عبر CSS العام
const styleGrouping = document.createElement('style');
styleGrouping.textContent = `
    .status-group { margin-bottom: 35px; }
    .status-group-header { 
        background: linear-gradient(135deg,#667eea 0%,#764ba2 100%);
        color:#fff; padding:10px 16px; border-radius:10px; font-weight:600; display:flex; align-items:center; gap:8px; box-shadow:0 2px 8px rgba(0,0,0,0.25);
        cursor:pointer;
    }
    .status-group-header .count { font-weight:400; font-size:0.85rem; opacity:.9; margin-right:auto; }
    .status-group-header .toggle-icon { transition: transform .25s ease; display:inline-flex; }
    .status-group.collapsed .status-group-header .toggle-icon { transform: rotate(-90deg); }
    .status-group-body { margin-top:15px; display:grid; gap:18px; }
    @media (min-width:992px){ .status-group-body { grid-template-columns:repeat(auto-fill,minmax(420px,1fr)); } }
    @media (max-width:991px){ .status-group-body { grid-template-columns:1fr; } }
    .status-group.collapsed .status-group-body { display:none; }
    .status-group-header:focus { outline:2px solid #fff; outline-offset:2px; }
`;
document.head.appendChild(styleGrouping);

// تفويض حدث الطي/الفتح بالماوس
document.addEventListener('click', function(e){
    const header = e.target.closest('.status-group-header');
    if (!header) return;
    const group = header.parentElement;
    const isCollapsed = group.classList.toggle('collapsed');
    header.setAttribute('aria-expanded', (!isCollapsed).toString());
});

// دعم Enter و Space للولوج عبر لوحة المفاتيح
document.addEventListener('keydown', function(e){
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('status-group-header')) {
        e.preventDefault();
        e.target.click();
    }
});
