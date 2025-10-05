const AGENTS_PER_PAGE = 10;

async function renderManageAgentsPage() {
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';

    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>إدارة الوكلاء</h1>
                <div class="header-actions-group">
                    ${isSuperAdmin ? `<button id="delete-all-agents-btn" class="btn-danger"><i class="fas fa-skull-crossbones"></i> حذف كل الوكلاء</button>` : ''}
                    ${isAdmin ? `<button id="bulk-renew-balances-btn" class="btn-renewal"><i class="fas fa-sync-alt"></i> تجديد الأرصدة</button>` : ''}
                    <button id="bulk-send-balance-btn" class="btn-telegram-bonus"><i class="fas fa-bullhorn"></i> تعميم الأرصدة</button>
                    ${isAdmin ? `<button id="bulk-add-agents-btn" class="btn-secondary"><i class="fas fa-users-cog"></i> إضافة وكلاء دفعة واحدة</button>` : ''}
                    <button id="add-agent-btn" class="btn-primary"><i class="fas fa-plus"></i> إضافة وكيل جديد</button>
                </div>
            </div>
            <div class="agent-filters">
                <div class="filter-search-container">
                    <input type="search" id="agent-search-input" placeholder="بحث بالاسم أو الرقم..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="agent-search-clear"></i>
                </div>
                <div class="filter-buttons">
                    <button class="filter-btn active" data-filter="all">الكل</button>
                    <button class="filter-btn" data-filter="R">R</button>
                    <button class="filter-btn" data-filter="A">A</button>
                    <button class="filter-btn" data-filter="B">B</button>
                    <button class="filter-btn" data-filter="C">C</button>
                </div>
                <div class="sort-container">
                    <label for="agent-sort-select">ترتيب حسب:</label>
                    <select id="agent-sort-select">
                        <option value="newest">الأحدث أولاً</option>
                        <option value="name_asc">أبجدي (أ - ي)</option>
                    </select>
                </div>
            </div>
        </div>
        <div id="agent-table-container"></div>
    `;

    document.getElementById('add-agent-btn').addEventListener('click', () => {
        setActiveNav(null);
        window.location.hash = 'add-agent?returnTo=manage-agents';
    });

    // --- NEW: Add listener for bulk renew balances button ---
    const bulkRenewBtn = document.getElementById('bulk-renew-balances-btn');
    if (bulkRenewBtn) {
        bulkRenewBtn.addEventListener('click', () => {
            handleBulkRenewBalances();
        });
    }

    // --- NEW: Add listener for delete all agents button ---
    const deleteAllBtn = document.getElementById('delete-all-agents-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', () => {
            handleDeleteAllAgents();
        });
    }
    // تعديل: إضافة معالج لزر الإرسال الجماعي
    const bulkSendBtn = document.getElementById('bulk-send-balance-btn');
    if (bulkSendBtn) {
        bulkSendBtn.addEventListener('click', () => handleBulkSendBalances());
    }

    // --- NEW: Add listener for bulk add agents button ---
    const bulkAddBtn = document.getElementById('bulk-add-agents-btn');
    if (bulkAddBtn) {
        bulkAddBtn.addEventListener('click', () => {
            renderBulkAddAgentsModal();
        });
    }

    setupAgentFilters();
    await fetchAndDisplayAgents(1); // Initial fetch for page 1
}

function setupAgentFilters() {
    const searchInput = document.getElementById('agent-search-input');
    const clearBtn = document.getElementById('agent-search-clear');
    const filterButtons = document.querySelectorAll('.agent-filters .filter-btn');
    const sortSelect = document.getElementById('agent-sort-select');

    if (!searchInput) return;

    const triggerFetch = () => {
        fetchAndDisplayAgents(1); // Always go to page 1 when filters change
    };

    searchInput.addEventListener('input', triggerFetch);

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            triggerFetch();
            searchInput.focus();
        });
    }

    if (filterButtons.length) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                triggerFetch();
            });
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', triggerFetch);
    }
}

async function fetchAndDisplayAgents(page) {
    const container = document.getElementById('agent-table-container');
    if (!container) return;

    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    // Get filter and sort values from the UI
    const searchInput = document.getElementById('agent-search-input');
    const sortSelect = document.getElementById('agent-sort-select');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const classificationFilter = document.querySelector('.agent-filters .filter-btn.active')?.dataset.filter || 'all';
    const sortValue = sortSelect ? sortSelect.value : 'newest';

    if (document.getElementById('agent-search-clear')) {
        document.getElementById('agent-search-clear').style.display = searchTerm ? 'block' : 'none';
    }

    try {
        const queryParams = new URLSearchParams({
            page: page,
            limit: AGENTS_PER_PAGE,
            search: searchTerm,
            classification: classificationFilter,
            sort: sortValue
        });

        const response = await authedFetch(`/api/agents?${queryParams.toString()}`);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to fetch data from server.');
        }
        const { data: agents, count } = await response.json();

        displayAgentsPage(agents || [], page, count || 0);
    } catch (error) {
        console.error("Error fetching agents:", error);
        container.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات الوكلاء.</p>`;
        return;
    }
}

