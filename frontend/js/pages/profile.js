let competitionCountdownIntervals = [];
const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function stopCompetitionCountdowns() {
    competitionCountdownIntervals.forEach(clearInterval);
    competitionCountdownIntervals = [];
}

function stopAllProfileTimers() {
    // A single function to clean up all timers when leaving the profile page.
    // This ensures complete separation.
    stopCompetitionCountdowns();
}

async function renderAgentProfilePage(agentId, options = {}) {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = '';

    if (!authedFetch) { // Check if authedFetch is available (it's a placeholder for now)
        appContent.innerHTML = `<p class="error">لا يمكن عرض الملف الشخصي، لم يتم الاتصال بقاعدة البيانات.</p>`;
        return;
    }

    // Clear any previous timers from other profiles
    stopAllProfileTimers();

    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const agentPerms = currentUserProfile?.permissions?.agents || {};
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';
    const compsPerms = currentUserProfile?.permissions?.competitions || {};
    const canViewFinancials = isSuperAdmin || isAdmin; // تعديل: السماح للمسؤول برؤية التفاصيل دائماً
    const canEditProfile = isAdmin;
    const canEditFinancials = isSuperAdmin || isAdmin; // تعديل: السماح للمسؤول بتعديل البيانات المالية دائماً
    const canViewAgentComps = isAdmin || agentPerms.can_view_competitions_tab; // المسؤولون لديهم صلاحية عرض المسابقات دائماً
    const canCreateComp = isAdmin || compsPerms.can_create; // المسؤولون لديهم صلاحية إنشاء المسابقات دائماً
    const canEditComps = isAdmin || compsPerms.manage_comps === 'full'; // FIX: Define the missing permission variable

    // Check for edit mode in hash, e.g., #profile/123/edit
    const hashParts = window.location.hash.split('/');
    const startInEditMode = hashParts.includes('edit');
    const defaultTab = options.activeTab || 'action';

    // --- STEP 5: MIGRATION TO CUSTOM BACKEND ---
    let agent = null;
    let error = null;
    try {
        const response = await authedFetch(`/api/agents/${agentId}`);
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || 'فشل جلب بيانات الوكيل.');
        }
        const result = await response.json();
        agent = result.data;
    } catch (e) {
        error = e;
    }

    try {
        const compResponse = await authedFetch(`/api/competitions?agentId=${agentId}&limit=100&sort=newest`); // Fetch up to 100 competitions for the agent
        const logUrl = `/api/logs?agent_id=${agentId}&limit=50&populate=user`;
        const logResponse = await authedFetch(logUrl); // Fetch latest 50 logs for the agent

        if (compResponse.ok) {
            const compResult = await compResponse.json();
            var agentCompetitions = compResult.data || [];
        }
        if (logResponse.ok) {
            const logResult = await logResponse.json();
            var agentLogs = logResult.data || [];
        }
    } catch (compError) {
    }
    if (error || !agent) {
        appContent.innerHTML = `<p class="error">فشل العثور على الوكيل المطلوب.</p>`;
        return;
    }

    // --- NEW: Fetch today's task status for this agent ---
    const today = new Date();
    const todayDayIndex = today.getDay();
    const todayStr = today.toISOString().split('T')[0];
    let agentTaskToday = {};
    let isTaskDay = (agent.audit_days || []).includes(todayDayIndex);

    // --- STEP 5: MIGRATION - Temporarily disable fetching daily tasks ---
    // if (isTaskDay) {
    //     const { data: taskData, error: taskError } = await supabase
    //         .from('daily_tasks')
    //         .select('*')
    //         .eq('agent_id', agentId)
    //         .eq('task_date', todayStr)
    //         .maybeSingle(); // FIX: Use maybeSingle() to prevent errors from duplicate entries.
    //     if (taskData) agentTaskToday = taskData;
    // }
    // --- End new fetch ---

    const hasActiveCompetition = agentCompetitions.some(c => c.is_active);
    const activeCompetition = agentCompetitions.find(c => c.is_active);
    const hasInactiveCompetition = !hasActiveCompetition && agentCompetitions.length > 0;

    let activeCompetitionCountdownHtml = '';
    if (activeCompetition && activeCompetition.ends_at) {
        const endDate = new Date(activeCompetition.ends_at);
        if (endDate.getTime() > new Date().getTime()) {
            // The content will be filled by the live countdown timer
            activeCompetitionCountdownHtml = `<div class="competition-countdown-header" data-end-date="${activeCompetition.ends_at}">
                <i class="fas fa-clock"></i> 
                <span>جاري حساب الوقت...</span>
            </div>`;
        }
    }

    // --- NEW: Prepare task icons for the header ---
    let taskIconsHtml = '';
    if (isTaskDay) {
        const needsAudit = !agentTaskToday.audited;
        const needsCompetition = !agentTaskToday.competition_sent;
        taskIconsHtml = `<div class="profile-task-icons">${needsAudit ? '<i class="fas fa-clipboard-check pending-icon-audit" title="مطلوب تدقيق اليوم"></i>' : ''}${needsCompetition ? '<i class="fas fa-trophy pending-icon-comp" title="مطلوب إرسال مسابقة اليوم"></i>' : ''}</div>`;
    }
    // Helper for audit days in Action Tab
    // --- تعديل: عرض أيام التدقيق المحددة فقط كعلامات (tags) ---
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const auditDaysHtml = (agent.audit_days && agent.audit_days.length > 0)
        ? `<div class="audit-days-display">${agent.audit_days.sort().map(dayIndex => `<span class="day-tag">${dayNames[dayIndex]}</span>`).join('')}</div>`
        : '<span class="day-tag-none">لا توجد أيام محددة</span>';
    appContent.innerHTML = `
        <div class="profile-page-top-bar">
            <button id="back-btn" class="btn-secondary">&larr; عودة</button>
            <div id="renewal-date-display" class="countdown-timer" style="display: none;"></div>
        </div>
        
        <div class="profile-header-v2">
            <div class="profile-avatar">
                ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Avatar">` : '<i class="fas fa-user-astronaut"></i>'}
            </div>
            <div class="profile-main-info" data-agent-id="${agent._id}">
                <h1>
                    ${agent.name} 
                    ${taskIconsHtml}
                    ${hasActiveCompetition ? `<span class="status-badge active">مسابقة نشطة</span>${activeCompetitionCountdownHtml}` : ''}
                    ${hasInactiveCompetition ? '<span class="status-badge inactive">مسابقة غير نشطة</span>' : ''}
                </h1>
                <p>رقم الوكالة: <strong class="agent-id-text" title="نسخ الرقم">${agent.agent_id}</strong> | التصنيف: ${agent.classification} | المرتبة: ${agent.rank || 'غير محدد'}</p>
                <p>روابط التلجرام: ${agent.telegram_channel_url ? `<a href="${agent.telegram_channel_url}" target="_blank">القناة</a>` : 'القناة (غير محدد)'} | ${agent.telegram_group_url ? `<a href="${agent.telegram_group_url}" target="_blank">الجروب</a>` : 'الجروب (غير محدد)'}</p>
                <p>معرف الدردشة: ${agent.telegram_chat_id ? `<code>${agent.telegram_chat_id}</code>` : 'غير محدد'} | اسم المجموعة: <strong>${agent.telegram_group_name || 'غير محدد'}</strong></p>
            </div>
            <div class="profile-header-actions">
                <button id="edit-profile-btn" class="btn-secondary"><i class="fas fa-user-edit"></i> تعديل</button>
            </div>
        </div>

        <div class="tabs">
            <button class="tab-link active" data-tab="action">Action</button>
            <button class="tab-link" data-tab="details">تفاصيل</button>
            <button class="tab-link" data-tab="agent-competitions">المسابقات</button>
            <button class="tab-link" data-tab="log">سجل</button>
            ${(isSuperAdmin || isAdmin) ? '<button class="tab-link" data-tab="analytics">تحليلات</button>' : ''}
        </div>

        <div id="tab-action" class="tab-content active">
            <div class="action-tab-grid">
                <div class="action-section">
                    <h2><i class="fas fa-info-circle"></i> بيانات تلقائية</h2>
                    <div class="action-info-grid">
                        <div class="action-info-card">
                            <i class="fas fa-calendar-check"></i>
                            <div class="info">
                                <label>أيام التدقيق</label>
                                <div class="value-group">${auditDaysHtml}</div>
                            </div>
                        </div>
                        <div class="action-info-card">
                            <i class="fas fa-wallet"></i>
                            <div class="info">
                                <label>الرصيد المتبقي</label>
                                <p>$${agent.remaining_balance || 0}</p>
                            </div>
                        </div>
                        <div class="action-info-card">
                            <i class="fas fa-gift"></i>
                            <div class="info">
                                <label>بونص الإيداع</label>
                                <p>${agent.remaining_deposit_bonus || 0} <span class="sub-value">مرات بنسبة</span> ${agent.deposit_bonus_percentage || 0}%</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="action-section">
                    <h2><i class="fas fa-rocket"></i> إجراءات سريعة</h2>
                    <div class="details-actions">
                        <button id="create-agent-competition" class="btn-primary"><i class="fas fa-magic"></i> إنشاء مسابقة</button>
                        <button id="send-bonus-cliche-btn" class="btn-telegram-bonus"><i class="fas fa-paper-plane"></i> إرسال كليشة البونص</button>
                        <button id="send-winners-cliche-btn" class="btn-telegram-winners"><i class="fas fa-trophy"></i> إرسال كليشة الفائزين</button>
                        <button id="manual-renew-btn" class="btn-renewal"><i class="fas fa-sync-alt"></i> تجديد الرصيد يدوياً</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="tab-details" class="tab-content">
            <!-- Content will be rendered here -->
        </div>
        <div id="tab-agent-competitions" class="tab-content">
            <!-- Content will be rendered here -->
        </div>
        <div id="tab-log" class="tab-content">
            <h2>سجل النشاط</h2>
            <p>لا توجد سجلات حالياً لهذا الوكيل.</p>
        </div>
        <div id="tab-analytics" class="tab-content">
            <!-- Analytics content will be rendered here -->
        </div>
    `;
 
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.hash = '#manage-agents';
    });

    // Click to copy agent ID from header
    const agentIdEl = appContent.querySelector('.profile-main-info .agent-id-text');
    if (agentIdEl) {
        agentIdEl.addEventListener('click', () => {
            navigator.clipboard.writeText(agent.agent_id).then(() => showToast(`تم نسخ الرقم: ${agent.agent_id}`, 'info'));
        });
    }

    const createCompBtn = document.getElementById('create-agent-competition');
    if (createCompBtn) {
        if (canCreateComp) { // This will be migrated later
            createCompBtn.addEventListener('click', () => window.location.hash = `competitions/new?agentId=${agent._id}`);
        } else {
            createCompBtn.addEventListener('click', () => showToast('ليس لديك صلاحية لإنشاء مسابقة.', 'error'));
        }
    }

    // --- Manual Renewal Button Logic ---
    document.getElementById('manual-renew-btn').addEventListener('click', async () => {
        if (!agent.renewal_period || agent.renewal_period === 'none') {
            showToast('لا يوجد نظام تجديد مفعل لهذا الوكيل.', 'info');
            return;
        }

        // Calculate next renewal date (same logic as the countdown)
        const renewalBtn = document.getElementById('manual-renew-btn');
        const lastRenewal = agent.last_renewal_date ? new Date(agent.last_renewal_date) : new Date(agent.created_at);
        let nextRenewalDate = new Date(lastRenewal);
        if (agent.renewal_period === 'weekly') nextRenewalDate.setDate(lastRenewal.getDate() + 7);
        else if (agent.renewal_period === 'biweekly') nextRenewalDate.setDate(lastRenewal.getDate() + 14);
        else if (agent.renewal_period === 'monthly') nextRenewalDate.setMonth(lastRenewal.getMonth() + 1);

        if (new Date() < nextRenewalDate) {
            const remainingTime = nextRenewalDate - new Date();
            const days = Math.ceil(remainingTime / (1000 * 60 * 60 * 24)); // Use ceil to show "1 day" for any remaining time
            showToast(`لا يمكن التجديد الآن. متبقي ${days} يوم.`, 'warning');
            return;
        }

        // If eligible, show confirmation
        showConfirmationModal(
            `هل أنت متأكد من تجديد رصيد الوكيل <strong>${agent.name}</strong> يدوياً؟`,
            async () => {
                const updateData = {
                    consumed_balance: 0,
                    remaining_balance: agent.competition_bonus,
                    used_deposit_bonus: 0,
                    remaining_deposit_bonus: agent.deposit_bonus_count,
                    last_renewal_date: new Date().toISOString()
                };

                // --- STEP 5: MIGRATION TO CUSTOM BACKEND ---
                try {
                    const response = await authedFetch(`/api/agents/${agent._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    });
                    if (!response.ok) {
                        const result = await response.json();
                        throw new Error(result.message || 'فشل تجديد الرصيد.');
                    }
                    await logAgentActivity(agent._id, 'MANUAL_RENEWAL', 'تم تجديد الرصيد يدوياً.');
                    showToast('تم تجديد الرصيد بنجاح.', 'success');
                    renderAgentProfilePage(agent._id, { activeTab: 'action' }); // Re-render the page
                } catch (error) {
                    showToast(`فشل تجديد الرصيد: ${error.message}`, 'error');
                }
            },
            {
                title: 'تأكيد التجديد اليدوي',
                confirmText: 'نعم، جدد الآن',
                confirmClass: 'btn-renewal'
            }
        );
    });

    document.getElementById('send-bonus-cliche-btn').addEventListener('click', async () => {
        // 1. Construct the message
        const baseLine = `يسرنا ان نحيطك علما بأن حضرتك كوكيل لدى شركة انزو تتمتع برصيد مسابقات:`;

        // --- NEW: Add renewal period text ---
        const renewalPeriodMap = {
            'weekly': 'أسبوعي',
            'biweekly': 'كل أسبوعين',
            'monthly': 'شهري'
        };
        const renewalValue = (agent.renewal_period && agent.renewal_period !== 'none') 
            ? (renewalPeriodMap[agent.renewal_period] || '')
            : '';

        // --- تعديل: بناء نص المميزات حسب الشكل الجديد ---
        let benefitsText = '';
        const remainingBalance = agent.remaining_balance || 0;
        const remainingDepositBonus = agent.remaining_deposit_bonus || 0;

        if (remainingBalance > 0) {
            benefitsText += `💰 <b>بونص تداولي:</b> <code>${remainingBalance}$</code>\n`;
        }
        if (remainingDepositBonus > 0) {
            benefitsText += `🎁 <b>بونص ايداع:</b> <code>${remainingDepositBonus}</code> مرات بنسبة <code>${agent.deposit_bonus_percentage || 0}%</code>\n`;
        }

        // إذا لم تكن هناك أي مميزات، لا تقم بالإرسال
        if (!benefitsText.trim()) {
            showToast('لا توجد أرصدة متاحة لإرسال كليشة البونص لهذا الوكيل.', 'info');
            return;
        }
        
        const clicheText = `<b>دمت بخير شريكنا العزيز ${agent.name}</b> ...

${baseLine}
${renewalValue ? `(<b>${renewalValue}</b>):\n\n` : ''}${benefitsText.trim()}

بامكانك الاستفادة منه من خلال انشاء مسابقات اسبوعية لتنمية وتطوير العملاء التابعين للوكالة.

هل ترغب بارسال مسابقة لحضرتك؟`;

        // --- Verification Logic ---
        let targetGroupInfo = 'المجموعة العامة';
        if (agent.telegram_chat_id && agent.telegram_group_name) {
            try {
                showToast('جاري التحقق من بيانات المجموعة...', 'info');
                const response = await authedFetch(`/api/get-chat-info?chatId=${agent.telegram_chat_id}`);
                const data = await response.json();

                if (!response.ok) throw new Error(data.message);

                const actualGroupName = data.title;
                if (actualGroupName.trim() !== agent.telegram_group_name.trim()) {
                    showToast(`<b>خطأ في التحقق:</b> اسم المجموعة المسجل (<b>${agent.telegram_group_name}</b>) لا يطابق الاسم الفعلي على تلجرام (<b>${actualGroupName}</b>). يرجى تصحيح البيانات.`, 'error');
                    return; // Stop the process
                }
                // Verification successful
                targetGroupInfo = `مجموعة الوكيل: <strong>${agent.telegram_group_name}</strong> (تم التحقق بنجاح)`;

            } catch (error) {
                showToast(`فشل التحقق من المجموعة: ${error.message}`, 'error');
                return; // Stop the process
            }
        } else if (agent.telegram_chat_id) {
            showToast('لا يمكن التحقق. اسم المجموعة غير مسجل لهذا الوكيل.', 'warning');
            return;
        }
        // --- End Verification Logic ---

        // Show confirmation modal only after successful verification (if applicable)
        showConfirmationModal(
            `<p>سيتم إرسال الرسالة إلى: ${targetGroupInfo}. هل أنت متأكد من المتابعة؟</p>
             <textarea class="modal-textarea-preview" readonly>${clicheText}</textarea>`,
            async () => {
                try {
                    const response = await authedFetch('/api/post-announcement', {
                        method: 'POST',
                        body: JSON.stringify({ message: clicheText, chatId: agent.telegram_chat_id })
                    });
                    if (!response.ok) {
                        const result = await response.json();
                        throw new Error(result.message || 'فشل الاتصال بالخادم.');
                    }
                    showToast('تم إرسال كليشة البونص إلى تلجرام بنجاح.', 'success');
                    await logAgentActivity(agent._id, 'BONUS_CLICHE_SENT', 'تم إرسال كليشة تذكير البونص إلى تلجرام.');
                } catch (error) {
                    showToast(`فشل إرسال الكليشة: ${error.message}`, 'error');
                }
            },
            {
                title: 'إرسال رسالة البونص',
                confirmText: 'إرسال',
                confirmClass: 'btn-telegram-bonus',
                modalClass: 'modal-wide'
            }
        );
    });

    document.getElementById('send-winners-cliche-btn').addEventListener('click', () => {
        const targetGroup = agent.telegram_group_name && agent.telegram_chat_id 
            ? `مجموعة الوكيل: <strong>${agent.telegram_group_name}</strong>` 
            : 'المجموعة العامة';


        const clicheText = `دمت بخير شريكنا العزيز ${agent.name}،

يرجى اختيار الفائزين بالمسابقة الاخيرة التي تم انتهاء مدة المشاركة بها 
وتزويدنا بفيديو الروليت والاسم الثلاثي و معلومات الحساب لكل فائز قبل الاعلان عنهم في قناتكم كي يتم التحقق منهم من قبل القسم المختص

الإجابة الصحيحة هي :${activeCompetition?.correct_answer}
كما يجب اختيار الفائزين بالقرعة لشفافية الاختيار.`;

        // Show confirmation modal before sending
        showConfirmationModal(
            `<p>سيتم إرسال الرسالة إلى: ${targetGroup}. هل أنت متأكد من المتابعة؟</p>
             <textarea class="modal-textarea-preview" readonly>${clicheText}</textarea>`,
            async () => {
                // Send to backend on confirmation
                try {
                    const response = await authedFetch('/api/post-announcement', { // This will be migrated later
                        method: 'POST',
                        body: JSON.stringify({ message: clicheText, chatId: agent.telegram_chat_id })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'فشل الاتصال بالخادم.');

                    showToast('تم إرسال طلب اختيار الفائزين إلى تلجرام بنجاح.', 'success');
                    await logAgentActivity(agent._id, 'WINNERS_SELECTION_REQUESTED', `تم إرسال طلب اختيار الفائزين لمسابقة الوكيل ${agent.name}.`);
                } catch (error) {
                    showToast(`فشل إرسال الطلب: ${error.message}`, 'error');
                }
            },
            {
                title: 'طلب اختيار الفائزين',
                confirmText: 'إرسال',
                confirmClass: 'btn-telegram-winners',
                modalClass: 'modal-wide'
            }
        );
    });

    const editBtn = document.getElementById('edit-profile-btn');
    if (editBtn) {
        if (canEditProfile) { // This will be migrated later
            editBtn.addEventListener('click', () => renderEditProfileHeader(agent));
        } else {
            editBtn.addEventListener('click', () => showToast('ليس لديك صلاحية لتعديل بيانات الوكيل.', 'error'));
        }
    }

    if (startInEditMode) {
        editBtn.click();
    }

    // Tab switching logic
    const tabLinks = appContent.querySelectorAll('.tab-link');
    const tabContents = appContent.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.dataset.tab;

            // Deactivate all
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activate the clicked one
            link.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });

    // Set the default active tab
    appContent.querySelector(`.tab-link[data-tab="${defaultTab}"]`)?.click();

    // Render competitions in the log tab
    const detailsTabContent = document.getElementById('tab-details');
    const logTabContent = document.getElementById('tab-log');
    const agentCompetitionsContent = document.getElementById('tab-agent-competitions'); // This will be migrated later
    const analyticsTabContent = document.getElementById('tab-analytics');

    // --- NEW: Render tab content based on permissions ---
    if (detailsTabContent) {
        if (!canViewFinancials) {
            detailsTabContent.innerHTML = `
                <div class="access-denied-container">
                    <i class="fas fa-lock"></i>
                    <h2>ليس لديك صلاحية وصول</h2>
                    <p>أنت لا تملك الصلاحية اللازمة لعرض التفاصيل المالية لهذا الوكيل.</p>
                </div>`;
        } else {
            renderDetailsView(agent);
        }
    }

    if (logTabContent) {
        if (agentLogs && agentLogs.length > 0) {
            logTabContent.innerHTML = generateActivityLogHTML(agentLogs, true); // Pass true to indicate it's for a single agent
        } else {
            logTabContent.innerHTML = '<h2>سجل النشاط</h2><p>لا توجد سجلات حالياً لهذا الوكيل.</p>';
        }
    }
    // This will be migrated later
    if (analyticsTabContent && (isSuperAdmin || isAdmin)) {
        // Render analytics tab content
        renderAgentAnalytics(agent, analyticsTabContent);
    }
    if (agentCompetitionsContent) {
        if (agentCompetitions && agentCompetitions.length > 0) {
            if (!canViewAgentComps) {
                agentCompetitionsContent.innerHTML = `
                    <div class="access-denied-container"> 
                        <i class="fas fa-lock"></i>
                        <h2>ليس لديك صلاحية وصول</h2>
                        <p>أنت لا تملك الصلاحية اللازمة لعرض مسابقات هذا الوكيل.</p>
                    </div>`;
                // Stop further processing for this tab
                startCompetitionCountdowns(); // Still need to start other timers
                return;
            }
            const activeAndPendingCompetitions = agentCompetitions.filter(c => c.status !== 'completed');
            const completedCompetitions = agentCompetitions.filter(c => c.status === 'completed');

            const renderCompetitionList = (competitions) => {
                return competitions.map(comp => {
                    const endDate = comp.ends_at ? new Date(comp.ends_at) : null;
                    let countdownHtml = '';
                    if (endDate && comp.status !== 'completed' && comp.status !== 'awaiting_winners') {
                        const diffTime = endDate.getTime() - new Date().getTime();
                        if (diffTime > 0) {
                            countdownHtml = `<div class="competition-countdown" data-end-date="${comp.ends_at}"><i class="fas fa-hourglass-half"></i> <span>جاري حساب الوقت...</span></div>`;
                        } else {
                            countdownHtml = `<div class="competition-countdown expired"><i class="fas fa-hourglass-end"></i> في انتظار المعالجة...</div>`;
                        }
                    }

                    const statusSteps = {
                        'sent': { text: 'تم الإرسال', step: 1, icon: 'fa-paper-plane' },
                        'awaiting_winners': { text: 'في انتظار الفائزين', step: 2, icon: 'fa-user-clock' },
                        'completed': { text: 'مكتملة', step: 3, icon: 'fa-check-double' }
                    };
                    const currentStatus = statusSteps[comp.status] || statusSteps['sent'];

                    const progressBarHtml = `
                        <div class="stepper-wrapper step-${currentStatus.step}">
                            ${Object.values(statusSteps).map((s, index) => {
                                const isLineCompleted = currentStatus.step > index + 1; // Line is complete if the next step is reached
                                return `
                                <div class="stepper-item ${currentStatus.step >= s.step ? 'completed' : ''}" title="${s.text}">
                                    <div class="step-counter">
                                        ${currentStatus.step > s.step ? '<i class="fas fa-check"></i>' : s.step}
                                    </div>
                                    <div class="step-name">${s.text}</div>
                                </div>
                                ${index < Object.values(statusSteps).length - 1 ? `<div class="stepper-line ${isLineCompleted ? 'completed' : ''}"></div>` : ''}
                            `}).join('')}
                        </div>
                    `;

                    return `
                    <div class="competition-card">
                        <div class="competition-card-header">
                            <h3>${comp.name}</h3>
                            <div class="header-right-content">
                                ${countdownHtml}
                                <span class="status-badge-v2 status-${comp.status}">${currentStatus.text}</span>
                            </div>
                        </div>
                        <div class="competition-card-body">
                            <div class="competition-status-tracker">${progressBarHtml}</div>
                            <div class="competition-details-grid">
                                <p class="competition-detail-item"><i class="fas fa-users"></i><strong>عدد الفائزين:</strong> ${comp.winners_count || 0}</p>
                                <p class="competition-detail-item"><i class="fas fa-dollar-sign"></i><strong>الجائزة للفائز:</strong> ${comp.prize_per_winner ? comp.prize_per_winner.toFixed(2) : '0.00'}</p>
                                <!-- NEW: Display both expected and actual winner selection dates -->
                                <p class="competition-detail-item"><i class="fas fa-calendar-alt"></i><strong>تاريخ اختيار الفائز:</strong> ${comp.ends_at ? new Date(comp.ends_at).toLocaleDateString('ar-EG', { dateStyle: 'medium' }) : '<em>غير محدد</em>'}</p>
                                ${comp.processed_at ? `
                                    <p class="competition-detail-item"><i class="fas fa-calendar-check"></i><strong>تاريخ المعالجة الفعلي:</strong> ${new Date(comp.processed_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                ` : ''}
                                <p class="competition-detail-item"><i class="fas fa-eye"></i><strong>المشاهدات:</strong> ${formatNumber(comp.views_count)}</p>
                                <p class="competition-detail-item"><i class="fas fa-heart"></i><strong>التفاعلات:</strong> ${formatNumber(comp.reactions_count)}</p>
                                <p class="competition-detail-item"><i class="fas fa-user-check"></i><strong>المشاركات:</strong> ${formatNumber(comp.participants_count)}</p>
                                <p class="competition-detail-item"><i class="fas fa-key"></i><strong>الإجابة الصحيحة:</strong> ${comp.correct_answer || '<em>غير محددة</em>'}</p>
                            </div>
                        </div>
                        <div class="competition-card-footer">
                            ${comp.status === 'awaiting_winners' ? `<button class="btn-primary complete-competition-btn" data-id="${comp.id}" data-name="${comp.name}"><i class="fas fa-check-double"></i> تم اختيار الفائزين</button>` : ''}
                            ${canEditComps ? `<button class="btn-danger delete-competition-btn" data-id="${comp._id}"><i class="fas fa-trash-alt"></i> حذف</button>` : ''}
                        </div>
                    </div>
                `}).join('');
            };

            agentCompetitionsContent.innerHTML = `
                <div class="competitions-list-profile">
                    ${renderCompetitionList(activeAndPendingCompetitions)}
                </div>
                ${completedCompetitions.length > 0 ? `
                    <details class="completed-competitions-group">
                        <summary>
                            <i class="fas fa-archive"></i> المسابقات المكتملة (${completedCompetitions.length})
                        </summary>
                        <div class="competitions-list-profile">
                            ${renderCompetitionList(completedCompetitions)}
                        </div>
                    </details>
                ` : ''}
            `;
        } else {
            if (canViewAgentComps) {
                agentCompetitionsContent.innerHTML = '<p>لا توجد مسابقات خاصة بهذا الوكيل بعد.</p>';
            }
        }
    }

    if (agentCompetitionsContent) {
        agentCompetitionsContent.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-competition-btn');
            const completeBtn = e.target.closest('.complete-competition-btn');

            if (completeBtn) {
                const id = completeBtn.dataset.id;
                const name = completeBtn.dataset.name;

                // --- NEW: Show modal with required fields before completing ---
                const modalContent = `
                    <p>لإكمال مسابقة "<strong>${name}</strong>"، يرجى إدخال البيانات التالية:</p>
                    <div class="form-layout" style="margin-top: 15px;">
                        <div class="form-group">
                            <label for="comp-views-count">عدد المشاهدات</label>
                            <input type="number" id="comp-views-count" class="modal-input" required min="0">
                        </div>
                        <div class="form-group">
                            <label for="comp-reactions-count">عدد التفاعلات</label>
                            <input type="number" id="comp-reactions-count" class="modal-input" required min="0">
                        </div>
                        <div class="form-group">
                            <label for="comp-participants-count">عدد المشاركات</label>
                            <input type="number" id="comp-participants-count" class="modal-input" required min="0">
                        </div>
                    </div>
                `;

                showConfirmationModal(
                    modalContent,
                    async () => {
                        const views = document.getElementById('comp-views-count').value;
                        const reactions = document.getElementById('comp-reactions-count').value;
                        const participants = document.getElementById('comp-participants-count').value;

                        const updateData = {
                            status: 'completed',
                            is_active: false,
                            views_count: parseInt(views, 10),
                            reactions_count: parseInt(reactions, 10),
                            participants_count: parseInt(participants, 10)
                        };

                        const response = await authedFetch(`/api/competitions/${id}`, { method: 'PUT', body: JSON.stringify(updateData) });

                        if (!response.ok) {
                            showToast('فشل إكمال المسابقة.', 'error');
                        } else {
                            showToast('تم إكمال المسابقة بنجاح.', 'success');
                            await logAgentActivity(agent._id, 'COMPETITION_COMPLETED', `تم إكمال مسابقة "${name}" مع تسجيل بيانات الأداء.`);
                            renderAgentProfilePage(agent._id, { activeTab: 'agent-competitions' });
                        }
                    }, {
                        title: 'إكمال المسابقة وتسجيل الأداء',
                        confirmText: 'نعم، اكتملت',
                        confirmClass: 'btn-primary',
                        onRender: (modal) => {
                            const confirmBtn = modal.querySelector('#confirm-btn');
                            const inputs = modal.querySelectorAll('.modal-input');
                            confirmBtn.disabled = true; // Disable by default

                            inputs.forEach(input => input.addEventListener('input', () => {
                                const allFilled = Array.from(inputs).every(i => i.value.trim() !== '' && parseInt(i.value, 10) >= 0 && i.value !== '');
                                confirmBtn.disabled = !allFilled;
                            }));
                        }
                    }
                );
                return; // Stop further execution
            }

            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                if (!id) return;
        
                showConfirmationModal(
                    'هل أنت متأكد من حذف هذه المسابقة؟<br><small>لا يمكن التراجع عن هذا الإجراء.</small>',
                    async () => {
                        const response = await authedFetch(`/api/competitions/${id}`, { method: 'DELETE' });
                        if (!response.ok) {
                            const result = await response.json();
                            showToast(result.message || 'فشل حذف المسابقة.', 'error');
                            return;
                        }
                        showToast('تم حذف المسابقة بنجاح.', 'success');
                        renderAgentProfilePage(agent._id, { activeTab: 'agent-competitions' });
                    }, {
                        title: 'تأكيد الحذف',
                        confirmText: 'حذف',
                        confirmClass: 'btn-danger'
                    });
            }
        });
    }

    // Start live countdowns for competitions
    startCompetitionCountdowns(); // This will be migrated later

    // Display the next renewal date, which is now fully independent
    displayNextRenewalDate(agent); // This will be migrated later
}

