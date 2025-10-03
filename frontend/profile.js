let competitionCountdownIntervals = [];

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

    if (!supabase) {
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

    // Check for edit mode in hash, e.g., #profile/123/edit
    const hashParts = window.location.hash.split('/');
    const startInEditMode = hashParts.includes('edit');
    const defaultTab = options.activeTab || 'action';

    const { data: agent, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

    // Fetch competitions and logs for this agent in parallel
    const [competitionsResult, logsResult] = await Promise.all([
        supabase.from('competitions').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }),
        supabase.from('agent_logs').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(20)
    ]);

    const agentCompetitions = competitionsResult.data || [];
    const agentLogs = logsResult.data || [];

    if (competitionsResult.error) console.error("Error fetching agent competitions:", competitionsResult.error);
    if (logsResult.error) console.error("Error fetching agent logs:", logsResult.error);

    if (error || !agent) {
        console.error('Error fetching agent profile:', error);
        appContent.innerHTML = `<p class="error">فشل العثور على الوكيل المطلوب.</p>`;
        return;
    }

    // --- NEW: Fetch today's task status for this agent ---
    const today = new Date();
    const todayDayIndex = today.getDay();
    const todayStr = today.toISOString().split('T')[0];
    let agentTaskToday = {};
    let isTaskDay = (agent.audit_days || []).includes(todayDayIndex);

    if (isTaskDay) {
        const { data: taskData, error: taskError } = await supabase
            .from('daily_tasks')
            .select('*')
            .eq('agent_id', agentId)
            .eq('task_date', todayStr)
            .maybeSingle(); // FIX: Use maybeSingle() to prevent errors from duplicate entries.
        if (taskData) agentTaskToday = taskData;
    }
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
            <div class="profile-main-info">
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
        agentIdEl.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(agent.agent_id).then(() => showToast(`تم نسخ الرقم: ${agent.agent_id}`, 'info'));
        });
    }

    const createCompBtn = document.getElementById('create-agent-competition');
    if (createCompBtn) {
        if (canCreateComp) {
            createCompBtn.addEventListener('click', () => window.location.hash = `competitions/new?agentId=${agent.id}`);
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

                const { error } = await supabase.from('agents').update(updateData).eq('id', agent.id);

                if (error) {
                    showToast(`فشل تجديد الرصيد: ${error.message}`, 'error');
                } else {
                    await logAgentActivity(agent.id, 'MANUAL_RENEWAL', 'تم تجديد الرصيد يدوياً.');
                    showToast('تم تجديد الرصيد بنجاح.', 'success');
                    renderAgentProfilePage(agent.id, { activeTab: 'action' }); // Re-render the page
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
                    await logAgentActivity(agent.id, 'BONUS_CLICHE_SENT', 'تم إرسال كليشة تذكير البونص إلى تلجرام.');
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
                    const response = await authedFetch('/api/post-announcement', {
                        method: 'POST',
                        body: JSON.stringify({ message: clicheText, chatId: agent.telegram_chat_id })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'فشل الاتصال بالخادم.');

                    showToast('تم إرسال طلب اختيار الفائزين إلى تلجرام بنجاح.', 'success');
                    await logAgentActivity(agent.id, 'WINNERS_SELECTION_REQUESTED', `تم إرسال طلب اختيار الفائزين لمسابقة الوكيل ${agent.name}.`);
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
        if (canEditProfile) {
            editBtn.addEventListener('click', () => renderEditProfileHeader(agent, appContent));
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
    const agentCompetitionsContent = document.getElementById('tab-agent-competitions');
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
            updateManualRenewButtonState(agent);
            logTabContent.innerHTML = generateActivityLogHTML(agentLogs);
        }
    }

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
                    if (endDate && comp.status !== 'completed') {
                        const diffTime = endDate.getTime() - new Date().getTime();
                        if (diffTime > 0) {
                            countdownHtml = `<div class="competition-countdown" data-end-date="${comp.ends_at}"><i class="fas fa-clock"></i> <span>جاري حساب الوقت...</span></div>`;
                        } else {
                            countdownHtml = `<div class="competition-countdown expired"><i class="fas fa-hourglass-end"></i> انتهى الوقت</div>`;
                        }
                    }

                    const statusSteps = {
                        'sent': { text: 'تم الإرسال', step: 1 },
                        'awaiting_winners': { text: 'في انتظار الفائزين', step: 2 },
                        'completed': { text: 'مكتملة', step: 3 }
                    };
                    const currentStatus = statusSteps[comp.status] || statusSteps['sent'];

                    const progressBarHtml = `
                        <div class="stepper-wrapper step-${currentStatus.step}">
                            ${Object.values(statusSteps).map((s, index) => {
                                const isLineCompleted = currentStatus.step > index + 1;
                                return `
                                <div class="stepper-item ${currentStatus.step >= s.step ? 'completed' : ''}">
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
                                <p class="competition-detail-item"><i class="fas fa-calendar-alt"></i><strong>تاريخ الاختيار:</strong> ${endDate ? endDate.toLocaleDateString('ar-EG') : 'غير محدد'}</p>
                                <p class="competition-detail-item"><i class="fas fa-eye"></i><strong>المشاهدات:</strong> ${formatNumber(comp.views_count)}</p>
                                <p class="competition-detail-item"><i class="fas fa-heart"></i><strong>التفاعلات:</strong> ${formatNumber(comp.reactions_count)}</p>
                                <p class="competition-detail-item"><i class="fas fa-user-check"></i><strong>المشاركات:</strong> ${formatNumber(comp.participants_count)}</p>
                                <p class="competition-detail-item"><i class="fas fa-key"></i><strong>الإجابة الصحيحة:</strong> ${comp.correct_answer || '<em>غير محددة</em>'}</p>
                            </div>
                        </div>
                        <div class="competition-card-footer">
                            ${comp.status === 'awaiting_winners' ? `<button class="btn-primary complete-competition-btn" data-id="${comp.id}" data-name="${comp.name}"><i class="fas fa-check-double"></i> تم اختيار الفائزين</button>` : ''}
                            <button class="btn-danger delete-competition-btn" data-id="${comp.id}"><i class="fas fa-trash-alt"></i> حذف</button>
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

                        const { error } = await supabase.from('competitions').update(updateData).eq('id', id);

                        if (error) {
                            showToast('فشل إكمال المسابقة.', 'error');
                        } else {
                            showToast('تم إكمال المسابقة بنجاح.', 'success');
                            await logAgentActivity(agent.id, 'COMPETITION_COMPLETED', `تم إكمال مسابقة "${name}" مع تسجيل بيانات الأداء.`);
                            renderAgentProfilePage(agent.id, { activeTab: 'agent-competitions' });
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
                                const allFilled = Array.from(inputs).every(i => i.value.trim() !== '' && parseInt(i.value, 10) >= 0);
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
                        const { error } = await supabase.from('competitions').delete().eq('id', id);
                        if (error) {
                            showToast('فشل حذف المسابقة.', 'error');
                            console.error('Delete competition error:', error);
                        } else {
                            showToast('تم حذف المسابقة بنجاح.', 'success');
                            // Re-render the profile page, staying on the same tab
                            renderAgentProfilePage(agent.id, { activeTab: 'agent-competitions' });
                        }
                    }, {
                        title: 'تأكيد الحذف',
                        confirmText: 'حذف',
                        confirmClass: 'btn-danger'
                    });
            }
        });
    }

    // Start live countdowns for competitions
    startCompetitionCountdowns();

    // Display the next renewal date, which is now fully independent
    displayNextRenewalDate(agent);
}