function displayAgentsPage(paginatedAgents, page, totalCount) {
    const container = document.getElementById('agent-table-container');
    if (!container) return;

    page = parseInt(page);
    const totalPages = Math.ceil(totalCount / AGENTS_PER_PAGE);
    
    const tableHtml = paginatedAgents.length > 0 ? `
        <table class="modern-table">
            <thead>
                <tr>
                    <th>الوكيل</th>
                    <th>رقم الوكالة</th>
                    <th>التصنيف</th>
                    <th>المرتبة</th>
                    <th>روابط التلجرام</th>
                    <th class="actions-column">الإجراءات</th>
                </tr>
            </thead>
            <tbody>
                ${paginatedAgents.map(agent => {
                    const avatarHtml = agent.avatar_url
                        ? `<img src="${agent.avatar_url}" alt="Avatar" class="avatar-small" loading="lazy">`
                        : `<div class="avatar-placeholder-small"><i class="fas fa-user"></i></div>`;
                    
                    return `
                        <tr data-agent-id="${agent._id}">
                            <td data-label="الوكيل">
                                <div class="table-agent-cell" style="cursor: pointer;">
                                    ${avatarHtml}
                                    <div class="agent-details">${agent.name}</div>
                                </div>
                            </td>
                            <td data-label="رقم الوكالة" class="agent-id-text" title="نسخ الرقم">${agent.agent_id}</td>
                            <td data-label="التصنيف"><span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span></td>
                            <td data-label="المرتبة">${agent.rank || 'غير محدد'}</td>
                            <td data-label="روابط التلجرام">
                                ${agent.telegram_channel_url ? `<a href="${agent.telegram_channel_url}" target="_blank" class="agent-table-link">القناة</a>` : ''}
                                ${agent.telegram_channel_url && agent.telegram_group_url ? ' | ' : ''}
                                ${agent.telegram_group_url ? `<a href="${agent.telegram_group_url}" target="_blank" class="agent-table-link">الجروب</a>` : ''}
                            </td>
                            <td class="actions-cell">
                                <button class="btn-secondary edit-btn btn-small"><i class="fas fa-edit"></i> تعديل</button>
                                <button class="btn-danger delete-btn btn-small"><i class="fas fa-trash-alt"></i> حذف</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    ` : '<p class="no-results-message">لا توجد وكلاء تطابق بحثك أو الفلتر الحالي.</p>';

    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml += '<div class="pagination-container">';
        paginationHtml += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>السابق</button>`;
        for (let i = 1; i <= totalPages; i++) {
            paginationHtml += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        paginationHtml += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي</button>`;
        paginationHtml += '</div>';
    }

    container.innerHTML = `<div class="table-responsive-container">${tableHtml}</div>${paginationHtml}`;

    attachCardEventListeners(page);
}

function attachCardEventListeners(currentPage) {
    const container = document.getElementById('agent-table-container');
    if (!container) return;

    // Event delegation for edit, delete, and pagination buttons
    container.addEventListener('click', (e) => {
        const agentCell = e.target.closest('.table-agent-cell');
        const agentIdText = e.target.closest('.agent-id-text');
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const link = e.target.closest('a');
        const paginationBtn = e.target.closest('.page-btn');

        // 1. نسخ رقم الوكالة
        if (agentIdText) {
            e.stopPropagation();
            const agentIdToCopy = agentIdText.textContent;
            navigator.clipboard.writeText(agentIdToCopy).then(() => showToast(`تم نسخ الرقم: ${agentIdToCopy}`, 'info'));
        }
        // 2. الانتقال للملف الشخصي عند الضغط على خلية الوكيل (الاسم/الصورة)
        else if (agentCell && !editBtn && !deleteBtn && !link) {
            const row = agentCell.closest('tr');
            if (row && row.dataset.agentId) {
                window.location.hash = `profile/${row.dataset.agentId}`;
            }
        }
        // 3. زر التعديل
        else if (editBtn) {
            const row = editBtn.closest('tr');
            if (row) window.location.hash = `profile/${row.dataset.agentId}/edit`;
        }
        // 4. زر الحذف
        else if (deleteBtn) {
            const row = deleteBtn.closest('tr');
            const agentId = row.dataset.agentId;
            const agentName = row.querySelector('.agent-details')?.textContent || 'وكيل غير معروف';
            showConfirmationModal(
                `هل أنت متأكد من حذف الوكيل "<strong>${agentName}</strong>"؟<br><small>سيتم حذف جميع بياناته المرتبطة بشكل دائم.</small>`,
                async () => {
                    // --- STEP 4: MIGRATION TO CUSTOM BACKEND ---
                    try {
                        const response = await authedFetch(`/api/agents/${agentId}`, {
                            method: 'DELETE',
                            // No 'Content-Type' for DELETE with no body
                            // headers: { 'Content-Type': 'application/json' }
                        });
                        if (!response.ok) {
                            const result = await response.json();
                            throw new Error(result.message || 'فشل حذف الوكيل.');
                        }
                        showToast('تم حذف الوكيل بنجاح.', 'success');
                        fetchAndDisplayAgents(currentPage);
                    } catch (error) {
                        showToast(`فشل حذف الوكيل: ${error.message}`, 'error');
                    }
                }, { title: 'تأكيد حذف الوكيل', confirmText: 'حذف نهائي', confirmClass: 'btn-danger' });
        }
        // 5. أزرار التنقل بين الصفحات
        else if (paginationBtn && !paginationBtn.disabled) {
            const newPage = paginationBtn.dataset.page;
            if (newPage) fetchAndDisplayAgents(parseInt(newPage));
        }
    });
}

// --- NEW: Delete All Agents Feature (Super Admin only) ---
async function handleDeleteAllAgents() {
    // --- تعديل: استخدام الواجهة الخلفية الجديدة لحذف جميع الوكلاء ---
    const modalContent = `
        <p class="warning-text" style="font-size: 1.1em;">
            <i class="fas fa-exclamation-triangle"></i> <strong>تحذير خطير!</strong> 
        </p>
        <p>أنت على وشك حذف <strong>جميع الوكلاء</strong> من النظام بشكل نهائي. هذا الإجراء لا يمكن التراجع عنه وسيزيل جميع بياناتهم ومسابقاتهم وسجلاتهم.</p>
        <p style="margin-top: 15px;">للتأكيد، يرجى كتابة كلمة "<strong>حذف</strong>" في الحقل أدناه:</p>
        <div class="form-group" style="margin-top: 10px;">
            <input type="text" id="delete-confirmation-input" class="modal-input" autocomplete="off">
        </div>
    `;
    showConfirmationModal(
        modalContent,
        async () => {
            const response = await authedFetch('/api/agents/delete-all', { method: 'DELETE' });
            if (response.ok) {
                showToast('تم حذف جميع الوكلاء بنجاح.', 'success');
                await fetchAndDisplayAgents(1);
            } else {
                const result = await response.json();
                showToast(result.message || 'فشل حذف جميع الوكلاء.', 'error');
            }
        },
        {
            title: 'تأكيد الحذف النهائي',
            confirmText: 'نعم، أحذف الكل',
            confirmClass: 'btn-danger',
            onRender: (modal) => {
                const confirmBtn = modal.querySelector('#confirm-btn');
                const confirmationInput = modal.querySelector('#delete-confirmation-input');
                confirmBtn.disabled = true; // Disable by default

                confirmationInput.addEventListener('input', () => {
                    if (confirmationInput.value.trim() === 'حذف') {
                        confirmBtn.disabled = false;
                        confirmBtn.classList.add('pulse-animation');
                    } else {
                        confirmBtn.disabled = true;
                        confirmBtn.classList.remove('pulse-animation');
                    }
                });
            }
        }
    );
}

// --- NEW: Bulk Renew Balances Feature ---
async function handleBulkRenewBalances() {
    showConfirmationModal(
        'هل أنت متأكد من رغبتك في تجديد أرصدة جميع الوكلاء؟<br><small>سيتم تحويل <strong>الرصيد المستهلك</strong> إلى <strong>الرصيد المتبقي</strong> لكل وكيل.</small>',
        async () => {
            console.log('[Bulk Renew] Starting bulk renewal process from frontend.');
            // Show a progress modal
            const progressModalOverlay = showProgressModal(
                'تجديد الأرصدة الجماعي',
                `
                <div class="update-progress-container">
                    <i class="fas fa-sync-alt fa-spin update-icon"></i>
                    <h3 id="bulk-renew-status-text">جاري التهيئة...</h3>
                    <div class="progress-bar-outer">
                        <div id="bulk-renew-progress-bar-inner" class="progress-bar-inner"></div>
                    </div>
                </div>
                `
            );

            const statusText = document.getElementById('bulk-renew-status-text');
            const progressBar = document.getElementById('bulk-renew-progress-bar-inner');
            const updateIcon = progressModalOverlay.querySelector('.update-icon');

            try {
                statusText.textContent = 'جاري معالجة طلب التجديد...';
                progressBar.style.width = '50%';
                console.log('[Bulk Renew] Sending request to /api/agents/bulk-renew');

                const response = await authedFetch('/api/agents/bulk-renew', { method: 'POST' });
                const result = await response.json();

                console.log('[Bulk Renew] Received response from backend:', result);
                if (!response.ok) {
                    throw new Error(result.message || 'فشل تجديد الأرصدة.');
                }

                progressBar.style.width = '100%';
                statusText.innerHTML = `اكتمل التجديد بنجاح.<br><strong>${result.processedCount}</strong> وكيل تم تجديد رصيده.`;
                updateIcon.className = 'fas fa-check-circle update-icon';
                progressBar.style.backgroundColor = 'var(--success-color)';

                console.log(`[Bulk Renew] Success. ${result.processedCount} agents renewed.`);
                await logAgentActivity(null, 'BULK_RENEWAL', `تم تجديد أرصدة ${result.processedCount} وكيل.`);
                await fetchAndDisplayAgents(1); // Refresh the agents list

            } catch (error) {
                console.error('[Bulk Renew] Frontend error during renewal:', error);
                statusText.innerHTML = `فشل التجديد.<br><small>${error.message}</small>`;
                updateIcon.className = 'fas fa-times-circle update-icon';
                progressBar.style.backgroundColor = 'var(--danger-color)';
            } finally {
                // --- NEW: Automatically close the progress modal after 4 seconds ---
                setTimeout(() => {
                    if (progressModalOverlay) progressModalOverlay.remove();
                }, 4000);
            }
        }, { title: 'تأكيد تجديد الأرصدة', confirmText: 'نعم، جدد الآن', confirmClass: 'btn-renewal' }
    );
}

async function handleMarkAllTasksComplete() {
    // 1. جلب وكلاء اليوم
    // --- تعديل: استخدام الواجهة الخلفية الجديدة لجلب وكلاء اليوم ---
    const response = await authedFetch('/api/agents?for_tasks=today&select=_id');
    if (!response.ok) {
        showToast('فشل جلب قائمة وكلاء اليوم.', 'error');
        return;
    }
    const { data: agentsForToday } = await response.json();
    
    if (!agentsForToday || agentsForToday.length === 0) {
        showToast('لا توجد مهام مجدولة لهذا اليوم.', 'info');
        return;
    }
    // 2. إظهار نافذة التأكيد
    showConfirmationModal(
        `هل أنت متأكد من تمييز جميع مهام اليوم (${agentsForToday.length} وكيل) كمكتملة؟`,
        async () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const agentIds = agentsForToday.map(agent => agent._id);

            // --- تعديل: استخدام الواجهة الخلفية الجديدة لتحديث المهام ---
            const completeResponse = await authedFetch('/api/tasks/bulk-complete', {
                method: 'POST',
                body: JSON.stringify({ agentIds, date: todayStr })
            });

            if (!completeResponse.ok) {
                showToast('فشل تحديث المهام بشكل جماعي.', 'error');
            } else {
                showToast('تم تمييز جميع المهام كمكتملة بنجاح.', 'success');
                // The tasks page is not currently rendered, so no need to refresh it.
            }
        }, { title: 'تأكيد إكمال جميع المهام', confirmText: 'نعم، إكمال الكل', confirmClass: 'btn-primary' }
    );
}

async function handleBulkSendBalances() {
    // تعديل: جلب الوكلاء المؤهلين من الواجهة الخلفية الجديدة
    const response = await authedFetch('/api/agents?eligibleForBalance=true');
    if (!response.ok) {
        showToast('فشل جلب بيانات الوكلاء المؤهلين.', 'error');
        return;
    }
    const { data: eligibleAgents, error: fetchError } = await response.json();

    if (fetchError) {
        showToast('فشل جلب بيانات الوكلاء المؤهلين.', 'error');
        return;
    }

    const agentCount = eligibleAgents.length;

    if (agentCount === 0) {
        showToast('لا يوجد وكلاء مؤهلون (لديهم معرف دردشة ورصيد متاح) لإرسال التعميم.', 'info');
        return;
    }

    const modalContent = `
        <p>سيتم إرسال كليشة الرصيد المتاح إلى <strong>${agentCount}</strong> وكيل مؤهل.</p>
        <p>سيتم تجهيز رسالة فريدة لكل وكيل تحتوي على تفاصيل رصيده وبونص الإيداع الخاص به.</p>
        <p class="warning-text" style="margin-top: 15px;"><i class="fas fa-exclamation-triangle"></i> هل أنت متأكد من المتابعة؟</p>
    `;

    showConfirmationModal(
        modalContent,
        async () => {
            showBulkSendProgressModal(agentCount);

            let successCount = 0;
            let errorCount = 0;
            const progressBar = document.getElementById('bulk-send-progress-bar-inner');
            const statusText = document.getElementById('bulk-send-status-text');
            const renewalPeriodMap = {
                'weekly': 'أسبوعي',
                'biweekly': 'كل أسبوعين',
                'monthly': 'شهري'
            };

            for (let i = 0; i < eligibleAgents.length; i++) {
                const agent = eligibleAgents[i];
                
                // بناء الرسالة الخاصة بكل وكيل
                const renewalText = renewalPeriodMap[agent.renewal_period] || 'تداولي';
                let benefitsText = '';
                if ((agent.remaining_balance || 0) > 0) {
                    benefitsText += `💰 <b>رصيد مسابقات (${renewalText}):</b> <code>${agent.remaining_balance}$</code>\n`;
                }
                if ((agent.remaining_deposit_bonus || 0) > 0) {
                    benefitsText += `🎁 <b>بونص ايداع:</b> <code>${agent.remaining_deposit_bonus}</code> مرات بنسبة <code>${agent.deposit_bonus_percentage || 0}%</code>\n`;
                }

                const clicheText = `<b>دمت بخير شريكنا العزيز ${agent.name}</b> ...\n\nيسرنا ان نحيطك علما بأن حضرتك كوكيل لدى شركة انزو تتمتع بالمميزات التالية:\n\n${benefitsText.trim()}\n\nبامكانك الاستفادة منه من خلال انشاء مسابقات اسبوعية لتنمية وتطوير العملاء التابعين للوكالة.\n\nهل ترغب بارسال مسابقة لحضرتك؟`; // This will be migrated later

                // --- STEP 6: MIGRATION - Temporarily disable sending to Telegram ---
                try {
                    const response = await fetch('/api/post-announcement', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: clicheText, chatId: agent.telegram_chat_id })
                    });

                    if (!response.ok) errorCount++;
                    else successCount++;

                } catch (e) {
                    errorCount++;
                }

                const progress = Math.round(((i + 1) / agentCount) * 100);
                progressBar.style.width = `${progress}%`;
                statusText.innerHTML = `جاري إرسال الأرصدة... (${i + 1} / ${agentCount})<br>نجح: ${successCount} | فشل: ${errorCount}`;
                // إصلاح: نقل التأخير الزمني إلى داخل الحلقة ليعمل بشكل صحيح
                if (i < eligibleAgents.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 400)); // 400ms delay
                }
            } // نهاية الحلقة for

            // Update modal with final result
            statusText.innerHTML = `اكتمل تعميم الأرصدة.<br><strong>${successCount}</strong> رسالة ناجحة | <strong>${errorCount}</strong> رسالة فاشلة.`;
            progressBar.style.backgroundColor = errorCount > 0 ? 'var(--danger-color)' : 'var(--success-color)';
            document.querySelector('.modal-no-actions .update-icon').className = 'fas fa-check-circle update-icon';
            await logAgentActivity(null, 'BULK_BALANCE_SENT', `تم تعميم الأرصدة إلى ${successCount} وكيل (فشل ${errorCount}).`);

            // --- تعديل: إخفاء نافذة التقدم تلقائياً بعد 3 ثوانٍ ---
            setTimeout(() => {
                // ابحث عن النافذة المنبثقة النشطة وقم بإزالتها
                const modalOverlay = document.querySelector('.modal-overlay');
                if (modalOverlay) {
                    modalOverlay.remove();
                }
            }, 3000); // إغلاق بعد 3 ثوانٍ
        }, {
            title: 'تعميم الأرصدة المتاحة',
            confirmText: 'إرسال الآن',
            confirmClass: 'btn-telegram-bonus',
            cancelText: 'إلغاء',
            modalClass: 'modal-wide'
        }
    );
}


function showBulkSendProgressModal(total) {
    const modalContent = `
        <div class="update-progress-container">
            <i class="fas fa-paper-plane update-icon"></i>
            <h3 id="bulk-send-status-text">جاري التهيئة لإرسال ${total} رسالة...</h3>
            <div class="progress-bar-outer">
                <div id="bulk-send-progress-bar-inner" class="progress-bar-inner"></div>
            </div>
        </div>
    `;
    showConfirmationModal(modalContent, null, {
        title: 'عملية الإرسال الجماعي',
        showCancel: false,
        showConfirm: false,
        modalClass: 'modal-no-actions'
    });
}

async function renderMiniCalendar() {
    const wrapper = document.getElementById('tasks-calendar-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = `
        <div class="page-header" style="padding: 0; border: none;">
            <div class="header-top-row">
                <h2>التقويم</h2>
            </div>
        </div>
        <div id="mini-calendar-container"></div>
    `;

    const calendarContainer = document.getElementById('mini-calendar-container');
    const today = new Date();
    const month = today.getMonth();


    const year = today.getFullYear();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let calendarHtml = `
        <div class="mini-calendar-header">
            <span class="month-year">${today.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div class="mini-calendar-grid">
            ${['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map(day => `<div class="day-name">${day}</div>`).join('')}
    `;

    // Add empty cells for the first day of the week
    for (let i = 0; i < firstDay; i++) {
        calendarHtml += '<div></div>';
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === today.getDate();
        calendarHtml += `<div class="day-cell ${isToday ? 'today' : ''}">${day}</div>`;
    }

    calendarHtml += '</div>';
    calendarContainer.innerHTML = calendarHtml;
}

function generateAgentCard(agent) {
    return `
        <div class="agent-card">
            <div class="agent-avatar">
                ${agent.avatar_url ? 
                    `<img src="${agent.avatar_url}" alt="${agent.name}">` : 
                    `<div class="avatar-placeholder"><i class="fas fa-user"></i></div>`
                }
            </div>
            <div class="agent-info">
                <h3>${agent.name}</h3>
                <span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>
                ${agent.is_exclusive ? '<div class="exclusive-badge"><i class="fas fa-star"></i> حصري</div>' : ''}
            </div>
        </div>
    `;
}

function showBulkSendProgressModal(total) {
    const modalContent = `
        <div class="update-progress-container">
            <i class="fas fa-paper-plane update-icon"></i>
            <h3 id="bulk-send-status-text">جاري التهيئة لإرسال ${total} رسالة...</h3>
            <div class="progress-bar-outer">
                <div id="bulk-send-progress-bar-inner" class="progress-bar-inner"></div>
            </div>
        </div>
    `;
    showConfirmationModal(modalContent, null, {
        title: 'عملية الإرسال الجماعي',
        showCancel: false,
        showConfirm: false,
        modalClass: 'modal-no-actions'
    });
}