/**
 * NEW: Renders an editor for the main profile header fields.
 * @param {object} agent The agent object to edit.
 */
function renderEditProfileHeader(agent) {
    const headerContainer = document.querySelector('.profile-main-info');
    const actionsContainer = document.querySelector('.profile-header-actions');
    if (!headerContainer || !actionsContainer) return;

    const originalHeaderHtml = headerContainer.innerHTML;
    const originalActionsHtml = actionsContainer.innerHTML;

    headerContainer.innerHTML = `
        <div class="form-layout-grid" style="gap: 10px;">
            <div class="form-group"><label>اسم الوكيل</label><input type="text" id="header-edit-name" value="${agent.name || ''}"></div>
            <div class="form-group"><label>رابط القناة</label><input type="text" id="header-edit-channel" value="${agent.telegram_channel_url || ''}"></div>
            <div class="form-group"><label>رابط الجروب</label><input type="text" id="header-edit-group" value="${agent.telegram_group_url || ''}"></div>
            <div class="form-group"><label>معرف الدردشة</label><input type="text" id="header-edit-chatid" value="${agent.telegram_chat_id || ''}"></div>
            <div class="form-group"><label>اسم المجموعة</label><input type="text" id="header-edit-groupname" value="${agent.telegram_group_name || ''}"></div>
        </div>
    `;

    actionsContainer.innerHTML = `
        <button id="header-save-btn" class="btn-primary"><i class="fas fa-check"></i> حفظ</button>
        <button id="header-cancel-btn" class="btn-secondary"><i class="fas fa-times"></i> إلغاء</button>
    `;

    const saveBtn = document.getElementById('header-save-btn');
    const cancelBtn = document.getElementById('header-cancel-btn');

    cancelBtn.addEventListener('click', () => {
        // Restore original content without a full page reload
        headerContainer.innerHTML = originalHeaderHtml;
        actionsContainer.innerHTML = originalActionsHtml;
        // Re-attach the edit button listener
        document.getElementById('edit-profile-btn').addEventListener('click', () => renderEditProfileHeader(agent));
    });

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const updatedData = {
            name: document.getElementById('header-edit-name').value,
            telegram_channel_url: document.getElementById('header-edit-channel').value,
            telegram_group_url: document.getElementById('header-edit-group').value,
            telegram_chat_id: document.getElementById('header-edit-chatid').value,
            telegram_group_name: document.getElementById('header-edit-groupname').value,
        };

        try {
            const response = await authedFetch(`/api/agents/${agent._id}`, {
                method: 'PUT',
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || 'فشل تحديث البيانات.');
            }

            showToast('تم تحديث بيانات الوكيل بنجاح.', 'success');
            await logAgentActivity(agent._id, 'PROFILE_UPDATE', 'تم تحديث بيانات الملف الشخصي للوكيل.');
            // Re-render the entire page to reflect changes everywhere
            renderAgentProfilePage(agent._id);

        } catch (error) {
            showToast(`فشل الحفظ: ${error.message}`, 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-check"></i> حفظ';
        }
    });
}


