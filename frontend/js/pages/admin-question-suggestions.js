// ==========================
// نظام اقتراح الأسئلة - للإدارة
// ==========================

let allSuggestions = [];
let stats = null;
let adminSuggestionsCurrentFilter = 'pending';
let currentUserRole = null; // Track user role
let isSuperAdmin = false; // Track if user is super admin
let currentEvaluatedSuggestion = null;
let suggestionTemplateModalInstance = null;
let suggestionTemplateData = null;
let templateQuestionCheckTimeout = null;

// ==========================
// التهيئة عند تحميل الصفحة
// ==========================
async function initAdminQuestionSuggestions() {
    // Check if we're on the correct page
    if (!document.getElementById('adminSuggestionsContainer')) {
        return; // Not on admin-question-suggestions.html, skip initialization
    }
    
    // Check user permissions and get role
    const userInfo = await checkUserAccess();
    if (!userInfo) {
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                    <h3>خطأ في التحقق من الصلاحيات</h3>
                    <p>لم نتمكن من التحقق من صلاحياتك</p>
                    <a href="#home" class="btn btn-primary mt-3">
                        <i class="fas fa-home"></i> العودة للرئيسية
                    </a>
                </div>
            `;
        }
        return;
    }
    
    currentUserRole = userInfo.role;
    isSuperAdmin = userInfo.role === 'super_admin'; // فقط السوبر أدمن له صلاحية التقييم والحذف
    
    // عرض جميع الاقتراحات لجميع المستخدمين (موظف، أدمن، سوبر أدمن)
    // صلاحية التقييم والحذف: السوبر أدمن فقط
    
    loadStats();
    loadUnreadCount(); // Load unread suggestions count for super admin
    loadAllSuggestions();
    setupFilters();
    setupEvaluationModal();
    setupCardDelegation();
    setupSuggestionTemplateModalHandlers();
}

// ==========================
// ملاحظة: تم إزالة دالة hideAdminElements
// لأن الصفحة أصبحت متاحة لعرض جميع الاقتراحات للجميع
// ==========================
// صلاحيات التقييم والحذف: السوبر أدمن فقط
// الموظفون والأدمن: يمكنهم العرض فقط

// ==========================
// التحقق من صلاحيات المستخدم
// ==========================
async function checkUserAccess() {
    try {
        const response = await utils.authedFetch('/api/auth/me');
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        
        // API returns user object directly, not wrapped in success/user
        if (data && data.role) {
            return {
                role: data.role,
                name: data.full_name
            };
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// ==========================
// تحميل الإحصائيات
// ==========================
async function loadStats() {
    try {
        const response = await utils.authedFetch('/api/question-suggestions/all?page=1&limit=1');
        
        if (!response.ok) {
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.stats) {
            stats = data.stats;
            displayStats(stats);
        }
    } catch (error) {
        // Silent fail
    }
}

function displayStats(stats) {
    document.getElementById('totalCount').textContent = stats.total || 0;
    document.getElementById('pendingCount').textContent = stats.pending || 0;
    document.getElementById('approvedCount').textContent = stats.approved || 0;
    document.getElementById('rejectedCount').textContent = stats.rejected || 0;
    document.getElementById('revisionCount').textContent = stats.needs_revision || 0;

    // Update header badge with pending count (show only if > 0)
    const pendingBadge = document.getElementById('pendingHeaderCountBadge');
    const pendingHeaderCount = document.getElementById('pendingHeaderCount');
    if (pendingBadge && pendingHeaderCount) {
        const pending = stats.pending || 0;
        pendingHeaderCount.textContent = pending;
        pendingBadge.style.display = pending > 0 ? 'inline-flex' : 'none';
    }
}

// ==========================
// تحميل عدد الاقتراحات غير المقروءة
// ==========================
async function loadUnreadCount() {

    try {
        
        // Determine endpoint based on role
        const endpoint = isSuperAdmin 
            ? '/api/question-suggestions/unread-count' 
            : '/api/question-suggestions/employee-unread-count';
            
        const response = await utils.authedFetch(endpoint);


        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (data.success) {
            const unreadCount = data.data.unreadCount || 0;
            displayUnreadCount(unreadCount);
        }
    } catch (error) {
        console.error('❌ [Unread Count] Error loading unread count:', error);
    }
}

function displayUnreadCount(count) {
    const unreadCounter = document.getElementById('pendingHeaderCountBadge');
    const unreadCountElement = document.getElementById('pendingHeaderCount');

    if (unreadCounter && unreadCountElement) {
        if (count > 0) {
            unreadCountElement.textContent = count;
            unreadCounter.style.display = 'inline-flex'; // Use inline-flex to match HTML style
        } else {
            unreadCounter.style.display = 'none';
        }
    }
}

// ==========================
// تحميل جميع الاقتراحات
// ==========================
async function loadAllSuggestions(status = 'pending') {
    try {
        // عرض جميع الاقتراحات لجميع المستخدمين
        const url = status && status !== 'all'
            ? `/api/question-suggestions/all?status=${status}&limit=100`
            : `/api/question-suggestions/all?limit=100`;
        
        const response = await utils.authedFetch(url);
        
        const data = await response.json();
        
        if (data.success) {
            allSuggestions = data.data;
            
            displayAllSuggestions(allSuggestions);
            loadEmployeeList(); // Load employee dropdown after data is loaded
        } else {
            console.error('❌ [Admin Suggestions] Failed to load:', data.message);
        }
    } catch (error) {
        console.error('❌ [Admin Suggestions] Error loading suggestions:', error);
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
            
            ${isSuperAdmin ? `
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
                    
                    ${(suggestion.status === 'approved' || suggestion.status === 'needs_revision') ? `
                        <button class="btn btn-secondary" data-action="archive" data-id="${suggestion._id}">
                            <i class="fas fa-archive"></i> أرشفة
                        </button>
                    ` : ''}

                    <button class="btn btn-outline-danger" data-action="delete" data-id="${suggestion._id}">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// ==========================
// فتح نافذة التقييم
// ==========================
function openEvaluationModal(suggestionId, status) {
    
    // فحص صلاحية السوبر أدمن
    if (!isSuperAdmin) {
        utils.showToast('هذه الصلاحية متاحة للمدير العام فقط', 'error');
        return;
    }
    
    const suggestion = allSuggestions.find(s => s._id === suggestionId);
    if (!suggestion) {
        return;
    }
    currentEvaluatedSuggestion = {
        ...suggestion,
        evaluation: suggestion.evaluation ? { ...suggestion.evaluation } : null
    };
    
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
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // فحص صلاحية السوبر أدمن
        if (!isSuperAdmin) {
            utils.showToast('هذه الصلاحية متاحة للمدير العام فقط', 'error');
            return;
        }
        
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
        
        const payload = { status, rating, feedback, admin_notes };
        
        try {
            const response = await utils.authedFetch(`/api/question-suggestions/evaluate/${suggestionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
                utils.showToast('تم تقييم الاقتراح بنجاح', 'success');
                bootstrap.Modal.getInstance(document.getElementById('evaluationModal')).hide();
                if (currentEvaluatedSuggestion && currentEvaluatedSuggestion._id === suggestionId) {
                    currentEvaluatedSuggestion.status = status;
                    currentEvaluatedSuggestion.evaluation = currentEvaluatedSuggestion.evaluation || {};
                    currentEvaluatedSuggestion.evaluation.rating = rating || null;
                    currentEvaluatedSuggestion.evaluation.feedback = feedback || '';
                }
                if (status === 'approved' && currentEvaluatedSuggestion && currentEvaluatedSuggestion._id === suggestionId) {
                    try {
                        showSuggestionTemplateModal(currentEvaluatedSuggestion);
                    } catch (modalError) {
                        console.error('Error opening template modal:', modalError);
                    }
                }
                loadStats();
                loadUnreadCount(); // Update unread count after evaluation
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
// حفظ الاقتراح كقالب مسابقة
// ==========================
function setupSuggestionTemplateModalHandlers() {
    const modalEl = document.getElementById('suggestionTemplateModal');
    if (!modalEl) {
        return;
    }

    suggestionTemplateModalInstance = new bootstrap.Modal(modalEl);
    modalEl.addEventListener('hidden.bs.modal', () => {
        suggestionTemplateData = null;
        resetSuggestionTemplateModal();
    });

    const saveBtn = document.getElementById('saveSuggestionTemplateBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSuggestionAsTemplate);
    }

    const skipBtn = document.getElementById('skipSuggestionTemplateBtn');
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            suggestionTemplateData = null;
        });
    }

    const questionInput = document.getElementById('templateSuggestionQuestionInput');
    if (questionInput) {
        questionInput.addEventListener('input', () => {
            if (templateQuestionCheckTimeout) {
                clearTimeout(templateQuestionCheckTimeout);
            }
            templateQuestionCheckTimeout = setTimeout(() => {
                checkTemplateAvailability(questionInput.value.trim());
            }, 500);
        });
    }
}

function showSuggestionTemplateModal(suggestion) {
    if (!isSuperAdmin || !suggestionTemplateModalInstance || !suggestion) {
        return;
    }

    suggestionTemplateData = { ...suggestion };
    const questionInput = document.getElementById('templateSuggestionQuestionInput');
    const answerInput = document.getElementById('templateSuggestionAnswerInput');
    const classificationSelect = document.getElementById('templateClassificationSelect');
    const typeSelect = document.getElementById('templateTypeSelect');
    const usageLimitInput = document.getElementById('templateUsageLimitInput');
    const contentInput = document.getElementById('templateContentInput');
    const employeeEl = document.getElementById('templateSuggestionEmployee');
    const categoryEl = document.getElementById('templateSuggestionCategory');

    if (questionInput) {
        questionInput.value = suggestion.question || '';
    }
    if (answerInput) {
        answerInput.value = suggestion.correct_answer || '';
    }
    if (classificationSelect) {
        classificationSelect.value = 'All';
    }
    if (typeSelect) {
        typeSelect.value = suggestion.category === 'interactive' ? 'تفاعلية' : 'مميزات';
    }
    if (usageLimitInput) {
        usageLimitInput.value = '';
    }
    if (contentInput) {
        contentInput.value = generateTemplateContentFromSuggestion(
            suggestion.question,
            suggestion.correct_answer
        );
        contentInput.setAttribute('readonly', 'true');
        contentInput.setAttribute('disabled', 'true');
    }
    if (employeeEl) {
        employeeEl.textContent = suggestion.suggested_by_name || 'غير معروف';
    }
    if (categoryEl) {
        categoryEl.textContent = getCategoryLabel(suggestion.category) || 'غير محدد';
    }

    const questionText = questionInput ? questionInput.value.trim() : '';
    checkTemplateAvailability(questionText);
    suggestionTemplateModalInstance.show();
}

function resetSuggestionTemplateModal() {
    const form = document.getElementById('suggestionTemplateForm');
    if (form) {
        form.reset();
    }
    const alertEl = document.getElementById('templateSuggestionExistsAlert');
    if (alertEl) {
        alertEl.classList.add('d-none');
        alertEl.textContent = '';
    }
    if (templateQuestionCheckTimeout) {
        clearTimeout(templateQuestionCheckTimeout);
        templateQuestionCheckTimeout = null;
    }
    const contentInput = document.getElementById('templateContentInput');
    if (contentInput) {
        contentInput.value = '';
    }
    const saveBtn = document.getElementById('saveSuggestionTemplateBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        delete saveBtn.dataset.saving;
        saveBtn.removeAttribute('data-saving');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ القالب';
    }
}

function generateTemplateContentFromSuggestion() {
    return `مسابقة جديدة من شركة إنزو للتداول 🏆

✨ هل تملك عينًا خبيرة في قراءة الشارتات؟ اختبر نفسك واربح!

💰 الجائزة: {{prize_details}}
                 {{deposit_bonus_prize_details}}

❓ سؤال المسابقة:
{{question}}

📝 كيفية المشاركة:
ضع تعليقك على منشور المسابقة بالقناة باستخدام حسابك الشخصي على تليجرام.

يجب أن يتضمن تعليقك:
• إجابتك على السؤال.
• اسمك الثلاثي المسجل بالوثائق.
• رقم الحساب التداولي.

يُمنع تعديل التعليق بعد نشره، وأي تعليق مُعدل سيتم استبعاده مباشرة.

⏳ مدة المسابقة: {{competition_duration}}

📚 يمكنك معرفة الإجابة وتعلّم المزيد عن النماذج الفنية وأساليب التحليل مع الكورس المجاني المقدم من الخبير العالمي أ. شريف خورشيد على موقع إنزو. 🆓

✨ لا تفوت الفرصة!
جاوب صح، اختبر معرفتك، وكن الفائز مع إنزو 🎁`;
}

async function checkTemplateAvailability(questionText) {
    const alertEl = document.getElementById('templateSuggestionExistsAlert');
    const saveBtn = document.getElementById('saveSuggestionTemplateBtn');

    if (alertEl) {
        alertEl.classList.add('d-none');
        alertEl.textContent = '';
    }

    if (!questionText) {
        if (saveBtn && !saveBtn.dataset.saving) {
            saveBtn.disabled = true;
        }
        return;
    }

    if (saveBtn && !saveBtn.dataset.saving) {
        saveBtn.disabled = false;
        delete saveBtn.dataset.disabledReason;
    }

    try {
        const response = await utils.authedFetch(`/api/templates/check-existence?question=${encodeURIComponent(questionText)}`);
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        if (data.exists) {
            if (alertEl) {
                alertEl.textContent = data.archived
                    ? 'هذا السؤال موجود داخل قالب مؤرشف. يمكنك استعادته من شاشة القوالب.'
                    : 'يوجد قالب نشط بنفس هذا السؤال بالفعل.';
                alertEl.classList.remove('d-none');
            }
            if (saveBtn && !data.archived) {
                saveBtn.disabled = true;
                saveBtn.dataset.disabledReason = 'exists';
            } else if (saveBtn && data.archived) {
                saveBtn.disabled = false;
                delete saveBtn.dataset.disabledReason;
            }
        } else if (saveBtn && !saveBtn.dataset.saving) {
            saveBtn.disabled = false;
            delete saveBtn.dataset.disabledReason;
        }
    } catch (error) {
        console.error('Error checking template availability:', error);
    }
}

async function saveSuggestionAsTemplate() {
    if (!suggestionTemplateData) {
        utils.showToast('لا توجد بيانات اقتراح لحفظها كقالب.', 'error');
        return;
    }

    const questionInput = document.getElementById('templateSuggestionQuestionInput');
    const answerInput = document.getElementById('templateSuggestionAnswerInput');
    const classificationSelect = document.getElementById('templateClassificationSelect');
    const typeSelect = document.getElementById('templateTypeSelect');
    const usageLimitInput = document.getElementById('templateUsageLimitInput');
    const contentInput = document.getElementById('templateContentInput');
    const saveBtn = document.getElementById('saveSuggestionTemplateBtn');

    const question = questionInput?.value.trim();
    const answer = answerInput?.value.trim();
    const classification = classificationSelect?.value || 'All';
    const type = typeSelect?.value || 'مميزات';
    const content = contentInput?.value.trim();
    const usageLimitValue = usageLimitInput?.value.trim();

    if (!question || !answer || !content) {
        utils.showToast('يرجى تعبئة السؤال والإجابة والمحتوى قبل الحفظ.', 'warning');
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.dataset.saving = 'true';
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    }

    let usageLimit = null;
    if (usageLimitValue) {
        const parsed = parseInt(usageLimitValue, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
            utils.showToast('عدد مرات الاستخدام يجب أن يكون رقماً أكبر من صفر.', 'warning');
            if (saveBtn) {
                saveBtn.disabled = false;
                delete saveBtn.dataset.saving;
                saveBtn.removeAttribute('data-saving');
                saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ القالب';
            }
            return;
        }
        usageLimit = parsed;
    }

    const payload = {
        question,
        content,
        correct_answer: answer,
        classification,
        type,
        competition_type: type === 'تفاعلية' ? 'special' : 'standard',
        status: 'active',
        description: `تم إنشاء هذا القالب من اقتراح السؤال للموظف ${suggestionTemplateData.suggested_by_name || ''}`.trim()
    };

    if (usageLimit !== null) {
        payload.usage_limit = usageLimit;
    }

    try {
        const response = await utils.authedFetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok || result.success === false) {
            utils.showToast(result.message || 'فشل إنشاء القالب. يرجى المحاولة مرة أخرى.', 'error');
            return;
        }

        utils.showToast('تم إنشاء القالب وإضافته بنجاح 🎉', 'success');
        suggestionTemplateModalInstance.hide();
    } catch (error) {
        console.error('Error saving template from suggestion:', error);
        utils.showToast('حدث خطأ أثناء حفظ القالب.', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            delete saveBtn.dataset.saving;
            saveBtn.removeAttribute('data-saving');
            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ القالب';
        }
    }
}

// ==========================
// حذف اقتراح
// ==========================
let pendingDeleteId = null; // Store the ID to delete

async function deleteSuggestion(suggestionId) {
    
    // فحص صلاحية السوبر أدمن
    if (!isSuperAdmin) {
        utils.showToast('هذه الصلاحية متاحة للمدير العام فقط', 'error');
        return;
    }
    
    // Store ID and show modal
    pendingDeleteId = suggestionId;
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    deleteModal.show();
}

// Handle confirm delete button
document.addEventListener('DOMContentLoaded', () => {
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!pendingDeleteId) return;
            
            const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal'));
            deleteModal.hide();
            
            try {
                const response = await utils.authedFetch(`/api/question-suggestions/${pendingDeleteId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
                
                if (data.success) {
                    utils.showToast('تم حذف الاقتراح بنجاح', 'success');
                    loadStats();
                    loadUnreadCount(); // Update unread count after deletion
                    loadAllSuggestions(adminSuggestionsCurrentFilter);
                } else {
                    utils.showToast(data.message || 'حدث خطأ', 'error');
                }
            } catch (error) {
                console.error('Error deleting suggestion:', error);
                utils.showToast('حدث خطأ في حذف الاقتراح', 'error');
            } finally {
                pendingDeleteId = null;
            }
        });
    }
});

