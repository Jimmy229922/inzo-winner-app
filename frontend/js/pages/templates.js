// Competition Templates page and modal logic extracted from competitions.js
// This file contains functions to render the templates page, archived templates,
// and the create/edit modals. It depends on global helpers: authedFetch, showToast,
// renderCreateTemplateModal, renderEditTemplateModal, showConfirmationModal, currentUserProfile

async function renderCompetitionTemplatesPage() {
    // --- NEW: Permission Check ---
    const appContent = document.getElementById('app-content');
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
    const templatesPerm = currentUserProfile?.permissions?.competitions?.manage_templates || 'none';
    const canView = isAdmin || templatesPerm === 'full' || templatesPerm === 'view';

    if (!canView) {
        appContent.innerHTML = `
            <div class="access-denied-container">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية وصول</h2>
                <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
            </div>`;
        return;
    }

    const canEdit = isAdmin || templatesPerm === 'full';
    document.querySelector('main').classList.add('full-width');

    const defaultTemplateContent = `مسابقة جديدة من شركة إنزو للتداول 🏆

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

    appContent.innerHTML = `
        <div class="page-header">
            <div class="header-top-row">
                <h1><i class="fas fa-file-alt"></i> إدارة قوالب المسابقات</h1>
                <button id="show-template-form-btn" class="btn-primary"><i class="fas fa-plus-circle"></i> إنشاء قالب جديد</button>
            </div>
            <div class="template-filters">
                <div class="filter-search-container">
                    <input type="search" id="template-search-input" placeholder="بحث باسم القالب..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="template-search-clear"></i>
                </div>
                <div class="filter-buttons" data-filter-group="classification">
                    <button class="filter-btn active" data-filter="all">الكل</button>
                    <button class="filter-btn" data-filter="R">R</button>
                    <button class="filter-btn" data-filter="A">A</button>
                    <button class="filter-btn" data-filter="B">B</button>
                    <button class="filter-btn" data-filter="C">C</button>
                    <button class="filter-btn" data-filter="All">عام</button>
                </div>
            </div>
        </div>
        <div class="templates-list-container">
            <div id="templates-list" class="templates-list-grouped"></div>
        </div>
    `;

    const templatesListDiv = document.getElementById('templates-list');
    const showFormBtn = document.getElementById('show-template-form-btn');

    if (showFormBtn) {
        if (canEdit) {
            showFormBtn.addEventListener('click', () => renderCreateTemplateModal(defaultTemplateContent, loadTemplates));
        } else {
            showFormBtn.addEventListener('click', () => showToast('ليس لديك صلاحية لإنشاء قوالب.', 'error'));
        }
    }

    async function loadTemplates() {
        const response = await authedFetch('/api/templates?archived=false');

        if (!response.ok) {
            console.error('Error fetching templates:', await response.text());
            templatesListDiv.innerHTML = '<p class="error">فشل تحميل القوالب.</p>';
            return;
        }

        const { data: templates } = await response.json();
        const classificationOrder = { 'R': 1, 'A': 2, 'B': 3, 'C': 4, 'All': 5 };
        templates.sort((a, b) => {
            const orderA = classificationOrder[a.classification] || 99;
            const orderB = classificationOrder[b.classification] || 99;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return (a.question || '').localeCompare(b.question || '');
        });

        if (templates.length === 0) {
            templatesListDiv.innerHTML = '<p class="no-results-message">لا توجد قوالب محفوظة بعد.</p>';
        } else {
            const groupedTemplates = templates.reduce((acc, template) => {
                const key = template.classification || 'All';
                if (!acc[key]) acc[key] = [];
                acc[key].push(template);
                return acc;
            }, {});

            const classificationOrderArr = ['R', 'A', 'B', 'C', 'All'];
            let groupsHtml = '';

            for (const classification of classificationOrderArr) {
                if (groupedTemplates[classification]) {
                    const group = groupedTemplates[classification];
                    groupsHtml += `
                        <details class="template-group" data-classification-group="${classification}" open>
                            <summary class="template-group-header">
                                <h2>تصنيف ${classification === 'All' ? 'عام' : classification}</h2>
                                <span class="template-count">${group.length} قوالب</span>
                            </summary>
                            <div class="template-group-content">
                                ${group.map(template => `
                                <div class="template-card" data-id="${template._id}" data-question="${(template.question || '').toLowerCase()}" data-classification="${template.classification || 'All'}">
                                        <div class="template-card-header">
                                        <h4>${template.question || 'قالب بدون سؤال'}</h4>
                                        </div>
                                        <div class="template-card-body">
                                            <p>${template.content.substring(0, 120)}...</p>
                                        </div>
                                        <div class="template-card-footer">
                                            <button class="btn-secondary edit-template-btn" data-id="${template._id}"><i class="fas fa-edit"></i> تعديل</button>
                                            <button class="btn-danger delete-template-btn" data-id="${template._id}"><i class="fas fa-trash-alt"></i> حذف</button>
                                        </div> 
                                    </div>
                                `).join('')}
                            </div>
                        </details>
                    `;
                }
            }
            templatesListDiv.innerHTML = groupsHtml;
        }
    }

    templatesListDiv.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-template-btn');
        if (editBtn) {
            if (!canEdit) {
                showToast('ليس لديك صلاحية لتعديل القوالب.', 'error');
                return;
            }
            const id = editBtn.dataset.id;
            const response = await authedFetch(`/api/templates/${id}`);
            const { data: template } = await response.json();
            if (!response.ok || !template) {
                showToast('فشل العثور على القالب.', 'error');
                return;
            }
            renderEditTemplateModal(template, loadTemplates);
        }

        const deleteBtn = e.target.closest('.delete-template-btn');
        if (deleteBtn) {
            if (!canEdit) {
                showToast('ليس لديك صلاحية لحذف القوالب.', 'error');
                return;
            }
            const templateId = deleteBtn.dataset.id;
            showConfirmationModal(
                'هل أنت متأكد من حذف هذا القالب؟<br><small>لا يمكن التراجع عن هذا الإجراء.</small>',
                async () => {
                    const response = await authedFetch(`/api/templates/${templateId}/archive`, { method: 'PATCH' });
                    if (!response.ok) {
                        const result = await response.json();
                        showToast(result.message || 'فشل حذف القالب.', 'error');
                    } else {
                        showToast('تم حذف القالب بنجاح.', 'success');
                        await loadTemplates();
                    }
                },
                { title: 'تأكيد حذف القالب', confirmText: 'حذف', confirmClass: 'btn-danger' }
            );
        }
    });

    await loadTemplates();
    setupTemplateFilters();
}

function renderCreateTemplateModal(defaultContent, onSaveCallback) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    let templateImageFile = null; // Variable to hold the new image file

    const modal = document.createElement('div');
    modal.className = 'form-modal-content modal-fullscreen';
    
    modal.innerHTML = `
        <div class="form-modal-header">
            <h2><i class="fas fa-plus-circle"></i> إنشاء قالب مسابقة جديد</h2>
            <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
        </div>
        <div class="form-modal-body">
            <form id="create-template-form" class="template-form-grid template-form-stacked">
                    <div class="template-form-fields">
                    <h3 class="details-section-title" style="margin-top: 0;"><i class="fas fa-info-circle"></i> الحقول الأساسية</h3>
                    <div class="form-group">
                        <label for="create-template-question">السؤال (سيكون اسم المسابقة)</label>
                        <textarea id="create-template-question" rows="3" required></textarea>
                        <div id="template-question-validation" class="validation-error" style="display: none; margin-top: 8px; font-size: 0.9em;"></div>
                    </div>
                    <div class="form-group">
                        <label for="create-template-correct-answer">الإجابة الصحيحة</label>
                        <textarea id="create-template-correct-answer" rows="2" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="create-template-classification">التصنيف (لمن سيظهر هذا القالب)</label>
                        <select id="create-template-classification" required>
                            <option value="All" selected>عام (يظهر للجميع)</option>
                            <option value="R">R</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="create-template-type">النوع</label>
                        <select id="create-template-type" required>
                            <option value="مميزات" selected>مميزات</option>
                            <option value="تفاعلية">تفاعلية</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="create-template-usage-limit">عدد مرات الاستخدام (اتركه فارغاً للاستخدام غير المحدود)</label>
                        <input type="number" id="create-template-usage-limit" min="1" placeholder="مثال: 5">
                    </div>
                </div>
                <div class="template-form-content">
                    <h3 class="details-section-title" style="margin-top: 0;"><i class="fas fa-file-alt"></i> محتوى المسابقة</h3>
                    <!-- NEW: Image Preview Section with upload button -->
                    <div class="form-group">
                        <label>صورة القالب</label>
                        <div class="image-preview-container">
                            <img id="create-template-image-preview" src="images/competition_bg.jpg" alt="صورة القالب" class="image-preview">
                        </div>
                        <input type="file" id="create-template-image-upload" accept="image/*" style="display: none;">
                        <button type="button" id="change-template-image-btn" class="btn-secondary btn-small" style="margin-top: 10px;"><i class="fas fa-edit"></i> تغيير الصورة</button>
                    </div>
                    <div class="form-group">
                        <label for="create-template-content">نص المسابقة</label>
                        <textarea id="create-template-content" rows="15" required>${defaultContent}</textarea>
                    </div>
                </div>
                <div class="form-actions template-form-actions">
                    <button type="submit" class="btn-primary"><i class="fas fa-save"></i> حفظ القالب</button>
                    <button type="button" id="cancel-create-modal" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    // --- NEW: Event Listeners for Image Manipulation ---
    const imageUploadInput = document.getElementById('create-template-image-upload');
    const changeImageBtn = document.getElementById('change-template-image-btn');
    const imagePreview = document.getElementById('create-template-image-preview');

    changeImageBtn.addEventListener('click', () => imageUploadInput.click());

    imageUploadInput.addEventListener('change', () => {
        const file = imageUploadInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
            templateImageFile = file;
        }
    });

    // --- NEW: Live validation for template question ---
    const questionInput = document.getElementById('create-template-question');
    const validationDiv = document.getElementById('template-question-validation');
    let debounceTimeout;

    questionInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
            const questionText = questionInput.value.trim();
            if (questionText) {
                try {
                    const response = await authedFetch(`/api/templates/check-existence?question=${encodeURIComponent(questionText)}`);
                    if (response.ok) {
                        const { exists, archived } = await response.json();
                        if (exists) {
                            if (archived) {
                                validationDiv.innerHTML = 'هذا السؤال موجود في قالب محذوف. يمكنك <a href="#archived-templates">استعادته من الأرشيف</a>.';
                            } else {
                                validationDiv.textContent = 'هذا السؤال مستخدم بالفعل في قالب آخر.';
                            }
                            validationDiv.style.display = 'block';
                        } else {
                            validationDiv.style.display = 'none';
                        }
                    } else {
                        validationDiv.style.display = 'none'; // Hide on error
                    }
                } catch (error) {
                    console.error('Error checking template existence:', error);
                    validationDiv.style.display = 'none'; // Hide on error
                }
            } else {
                validationDiv.style.display = 'none';
            }
        }, 500); // 500ms debounce delay
    });

    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-create-modal').addEventListener('click', closeModal);
    
    document.getElementById('create-template-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        // --- NEW: Prevent submission if validation error is visible ---
        if (validationDiv.style.display === 'block') {
            showToast('لا يمكن حفظ القالب لأن السؤال مستخدم بالفعل.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;

                    const questionText = document.getElementById('create-template-question').value.trim();        
                    if (!questionText) {
                        showToast('حقل السؤال مطلوب.', 'error');
                        submitBtn.disabled = false;
                        return;
                    }
        
                    // Debugging: Log values before sending
                    console.log('DEBUG: Question Text (name/question):', questionText);
                    console.log('DEBUG: Template Content:', document.getElementById('create-template-content').value.trim());
                    console.log('DEBUG: Correct Answer:', document.getElementById('create-template-correct-answer').value.trim());
                    console.log('DEBUG: Classification:', document.getElementById('create-template-classification').value);
                    console.log('DEBUG: Usage Limit:', document.getElementById('create-template-usage-limit').value);
        
                    try {
                        let finalImageUrl = '/images/competition_bg.jpg'; // Default image
        
                        if (templateImageFile) {
                            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الصورة...';
                            const formData = new FormData();
                            formData.append('image', templateImageFile);
        
                            // Re-using the competition image upload endpoint
                            const uploadResponse = await authedFetch('/api/competitions/upload-image', { method: 'POST', body: formData });
        
                            if (!uploadResponse.ok) {
                                throw new Error('فشل رفع الصورة.');
                            }
                            
                            const uploadResult = await uploadResponse.json();
                            finalImageUrl = uploadResult.imageUrl; // The backend should return the relative path
                        }
                        
                        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري حفظ القالب...';
        
                        // تجميع كل بيانات القالب للحفظ
                        const formData = {
                            // البيانات الأساسية
                            question: questionText.trim(),
                            content: document.getElementById('create-template-content').value.trim(),
                            type: document.getElementById('create-template-type').value || 'مميزات',
                            classification: document.getElementById('create-template-classification').value || 'All',
                            
                            // تفاصيل المسابقة
                            correct_answer: document.getElementById('create-template-correct-answer').value.trim(),
                            competition_type: 'standard',
                            prize_details: '',  // سيتم تعبئته من محتوى القالب عند الاستخدام
                            deposit_bonus_prize_details: '', // سيتم تعبئته من محتوى القالب عند الاستخدام
                            competition_duration: '', // سيتم تعبئته عند إنشاء المسابقة
                            
                            // ضوابط الاستخدام
                            usage_limit: document.getElementById('create-template-usage-limit').value ? 
                                parseInt(document.getElementById('create-template-usage-limit').value, 10) : null,
                            
                            // الوسائط
                            image_url: finalImageUrl,
                            
                            // الحالة
                            status: 'active',
                        };

                        console.log('DEBUG: Creating template with data:', formData);
                        console.log('DEBUG (Frontend): FormData before sending:', formData);
            const response = await authedFetch('/api/templates', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('Template creation failed:', result);
                throw new Error(result.message || 'فشل حفظ القالب.');
            }
            
            console.log('Template created successfully:', result);
            showToast('تم حفظ القالب بنجاح.', 'success');
            closeModal();
            if (onSaveCallback) onSaveCallback();

        } catch (error) {
            showToast(error.message, 'error');
            console.error('Template creation failed:', error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    });
}

function setupTemplateFilters() {
    const searchInput = document.getElementById('template-search-input');
    const clearBtn = document.getElementById('template-search-clear');
    const filterButtons = document.querySelectorAll('.template-filters .filter-btn');

    if (!searchInput) return;

    const applyFilters = () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeFilter = document.querySelector('.template-filters .filter-btn.active').dataset.filter;

        const allGroups = document.querySelectorAll('.template-group');
        let hasResults = false;

        allGroups.forEach(group => {
            const cards = group.querySelectorAll('.template-card');
            let visibleCardsInGroup = 0;

            cards.forEach(card => {
                const question = card.dataset.question || '';
                const classification = card.dataset.classification;

                const matchesSearch = searchTerm === '' || question.includes(searchTerm);
                const matchesFilter = activeFilter === 'all' || classification === activeFilter;

                const isVisible = matchesSearch && matchesFilter;
                card.style.display = isVisible ? '' : 'none';
                if (isVisible) {
                    visibleCardsInGroup++;
                }
            });

            group.style.display = visibleCardsInGroup > 0 ? '' : 'none';
            if (visibleCardsInGroup > 0) {
                hasResults = true;
            }
        });
    };

    searchInput.addEventListener('input', applyFilters);
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            applyFilters();
            searchInput.focus();
        });
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            applyFilters();
        });
    });
}

