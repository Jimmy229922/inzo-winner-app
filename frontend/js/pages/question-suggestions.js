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
    // checkForNotifications(); // Removed old notification check
    setupCustomCategoryToggle();
    setupScrollObserver(); // NEW: Mark updates as seen on scroll
    setupDelegation();
}

// ==========================
// إعداد تفويض الأحداث (Event Delegation)
// ==========================
function setupDelegation() {
    const container = document.getElementById('suggestionsContainer');
    if (!container) return;

    container.addEventListener('click', function(e) {
        const editBtn = e.target.closest('.btn-edit-suggestion');
        if (editBtn) {
            const id = editBtn.dataset.id;
            console.log('🔘 Edit button clicked (Delegated) for ID:', id);
            if (window.openEditModal) {
                window.openEditModal(id);
            } else {
                console.error('❌ openEditModal function is not defined');
            }
        }
    });
}

// ==========================
// مراقبة التمرير لتحديث حالة القراءة
// ==========================
function setupScrollObserver() {
    const suggestionsList = document.getElementById('suggestionsContainer');
    if (!suggestionsList) return;

    // Create an intersection observer to detect when the list is viewed
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                markUpdatesAsSeen();
                // Disconnect after marking as seen to avoid repeated calls
                observer.disconnect();
            }
        });
    }, { threshold: 0.1 }); // Trigger when 10% of the list is visible

    observer.observe(suggestionsList);
}

// ==========================
// تحديث حالة الإشعارات إلى "مقروءة"
// ==========================
async function markUpdatesAsSeen() {
    try {
        console.log('👀 [Suggestions] Marking updates as seen...');
        const response = await utils.authedFetch('/api/question-suggestions/mark-seen', {
            method: 'POST'
        });
        
        if (response.ok) {
            console.log('✅ [Suggestions] Updates marked as seen');
            // Update the global counter immediately
            if (typeof loadGlobalUnreadCount === 'function') {
                loadGlobalUnreadCount();
            }
        }
    } catch (error) {
        console.error('❌ [Suggestions] Error marking updates as seen:', error);
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
            allMySuggestions = data.data;
            displayMySuggestions(allMySuggestions);
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
        needs_revision: 'تحتاج تعديل',
        approved: 'مقبولة',
        rejected: 'مرفوضة'
    };
    
    // ترتيب مخصص للعرض
    const statusOrder = ['pending', 'needs_revision', 'approved', 'rejected'];
    
    let html = '';
    statusOrder.forEach(status => {
        const list = groups[status];
        if (!list || list.length === 0) return; // لا تظهر القسم الفارغ
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

    // إضافة event listeners للطي والفتح
    document.querySelectorAll('.status-group-header').forEach(header => {
        header.addEventListener('click', function() {
            const body = this.nextElementSibling;
            const icon = this.querySelector('.toggle-icon i');
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            
            if (isExpanded) {
                body.style.display = 'none';
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-left');
                this.setAttribute('aria-expanded', 'false');
            } else {
                body.style.display = 'grid';
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-down');
                this.setAttribute('aria-expanded', 'true');
            }
        });
    });
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
            
            ${suggestion.status === 'needs_revision' ? `
                <div class="card-footer text-end mt-3 pt-3 border-top border-secondary">
                    <button class="btn btn-warning btn-sm btn-edit-suggestion" data-id="${suggestion._id}">
                        <i class="fas fa-edit"></i> تعديل وإعادة إرسال
                    </button>
                </div>
            ` : ''}
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
        trading: 'تداولية',
        interactive: 'تفاعلية',
        company_features: 'مميزات الشركة',
        educational: 'تعليمية',
        highlight_site: 'تبرز الموقع',
        other: 'اخري'
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
            
            console.log('🚀 [Employee Suggestion] Sending suggestion:', payload);
            
            const response = await utils.authedFetch('/api/question-suggestions/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            console.log('✅ [Employee Suggestion] Server response:', data);
            
            if (data.success) {
                console.log('✅ [Employee Suggestion] Suggestion saved successfully with ID:', data.data?._id);
                utils.showToast('تم إرسال الاقتراح بنجاح! سيتم مراجعته قريباً', 'success');
                form.reset();
                loadMyStats();
                loadMySuggestions();
            } else {
                console.error('❌ [Employee Suggestion] Failed to save:', data.message);
                utils.showToast(data.message || 'حدث خطأ', 'error');
            }
        } catch (error) {
            console.error('❌ [Employee Suggestion] Error submitting suggestion:', error);
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
let allMySuggestions = [];
let currentStatusFilter = '';

function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentStatusFilter = this.dataset.status;
            loadMySuggestions(currentStatusFilter);
        });
    });
    
    // Advanced search setup
    const applySearchBtn = document.getElementById('applySearchBtn');
    const resetSearchBtn = document.getElementById('resetSearchBtn');
    const searchText = document.getElementById('searchText');
    
    if (applySearchBtn) {
        applySearchBtn.addEventListener('click', () => {
            applyAdvancedSearch();
        });
    }
    
    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', () => {
            document.getElementById('searchText').value = '';
            document.getElementById('filterDateFrom').value = '';
            document.getElementById('filterDateTo').value = '';
            document.getElementById('filterCategory').value = '';
            displayMySuggestions(allMySuggestions);
        });
    }
    
    // Real-time search on typing
    if (searchText) {
        searchText.addEventListener('input', debounce(() => {
            applyAdvancedSearch();
        }, 500));
    }
}