// ==========================
// أرشفة اقتراح
// ==========================
let suggestionToArchiveId = null;

function archiveSuggestion(suggestionId) {
    suggestionToArchiveId = suggestionId;
    const modal = new bootstrap.Modal(document.getElementById('archiveModal'));
    modal.show();
}

// Setup Archive Confirmation
document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('confirmArchiveBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (!suggestionToArchiveId) return;
            
            const btn = document.getElementById('confirmArchiveBtn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';

            try {
                const response = await utils.authedFetch(`/api/question-suggestions/${suggestionToArchiveId}/archive`, {
                    method: 'PUT'
                });
                const data = await response.json();
                
                if (data.success) {
                    utils.showToast('تم أرشفة الاقتراح بنجاح', 'success');
                    bootstrap.Modal.getInstance(document.getElementById('archiveModal')).hide();
                    loadStats();
                    loadAllSuggestions(adminSuggestionsCurrentFilter);
                } else {
                    utils.showToast(data.message || 'حدث خطأ', 'error');
                }
            } catch (error) {
                console.error('Error archiving suggestion:', error);
                utils.showToast('حدث خطأ في أرشفة الاقتراح', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
                suggestionToArchiveId = null;
            }
        });
    }
});

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
            loadAllSuggestions(adminSuggestionsCurrentFilter);
        });
    });
    
    // Advanced filters setup
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const employeeFilter = document.getElementById('employeeFilter');
    const dateFromFilter = document.getElementById('dateFromFilter');
    const dateToFilter = document.getElementById('dateToFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    
    // Apply filters button
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            applyAdvancedFilters();
        });
    }
    
    // Reset filters button
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (employeeFilter) employeeFilter.value = '';
            if (dateFromFilter) dateFromFilter.value = '';
            if (dateToFilter) dateToFilter.value = '';
            if (categoryFilter) categoryFilter.value = '';
            loadAllSuggestions(adminSuggestionsCurrentFilter);
            // Reload original stats
            loadStats();
        });
    }
    
    // Copy approved questions button
    const copyApprovedQuestionsBtn = document.getElementById('copyApprovedQuestionsBtn');
    if (copyApprovedQuestionsBtn) {
        copyApprovedQuestionsBtn.addEventListener('click', () => {
            copyApprovedQuestions();
        });
    }
    
    // Export to Excel button
    const exportToExcelBtn = document.getElementById('exportToExcelBtn');
    if (exportToExcelBtn) {
        exportToExcelBtn.addEventListener('click', () => {
            exportToExcel();
        });
    }
}