async function renderArchivedTemplatesPage() {
    const appContent = document.getElementById('app-content');
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
    const templatesPerm = currentUserProfile?.permissions?.competitions?.manage_templates || 'none';
    const canView = isAdmin || templatesPerm === 'full' || templatesPerm === 'view';

    if (!canView) {
        appContent.innerHTML = ` <div class="access-denied-container">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية وصول</h2>
                <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
            </div>`;
        return;
    }
    document.querySelector('main').classList.add('full-width');

    appContent.innerHTML = `
        <div class="page-header">
            <div class="header-top-row">
                <h1><i class="fas fa-archive"></i> أرشيف قوالب المسابقات</h1>
            </div>
            <div class="template-filters">
                <div class="filter-search-container">
                    <input type="search" id="archive-search-input" placeholder="بحث باسم القالب..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="archive-search-clear"></i>
                </div>
                <div class="filter-buttons" data-filter-group="classification">
                    <button class="filter-btn active" data-filter="all">الكل</button>
                    <button class="filter-btn" data-filter="R">R</button>
                    <button class="filter-btn" data-filter="A">A</button>
                    <button class="filter-btn" data-filter="B">B</button>
                    <button class="filter-btn" data-filter="C">C</button>
                    <button class="filter-btn" data-filter="All">عام</button>
                </div>
            </div>
        </div>
        <p class="page-subtitle" style="text-align: right; margin-top: 0;">القوالب التي وصلت إلى الحد الأقصى من الاستخدام. يمكنك إعادة تفعيلها من هنا.</p>
        <div id="archived-templates-list" class="table-responsive-container">
            <p>جاري تحميل الأرشيف...</p>
        </div>
    `;

    const listDiv = document.getElementById('archived-templates-list');
    let allArchivedTemplates = [];

    function displayArchived(templatesToDisplay) {
        const isSuperAdmin = currentUserProfile?.role === 'super_admin';
        const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
        const templatesPerm = currentUserProfile?.permissions?.competitions?.manage_templates || 'none';
        const canEdit = isAdmin || templatesPerm === 'full';
        if (templatesToDisplay.length === 0) {
            listDiv.innerHTML = '<p class="no-results-message">لا توجد قوالب في الأرشيف تطابق بحثك.</p>';
        } else {
            listDiv.innerHTML = `
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>اسم القالب (السؤال)</th>
                            <th>التصنيف</th>
                            <th>مرات الاستخدام</th>
                            <th class="actions-column">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${templatesToDisplay.map(template => `
                            <tr data-question="${(template.name || '').toLowerCase()}" data-classification="${template.classification || 'All'}">
                                <td data-label="اسم القالب">${template.name || 'قالب بدون اسم'}</td>
                                <td data-label="التصنيف"><span class="classification-badge classification-${(template.classification || 'all').toLowerCase()}">${template.classification || 'الكل'}</span></td>
                                <td data-label="مرات الاستخدام">${template.usage_count} / ${template.usage_limit}</td>
                                <td class="actions-cell">
                                    <button class="btn-primary reactivate-template-btn btn-small" data-id="${template._id}"><i class="fas fa-undo"></i> إعادة تفعيل</button>
                                    ${canEdit ? `<button class="btn-danger delete-template-btn btn-small" data-id="${template._id}"><i class="fas fa-trash-alt"></i> حذف نهائي</button>` : ''}
                                </td> 
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }

    function setupArchiveFilters() {
        const searchInput = document.getElementById('archive-search-input');
        const clearBtn = document.getElementById('archive-search-clear');
        const filterButtons = document.querySelectorAll('.template-filters .filter-btn');

        const applyFilters = () => {
            if (clearBtn) clearBtn.style.display = searchInput.value ? 'block' : 'none';
            const searchTerm = searchInput.value.toLowerCase().trim();
            const activeFilter = document.querySelector('.template-filters .filter-btn.active').dataset.filter;

            const filtered = allArchivedTemplates.filter(template => {
                const matchesSearch = searchTerm === '' || template.name.toLowerCase().includes(searchTerm);
                const matchesFilter = activeFilter === 'all' || (template.classification || 'All') === activeFilter;
                return matchesSearch && matchesFilter;
            });
            displayArchived(filtered);
        };

        searchInput.addEventListener('input', applyFilters);
        clearBtn.addEventListener('click', () => { searchInput.value = ''; applyFilters(); });
        filterButtons.forEach(btn => btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilters();
        }));
    }

    async function loadAndDisplayArchived() {
        const response = await authedFetch('/api/templates?archived=true');

        if (!response.ok) {
            listDiv.innerHTML = `<p class="error">فشل تحميل الأرشيف.</p>`;
            console.error('Archive fetch error:', await response.text());
            return;
        }
        const { data } = await response.json();
        allArchivedTemplates = data || [];
        displayArchived(allArchivedTemplates || []);
        setupArchiveFilters();
    }

    listDiv.addEventListener('click', async (e) => {
        const reactivateBtn = e.target.closest('.reactivate-template-btn');
        const deleteBtn = e.target.closest('.delete-template-btn');

        if (reactivateBtn) {
            const id = reactivateBtn.dataset.id;
            showConfirmationModal('هل أنت متأكد من إعادة تفعيل هذا القالب؟<br><small>سيتم إعادة تعيين عداد استخدامه إلى الصفر.</small>', async () => {
                const response = await authedFetch(`/api/templates/${id}/reactivate`, { method: 'PUT' });
                if (!response.ok) {
                    const result = await response.json();
                    showToast(result.message || 'فشل إعادة تفعيل القالب.', 'error');
                } else {
                    showToast('تم إعادة تفعيل القالب بنجاح.', 'success');
                    await loadAndDisplayArchived();
                }
            }, { title: 'تأكيد إعادة التفعيل' });
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            showConfirmationModal('هل أنت متأكد من الحذف النهائي لهذا القالب؟<br><small>هذا الإجراء لا يمكن التراجع عنه.</small>', async () => {
                const response = await authedFetch(`/api/templates/${id}`, { method: 'DELETE' });
                if (!response.ok) {
                    const result = await response.json();
                    showToast(result.message || 'فشل حذف القالب.', 'error');
                } else {
                    showToast('تم حذف القالب نهائياً.', 'success');
                    await loadAndDisplayArchived();
                }
            }, { title: 'تأكيد الحذف النهائي', confirmText: 'حذف نهائي', confirmClass: 'btn-danger' });
        }
    });

    await loadAndDisplayArchived();
}