function startCompetitionCountdowns() {
    const countdownElements = document.querySelectorAll('.competition-countdown, .competition-countdown-header');
    if (countdownElements.length === 0) return;

    stopCompetitionCountdowns(); // Clear any existing intervals before starting new ones

    const updateElements = () => {
        let activeTimers = false;
        countdownElements.forEach(el => {
            if (!document.body.contains(el)) return;

            const endDateStr = el.dataset.endDate;
            if (!endDateStr) {
                el.innerHTML = ''; // Clear if no date
                return;
            }

            const endDate = new Date(endDateStr);
            const diffTime = endDate.getTime() - Date.now();

            if (diffTime <= 0) {
                el.innerHTML = `<i class="fas fa-hourglass-end"></i> في انتظار المعالجة...`;
                el.classList.add('expired');
            } else {
                activeTimers = true;
                // FIX: Display remaining time in days only.
                const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                let daysText = '';
                if (days > 1) {
                    daysText = `${days} أيام`;
                } else if (days === 1) {
                    daysText = `يوم واحد`;
                } else { // Should not happen with ceil, but as a fallback
                    daysText = 'أقل من يوم';
                }
                el.innerHTML = `<i class="fas fa-hourglass-half"></i> <span>متبقي: ${daysText}</span>`;
            }
        });
        if (!activeTimers) stopCompetitionCountdowns();
    };

    updateElements();
    const intervalId = setInterval(updateElements, 1000);
    competitionCountdownIntervals.push(intervalId);
}