function startCompetitionCountdowns() {
    const countdownElements = document.querySelectorAll('.competition-countdown, .competition-countdown-header');
    if (countdownElements.length === 0) return;

    const updateElements = () => {
        let activeTimers = false;
        countdownElements.forEach(el => {
            if (!document.body.contains(el)) return;

            const endDateStr = el.dataset.endDate;
            if (!endDateStr) return;

            const endDate = new Date(endDateStr);
            const diffTime = endDate.getTime() - new Date().getTime();

            if (diffTime <= 0) {
                el.innerHTML = `<i class="fas fa-hourglass-end"></i> انتهى الوقت`;
                el.classList.add('expired');
            } else {
                activeTimers = true;
                const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (days > 0) {
                    el.innerHTML = `<i class="fas fa-clock"></i> <span>متبقي: ${days} يوم</span>`;
                } else {
                    el.innerHTML = `<i class="fas fa-clock"></i> <span>ينتهي اليوم</span>`;
                }
            }
        });
        if (!activeTimers) stopCompetitionCountdowns();
    };

    updateElements();
    const intervalId = setInterval(updateElements, 1000);
    competitionCountdownIntervals.push(intervalId);
}

function generateActivityLogHTML(logs) {
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
    let html = '<h2>سجل النشاط</h2><div class="log-timeline-v2">';

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
                                <p class="log-timestamp">${new Date(log.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
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
        let iconHtml = '';

        // إصلاح: منطق عرض أيقونة التعديل
        if (isSuperAdmin || (isEditable && (!isFinancial || (isFinancial && canEditFinancials)))) {
            iconHtml = `<span class="inline-edit-trigger" title="قابل للتعديل"><i class="fas fa-pen"></i></span>`;
        } else if (!isEditable) {
            iconHtml = `<span class="auto-calculated-indicator" title="يُحسب تلقائياً"><i class="fas fa-cogs"></i></span>`;
        }



        if (numericFields.includes(fieldName)) {
            displayValue = (value === null || value === undefined) ? 0 : value;
            if (fieldName === 'prize_per_winner') displayValue = parseFloat(displayValue).toFixed(2);
            if (fieldName === 'deposit_bonus_percentage') displayValue = `${displayValue}%`;
            if (fieldName === 'competition_bonus') displayValue = `$${displayValue}`;
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
            ${createFieldHTML('المرتبة', agent.rank, 'rank', true)}
            ${createFieldHTML('بونص المسابقات (تداولي)', agent.competition_bonus, 'competition_bonus', false)}
            ${createFieldHTML('مرات بونص الإيداع', agent.deposit_bonus_count, 'deposit_bonus_count', false)}
            ${createFieldHTML('نسبة بونص الإيداع', agent.deposit_bonus_percentage, 'deposit_bonus_percentage', false)}
            
            <h3 class="details-section-title">الأرصدة</h3>
            ${createFieldHTML('رصيد مستهلك', agent.consumed_balance, 'consumed_balance', true)}
            ${createFieldHTML('رصيد متبقي', agent.remaining_balance, 'remaining_balance', false)}            
            ${createFieldHTML('بونص إيداع مستخدم', agent.used_deposit_bonus, 'used_deposit_bonus', true)}
            ${createFieldHTML('بونص إيداع متبقي', agent.remaining_deposit_bonus, 'remaining_deposit_bonus', false)}

            <h3 class="details-section-title">إعدادات المسابقة الواحدة</h3>
            ${createFieldHTML('رصيد المسابقة الواحدة', agent.single_competition_balance, 'single_competition_balance', true)}
            ${createFieldHTML('عدد الفائزين', agent.winners_count, 'winners_count', true)}
            ${createFieldHTML('جائزة كل فائز', agent.prize_per_winner, 'prize_per_winner', false)}
            
            <h3 class="details-section-title">التجديد والمدة</h3>
            ${createFieldHTML('يجدد كل', agent.renewal_period, 'renewal_period', true)}
            ${createFieldHTML('عدد المسابقات كل أسبوع', agent.competitions_per_week, 'competitions_per_week', true)}
            ${createFieldHTML('مدة المسابقة', agent.competition_duration, 'competition_duration', true)}
            ${createFieldHTML('تاريخ آخر مسابقة', agent.last_competition_date, 'last_competition_date', false)}
            ${createFieldHTML('تاريخ اختيار الفائز', agent.winner_selection_date, 'winner_selection_date', false)}
        </div>
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

    // --- إصلاح: السماح للمدير العام بتعديل الحقول المحسوبة، مع إظهار تنبيه ---
    const calculatedFields = ['competition_bonus', 'deposit_bonus_percentage', 'deposit_bonus_count', 'remaining_balance', 'remaining_deposit_bonus', 'winner_selection_date', 'prize_per_winner', 'competition_duration', 'last_competition_date'];
    if (calculatedFields.includes(fieldName) && !isSuperAdmin) {
        showToast('يتم حساب هذا الحقل تلقائياً ولا يمكن تعديله مباشرة.', 'info');
        return; // منع التعديل لغير المدير العام
    }

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
        const newValue = input.value;
        const updateData = {};
        
        // Get a fresh copy of agent data to avoid stale data issues
        const { data: currentAgent, error: fetchError } = await supabase.from('agents').select('*').eq('id', agent.id).single();
        if (fetchError) {
            showToast('فشل في جلب بيانات الوكيل المحدثة.', 'error');
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
            if (fieldName.includes('_date')) {
                finalValue = newValue === '' ? null : newValue;
            }else {
                const parsedValue = parseFloat(newValue);
                finalValue = newValue === '' ? null : (isNaN(parsedValue) ? newValue : parsedValue);
            }

            // --- إصلاح: منطق الحفظ للمدير العام والحسابات التلقائية ---
            // إذا كان المدير العام يعدل حقلاً محسوباً، احفظ قيمته مباشرة وتوقف.
            if (isSuperAdmin && calculatedFields.includes(fieldName)) {
                updateData[fieldName] = finalValue;
            } else {
                // إذا لم يكن المدير العام أو كان يعدل حقلاً عادياً، قم بتطبيق المنطق المترابط.
                updateData[fieldName] = finalValue;

                if (fieldName === 'renewal_period' || fieldName === 'competition_duration') {
                    updateData.last_renewal_date = new Date().toISOString();
                }
                else if (fieldName === 'consumed_balance') {
                    updateData.remaining_balance = (currentAgent.competition_bonus || 0) - (finalValue || 0);
                } else if (fieldName === 'used_deposit_bonus') {
                    updateData.remaining_deposit_bonus = (currentAgent.deposit_bonus_count || 0) - (finalValue || 0);
                } else if (fieldName === 'last_competition_date' || fieldName === 'competition_duration' || fieldName === 'competitions_per_week') {
                    // --- إصلاح: جلب القيم الحالية من الصفحة عند الحفظ ---
                    const lastDate = (fieldName === 'last_competition_date') ? finalValue : currentAgent.last_competition_date;
                    let duration = (fieldName === 'competition_duration') ? finalValue : currentAgent.competition_duration;
                    
                    // إذا تم تغيير عدد المسابقات، قم بتحديث المدة أولاً
                    if (fieldName === 'competitions_per_week') {
                        duration = (finalValue == 1) ? '48h' : '24h';
                        updateData.competition_duration = duration;
                    }

                    if (lastDate && duration) {
                        const durationMap = { '24h': 1, '48h': 2 };
                        const durationDays = durationMap[duration] || 0;
                        const newDate = new Date(lastDate);
                        newDate.setDate(newDate.getDate() + durationDays);
                        updateData.winner_selection_date = newDate.toISOString().split('T')[0];
                    }
                } else if (fieldName === 'competitions_per_week') {
                    const compsPerWeek = finalValue;
                    updateData.competition_duration = (compsPerWeek == 1) ? '48h' : '24h';
                } else if (fieldName === 'single_competition_balance' || fieldName === 'winners_count') {
                    const balance = (fieldName === 'single_competition_balance' ? finalValue : currentAgent.single_competition_balance) || 0;
                    const winners = (fieldName === 'winners_count' ? finalValue : currentAgent.winners_count) || 0;
                    if (balance && winners > 0) {
                        updateData.prize_per_winner = (balance / winners).toFixed(2);
                    } else {
                        updateData.prize_per_winner = 0;
                    }
                }
            }
        }

        const { data: updatedAgent, error } = await supabase.from('agents').update(updateData).eq('id', agent.id).select().single();

        if (error) {
            console.error('Error updating field:', error);
            showToast(`فشل تحديث الحقل: ${error.message}`, 'error');
            renderDetailsView(agent); // Revert on error
        } else {
            const oldValue = currentAgent[fieldName];
            console.log(`[DEBUG] Field '${label}' updated successfully. Old value: '${oldValue}', New value: '${newValue}'.`);
            const description = `تم تحديث "${label}" من "${oldValue || 'فارغ'}" إلى "${newValue || 'فارغ'}".`;
            await logAgentActivity(agent.id, 'DETAILS_UPDATE', description, { field: label, from: oldValue, to: newValue });
            showToast('تم حفظ التغيير بنجاح.', 'success');
            // If rank or renewal period was changed, a full re-render is needed to update all dependent fields.
            if (fieldName === 'rank' || fieldName === 'renewal_period') {
                renderAgentProfilePage(agent.id, { activeTab: 'details' });
            } else {
                // تحسين: إعادة عرض الأجزاء المتأثرة فقط، بما في ذلك سجل النشاط
                renderDetailsView(updatedAgent);
                
                // تحديث سجل النشاط بشكل فوري
                const { data: newLogs } = await supabase.from('agent_logs').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false }).limit(20);
                const logTabContent = document.getElementById('tab-log');
                if (logTabContent && newLogs) {
                    logTabContent.innerHTML = generateActivityLogHTML(newLogs);
                }
            }
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

    const lastRenewal = agent.last_renewal_date ? new Date(agent.last_renewal_date) : new Date(agent.created_at);
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
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    let query = supabase
        .from('competitions')
        .select('id, name, created_at, views_count, reactions_count, participants_count')
        .eq('agent_id', agent.id)
        .not('views_count', 'is', null);

    // --- NEW: Date Range Filtering ---
    if (dateRange !== 'all') {
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        let startDate = new Date();

        if (dateRange === '7d') {
            startDate.setDate(today.getDate() - 7);
        } else if (dateRange === '30d') {
            startDate.setDate(today.getDate() - 30);
        } else if (dateRange === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        }
        startDate.setHours(0, 0, 0, 0); // Start of the day

        query = query.gte('created_at', startDate.toISOString()).lte('created_at', today.toISOString());
    }

    const { data: competitions, error } = await query.order('created_at', { ascending: false });

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
        const dateString = new Date(comp.created_at).toISOString().split('T')[0];
        if (dailyData[dateString]) {
            dailyData[dateString].views += comp.views_count || 0;
            dailyData[dateString].reactions += comp.reactions_count || 0;
            dailyData[dateString].participants += comp.participants_count || 0;
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

function renderEditProfileHeader(agent, parentElement) {
    const headerV2 = parentElement.querySelector('.profile-header-v2');
    if (!headerV2) return;

    const originalHeaderHTML = headerV2.innerHTML;

    headerV2.innerHTML = `
        <form id="edit-profile-form" class="profile-header-edit-form">
            <div class="profile-avatar-edit">
                <img src="${agent.avatar_url || 'https://via.placeholder.com/80/8A2BE2/FFFFFF?text=inzo'}" alt="Avatar" id="avatar-preview">
                <label for="avatar-upload" class="btn-secondary" style="cursor: pointer;">
                    <i class="fas fa-upload"></i> تغيير الصورة
                </label>
                <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
            </div>
            <div style="flex-grow: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group"><label for="edit-agent-name">اسم الوكيل</label><input type="text" id="edit-agent-name" value="${agent.name}" required></div>
                <div class="form-group"><label for="edit-agent-id">رقم الوكالة</label><input type="text" id="edit-agent-id" value="${agent.agent_id}" required></div>
                <div class="form-group">
                    <label for="edit-agent-classification">التصنيف</label>
                    <select id="edit-agent-classification">
                        <option value="R" ${agent.classification === 'R' ? 'selected' : ''}>R</option>
                        <option value="A" ${agent.classification === 'A' ? 'selected' : ''}>A</option>
                        <option value="B" ${agent.classification === 'B' ? 'selected' : ''}>B</option>
                        <option value="C" ${agent.classification === 'C' ? 'selected' : ''}>C</option>
                    </select>
                </div>
                <div class="form-group"><label for="telegram-channel-url">رابط قناة التلجرام</label><input type="text" id="telegram-channel-url" value="${agent.telegram_channel_url || ''}"></div>
                <div class="form-group"><label for="telegram-group-url">رابط جروب التلجرام</label><input type="text" id="telegram-group-url" value="${agent.telegram_group_url || ''}"></div>
                <div class="form-group"><label for="edit-telegram-chat-id">معرف الدردشة (Chat ID)</label><input type="text" id="edit-telegram-chat-id" value="${agent.telegram_chat_id || ''}" placeholder="مثال: -100123456789"></div>
                <div class="form-group"><label for="edit-telegram-group-name">اسم مجموعة التلجرام</label><input type="text" id="edit-telegram-group-name" value="${agent.telegram_group_name || ''}"></div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label style="margin-bottom: 10px;">أيام التدقيق</label>
                    <div class="days-selector-v2">
                        ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((day, index) => `
                            <div class="day-toggle-wrapper">
                                <input type="checkbox" id="day-edit-${index}" value="${index}" class="day-toggle-input" ${(agent.audit_days || []).includes(index) ? 'checked' : ''}>
                                <label for="day-edit-${index}" class="day-toggle-btn">${day}</label>
                            </div>`).join('')}
                    </div>
                </div>
            </div>
            <div class="form-actions" style="align-self: flex-start;">
                <button type="submit" id="save-profile-btn" class="btn-primary"><i class="fas fa-save"></i> حفظ</button>
                <button type="button" id="cancel-edit-btn" class="btn-secondary">إلغاء</button>
            </div>
        </form>
    `;

    // Preview avatar URL change
    const avatarUploadInput = headerV2.querySelector('#avatar-upload');
    const avatarPreview = headerV2.querySelector('#avatar-preview');
    avatarUploadInput.addEventListener('change', () => {
        const file = avatarUploadInput.files[0];
        if (file) {
            avatarPreview.src = URL.createObjectURL(file);
        }
    });

    headerV2.querySelector('#cancel-edit-btn').addEventListener('click', () => {
        headerV2.innerHTML = originalHeaderHTML;
        // Re-attach the original edit button listener
        headerV2.querySelector('#edit-profile-btn').addEventListener('click', () => {
            renderEditProfileHeader(agent, parentElement);
        });
    });

    headerV2.querySelector('#edit-profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = headerV2.querySelector('#save-profile-btn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        const newAgentId = headerV2.querySelector('#edit-agent-id').value;

        // NEW: Check for agent_id uniqueness on update
        if (newAgentId !== agent.agent_id) {
            const { data: existingAgents, error: checkError } = await supabase
                .from('agents')
                .select('id')
                .eq('agent_id', newAgentId);

            if (checkError) {
                console.error('Error checking for existing agent on update:', checkError);
                showToast('حدث خطأ أثناء التحقق من رقم الوكالة.', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
                return;
            }

            if (existingAgents && existingAgents.length > 0) {
                showToast('رقم الوكالة هذا مستخدم بالفعل لوكيل آخر.', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
                return;
            }
        }

        const avatarFile = headerV2.querySelector('#avatar-upload').files[0];
        let newAvatarUrl = agent.avatar_url;

        // 1. Handle file upload if a new file is selected
        if (avatarFile) {
            const filePath = `${agent.id}-${Date.now()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, avatarFile);

            if (uploadError) {
                showToast('فشل رفع الصورة. يرجى المحاولة مرة أخرى.', 'error');
                console.error('Avatar upload error:', uploadError);
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
                return; // Stop the process
            }

            // 2. Get the public URL of the uploaded file
            const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);
            
            newAvatarUrl = urlData.publicUrl;
        }

        const selectedDays = Array.from(headerV2.querySelectorAll('.days-selector-v2 input:checked')).map(input => parseInt(input.value, 10));

        // 3. Prepare the data to update in the 'agents' table
        const updatedData = {
            name: headerV2.querySelector('#edit-agent-name').value,
            agent_id: newAgentId,
            classification: headerV2.querySelector('#edit-agent-classification').value,
            audit_days: selectedDays,
            telegram_channel_url: headerV2.querySelector('#telegram-channel-url').value || null,
            telegram_group_url: headerV2.querySelector('#telegram-group-url').value || null,
            telegram_chat_id: headerV2.querySelector('#edit-telegram-chat-id').value || null,
            telegram_group_name: headerV2.querySelector('#edit-telegram-group-name').value || null,
            avatar_url: newAvatarUrl,
        };

        // 4. Update the agent's record
        const { error } = await supabase.from('agents').update(updatedData).eq('id', agent.id);

        if (error) {
            console.error('Error updating agent:', error);
            showToast(`فشل تحديث بيانات الوكيل: ${error.message}`, 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
        } else {
            // Log the activity
            const changedKeys = Object.keys(updatedData)
                .filter(key => JSON.stringify(updatedData[key]) !== JSON.stringify(agent[key]));

            if (changedKeys.length > 0) {
                const fieldLabels = {
                    name: 'الاسم',
                    agent_id: 'رقم الوكالة',
                    classification: 'التصنيف',
                    audit_days: 'أيام التدقيق',
                    telegram_channel_url: 'رابط قناة التلجرام',
                    telegram_group_url: 'رابط جروب التلجرام',
                    telegram_chat_id: 'معرف الدردشة',
                    telegram_group_name: 'اسم مجموعة التلجرام',
                    avatar_url: 'الصورة الشخصية'
                  };
                const changeDescriptions = changedKeys.map(key => {
                    const label = fieldLabels[key] || key;
                    const oldValue = agent[key] || 'فارغ';
                    const newValue = updatedData[key] || 'فارغ';
                    // For arrays like audit_days, make them readable
                    const oldDisplay = Array.isArray(oldValue) ? oldValue.join(', ') : oldValue;
                    const newDisplay = Array.isArray(newValue) ? newValue.join(', ') : newValue;
                    return `"${label}" من "${oldDisplay}" إلى "${newDisplay}"`;
                }).join('، ');
                await logAgentActivity(agent.id, 'PROFILE_UPDATE', `تم تحديث الملف الشخصي: ${changeDescriptions}.`);
            }

            showToast('تم تحديث بيانات الوكيل بنجاح.', 'success');
            // تحسين: بدلاً من إعادة تحميل الصفحة بالكامل، نقوم بجلب البيانات الجديدة وإعادة عرض الأجزاء المتأثرة فقط
            history.replaceState(null, '', `#profile/${agent.id}`);
            const { data: freshAgent, error: freshError } = await supabase.from('agents').select('*').eq('id', agent.id).single();
            if (freshAgent) {
                renderAgentProfilePage(agent.id); // إعادة تحميل الصفحة بالكامل لضمان تحديث كل شيء
            }
        }
    });
}

// NEW: Function to render the user's own profile settings page
async function renderProfileSettingsPage() {
    const appContent = document.getElementById('app-content');

    if (!currentUserProfile) {
        appContent.innerHTML = `<p class="error">يجب تسجيل الدخول لعرض هذه الصفحة.</p>`;
        return;
    }

    // We need the user's email, which is in `supabase.auth.user()` not our profile table.
    const { data: { user } } = await supabase.auth.getUser();

    const isSuperAdmin = currentUserProfile.role === 'super_admin';
    const isAdmin = currentUserProfile.role === 'admin';
    const roleBadge = isSuperAdmin ? '<span class="admin-badge super-admin">مدير عام</span>' : (isAdmin ? '<span class="admin-badge">مسؤول</span>' : '<span class="employee-badge">موظف</span>');

    appContent.innerHTML = `
        <div class="page-header">
            <h1><i class="fas fa-user-cog"></i> إعدادات الملف الشخصي</h1>
        </div>

        <!-- NEW: Profile Header Section for display -->
        <div class="profile-settings-header">
            <div class="profile-avatar-edit large-avatar">
                <img src="${currentUserProfile.avatar_url || `https://ui-avatars.com/api/?name=${currentUserProfile.full_name || user?.email}&background=8A2BE2&color=fff&size=128`}" alt="Avatar" id="avatar-preview">
                <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
            </div>
            <div class="profile-header-info">
                <h2 class="profile-name-display">${currentUserProfile.full_name || 'مستخدم'} ${roleBadge}</h2>
                <p class="profile-email-display">${user?.email || ''}</p>
            </div>
        </div>

        <div class="form-container" style="max-width: 800px;">
            <form id="profile-settings-form">
                ${currentUserProfile.role === 'admin' ? `
                    <h3 class="details-section-title">المعلومات الأساسية</h3>
                    <div class="details-grid" style="grid-template-columns: 1fr; gap: 20px;"><div class="form-group"><label for="profile-full-name">الاسم الكامل</label><input type="text" id="profile-full-name" class="profile-name-input" value="${currentUserProfile.full_name || ''}" required></div></div>
                ` : ''}
                
                <h3 class="details-section-title">تغيير كلمة المرور</h3>
                <div class="details-grid" style="grid-template-columns: 1fr; gap: 20px;">
                    <div class="form-group">
                        <label for="profile-current-password">كلمة المرور الحالية</label>
                        <div class="password-input-wrapper">
                            <input type="password" id="profile-current-password" placeholder="أدخل كلمة المرور الحالية للتغيير">
                            <button type="button" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                            <div id="current-password-validation-msg" class="validation-status-inline"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="profile-new-password">كلمة المرور الجديدة</label>
                        <div class="password-input-wrapper">
                            <input type="password" id="profile-new-password" placeholder="اتركه فارغاً لعدم التغيير">
                            <button type="button" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                        </div>
                        <div class="password-strength-meter"><div class="strength-bar"></div></div>
                        <div class="password-actions">
                            <button type="button" id="generate-password-btn" class="btn-secondary btn-small">إنشاء كلمة مرور قوية</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="profile-confirm-password">تأكيد كلمة المرور الجديدة</label>
                        <div class="password-input-wrapper">
                            <input type="password" id="profile-confirm-password">
                            <button type="button" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                            <div id="password-match-error" class="validation-error-inline" style="display: none;">كلمتا المرور غير متطابقتين.</div>
                        </div>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" id="save-profile-settings-btn" class="btn-primary">
                        <i class="fas fa-save"></i> حفظ التغييرات
                    </button>
                </div>
            </form>
        </div>
    `;

    const form = document.getElementById('profile-settings-form');
    const saveBtn = form.querySelector('#save-profile-settings-btn');
    const newPasswordInput = form.querySelector('#profile-new-password');
    const confirmPasswordInput = form.querySelector('#profile-confirm-password');
    const currentPasswordInput = form.querySelector('#profile-current-password');
    const validationMsgEl = form.querySelector('#current-password-validation-msg');

    // --- NEW: Real-time current password validation on blur ---
    currentPasswordInput.addEventListener('blur', async () => {
        const password = currentPasswordInput.value;

        // Clear previous message if input is empty
        if (!password) {
            validationMsgEl.innerHTML = '';
            validationMsgEl.className = 'validation-status-inline';
            return;
        }

        // Show a loading indicator
        validationMsgEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>جاري التحقق...</span>';
        validationMsgEl.className = 'validation-status-inline checking';

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            const { error: reauthError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password
            });

            if (reauthError) {
                validationMsgEl.innerHTML = '<i class="fas fa-times-circle"></i> <span>كلمة المرور الحالية غير صحيحة.</span>';
                validationMsgEl.className = 'validation-status-inline error';
            } else {
                validationMsgEl.innerHTML = '<i class="fas fa-check-circle"></i> <span>كلمة المرور صحيحة.</span>';
                validationMsgEl.className = 'validation-status-inline success';
            }
        } catch (e) {
            validationMsgEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>حدث خطأ أثناء التحقق.</span>';
            validationMsgEl.className = 'validation-status-inline error';
        }
    });

    // --- Avatar Logic ---
    const avatarUploadInput = document.getElementById('avatar-upload');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarEditContainer = document.querySelector('.profile-settings-header .profile-avatar-edit');

    if (avatarEditContainer) {
        avatarEditContainer.addEventListener('click', () => {
            if (currentUserProfile.role === 'admin') {
                avatarUploadInput.click();
            }
        });
    }
    if (avatarUploadInput) {
        avatarUploadInput.addEventListener('change', () => {
            const file = avatarUploadInput.files[0];
            if (file) avatarPreview.src = URL.createObjectURL(file);
        });
    }

    // --- Password Toggles & Strength Meter ---
    form.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.password-input-wrapper').querySelector('input');
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.querySelector('i').className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'}`;
        });
    });
    const strengthBar = form.querySelector('.strength-bar');
    newPasswordInput.addEventListener('input', () => {
        const password = newPasswordInput.value;
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/\d/)) strength++;
        if (password.match(/[^a-zA-Z\d]/)) strength++;
        strengthBar.className = 'strength-bar';
        if (strength > 0) strengthBar.classList.add(`strength-${strength}`);
    });

    // --- Generate Password Button ---
    const generatePasswordBtn = form.querySelector('#generate-password-btn');
    if (generatePasswordBtn) {
        generatePasswordBtn.addEventListener('click', () => {
            const lower = 'abcdefghijklmnopqrstuvwxyz';
            const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const numbers = '0123456789';
            const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
            const all = lower + upper + numbers + symbols;
            let newPassword = '';
            newPassword += lower.charAt(Math.floor(Math.random() * lower.length));
            newPassword += upper.charAt(Math.floor(Math.random() * upper.length));
            newPassword += numbers.charAt(Math.floor(Math.random() * numbers.length));
            newPassword += symbols.charAt(Math.floor(Math.random() * symbols.length));
            for (let i = newPassword.length; i < 14; i++) {
                newPassword += all.charAt(Math.floor(Math.random() * all.length));
            }
            newPassword = newPassword.split('').sort(() => 0.5 - Math.random()).join('');
            newPasswordInput.value = newPassword;
            confirmPasswordInput.value = newPassword;
            newPasswordInput.dispatchEvent(new Event('input')); // Trigger strength check
            navigator.clipboard.writeText(newPassword).then(() => {
                showToast('تم إنشاء ونسخ كلمة مرور قوية.', 'success');
            });
        });
    }

    // --- Real-time password match validation ---
    const passwordMatchError = form.querySelector('#password-match-error');
    const validatePasswordMatch = () => {
        if (newPasswordInput.value && confirmPasswordInput.value && newPasswordInput.value !== confirmPasswordInput.value) {
            passwordMatchError.style.display = 'block';
            saveBtn.disabled = true;
        } else {
            passwordMatchError.style.display = 'none';
            saveBtn.disabled = false;
        }
    };
    newPasswordInput.addEventListener('input', validatePasswordMatch);
    confirmPasswordInput.addEventListener('input', validatePasswordMatch);

    // --- Disable form elements for non-admins ---
    if (currentUserProfile.role !== 'admin') {
        const fullNameInput = form.querySelector('#profile-full-name');
        if (fullNameInput) fullNameInput.disabled = true;
        avatarEditContainer.style.cursor = 'not-allowed';
        avatarEditContainer.title = 'لا يمكنك تغيير الصورة الشخصية.';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // --- Submission Logic ---
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        const fullNameInput = document.getElementById('profile-full-name');
        const fullName = fullNameInput ? fullNameInput.value : currentUserProfile.full_name;
        const newPassword = newPasswordInput.value; // FIX: Define newPassword variable
        const confirmPassword = document.getElementById('profile-confirm-password').value;
        const currentPassword = document.getElementById('profile-current-password').value;

        try {
            // --- Password Validation ---
            if (newPassword && !currentPassword) {
                throw new Error('يجب إدخال كلمة المرور الحالية لتغييرها.');
            }
            if (newPassword !== confirmPassword) {
                throw new Error('كلمتا المرور الجديدتان غير متطابقتين.');
            }

            // 1. Handle avatar upload if a new file is selected
            const avatarFile = document.getElementById('avatar-upload').files[0];
            let newAvatarUrl = currentUserProfile.avatar_url;

            if (avatarFile) {
                const filePath = `user-avatars/${currentUserProfile.id}-${Date.now()}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile);

                if (uploadError) {
                    throw new Error('فشل رفع الصورة. يرجى المحاولة مرة أخرى.');
                }

                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                newAvatarUrl = urlData.publicUrl;
            }

            // 2. Update public profile table (users)
            const profileUpdateData = { avatar_url: newAvatarUrl };
            if (currentUserProfile.role === 'admin' && fullNameInput) {
                profileUpdateData.full_name = fullName;
            }

            const { error: profileError } = await supabase
                .from('users')
                .update(profileUpdateData)
                .eq('id', currentUserProfile.id);

            if (profileError) throw profileError;

            // 3. If a new password is provided, verify old and update in auth
            if (newPassword && currentPassword) {
                // --- FIX: Verify current password by attempting a sign-in ---
                // This is a secure way to confirm the user knows their current password.
                const { data: { user: authUser } } = await supabase.auth.getUser();
                const { error: reauthError } = await supabase.auth.signInWithPassword({
                    email: authUser.email,
                    password: currentPassword
                });
                if (reauthError) throw new Error('كلمة المرور الحالية غير صحيحة.');

                // If re-authentication is successful, update the password
                const { error: passwordError } = await supabase.auth.updateUser({
                    password: newPassword
                });
                if (passwordError) throw passwordError;
            }

            // 4. Refresh local user profile data to reflect changes
            await fetchUserProfile();

            showToast('تم تحديث الملف الشخصي بنجاح.', 'success');

            // NEW: If password was changed, clear fields and hide the section
            if (newPassword) {
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
                validationMsgEl.innerHTML = '';
                validationMsgEl.className = 'validation-status-inline';
                form.querySelector('#password-match-error').style.display = 'none';
                form.querySelector('.strength-bar').className = 'strength-bar';
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast(`فشل تحديث الملف الشخصي: ${error.message}`, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التغييرات';
        }
    });
}