function renderEditTemplateModal(template, onSaveCallback) {
    // NEW: Full-screen edit modal replicating create modal structure with existing data populated.
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let updatedImageFile = null;

    const modal = document.createElement('div');
    modal.className = 'form-modal-content modal-fullscreen';
    modal.innerHTML = `
        <div class="form-modal-header">
            <h2><i class="fas fa-edit"></i> تعديل القالب</h2>
            <button id="close-edit-template-modal" class="btn-icon-action" title="إغلاق">&times;</button>
        </div>
        <div class="form-modal-body">
            <form id="edit-template-form" class="template-form-grid template-form-stacked">
                <div class="template-form-fields">
                    <h3 class="details-section-title" style="margin-top:0;"><i class="fas fa-info-circle"></i> الحقول الأساسية</h3>
                    <div class="form-group">
                        <label for="edit-template-question">السؤال (اسم المسابقة)</label>
                        <textarea id="edit-template-question" rows="3" required>${template.question || ''}</textarea>
                        <div id="edit-template-question-validation" class="validation-error" style="display:none; margin-top:8px; font-size:0.9em;"></div>
                    </div>
                    <div class="form-group">
                        <label for="edit-template-correct-answer">الإجابة الصحيحة</label>
                        <textarea id="edit-template-correct-answer" rows="2" required>${template.correct_answer || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="edit-template-classification">التصنيف</label>
                        <select id="edit-template-classification" required>
                            ${['All','R','A','B','C'].map(cls => `<option value="${cls}" ${template.classification === cls ? 'selected' : ''}>${cls === 'All' ? 'عام (الجميع)' : cls}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-template-type">النوع</label>
                        <select id="edit-template-type" required>
                            ${['مميزات','تفاعلية'].map(t => `<option value="${t}" ${template.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-template-usage-limit">عدد مرات الاستخدام (فارغ = غير محدود)</label>
                        <input type="number" id="edit-template-usage-limit" min="1" value="${template.usage_limit === null || template.usage_limit === undefined ? '' : template.usage_limit}">
                        <div style="display:block; margin-top:6px; color:var(--text-secondary-color); line-height:1.6;">
                            <div>استخدامات الدورة الحالية: <strong>${template.usage_count || 0}</strong>${template.usage_limit !== null && template.usage_limit !== undefined ? ` / ${template.usage_limit}` : ''}</div>
                            <div>إجمالي مرات الاستخدام: <strong>${(template.usage_total ?? (Array.isArray(template.times_used) ? template.times_used.length : 0) + (template.usage_count || 0))}</strong></div>
                        </div>
                    </div>
                </div>
                <div class="template-form-content">
                    <h3 class="details-section-title" style="margin-top:0;"><i class="fas fa-file-alt"></i> محتوى المسابقة</h3>
                    <div class="form-group">
                        <label>صورة القالب</label>
                        <div class="image-preview-container">
                            <img id="edit-template-image-preview" src="${template.image_url || 'images/competition_bg.jpg'}" alt="صورة القالب" class="image-preview">
                        </div>
                        <input type="file" id="edit-template-image-upload" accept="image/*" style="display:none;">
                        <button type="button" id="change-edit-template-image-btn" class="btn-secondary btn-small" style="margin-top:10px;"><i class="fas fa-edit"></i> تغيير الصورة</button>
                    </div>
                    <div class="form-group">
                        <label for="edit-template-content">نص المسابقة</label>
                        <textarea id="edit-template-content" rows="15" required>${template.content || ''}</textarea>
                    </div>
                </div>
                <div class="form-actions template-form-actions">
                    <button type="submit" class="btn-primary"><i class="fas fa-save"></i> حفظ التعديلات</button>
                    <button type="button" id="cancel-edit-template-modal" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    document.getElementById('close-edit-template-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-edit-template-modal').addEventListener('click', closeModal);

    // Image handling
    const imageUploadInput = document.getElementById('edit-template-image-upload');
    const changeImageBtn = document.getElementById('change-edit-template-image-btn');
    const imagePreview = document.getElementById('edit-template-image-preview');
    changeImageBtn.addEventListener('click', () => imageUploadInput.click());
    imageUploadInput.addEventListener('change', () => {
        const file = imageUploadInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => { imagePreview.src = e.target.result; };
            reader.readAsDataURL(file);
            updatedImageFile = file;
        }
    });

    // Live duplicate question validation
    const questionInput = document.getElementById('edit-template-question');
    const validationDiv = document.getElementById('edit-template-question-validation');
    let debounceTimeout;
    questionInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
            const text = questionInput.value.trim();
            if (!text || text === template.question) { validationDiv.style.display='none'; return; }
            try {
                const resp = await authedFetch(`/api/templates/check-existence?question=${encodeURIComponent(text)}`);
                if (resp.ok) {
                    const { exists, archived } = await resp.json();
                    if (exists) {
                        validationDiv.innerHTML = archived ? 'هذا السؤال موجود في قالب محذوف.' : 'هذا السؤال مستخدم بالفعل في قالب آخر.';
                        validationDiv.style.display = 'block';
                    } else {
                        validationDiv.style.display = 'none';
                    }
                } else { validationDiv.style.display='none'; }
            } catch (err) { validationDiv.style.display='none'; }
        }, 500);
    });

    document.getElementById('edit-template-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (validationDiv.style.display === 'block') { showToast('لا يمكن حفظ القالب لأن السؤال مستخدم.', 'error'); return; }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        try {
            let finalImageUrl = template.image_url || 'images/competition_bg.jpg';
            if (updatedImageFile) {
                const formData = new FormData();
                formData.append('image', updatedImageFile);
                const uploadResp = await authedFetch('/api/competitions/upload-image', { method: 'POST', body: formData });
                if (!uploadResp.ok) throw new Error('فشل رفع الصورة');
                const uploadResult = await uploadResp.json();
                finalImageUrl = uploadResult.imageUrl;
            }

            const payload = {
                question: questionInput.value.trim(),
                correct_answer: document.getElementById('edit-template-correct-answer').value.trim(),
                classification: document.getElementById('edit-template-classification').value,
                type: document.getElementById('edit-template-type').value,
                usage_limit: document.getElementById('edit-template-usage-limit').value ? parseInt(document.getElementById('edit-template-usage-limit').value,10) : null,
                content: document.getElementById('edit-template-content').value.trim(),
                image_url: finalImageUrl
            };

            const resp = await authedFetch(`/api/templates/${template._id}` , {
                method: 'PUT',
                headers: { 'Content-Type':'application/json;charset=UTF-8','Accept':'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await resp.json();
            if (!resp.ok) throw new Error(result.message || 'فشل حفظ التعديلات.');

            showToast('تم حفظ التعديلات بنجاح.', 'success');
            closeModal();
            if (onSaveCallback) onSaveCallback();
        } catch (err) {
            console.error('Edit template failed:', err);
            showToast(err.message || 'فشل حفظ التعديلات.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    });
}

// Export to global so other pages can call these functions
window.renderCompetitionTemplatesPage = renderCompetitionTemplatesPage;
window.renderArchivedTemplatesPage = renderArchivedTemplatesPage;
window.renderCreateTemplateModal = renderCreateTemplateModal;
window.renderEditTemplateModal = renderEditTemplateModal;
window.setupTemplateFilters = setupTemplateFilters;
