// ==========================
// أرشيف الاقتراحات
// ==========================

let archivedSuggestions = [];
let currentUserRole = null;
let isSuperAdmin = false;

// ==========================
// التهيئة عند تحميل الصفحة
// ==========================
document.addEventListener('DOMContentLoaded', initArchivedSuggestions);

async function initArchivedSuggestions() {
    // Check if we're on the correct page
    if (!document.getElementById('archivedSuggestionsContainer')) {
        return;
    }
    
    // Check user permissions
    const userInfo = await checkUserAccess();
    if (!userInfo) {
        window.location.href = '../index.html';
        return;
    }
    
    currentUserRole = userInfo.role;
    isSuperAdmin = userInfo.role === 'super_admin';
    
    loadArchivedSuggestions();
}

// ==========================
// التحقق من الصلاحيات
// ==========================
async function checkUserAccess() {
    try {
        const response = await utils.authedFetch('/api/auth/me');
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data.role) {
            return { role: data.role, name: data.full_name };
        }
        return null;
    } catch (error) {
        return null;
    }
}

// ==========================
// تحميل الاقتراحات المؤرشفة
// ==========================
async function loadArchivedSuggestions() {
    try {
        const container = document.getElementById('archivedSuggestionsContainer');
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-spinner fa-spin fa-3x text-muted"></i>
                <p class="mt-3 text-muted">جاري تحميل الأرشيف...</p>
            </div>
        `;

        // Fetch with is_archived=true and archived_by_me=true
        const response = await utils.authedFetch('/api/question-suggestions/all?is_archived=true&archived_by_me=true&limit=100');
        const data = await response.json();
        
        if (data.success) {
            archivedSuggestions = data.data;
            displayArchivedSuggestions(archivedSuggestions);
        } else {
            container.innerHTML = `
                <div class="alert alert-danger m-3">
                    فشل تحميل الأرشيف: ${data.message}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading archived suggestions:', error);
        document.getElementById('archivedSuggestionsContainer').innerHTML = `
            <div class="alert alert-danger m-3">
                حدث خطأ أثناء الاتصال بالخادم
            </div>
        `;
    }
}

// ==========================
// عرض الاقتراحات
// ==========================
function displayArchivedSuggestions(suggestions) {
    const container = document.getElementById('archivedSuggestionsContainer');
    
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-archive fa-3x text-muted mb-3"></i>
                <p class="text-muted">الأرشيف فارغ</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    suggestions.forEach(suggestion => {
        html += createArchivedSuggestionCard(suggestion);
    });
    
    container.innerHTML = html;
    
    // Add event listeners for delete buttons if super admin
    if (isSuperAdmin) {
        document.querySelectorAll('.btn-delete-permanent').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                confirmDelete(id);
            });
        });
    }
}

function createArchivedSuggestionCard(suggestion) {
    const date = new Date(suggestion.createdAt).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const statusLabels = {
        'pending': 'قيد المراجعة',
        'approved': 'مقبول',
        'rejected': 'مرفوض',
        'needs_revision': 'يحتاج تعديل'
    };
    
    const statusClass = suggestion.status;
    const statusText = statusLabels[suggestion.status] || suggestion.status;
    
    const categoryDisplay = suggestion.category === 'other' && suggestion.custom_category
        ? `<span class="category-badge">${suggestion.custom_category}</span>`
        : `<span class="category-badge">${getCategoryLabel(suggestion.category)}</span>`;

    return `
        <div class="admin-suggestion-card" id="card-${suggestion._id}">
            <div class="card-header">
                <div class="employee-info">
                    <i class="fas fa-user"></i>
                    <strong>${suggestion.suggested_by_name}</strong>
                    <span class="date">${date}</span>
                </div>
                <div class="badges">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    ${categoryDisplay}
                    <span class="difficulty-badge ${suggestion.difficulty}">${getDifficultyLabel(suggestion.difficulty)}</span>
                </div>
            </div>
            
            <div class="card-body">
                <div class="question-section">
                    <div class="section-title">
                        <i class="fas fa-question-circle"></i>
                        السؤال:
                    </div>
                    <p class="question-text">${suggestion.question}</p>
                </div>
                
                <div class="answer-section">
                    <div class="section-title">
                        <i class="fas fa-check-circle"></i>
                        الإجابة:
                    </div>
                    <p class="answer-text">${suggestion.correct_answer}</p>
                </div>
                
                ${suggestion.evaluation && suggestion.evaluation.feedback ? `
                    <div class="previous-evaluation">
                        <div class="section-title">
                            <i class="fas fa-comment-alt"></i>
                            ملاحظات الأرشفة/التقييم:
                        </div>
                        <p class="feedback-text">${suggestion.evaluation.feedback}</p>
                        <p class="reviewer-info">
                            بواسطة: ${suggestion.evaluation.reviewed_by_name}
                        </p>
                    </div>
                ` : ''}
                
                ${isSuperAdmin ? `
                    <div class="mt-3 text-end border-top pt-3 border-secondary">
                        <button class="btn btn-sm btn-outline-danger btn-delete-permanent" data-id="${suggestion._id}">
                            <i class="fas fa-trash"></i> حذف نهائي
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// ==========================
// دوال مساعدة
// ==========================
function getCategoryLabel(category) {
    const labels = {
        'general': 'ثقافة عامة',
        'science': 'علوم',
        'history': 'تاريخ',
        'geography': 'جغرافيا',
        'sports': 'رياضة',
        'arts': 'فنون',
        'technology': 'تكنولوجيا',
        'religious': 'ديني',
        'other': 'أخرى'
    };
    return labels[category] || category;
}

function getDifficultyLabel(difficulty) {
    const labels = {
        'easy': 'سهل',
        'medium': 'متوسط',
        'hard': 'صعب'
    };
    return labels[difficulty] || difficulty;
}

// ==========================
// الحذف النهائي
// ==========================
async function confirmDelete(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الاقتراح نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) {
        return;
    }
    
    try {
        const response = await utils.authedFetch(`/api/question-suggestions/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            utils.showToast('تم الحذف بنجاح', 'success');
            document.getElementById(`card-${id}`).remove();
            
            // Check if empty
            if (document.querySelectorAll('.admin-suggestion-card').length === 0) {
                loadArchivedSuggestions(); // Reload to show empty state
            }
        } else {
            utils.showToast(data.message || 'فشل الحذف', 'error');
        }
    } catch (error) {
        console.error('Error deleting suggestion:', error);
        utils.showToast('حدث خطأ أثناء الحذف', 'error');
    }
}