// Apply advanced search
function applyAdvancedSearch() {
    const searchText = document.getElementById('searchText')?.value.toLowerCase().trim();
    const dateFrom = document.getElementById('filterDateFrom')?.value;
    const dateTo = document.getElementById('filterDateTo')?.value;
    const category = document.getElementById('filterCategory')?.value;
    
    let filtered = [...allMySuggestions];
    
    // Filter by search text
    if (searchText) {
        filtered = filtered.filter(s => 
            s.question?.toLowerCase().includes(searchText) ||
            s.correct_answer?.toLowerCase().includes(searchText)
        );
    }
    
    // Filter by date range
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(s => {
            const suggestionDate = new Date(s.createdAt);
            suggestionDate.setHours(0, 0, 0, 0);
            return suggestionDate >= fromDate;
        });
    }
    
    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(s => {
            const suggestionDate = new Date(s.createdAt);
            return suggestionDate <= toDate;
        });
    }
    
    // Filter by category
    if (category) {
        filtered = filtered.filter(s => s.category === category);
    }
    
    console.log('[EmployeeSuggest] Advanced search applied. Results:', filtered.length);
    displayMySuggestions(filtered);
}

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
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

// ==========================
// تعديل الاقتراح
// ==========================
window.openEditModal = function(id) {
    console.log('📝 [Edit] Opening modal for ID:', id);
    
    if (!allMySuggestions || allMySuggestions.length === 0) {
        console.error('❌ [Edit] No suggestions loaded');
        utils.showToast('حدث خطأ: لم يتم تحميل البيانات', 'error');
        return;
    }

    const suggestion = allMySuggestions.find(s => s._id === id);
    if (!suggestion) {
        console.error('❌ [Edit] Suggestion not found in local list:', id);
        utils.showToast('حدث خطأ: الاقتراح غير موجود', 'error');
        return;
    }

    document.getElementById('editSuggestionId').value = suggestion._id;
    document.getElementById('editQuestion').value = suggestion.question;
    document.getElementById('editAnswer').value = suggestion.correct_answer;
    document.getElementById('editCategory').value = suggestion.category;
    document.getElementById('editDifficulty').value = suggestion.difficulty;
    document.getElementById('editNotes').value = suggestion.additional_notes || '';
    
    const customGroup = document.getElementById('editCustomCategoryGroup');
    const customInput = document.getElementById('editCustomCategory');
    
    if (suggestion.category === 'other') {
        customGroup.style.display = 'block';
        customInput.value = suggestion.custom_category || '';
    } else {
        customGroup.style.display = 'none';
        customInput.value = '';
    }

    // Setup category change listener for edit modal
    const categorySelect = document.getElementById('editCategory');
    if (categorySelect) {
        categorySelect.onchange = function() {
            if (this.value === 'other') {
                customGroup.style.display = 'block';
            } else {
                customGroup.style.display = 'none';
            }
        };
    }

    try {
        const modalEl = document.getElementById('editSuggestionModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } catch (e) {
        console.error('❌ [Edit] Error showing modal:', e);
        utils.showToast('حدث خطأ في فتح النافذة', 'error');
    }
};

// Setup Edit Form Submission
document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('editSuggestionForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('editSuggestionId').value;
            const submitBtn = editForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
            
            try {
                const formData = {
                    question: document.getElementById('editQuestion').value,
                    correct_answer: document.getElementById('editAnswer').value,
                    category: document.getElementById('editCategory').value,
                    difficulty: document.getElementById('editDifficulty').value,
                    additional_notes: document.getElementById('editNotes').value,
                    custom_category: document.getElementById('editCustomCategory').value
                };

                const response = await utils.authedFetch(`/api/question-suggestions/${id}/update`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (data.success) {
                    utils.showToast('تم تحديث الاقتراح وإعادة إرساله بنجاح', 'success');
                    bootstrap.Modal.getInstance(document.getElementById('editSuggestionModal')).hide();
                    loadMySuggestions();
                    loadMyStats();
                } else {
                    utils.showToast(data.message || 'حدث خطأ', 'error');
                }
            } catch (error) {
                console.error('Error updating suggestion:', error);
                utils.showToast('حدث خطأ في تحديث الاقتراح', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }
});

// دعم Enter و Space للولوج عبر لوحة المفاتيح
document.addEventListener('keydown', function(e){
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('status-group-header')) {
        e.preventDefault();
        e.target.click();
    }
});