// Load employee list from suggestions
async function loadEmployeeList() {
    try {
        const employeeFilter = document.getElementById('employeeFilter');
        if (!employeeFilter) return;

        // Clear existing options except the first one (all employees)
        while (employeeFilter.options.length > 1) {
            employeeFilter.remove(1);
        }

        // Load ALL employees regardless of current filter status
        const response = await utils.authedFetch('/api/question-suggestions/all?limit=1000');
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Get unique employee names from ALL suggestions
                const uniqueEmployees = [...new Set(data.data.map(s => s.suggested_by_name))]
                    .filter(name => name)
                    .sort();

                // Add options to select
                uniqueEmployees.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    employeeFilter.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading employee list:', error);
    }
}

// Apply advanced filters
async function applyAdvancedFilters() {
    const employeeName = document.getElementById('employeeFilter')?.value.trim();
    const dateFrom = document.getElementById('dateFromFilter')?.value;
    const dateTo = document.getElementById('dateToFilter')?.value;
    const category = document.getElementById('categoryFilter')?.value;

    try {
        // Load ALL suggestions regardless of current status filter
        const response = await utils.authedFetch('/api/question-suggestions/all?limit=1000');
        if (!response.ok) {
            console.error('Failed to load all suggestions for filtering');
            return;
        }

        const data = await response.json();
        if (!data.success) {
            console.error('Failed to get suggestions data');
            return;
        }

        // Update global allSuggestions so modal lookups work
        allSuggestions = data.data;
        let filtered = [...allSuggestions];

        // Filter by employee name
        if (employeeName) {
            filtered = filtered.filter(s =>
                s.suggested_by_name === employeeName
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

        // Update statistics cards based on filtered results
        updateStatsCards(filtered);

        displayAllSuggestions(filtered);
    } catch (error) {
        console.error('Error applying advanced filters:', error);
        utils.showToast('حدث خطأ في تطبيق الفلاتر', 'error');
    }
}

// Update statistics cards
function updateStatsCards(suggestions) {
    const totalCount = suggestions.length;
    const pendingCount = suggestions.filter(s => s.status === 'pending').length;
    const approvedCount = suggestions.filter(s => s.status === 'approved').length;
    const rejectedCount = suggestions.filter(s => s.status === 'rejected').length;
    const revisionCount = suggestions.filter(s => s.status === 'needs_revision').length;

    // Update the UI
    const totalEl = document.getElementById('totalCount');
    const pendingEl = document.getElementById('pendingCount');
    const approvedEl = document.getElementById('approvedCount');
    const rejectedEl = document.getElementById('rejectedCount');
    const revisionEl = document.getElementById('revisionCount');

    if (totalEl) totalEl.textContent = totalCount;
    if (pendingEl) pendingEl.textContent = pendingCount;
    if (approvedEl) approvedEl.textContent = approvedCount;
    if (rejectedEl) rejectedEl.textContent = rejectedCount;
    if (revisionEl) revisionEl.textContent = revisionCount;

    // Update pending header badge
    const pendingHeaderBadge = document.getElementById('pendingHeaderCountBadge');
    const pendingHeaderCount = document.getElementById('pendingHeaderCount');
    if (pendingHeaderBadge && pendingHeaderCount) {
        if (pendingCount > 0) {
            pendingHeaderBadge.style.display = 'inline-flex';
            pendingHeaderCount.textContent = pendingCount;
        } else {
            pendingHeaderBadge.style.display = 'none';
        }
    }
}// Debounce helper function
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
        
        // Block actions for non-super admin users
        if (!isSuperAdmin) {
            utils.showToast('هذه الصلاحية متاحة للمدير العام فقط', 'error');
            return;
        }
        
        if (action === 'evaluate') {
            const targetStatus = btn.dataset.status || 'pending';
            openEvaluationModal(id, targetStatus);
        } else if (action === 'delete') {
            deleteSuggestion(id);
        } else if (action === 'archive') {
            archiveSuggestion(id);
        }
    });
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
// التهيئة عند تحميل الصفحة
// ==========================
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('adminSuggestionsContainer');
    
    initAdminQuestionSuggestions();
});

