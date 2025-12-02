// ==========================
// نظام اقتراح الأسئلة - للإدارة
// ==========================

let allSuggestions = [];
let stats = null;
let adminSuggestionsCurrentFilter = 'pending';

// ==========================
// التهيئة عند تحميل الصفحة
// ==========================
function initAdminQuestionSuggestions() {
    // Check if we're on the correct page
    if (!document.getElementById('adminSuggestionsContainer')) {
        return; // Not on admin-question-suggestions.html, skip initialization
    }
    
    loadStats();
    loadAllSuggestions();
    setupFilters();
    setupEvaluationModal();
    setupCardDelegation();
}

// ==========================
// تحميل الإحصائيات
// ==========================
async function loadStats() {
    try {
        const response = await utils.authedFetch('/api/question-suggestions/all?page=1&limit=1');
        const data = await response.json();
        
        if (data.success && data.stats) {
            stats = data.stats;
            displayStats(stats);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function displayStats(stats) {
    document.getElementById('totalCount').textContent = stats.total || 0;
    document.getElementById('pendingCount').textContent = stats.pending || 0;
    document.getElementById('approvedCount').textContent = stats.approved || 0;
    document.getElementById('rejectedCount').textContent = stats.rejected || 0;
    document.getElementById('revisionCount').textContent = stats.needs_revision || 0;
}

// ==========================
// تحميل جميع الاقتراحات
// ==========================
async function loadAllSuggestions(status = 'pending') {
    try {
        console.log('[AdminSuggest] loadAllSuggestions status=', status);
        const url = `/api/question-suggestions/all?status=${status}&limit=100`;
        const response = await utils.authedFetch(url);
        console.log('[AdminSuggest] fetch response status', response.status);
        const data = await response.json();
        console.log('[AdminSuggest] suggestions received count=', data.success ? data.data.length : 'NO-DATA', data);
        
        if (data.success) {
            allSuggestions = data.data;
            displayAllSuggestions(allSuggestions);
        }
    } catch (error) {
        console.error('Error loading suggestions:', error);
        utils.showToast('حدث خطأ في تحميل الاقتراحات', 'error');
    }
}

function displayAllSuggestions(suggestions) {
    const container = document.getElementById('adminSuggestionsContainer');
    
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                <p class="text-muted">لا توجد اقتراحات في هذه الفئة</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    suggestions.forEach(suggestion => {
        html += createAdminSuggestionCard(suggestion);
    });
    
    container.innerHTML = html; // محتوى جديد جاهز للتعامل مع التفويض
}

function createAdminSuggestionCard(suggestion) {
    const statusBadge = getStatusBadge(suggestion.status);
    const date = new Date(suggestion.createdAt).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const hasEvaluation = suggestion.evaluation && suggestion.evaluation.feedback;
    const canEvaluate = suggestion.status === 'pending' || suggestion.status === 'needs_revision';
    
    const categoryDisplay = suggestion.category === 'other' && suggestion.custom_category
        ? `<span class="category-badge">${suggestion.custom_category}</span>`
        : `<span class="category-badge">${getCategoryLabel(suggestion.category)}</span>`;

    return `
        <div class="admin-suggestion-card ${suggestion.status}" data-id="${suggestion._id}">
            <div class="card-header">
                <div class="employee-info">
                    <i class="fas fa-user"></i>
                    <strong>${suggestion.suggested_by_name}</strong>
                    <span class="date">${date}</span>
                </div>
                <div class="badges">
                    ${statusBadge}
                    ${categoryDisplay}
                    <span class="difficulty-badge ${suggestion.difficulty}">${getDifficultyLabel(suggestion.difficulty)}</span>
                </div>
            </div>
            
            <div class="card-body">
                <div class="question-section">
                    <div class="section-title">
                        <i class="fas fa-question-circle"></i>
                        السؤال المقترح:
                    </div>
                    <p class="question-text">${suggestion.question}</p>
                </div>
                
                <div class="answer-section">
                    <div class="section-title">
                        <i class="fas fa-check-circle"></i>
                        الإجابة الصحيحة:
                    </div>
                    <p class="answer-text">${suggestion.correct_answer}</p>
                </div>
                
                ${hasEvaluation ? `
                    <div class="previous-evaluation">
                        <div class="section-title">
                            <i class="fas fa-clipboard-check"></i>
                            التقييم السابق:
                        </div>
                        ${suggestion.evaluation.rating ? `
                            <div class="rating-display">
                                ${getRatingStars(suggestion.evaluation.rating)}
                                <span>${suggestion.evaluation.rating}/5</span>
                            </div>
                        ` : ''}
                        <p class="feedback-text">${suggestion.evaluation.feedback}</p>
                        <p class="reviewer-info">
                            <i class="fas fa-user-tie"></i>
                            ${suggestion.evaluation.reviewed_by_name} - 
                            ${new Date(suggestion.evaluation.reviewed_at).toLocaleDateString('ar-EG')}
                        </p>
                    </div>
                ` : ''}
            </div>
            
            <div class="card-footer">
                ${canEvaluate ? `
                    <button class="btn btn-success" data-action="evaluate" data-status="approved" data-id="${suggestion._id}">
                        <i class="fas fa-check"></i> قبول
                    </button>
                    <button class="btn btn-warning" data-action="evaluate" data-status="needs_revision" data-id="${suggestion._id}">
                        <i class="fas fa-edit"></i> يحتاج تعديل
                    </button>
                    <button class="btn btn-danger" data-action="evaluate" data-status="rejected" data-id="${suggestion._id}">
                        <i class="fas fa-times"></i> رفض
                    </button>
                ` : `
                    <button class="btn btn-secondary" data-action="evaluate" data-status="${suggestion.status}" data-id="${suggestion._id}">
                        <i class="fas fa-eye"></i> عرض التفاصيل
                    </button>
                `}
                <button class="btn btn-outline-danger" data-action="delete" data-id="${suggestion._id}">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
        </div>
    `;
}

// ==========================
// فتح نافذة التقييم
// ==========================
function openEvaluationModal(suggestionId, status) {
    console.log('[AdminSuggest] openEvaluationModal id=', suggestionId, 'targetStatus=', status);
    const suggestion = allSuggestions.find(s => s._id === suggestionId);
    if (!suggestion) {
        console.warn('[AdminSuggest] suggestion not found in allSuggestions for id', suggestionId);
        return;
    }
    console.log('[AdminSuggest] found suggestion currentStatus=', suggestion.status);
    
    // تعبئة البيانات
    document.getElementById('evalSuggestionId').value = suggestionId;
    document.getElementById('evalEmployeeName').textContent = suggestion.suggested_by_name;
    document.getElementById('evalQuestion').textContent = suggestion.question;
    document.getElementById('evalAnswer').textContent = suggestion.correct_answer;
    document.getElementById('evalStatus').value = status;
    
    // إذا كان هناك تقييم سابق
    if (suggestion.evaluation) {
        document.getElementById('evalRating').value = suggestion.evaluation.rating || '';
        document.getElementById('evalFeedback').value = suggestion.evaluation.feedback || '';
        document.getElementById('evalNotes').value = suggestion.evaluation.admin_notes || '';
    } else {
        document.getElementById('evalRating').value = '';
        document.getElementById('evalFeedback').value = '';
        document.getElementById('evalNotes').value = '';
    }
    
    // فتح النافذة
    const modal = new bootstrap.Modal(document.getElementById('evaluationModal'));
    modal.show();
}

// ==========================
// إرسال التقييم
// ==========================
function setupEvaluationModal() {
    const form = document.getElementById('evaluationForm');
    console.log('[AdminSuggest] setupEvaluationModal binding submit listener');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('[AdminSuggest] evaluationForm submit triggered');
        
        const suggestionId = document.getElementById('evalSuggestionId').value;
        const status = document.getElementById('evalStatus').value;
        const rating = parseInt(document.getElementById('evalRating').value) || null;
        const feedback = document.getElementById('evalFeedback').value.trim();
        const admin_notes = document.getElementById('evalNotes').value.trim();
        
        if (!feedback && status !== 'approved') {
            utils.showToast('يرجى إدخال ملاحظات التقييم', 'warning');
            return;
        }
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        
        try {
            const response = await utils.authedFetch(`/api/question-suggestions/evaluate/${suggestionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, rating, feedback, admin_notes })
            });
            console.log('[AdminSuggest] evaluate fetch status', response.status);
            const data = await response.json();
            console.log('[AdminSuggest] evaluate response body', data);
            if (data.success) {
                utils.showToast('تم تقييم الاقتراح بنجاح', 'success');
                bootstrap.Modal.getInstance(document.getElementById('evaluationModal')).hide();
                loadStats();
                loadAllSuggestions(adminSuggestionsCurrentFilter);
            } else {
                utils.showToast(data.message || 'حدث خطأ', 'error');
            }
        } catch (error) {
            console.error('Error evaluating suggestion:', error);
            utils.showToast('حدث خطأ في تقييم الاقتراح', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التقييم';
        }
    });
}

// ==========================
// حذف اقتراح
// ==========================
async function deleteSuggestion(suggestionId) {
    console.log('[AdminSuggest] deleteSuggestion clicked id=', suggestionId);
    if (!confirm('هل أنت متأكد من حذف هذا الاقتراح؟')) {
        return;
    }
    
    try {
        const response = await utils.authedFetch(`/api/question-suggestions/${suggestionId}`, {
            method: 'DELETE'
        });
        console.log('[AdminSuggest] delete fetch status', response.status);
        const data = await response.json();
        console.log('[AdminSuggest] delete response body', data);
        
        if (data.success) {
            utils.showToast('تم حذف الاقتراح بنجاح', 'success');
            loadStats();
            loadAllSuggestions(adminSuggestionsCurrentFilter);
        } else {
            utils.showToast(data.message || 'حدث خطأ', 'error');
        }
    } catch (error) {
        console.error('Error deleting suggestion:', error);
        utils.showToast('حدث خطأ في حذف الاقتراح', 'error');
    }
}

// ==========================
// الفلاتر
// ==========================
function setupFilters() {
    const filterButtons = document.querySelectorAll('.admin-filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            adminSuggestionsCurrentFilter = this.dataset.status;
            console.log('[AdminSuggest] filter changed to', adminSuggestionsCurrentFilter);
            loadAllSuggestions(adminSuggestionsCurrentFilter);
        });
    });
}

// ==========================
// تفويض أحداث البطاقات (تقييم / حذف)
// ==========================
function setupCardDelegation() {
    const container = document.getElementById('adminSuggestionsContainer');
    if (!container) return;
    container.addEventListener('click', function(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action;
        if (!action) return;
        const id = btn.dataset.id;
        if (!id) return;
        if (action === 'evaluate') {
            const targetStatus = btn.dataset.status || 'pending';
            console.log('[AdminSuggest][Delegation] evaluate click id=', id, 'status=', targetStatus);
            openEvaluationModal(id, targetStatus);
        } else if (action === 'delete') {
            console.log('[AdminSuggest][Delegation] delete click id=', id);
            deleteSuggestion(id);
        }
    });
    console.log('[AdminSuggest] Card delegation attached');
}

// ==========================
// Helper Functions
// ==========================
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
// التهيئة عند تحميل الصفحة
// ==========================
document.addEventListener('DOMContentLoaded', initAdminQuestionSuggestions);

// جعل الدوال المستخدمة في onclick متاحة عالمياً بعد التجميع داخل IIFE
// بسبب أن bundler يلف كل الملفات داخل (function(window){ ... }) فلا تصبح هذه الدوال على الكائن window تلقائياً
// لذلك نُصدرها صراحة ليعمل الـ onclick داخل عناصر البطاقات
window.openEvaluationModal = openEvaluationModal;
window.deleteSuggestion = deleteSuggestion;
console.log('[AdminSuggest] Global functions exposed');