function generateActivityLogHTML(logs, isAgentProfile = false) {
    const getLogIconDetails = (actionType) => {
        if (actionType.includes('CREATED')) return { icon: 'fa-user-plus', colorClass: 'log-icon-create' };
        if (actionType.includes('DELETED')) return { icon: 'fa-user-slash', colorClass: 'log-icon-delete' }
        if (actionType.includes('PROFILE_UPDATE')) return { icon: 'fa-user-edit', colorClass: 'log-icon-profile' };
        if (actionType.includes('DETAILS_UPDATE')) return { icon: 'fa-cogs', colorClass: 'log-icon-details' };
        if (actionType.includes('COMPETITION_CREATED')) return { icon: 'fa-trophy', colorClass: 'log-icon-competition' };
        if (actionType.includes('WINNERS_SELECTION_REQUESTED')) return { icon: 'fa-question-circle', colorClass: 'log-icon-telegram' };
        return { icon: 'fa-history', colorClass: 'log-icon-generic' };
    };

    const groupLogsByDate = (logs) => {
        const groups = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const todayStr = today.toISOString().split('T')[0];
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        logs.forEach(log => {
            const logDate = new Date(log.created_at);
            const logDateStr = logDate.toISOString().split('T')[0];
            let dateKey;

            if (logDateStr === todayStr) dateKey = 'اليوم';
            else if (logDateStr === yesterdayStr) dateKey = 'الأمس';
            else dateKey = logDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(log);
        });
        return groups;
    };

    const groupedLogs = groupLogsByDate(logs);
    let html = '<h2>سجل النشاط</h2><div class="log-timeline-v2" id="agent-log-timeline">';

    for (const date in groupedLogs) {
        html += `
            <div class="log-date-group">
                <div class="log-date-header">${date}</div>
                ${groupedLogs[date].map(log => {
                    const { icon, colorClass } = getLogIconDetails(log.action_type);
                    return `
                        <div class="log-item-v2">
                            <div class="log-item-icon-v2 ${colorClass}"><i class="fas ${icon}"></i></div>
                            <div class="log-item-content-v2">
                                <p class="log-description">${log.description}</p>
                                <p class="log-timestamp">
                                    <i class="fas fa-user"></i> ${log.user_name || 'نظام'}
                                    <span class="log-separator">|</span>
                                    <i class="fas fa-clock"></i> ${new Date(log.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    html += '</div>';
    return html;
}

function renderDetailsView(agent) {
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = currentUserProfile?.role === 'admin';
    const canEditFinancials = isSuperAdmin || isAdmin;

    const container = document.getElementById('tab-details');
    if (!container) return;

    const createFieldHTML = (label, value, fieldName, isEditable = true) => {
        const numericFields = ['competition_bonus', 'deposit_bonus_count', 'deposit_bonus_percentage', 'consumed_balance', 'remaining_balance', 'used_deposit_bonus', 'remaining_deposit_bonus', 'single_competition_balance', 'winners_count', 'prize_per_winner', 'competitions_per_week'];
        // --- NEW: Define which fields are financial ---
        const financialFields = ['rank', 'competition_bonus', 'deposit_bonus_count', 'deposit_bonus_percentage', 'consumed_balance', 'remaining_balance', 'used_deposit_bonus', 'remaining_deposit_bonus', 'single_competition_balance', 'winners_count', 'prize_per_winner', 'renewal_period'];
                const isFinancial = financialFields.includes(fieldName);

        let displayValue;
        let iconHtml = `<span class="inline-edit-trigger" title="قابل للتعديل"><i class="fas fa-pen"></i></span>`;

        // إصلاح: منطق عرض أيقونة التعديل
        if (!isEditable && fieldName !== 'audit_days') { // Allow editing audit_days even if other fields are not editable
            iconHtml = `<span class="auto-calculated-indicator" title="يُحسب تلقائياً"><i class="fas fa-cogs"></i></span>`;
        }



        if (numericFields.includes(fieldName)) {
            displayValue = (value === null || value === undefined) ? 0 : value;
            if (fieldName === 'prize_per_winner') displayValue = parseFloat(displayValue).toFixed(2);
            if (fieldName === 'deposit_bonus_percentage') displayValue = `${displayValue}%`;
            if (fieldName === 'competition_bonus') displayValue = `$${displayValue}`;
        } else if (fieldName === 'audit_days') {
            displayValue = value || 'غير محدد';
        } else if (fieldName.includes('_date')) {
            displayValue = value ? new Date(value).toLocaleDateString('ar-EG') : 'لم يحدد';
        } else {
            displayValue = value || 'غير محدد';
        }
        return `
            <div class="details-group" data-field="${fieldName}">
                ${iconHtml}
                <label>${label}</label>
                <p>${displayValue}</p>
            </div>
        `;
    };

    const htmlContent = `
        <div class="details-grid">
            <h3 class="details-section-title">المرتبة والمكافآت</h3>
            ${createFieldHTML('المرتبة', agent.rank, 'rank')}
            ${createFieldHTML('بونص المسابقات (تداولي)', agent.competition_bonus, 'competition_bonus')}
            ${createFieldHTML('مرات بونص الإيداع', agent.deposit_bonus_count, 'deposit_bonus_count')}
            ${createFieldHTML('نسبة بونص الإيداع', agent.deposit_bonus_percentage, 'deposit_bonus_percentage')}
            
            <h3 class="details-section-title">الأرصدة</h3>
            ${createFieldHTML('رصيد مستهلك', agent.consumed_balance, 'consumed_balance')}
            ${createFieldHTML('رصيد متبقي', agent.remaining_balance, 'remaining_balance')}
            ${createFieldHTML('بونص إيداع مستخدم', agent.used_deposit_bonus, 'used_deposit_bonus')}
            ${createFieldHTML('بونص إيداع متبقي', agent.remaining_deposit_bonus, 'remaining_deposit_bonus')}

            <h3 class="details-section-title">إعدادات المسابقة الواحدة</h3>
            ${createFieldHTML('رصيد المسابقة الواحدة', agent.single_competition_balance, 'single_competition_balance')}
            ${createFieldHTML('عدد الفائزين', agent.winners_count, 'winners_count')}
            ${createFieldHTML('جائزة كل فائز', agent.prize_per_winner, 'prize_per_winner')}
            
            <h3 class="details-section-title">التجديد والمدة</h3>
            ${createFieldHTML('يجدد كل', agent.renewal_period, 'renewal_period')}
            ${createFieldHTML('عدد المسابقات كل أسبوع', agent.competitions_per_week, 'competitions_per_week')}
            ${createFieldHTML('مدة المسابقة', agent.competition_duration, 'competition_duration')}
            ${createFieldHTML('تاريخ آخر مسابقة', agent.last_competition_date, 'last_competition_date')}
        </div>
        ${isSuperAdmin ? `
            <div class="details-actions" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                <button id="trigger-renewal-test-btn" class="btn-danger"><i class="fas fa-history"></i> تجربة التجديد (20 ثانية)</button>
            </div>
        ` : ''}
    `;



    // --- FIX V3: Stable content update ---
    // Clear the container's content and re-add the event listener.
    // This prevents replacing the container itself, which caused content to leak across pages.
    container.innerHTML = htmlContent;
    const eventHandler = (e) => {
        const trigger = e.target.closest('.inline-edit-trigger');
        if (trigger) {
            const group = trigger.closest('.details-group'); 
            // FIX: Add a null check to prevent race condition errors after a save.
            if (!group) return;
            renderInlineEditor(group, agent);
        }
    };

    // --- NEW: Add listener for the test renewal button ---
    const testRenewalBtn = document.getElementById('trigger-renewal-test-btn');
    if (testRenewalBtn) {
        testRenewalBtn.addEventListener('click', async () => {
            testRenewalBtn.disabled = true;
            testRenewalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> سيتم التجديد بعد 20 ثانية...';

            setTimeout(async () => {
                try {
                    const response = await authedFetch(`/api/agents/${agent._id}/renew`, { method: 'POST' });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'فشل تجديد رصيد الوكيل.');
                    
                    showToast(`تم تجديد رصيد الوكيل ${agent.name} بنجاح.`, 'success');
                    renderAgentProfilePage(agent._id, { activeTab: 'details' }); // Refresh to see changes
                } catch (error) {
                    showToast(`خطأ: ${error.message}`, 'error');
                    testRenewalBtn.disabled = false;
                    testRenewalBtn.innerHTML = '<i class="fas fa-history"></i> تجربة التجديد (20 ثانية)';
                }
            }, 20000); // 20 seconds delay
        });
    }

    container.addEventListener('click', eventHandler);
}

async function renderInlineEditor(groupElement, agent) {
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = currentUserProfile?.role === 'admin';
    const canEditFinancials = isSuperAdmin || isAdmin;
    
    const fieldName = groupElement.dataset.field;
    const originalContent = groupElement.innerHTML;
    const currentValue = agent[fieldName];
    const label = groupElement.querySelector('label').textContent;
    let editorHtml = '';

    switch (fieldName) {
        case 'rank':
            // تعديل: توحيد شكل وترتيب قائمة المراتب مع صفحة الإضافة
            editorHtml = `<select id="inline-edit-input">
                <optgroup label="⁕ مراتب الوكلاء الاعتيادية ⁖">
                    ${Object.keys(RANKS_DATA).filter(r => ['BEGINNING', 'GROWTH', 'PRO', 'ELITE'].includes(r)).map(rank => `<option value="${rank}" ${currentValue === rank ? 'selected' : ''}>🔸 ${rank}</option>`).join('')}
                </optgroup>
                <optgroup label="⁕ مراتب الوكالة الحصرية ⁖">
                    <option value="وكيل حصري بدون مرتبة" ${currentValue === 'وكيل حصري بدون مرتبة' ? 'selected' : ''}>⭐ وكيل حصري بدون مرتبة</option>
                    <option disabled>──────────</option>
                    ${Object.keys(RANKS_DATA).filter(r => ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'SAPPHIRE', 'EMERALD', 'KING', 'LEGEND'].includes(r)).map(rank => `<option value="${rank}" ${currentValue === rank ? 'selected' : ''}>⭐ ${rank}</option>`).join('')}
                </optgroup>
                <optgroup label="⁕ المراكز ⁖">
                    <option value="CENTER" ${currentValue === 'CENTER' ? 'selected' : ''}>🏢 CENTER</option>
                </optgroup>
            </select>`;
            break;
        case 'renewal_period':
            editorHtml = `<select id="inline-edit-input">
                <option value="none" ${currentValue === 'none' ? 'selected' : ''}>بدون تجديد</option>
                <option value="weekly" ${currentValue === 'weekly' ? 'selected' : ''}>أسبوع</option>
                <option value="biweekly" ${currentValue === 'biweekly' ? 'selected' : ''}>أسبوعين</option>
                <option value="monthly" ${currentValue === 'monthly' ? 'selected' : ''}>شهر</option>
            </select>`;
            break;
        case 'competitions_per_week':
            editorHtml = `<select id="inline-edit-input"><option value="1" ${currentValue == 1 ? 'selected' : ''}>1</option><option value="2" ${currentValue == 2 ? 'selected' : ''}>2</option><option value="3" ${currentValue == 3 ? 'selected' : ''}>3</option></select>`;
            break;
        case 'last_competition_date': // تعديل: السماح بتعديل تاريخ آخر مسابقة
        case 'winner_selection_date': // تعديل: السماح بتعديل تاريخ اختيار الفائز
            editorHtml = `<input type="date" id="inline-edit-input" value="${currentValue || ''}">`;
            break;
        case 'competition_duration': // تعديل: السماح بتعديل مدة المسابقة
            editorHtml = `<select id="inline-edit-input"><option value="24h" ${currentValue === '24h' ? 'selected' : ''}>24 ساعة</option><option value="48h" ${currentValue === '48h' ? 'selected' : ''}>48 ساعة</option></select>`;
            break;
        case 'audit_days':
            editorHtml = `
                <div class="days-selector-v2" id="inline-edit-input">
                    ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day, index) => `
                        <div class="day-toggle-wrapper">
                            <input type="checkbox" id="day-edit-inline-${index}" value="${index}" class="day-toggle-input" ${(currentValue || []).includes(index) ? 'checked' : ''}>
                            <label for="day-edit-inline-${index}" class="day-toggle-btn">${day}</label>
                        </div>`).join('')}
                </div>`;
            break;
        default: // for text/number inputs
            editorHtml = `<input type="number" id="inline-edit-input" value="${currentValue || ''}" placeholder="${label}">`;
            break;
    }

    groupElement.innerHTML = `
        <label>${label}</label>
        ${editorHtml}
        <div class="inline-edit-actions">
            <button id="inline-save-btn" class="btn-primary"><i class="fas fa-check"></i></button>
            <button id="inline-cancel-btn" class="btn-secondary"><i class="fas fa-times"></i></button>
        </div>
    `;

    // --- تعديل: إضافة تحديث فوري لتاريخ اختيار الفائز ---
    const inputElement = groupElement.querySelector('#inline-edit-input');
    if (inputElement && (fieldName === 'last_competition_date' || fieldName === 'competition_duration')) {
        const liveUpdateWinnerDate = () => {
            // --- إصلاح: جلب القيم الحالية من الصفحة مباشرة ---
            // ابحث عن حقل الإدخال النشط لتاريخ آخر مسابقة، أو استخدم القيمة المعروضة إذا لم يكن في وضع التعديل.
            const lastCompDateInput = document.querySelector('.details-group[data-field="last_competition_date"] #inline-edit-input');
            const lastCompDateValue = lastCompDateInput ? lastCompDateInput.value : agent.last_competition_date;

            // ابحث عن حقل الإدخال النشط لمدة المسابقة، أو استخدم القيمة المعروضة.
            const durationInput = document.querySelector('.details-group[data-field="competition_duration"] #inline-edit-input');
            const durationValue = durationInput ? durationInput.value : agent.competition_duration;
            
            // ابحث عن عنصر عرض تاريخ اختيار الفائز لتحديثه.
            const winnerDateElement = document.querySelector('.details-group[data-field="winner_selection_date"] p');

            if (lastCompDateValue && durationValue && winnerDateElement) {
                const durationMap = { '24h': 1, '48h': 2, 'monthly': 30 };
                const durationDays = durationMap[durationValue] || 0;
                if (durationDays > 0) {
                    try {
                        const newDate = new Date(lastCompDateValue);
                        newDate.setDate(newDate.getDate() + durationDays);
                        winnerDateElement.textContent = newDate.toLocaleDateString('ar-EG');
                    } catch (e) {
                        // تجاهل الأخطاء الناتجة عن إدخال تاريخ غير صالح مؤقتاً
                    }
                }
            }
        };

        // استدعاء الدالة عند تغيير القيمة
        inputElement.addEventListener('change', liveUpdateWinnerDate);
    }

    groupElement.querySelector('#inline-cancel-btn').addEventListener('click', () => {
        renderDetailsView(agent);
    });

    groupElement.querySelector('#inline-save-btn').addEventListener('click', async () => {
        const input = groupElement.querySelector('#inline-edit-input');
        let newValue = input.value;
        const updateData = {};
        
        // --- STEP 5: MIGRATION TO CUSTOM BACKEND ---
        let currentAgent;
        try {
            const response = await authedFetch(`/api/agents/${agent._id}`);
            if (!response.ok) throw new Error('Failed to fetch latest agent data.');
            const result = await response.json();
            currentAgent = result.data;
        } catch (fetchError) {
            showToast('فشل في جلب بيانات الوكيل المحدثة.', 'error');
            console.error(fetchError);
            return;
        }

        if (fieldName === 'rank') {
            const rankData = RANKS_DATA[newValue] || {};
            updateData.rank = newValue;
            updateData.competition_bonus = rankData.competition_bonus;
            updateData.deposit_bonus_percentage = rankData.deposit_bonus_percentage;
            updateData.deposit_bonus_count = rankData.deposit_bonus_count;
            // When rank changes, it might affect balances
            // --- تعديل: منطق خاص لمرتبة "بدون مرتبة حصرية" ---
            if (newValue === 'بدون مرتبة حصرية') {
                updateData.competition_bonus = 60;
                updateData.remaining_balance = 60 - (currentAgent.consumed_balance || 0)
                updateData.deposit_bonus_percentage = null;
                updateData.deposit_bonus_count = null;
            } else {
                updateData.competition_bonus = rankData.competition_bonus;
                updateData.remaining_balance = (rankData.competition_bonus || 0) - (currentAgent.consumed_balance || 0);
            }
            updateData.remaining_deposit_bonus = (rankData.deposit_bonus_count || 0) - (currentAgent.used_deposit_bonus || 0);
        } else {
            let finalValue;
            if (fieldName === 'audit_days') {
                finalValue = Array.from(groupElement.querySelectorAll('.day-toggle-input:checked')).map(input => parseInt(input.value, 10));
                newValue = finalValue.map(d => dayNames[d]).join(', ') || 'فارغ'; // For logging
            } else if (fieldName.includes('_date')) {
                finalValue = newValue === '' ? null : newValue;
            }else {
                const parsedValue = parseFloat(newValue);
                finalValue = newValue === '' ? null : (isNaN(parsedValue) ? newValue : parsedValue);
            }

            // Direct update: The user is now responsible for all values.
            // The backend will simply save what it's given.
            updateData[fieldName] = finalValue;
        }

        try {
            const response = await authedFetch(`/api/agents/${agent._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            if (!response.ok) throw new Error((await response.json()).message || 'فشل تحديث الحقل.');
            const { data: updatedAgent } = await response.json();

            const oldValue = currentAgent[fieldName];
            const description = `تم تحديث "${label}" من "${oldValue || 'فارغ'}" إلى "${newValue || 'فارغ'}".`; // This will be migrated later
            await logAgentActivity(agent._id, 'DETAILS_UPDATE', description, { field: label, from: oldValue, to: newValue });
            showToast('تم حفظ التغيير بنجاح.', 'success');
            // If rank or renewal period was changed, a full re-render is needed to update all dependent fields.
            if (fieldName === 'rank' || fieldName === 'renewal_period') {
                renderAgentProfilePage(agent._id, { activeTab: 'details' });
            } else {
                // تحسين: إعادة عرض الأجزاء المتأثرة فقط، بما في ذلك سجل النشاط
                renderDetailsView(updatedAgent);
                // This will be migrated later
            }
        } catch (e) {
            showToast(`فشل تحديث الحقل: ${e.message}`, 'error');
            renderDetailsView(agent); // Revert on error
        }
    });
}

function updateManualRenewButtonState(agent) {
    const renewalBtn = document.getElementById('manual-renew-btn');
    if (!renewalBtn || !agent || !agent.renewal_period || agent.renewal_period === 'none') {
        if (renewalBtn) renewalBtn.style.display = 'none';
        return;
    }

    renewalBtn.style.display = 'inline-flex';

    const lastRenewal = agent.last_renewal_date ? new Date(agent.last_renewal_date) : new Date(agent.created_at);
    let nextRenewalDate = new Date(lastRenewal);
    if (agent.renewal_period === 'weekly') nextRenewalDate.setDate(lastRenewal.getDate() + 7);
    else if (agent.renewal_period === 'biweekly') nextRenewalDate.setDate(lastRenewal.getDate() + 14);
    else if (agent.renewal_period === 'monthly') nextRenewalDate.setMonth(lastRenewal.getMonth() + 1);

    if (new Date() >= nextRenewalDate) {
        renewalBtn.disabled = false;
        renewalBtn.classList.add('ready');
    } else {
        renewalBtn.disabled = true;
        renewalBtn.classList.remove('ready');
    }
}

function displayNextRenewalDate(agent) {
    const displayElement = document.getElementById('renewal-date-display');
    if (!displayElement || !agent.renewal_period || agent.renewal_period === 'none') {
        if(displayElement) displayElement.style.display = 'none';
        updateManualRenewButtonState(agent);
        return;
    }

    // --- إصلاح: استخدام تاريخ إنشاء الوكيل كقيمة احتياطية إذا لم يكن هناك تاريخ تجديد سابق ---
    // هذا يمنع ظهور "Invalid Date" للوكلاء الجدد.
    const lastRenewal = agent.last_renewal_date ? new Date(agent.last_renewal_date) : new Date(agent.createdAt);
    let nextRenewalDate = new Date(lastRenewal);

    if (agent.renewal_period === 'weekly') nextRenewalDate.setDate(lastRenewal.getDate() + 7);
    else if (agent.renewal_period === 'biweekly') nextRenewalDate.setDate(lastRenewal.getDate() + 14);
    else if (agent.renewal_period === 'monthly') nextRenewalDate.setMonth(lastRenewal.getMonth() + 1);
    else {
        displayElement.style.display = 'none';
        return;
    }

    displayElement.style.display = 'flex';
    displayElement.innerHTML = `<i class="fas fa-calendar-alt"></i> <span>يُجدد في: ${nextRenewalDate.toLocaleDateString('ar-EG')}</span>`;

    // Also update the button state based on the date
    updateManualRenewButtonState(agent);
}

// --- NEW: Agent Analytics Section ---
async function renderAgentAnalytics(agent, container, dateRange = 'all') {
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>'; // This will be migrated later
    let competitions = [];
    let error = null;

    try {
        const queryParams = new URLSearchParams({ dateRange });
        const response = await authedFetch(`/api/stats/agent-analytics/${agent._id}?${queryParams.toString()}`);
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || 'فشل تحميل بيانات التحليلات.');
        }
        const result = await response.json();
        competitions = result.competitions;
    } catch (e) {
        error = e;
    }

    if (error) {
        container.innerHTML = '<p class="error">فشل تحميل بيانات التحليلات.</p>';
        return;
    }

    // --- NEW: Calculate KPIs ---
    const totalCompetitions = competitions.length;
    const totalViews = competitions.reduce((sum, c) => sum + (c.views_count || 0), 0);
    const totalReactions = competitions.reduce((sum, c) => sum + (c.reactions_count || 0), 0);
    const totalParticipants = competitions.reduce((sum, c) => sum + (c.participants_count || 0), 0);
    const avgViews = totalCompetitions > 0 ? totalViews / totalCompetitions : 0;

    // --- NEW: Calculate Growth Rate ---
    let growthRate = 0;
    if (competitions.length >= 2) {
        const latest = competitions[0];
        const previous = competitions[1];
        const latestTotal = (latest.views_count || 0) + (latest.reactions_count || 0) + (latest.participants_count || 0);
        const previousTotal = (previous.views_count || 0) + (previous.reactions_count || 0) + (previous.participants_count || 0);
        if (previousTotal > 0) {
            growthRate = ((latestTotal - previousTotal) / previousTotal) * 100;
        }
    }

    const kpiCardsHtml = `
        <div class="dashboard-grid-v2" style="margin-bottom: 20px;">
            <div class="stat-card-v2 color-1">
                <div class="stat-card-v2-icon-bg"><i class="fas fa-eye"></i></div>
                <p class="stat-card-v2-value">${formatNumber(totalViews)}</p>
                <h3 class="stat-card-v2-title">إجمالي المشاهدات</h3>
            </div>
            <div class="stat-card-v2 color-2">
                <div class="stat-card-v2-icon-bg"><i class="fas fa-heart"></i></div>
                <p class="stat-card-v2-value">${formatNumber(totalReactions)}</p>
                <h3 class="stat-card-v2-title">إجمالي التفاعلات</h3>
            </div>
            <div class="stat-card-v2 color-3">
                <div class="stat-card-v2-icon-bg"><i class="fas fa-users"></i></div>
                <p class="stat-card-v2-value">${formatNumber(totalParticipants)}</p>
                <h3 class="stat-card-v2-title">إجمالي المشاركات</h3>
            </div>
            <div class="stat-card-v2 color-4">
                <div class="stat-card-v2-icon-bg"><i class="fas fa-chart-line"></i></div>
                <p class="stat-card-v2-value">${growthRate.toFixed(1)}%</p>
                <h3 class="stat-card-v2-title">معدل النمو</h3>
            </div>
        </div>
    `;

    // --- NEW: Date Filter and Export Buttons ---
    const analyticsHeaderHtml = `
        <div class="analytics-header">
            <h2><i class="fas fa-chart-line"></i> تحليلات أداء المسابقات</h2>
            <div class="analytics-actions">
                <div class="filter-buttons">
                    <button class="filter-btn ${dateRange === 'all' ? 'active' : ''}" data-range="all">الكل</button>
                    <button class="filter-btn ${dateRange === '7d' ? 'active' : ''}" data-range="7d">آخر 7 أيام</button>
                    <button class="filter-btn ${dateRange === '30d' ? 'active' : ''}" data-range="30d">آخر 30 يوم</button>
                    <button class="filter-btn ${dateRange === 'month' ? 'active' : ''}" data-range="month">هذا الشهر</button>
                </div>
            </div>
        </div>
    `;

    // --- NEW: Event listener for date filters ---
    container.addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            const newRange = e.target.dataset.range;
            renderAgentAnalytics(agent, container, newRange);
        }
    });

    if (competitions.length === 0) {
        container.innerHTML = `${analyticsHeaderHtml}<p class="no-results-message">لا توجد بيانات تحليلية في النطاق الزمني المحدد.</p>`;
        return;
    }

    container.innerHTML = `
        ${analyticsHeaderHtml}
        ${kpiCardsHtml}
        <div class="analytics-container">
            <div class="chart-container" style="height: 350px; margin-bottom: 30px;">
                <canvas id="agent-analytics-chart"></canvas>
            </div>
            <div class="table-responsive-container">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>اسم المسابقة</th>
                            <th>تاريخ الإنشاء</th>
                            <th>المشاهدات</th>
                            <th>التفاعلات</th>
                            <th>المشاركات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${competitions.map(c => `
                            <tr>
                                <td data-label="اسم المسابقة">${c.name}</td>
                                <td data-label="تاريخ الإنشاء">${new Date(c.created_at).toLocaleDateString('ar-EG')}</td>
                                <td data-label="المشاهدات">${formatNumber(c.views_count)}</td>
                                <td data-label="التفاعلات">${formatNumber(c.reactions_count)}</td>
                                <td data-label="المشاركات">${formatNumber(c.participants_count)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // --- NEW: Render daily performance chart ---
    const ctx = document.getElementById('agent-analytics-chart')?.getContext('2d');
    if (!ctx) return;

    // Determine the date range for the chart labels
    const chartLabels = [];
    const dailyData = {};
    const today = new Date();
    let daysInChart = 7; // Default for 'all' or '7d'

    if (dateRange === '30d') daysInChart = 30;
    else if (dateRange === 'month') daysInChart = today.getDate();
    else if (dateRange === 'all') {
        const oldestDate = new Date(agent.created_at); // Use agent creation date
        const diffTime = Math.abs(today - oldestDate);
        daysInChart = Math.max(7, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1); // +1 to include today
    }

    for (let i = daysInChart - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        chartLabels.push(date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }));
        dailyData[dateString] = { views: 0, reactions: 0, participants: 0 };
    }

    competitions.forEach(comp => {
        if (comp.createdAt) { // Check if createdAt exists
            const dateString = new Date(comp.createdAt).toISOString().split('T')[0];
            if (dailyData[dateString]) {
                dailyData[dateString].views += comp.views_count || 0;
                dailyData[dateString].reactions += comp.reactions_count || 0;
                dailyData[dateString].participants += comp.participants_count || 0;
            }
        }
    });

    const dailyViews = Object.values(dailyData).map(d => d.views);
    const dailyReactions = Object.values(dailyData).map(d => d.reactions);
    const dailyParticipants = Object.values(dailyData).map(d => d.participants);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [
                { label: 'المشاهدات', data: dailyViews, borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.2)', fill: true, tension: 0.3 },
                { label: 'التفاعلات', data: dailyReactions, borderColor: 'rgba(255, 206, 86, 1)', backgroundColor: 'rgba(255, 206, 86, 0.2)', fill: true, tension: 0.3 },
                { label: 'المشاركات', data: dailyParticipants, borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            },
            plugins: { legend: { position: 'top' } },
            interaction: { mode: 'index', intersect: false }
        }
    });
}