// ==========================
// نسخ الأسئلة المقبولة
// ==========================
async function copyApprovedQuestions() {
    try {
        const employeeName = document.getElementById('employeeFilter')?.value.trim();
        const dateFrom = document.getElementById('dateFromFilter')?.value;
        const dateTo = document.getElementById('dateToFilter')?.value;
        const category = document.getElementById('categoryFilter')?.value;

        // Load all suggestions
        const response = await utils.authedFetch('/api/question-suggestions/all?limit=1000');
        if (!response.ok) {
            showToast('فشل تحميل الاقتراحات', 'error');
            return;
        }

        const data = await response.json();
        if (!data.success || !data.data) {
            showToast('لا توجد بيانات متاحة', 'error');
            return;
        }

        // Filter approved suggestions only
        let filteredSuggestions = data.data.filter(s => s.status === 'approved');

        // Apply employee filter
        if (employeeName) {
            filteredSuggestions = filteredSuggestions.filter(s => 
                s.suggested_by_name && s.suggested_by_name.trim() === employeeName
            );
        }

        // Apply date filters
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filteredSuggestions = filteredSuggestions.filter(s => {
                const suggestionDate = new Date(s.createdAt);
                suggestionDate.setHours(0, 0, 0, 0);
                return suggestionDate >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filteredSuggestions = filteredSuggestions.filter(s => {
                const suggestionDate = new Date(s.createdAt);
                return suggestionDate <= toDate;
            });
        }

        // Apply category filter
        if (category) {
            filteredSuggestions = filteredSuggestions.filter(s => s.category === category);
        }

        // Check if there are any approved questions
        if (filteredSuggestions.length === 0) {
            showToast('لا توجد أسئلة مقبولة حسب الفلتر المحدد', 'warning');
            return;
        }

        // Format questions for copying
        let copiedText = '📋 الأسئلة المقبولة\n';
        copiedText += '═══════════════════════════════\n\n';

        filteredSuggestions.forEach((suggestion, index) => {
            copiedText += `${index + 1}. ${suggestion.question}\n\n`;
        });

        copiedText += `═══════════════════════════════\n`;
        copiedText += `إجمالي الأسئلة: ${filteredSuggestions.length}\n`;

        // Copy to clipboard
        await navigator.clipboard.writeText(copiedText);
        
        showToast(`تم نسخ ${filteredSuggestions.length} سؤال مقبول بنجاح! ✅`, 'success');

    } catch (error) {
        console.error('Error copying approved questions:', error);
        showToast('حدث خطأ أثناء نسخ الأسئلة', 'error');
    }
}

// ==========================
// تصدير إلى Excel
// ==========================
async function exportToExcel() {
    try {
        const employeeName = document.getElementById('employeeFilter')?.value.trim();
        const dateFrom = document.getElementById('dateFromFilter')?.value;
        const dateTo = document.getElementById('dateToFilter')?.value;
        const category = document.getElementById('categoryFilter')?.value;

        // Load all suggestions
        const response = await utils.authedFetch('/api/question-suggestions/all?limit=1000');
        if (!response.ok) {
            showToast('فشل تحميل الاقتراحات', 'error');
            return;
        }

        const data = await response.json();
        if (!data.success || !data.data) {
            showToast('لا توجد بيانات متاحة', 'error');
            return;
        }

        let filteredSuggestions = [...data.data];

        // Apply employee filter
        if (employeeName) {
            filteredSuggestions = filteredSuggestions.filter(s => 
                s.suggested_by_name && s.suggested_by_name.trim() === employeeName
            );
        }

        // Apply date filters
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filteredSuggestions = filteredSuggestions.filter(s => {
                const suggestionDate = new Date(s.createdAt);
                suggestionDate.setHours(0, 0, 0, 0);
                return suggestionDate >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filteredSuggestions = filteredSuggestions.filter(s => {
                const suggestionDate = new Date(s.createdAt);
                return suggestionDate <= toDate;
            });
        }

        // Apply category filter
        if (category) {
            filteredSuggestions = filteredSuggestions.filter(s => s.category === category);
        }

        // Check if there are any suggestions
        if (filteredSuggestions.length === 0) {
            showToast('لا توجد اقتراحات للتصدير حسب الفلتر المحدد', 'warning');
            return;
        }

        // Format maps
        const statusMap = {
            'pending': 'قيد المراجعة',
            'approved': 'مقبولة',
            'rejected': 'مرفوضة',
            'needs_revision': 'تحتاج تعديل'
        };

        const categoryMap = {
            'trading': 'تداولية',
            'interactive': 'تفاعلية',
            'company_features': 'مميزات الشركة',
            'educational': 'تعليمية',
            'highlight_site': 'تبرز الموقع',
            'other': 'اخري'
        };

        const difficultyMap = {
            'easy': 'سهل',
            'medium': 'متوسط',
            'hard': 'صعب'
        };

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return '-';
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                let hours = date.getHours();
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'م' : 'ص';
                hours = hours % 12;
                hours = hours ? hours : 12; // 0 => 12
                hours = hours.toString().padStart(2, '0');
                return `${day}/${month}/${year} - ${hours}:${minutes} ${ampm}`;
            } catch (error) {
                console.error('Error formatting date:', error);
                return '-';
            }
        };

        // Prepare header
        const headers = [
            '#', 
            'السؤال', 
            'الإجابة الصحيحة', 
            'التصنيف', 
            'المستوى', 
            'الحالة', 
            'اسم الموظف', 
            'تاريخ الإقتراح', 
            'التقييم', 
            'الملاحظات', 
            'مراجع بواسطة', 
            'تاريخ المراجعة', 
            'ملاحظات الإدارة'
        ];

        // Prepare data rows
        const dataRows = filteredSuggestions.map((suggestion, index) => [
            index + 1,
            suggestion.question || '-',
            suggestion.correct_answer || '-',
            categoryMap[suggestion.category] || suggestion.category || '-',
            difficultyMap[suggestion.difficulty] || suggestion.difficulty || '-',
            statusMap[suggestion.status] || suggestion.status || '-',
            suggestion.suggested_by_name || '-',
            formatDate(suggestion.createdAt),
            suggestion.evaluation?.rating ? `${suggestion.evaluation.rating} / 5` : '-',
            suggestion.evaluation?.feedback || '-',
            suggestion.evaluation?.reviewed_by_name || '-',
            formatDate(suggestion.evaluation?.reviewed_at),
            suggestion.evaluation?.admin_notes || '-'
        ]);

        // Combine headers and data
        const allData = [headers, ...dataRows];

        // Create workbook and worksheet with graceful fallbacks for older XLSX builds
        let ws;
        const xlsxUtils = (XLSX && XLSX.utils) ? XLSX.utils : {};
        const wb = (xlsxUtils && typeof xlsxUtils.book_new === 'function')
            ? xlsxUtils.book_new()
            : { SheetNames: [], Sheets: {} }; // fallback shape used by xlsx-style

        // Helper to build sheet from AOA
        const buildSheetFromAOA = (aoa) => {
            if (xlsxUtils.aoa_to_sheet) return xlsxUtils.aoa_to_sheet(aoa);
            let sheet = {};
            if (xlsxUtils.sheet_add_aoa) {
                xlsxUtils.sheet_add_aoa(sheet, aoa);
            } else if (xlsxUtils.encode_cell && xlsxUtils.encode_range) {
                // Manual cell assignment
                aoa.forEach((row, rIdx) => {
                    row.forEach((val, cIdx) => {
                        const cellRef = xlsxUtils.encode_cell({ r: rIdx, c: cIdx });
                        sheet[cellRef] = { v: val };
                    });
                });
                const range = {
                    s: { r: 0, c: 0 },
                    e: { r: aoa.length - 1, c: headers.length - 1 }
                };
                sheet['!ref'] = xlsxUtils.encode_range(range);
            }
            return sheet;
        };

        // Build worksheet with layered fallbacks
        try {
            if (xlsxUtils && typeof xlsxUtils.aoa_to_sheet === 'function') {
                ws = xlsxUtils.aoa_to_sheet(allData);
            } else if (xlsxUtils && typeof xlsxUtils.json_to_sheet === 'function') {
                const jsonArray = dataRows.map(row => {
                    const obj = {};
                    headers.forEach((h, i) => obj[h] = row[i]);
                    return obj;
                });
                ws = xlsxUtils.json_to_sheet(jsonArray, { header: headers });
            } else {
                ws = buildSheetFromAOA(allData);
            }
        } catch (err) {
            // As a last resort convert via cell-by-cell - create empty sheet to continue gracefully
            ws = buildSheetFromAOA([headers]);
        }

        // Ensure worksheet exists before proceeding
        if (!ws || !ws['!ref']) {
            // If we have no ref yet, initialize with headers to build a valid sheet
            ws = buildSheetFromAOA([headers]);
        }

        // Set column widths
        ws['!cols'] = [
            { wch: 5 },      // #
            { wch: 60 },     // السؤال
            { wch: 30 },     // الإجابة
            { wch: 15 },     // التصنيف
            { wch: 12 },     // المستوى
            { wch: 15 },     // الحالة
            { wch: 25 },     // اسم الموظف
            { wch: 20 },     // تاريخ الإقتراح
            { wch: 10 },     // التقييم
            { wch: 40 },     // الملاحظات
            { wch: 25 },     // مراجع بواسطة
            { wch: 20 },     // تاريخ المراجعة
            { wch: 40 }      // ملاحظات الإدارة
        ];

        // Header style - Dark blue background with white text
        const headerStyle = {
            font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 12 },
            fill: { fgColor: { rgb: 'FF2C3E50' }, patternType: 'solid' },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'FF000000' } },
                bottom: { style: 'thin', color: { rgb: 'FF000000' } },
                left: { style: 'thin', color: { rgb: 'FF000000' } },
                right: { style: 'thin', color: { rgb: 'FF000000' } }
            }
        };

        // Alternate row styles
        const whiteRowStyle = {
            fill: { fgColor: { rgb: 'FFFFFFFF' }, patternType: 'solid' },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
                bottom: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
                left: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
                right: { style: 'thin', color: { rgb: 'FFD0D0D0' } }
            }
        };

        const grayRowStyle = {
            fill: { fgColor: { rgb: 'FFF0F0F0' }, patternType: 'solid' },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
                bottom: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
                left: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
                right: { style: 'thin', color: { rgb: 'FFD0D0D0' } }
            }
        };

        const encodeCell = xlsxUtils.encode_cell || ((ref) => {
            // Minimal fallback for encode_cell
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const colPart = letters[ref.c] || ('C' + ref.c); // crude fallback
            return `${colPart}${ref.r + 1}`;
        });

        // Status-specific styles with colors
        const statusStyles = {
            'مقبولة': {
                fill: { fgColor: { rgb: 'FFC6EFCE' }, patternType: 'solid' }, // Light green
                font: { bold: true, color: { rgb: 'FF006100' } }, // Dark green
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: {
                    top: { style: 'thin', color: { rgb: 'FF00B050' } },
                    bottom: { style: 'thin', color: { rgb: 'FF00B050' } },
                    left: { style: 'thin', color: { rgb: 'FF00B050' } },
                    right: { style: 'thin', color: { rgb: 'FF00B050' } }
                }
            },
            'مرفوضة': {
                fill: { fgColor: { rgb: 'FFFFC7CE' }, patternType: 'solid' }, // Light red
                font: { bold: true, color: { rgb: 'FF9C0006' } }, // Dark red
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: {
                    top: { style: 'thin', color: { rgb: 'FFFF0000' } },
                    bottom: { style: 'thin', color: { rgb: 'FFFF0000' } },
                    left: { style: 'thin', color: { rgb: 'FFFF0000' } },
                    right: { style: 'thin', color: { rgb: 'FFFF0000' } }
                }
            },
            'قيد المراجعة': {
                fill: { fgColor: { rgb: 'FFFFEB9C' }, patternType: 'solid' }, // Light yellow
                font: { bold: true, color: { rgb: 'FF9C6500' } }, // Dark orange
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: {
                    top: { style: 'thin', color: { rgb: 'FFFFC000' } },
                    bottom: { style: 'thin', color: { rgb: 'FFFFC000' } },
                    left: { style: 'thin', color: { rgb: 'FFFFC000' } },
                    right: { style: 'thin', color: { rgb: 'FFFFC000' } }
                }
            },
            'تحتاج تعديل': {
                fill: { fgColor: { rgb: 'FFE4DFEC' }, patternType: 'solid' }, // Light purple
                font: { bold: true, color: { rgb: 'FF5B2C6F' } }, // Dark purple
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: {
                    top: { style: 'thin', color: { rgb: 'FF9B59B6' } },
                    bottom: { style: 'thin', color: { rgb: 'FF9B59B6' } },
                    left: { style: 'thin', color: { rgb: 'FF9B59B6' } },
                    right: { style: 'thin', color: { rgb: 'FF9B59B6' } }
                }
            }
        };

        // Difficulty-specific styles with colors
        const difficultyStyles = {
            'سهل': {
                fill: { fgColor: { rgb: 'FFD4EDDA' }, patternType: 'solid' }, // Light green
                font: { bold: true, color: { rgb: 'FF155724' } }, // Dark green
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: {
                    top: { style: 'thin', color: { rgb: 'FF28A745' } },
                    bottom: { style: 'thin', color: { rgb: 'FF28A745' } },
                    left: { style: 'thin', color: { rgb: 'FF28A745' } },
                    right: { style: 'thin', color: { rgb: 'FF28A745' } }
                }
            },
            'متوسط': {
                fill: { fgColor: { rgb: 'FFFFF3CD' }, patternType: 'solid' }, // Light yellow
                font: { bold: true, color: { rgb: 'FF856404' } }, // Dark yellow
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: {
                    top: { style: 'thin', color: { rgb: 'FFFFC107' } },
                    bottom: { style: 'thin', color: { rgb: 'FFFFC107' } },
                    left: { style: 'thin', color: { rgb: 'FFFFC107' } },
                    right: { style: 'thin', color: { rgb: 'FFFFC107' } }
                }
            },
            'صعب': {
                fill: { fgColor: { rgb: 'FFF8D7DA' }, patternType: 'solid' }, // Light red
                font: { bold: true, color: { rgb: 'FF721C24' } }, // Dark red
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: {
                    top: { style: 'thin', color: { rgb: 'FFDC3545' } },
                    bottom: { style: 'thin', color: { rgb: 'FFDC3545' } },
                    left: { style: 'thin', color: { rgb: 'FFDC3545' } },
                    right: { style: 'thin', color: { rgb: 'FFDC3545' } }
                }
            }
        };

        // Status column index (column F = 5)
        const statusColIndex = 5;
        // Difficulty column index (column E = 4)
        const difficultyColIndex = 4;

        // Apply styles to all cells
        for (let row = 0; row <= dataRows.length; row++) {
            for (let col = 0; col < headers.length; col++) {
                const cellRef = encodeCell({ r: row, c: col });
                
                // Ensure cell exists with proper structure
                if (!ws[cellRef]) {
                    ws[cellRef] = { t: 's', v: '' };
                }
                
                // Make sure cell has required properties
                if (!ws[cellRef].t) ws[cellRef].t = 's';
                if (ws[cellRef].v === undefined) ws[cellRef].v = '';

                if (row === 0) {
                    // Header row
                    ws[cellRef].s = headerStyle;
                } else {
                    // Check if this is the status column
                    if (col === statusColIndex) {
                        const statusValue = ws[cellRef].v;
                        if (statusStyles[statusValue]) {
                            ws[cellRef].s = statusStyles[statusValue];
                        } else {
                            // Default style for unknown status
                            ws[cellRef].s = row % 2 === 0 ? whiteRowStyle : grayRowStyle;
                        }
                    } else if (col === difficultyColIndex) {
                        // Check if this is the difficulty column
                        const difficultyValue = ws[cellRef].v;
                        if (difficultyStyles[difficultyValue]) {
                            ws[cellRef].s = difficultyStyles[difficultyValue];
                        } else {
                            // Default style for unknown difficulty
                            ws[cellRef].s = row % 2 === 0 ? whiteRowStyle : grayRowStyle;
                        }
                    } else {
                        // Alternate row colors for non-status/difficulty columns
                        ws[cellRef].s = row % 2 === 0 ? whiteRowStyle : grayRowStyle;
                    }
                }
            }
        }

        // Set row height for header
        ws['!rows'] = [{ hpx: 30 }];

        // Add worksheet to workbook
        if (xlsxUtils.book_append_sheet) {
            xlsxUtils.book_append_sheet(wb, ws, 'اقتراحات الأسئلة');
        } else {
            wb.SheetNames.push('اقتراحات الأسئلة');
            wb.Sheets['اقتراحات الأسئلة'] = ws;
        }

        // Generate filename and save (browser-compatible approach)
        const fileName = `اقتراحات_الأسئلة_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        console.log('[Excel Export] Starting export process...');
        console.log('[Excel Export] Workbook structure:', { 
            sheetNames: wb.SheetNames, 
            hasSheets: !!wb.Sheets,
            sheetCount: Object.keys(wb.Sheets || {}).length
        });
        console.log('[Excel Export] Worksheet structure:', {
            hasRef: !!ws['!ref'],
            ref: ws['!ref'],
            hasCols: !!ws['!cols'],
            hasRows: !!ws['!rows']
        });
        console.log('[Excel Export] XLSX library capabilities:', {
            hasWrite: !!(XLSX && XLSX.write),
            writeType: typeof XLSX.write,
            hasWriteFile: !!(XLSX && XLSX.writeFile),
            writeFileType: typeof XLSX.writeFile
        });
        
        // Write workbook to binary string and trigger download
        if (XLSX.writeFile && typeof XLSX.writeFile === 'function') {
            console.log('[Excel Export] Trying XLSX.writeFile...');
            try {
                XLSX.writeFile(wb, fileName);
                console.log('[Excel Export] ✅ writeFile succeeded');
            } catch (writeErr) {
                console.warn('[Excel Export] ⚠️ writeFile failed:', writeErr.message);
                console.log('[Excel Export] Trying fallback with XLSX.write...');
                
                // Try different output types
                const types = ['binary', 'base64', 'buffer'];
                let success = false;
                
                for (const outputType of types) {
                    try {
                        console.log(`[Excel Export] Attempting type: ${outputType}`);
                        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: outputType });
                        console.log(`[Excel Export] Write succeeded with type ${outputType}, output length:`, wbout.length || wbout.byteLength);
                        
                        let blob;
                        if (outputType === 'binary') {
                            const buf = new ArrayBuffer(wbout.length);
                            const view = new Uint8Array(buf);
                            for (let i = 0; i < wbout.length; i++) {
                                view[i] = wbout.charCodeAt(i) & 0xFF;
                            }
                            blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                        } else if (outputType === 'base64') {
                            const binStr = atob(wbout);
                            const buf = new ArrayBuffer(binStr.length);
                            const view = new Uint8Array(buf);
                            for (let i = 0; i < binStr.length; i++) {
                                view[i] = binStr.charCodeAt(i) & 0xFF;
                            }
                            blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                        } else {
                            blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                        }
                        
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        console.log(`[Excel Export] ✅ Download triggered with type ${outputType}`);
                        success = true;
                        break;
                    } catch (typeErr) {
                        console.warn(`[Excel Export] ⚠️ Type ${outputType} failed:`, typeErr.message);
                    }
                }
                
                if (!success) {
                    throw new Error('All write methods failed');
                }
            }
        } else if (XLSX.write) {
            console.log('[Excel Export] writeFile not available, using XLSX.write directly...');
            
            // Try different output types
            const types = ['binary', 'base64', 'buffer'];
            let success = false;
            
            for (const outputType of types) {
                try {
                    console.log(`[Excel Export] Attempting type: ${outputType}`);
                    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: outputType });
                    console.log(`[Excel Export] Write succeeded with type ${outputType}`);
                    
                    let blob;
                    if (outputType === 'binary') {
                        const buf = new ArrayBuffer(wbout.length);
                        const view = new Uint8Array(buf);
                        for (let i = 0; i < wbout.length; i++) {
                            view[i] = wbout.charCodeAt(i) & 0xFF;
                        }
                        blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    } else if (outputType === 'base64') {
                        const binStr = atob(wbout);
                        const buf = new ArrayBuffer(binStr.length);
                        const view = new Uint8Array(buf);
                        for (let i = 0; i < binStr.length; i++) {
                            view[i] = binStr.charCodeAt(i) & 0xFF;
                        }
                        blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    } else {
                        blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    }
                    
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    console.log(`[Excel Export] ✅ Download triggered with type ${outputType}`);
                    success = true;
                    break;
                } catch (typeErr) {
                    console.warn(`[Excel Export] ⚠️ Type ${outputType} failed:`, typeErr.message);
                }
            }
            
            if (!success) {
                throw new Error('All write methods failed');
            }
        }

        showToast(`تم تصدير ${filteredSuggestions.length} اقتراح بنجاح! ✅`, 'success');

    } catch (error) {
        console.error('Error exporting to Excel:', error);
        showToast('حدث خطأ أثناء التصدير إلى Excel', 'error');
    }
}

// جعل الدوال المستخدمة في onclick متاحة عالمياً بعد التجميع داخل IIFE
// بسبب أن bundler يلف كل الملفات داخل (function(window){ ... }) فلا تصبح هذه الدوال على الكائن window تلقائياً
// لذلك نُصدرها صراحة ليعمل الـ onclick داخل عناصر البطاقات
window.openEvaluationModal = openEvaluationModal;
window.deleteSuggestion = deleteSuggestion;
window.copyApprovedQuestions = copyApprovedQuestions;
window.exportToExcel = exportToExcel;
// Show this debug log only when running in development or for admin users
try {
    const isDev = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
    const cachedProfile = localStorage.getItem('userProfile');
    const role = cachedProfile ? (JSON.parse(cachedProfile).role) : null;
    const isAdmin = role === 'admin' || role === 'super_admin';
    if (isDev || isAdmin) {
        console.log('[AdminSuggest] Global functions exposed');
    }
} catch (_) { /* noop */ }
