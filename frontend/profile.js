async function renderAgentProfilePage(agentId, options = {}) {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = '';

    if (!supabase) {
        appContent.innerHTML = `<p class="error">لا يمكن عرض الملف الشخصي، لم يتم الاتصال بقاعدة البيانات.</p>`;
        return;
    }

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

    const hasActiveCompetition = agentCompetitions.some(c => c.is_active);
    const hasInactiveCompetition = !hasActiveCompetition && agentCompetitions.length > 0;

    let birthdayIndicator = '';
    if (agent.birth_date) {
        const today = new Date();
        const birthDate = new Date(agent.birth_date);
        // Compare month and day, ignoring year and timezone differences
        if (today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate()) {
            birthdayIndicator = `<button id="send-birthday-greeting-btn" class="birthday-badge"><i class="fas fa-birthday-cake"></i> عيد ميلاد سعيد!</button>`;
        }
    }

    // Helper for audit days in Action Tab
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const auditDaysHtml = (agent.audit_days && agent.audit_days.length > 0)
        ? agent.audit_days.sort().map(dayIndex => `<span class="day-tag">${dayNames[dayIndex]}</span>`).join('')
        : '<span class="day-tag-none">لا توجد أيام محددة</span>';

    appContent.innerHTML = `
        <div class="profile-page-top-bar">
            <button id="back-btn" class="btn-secondary">&larr; عودة</button>
            <div id="renewal-countdown-timer" class="countdown-timer" style="display: none;"></div>
        </div>
        
        <div class="profile-header-v2">
            <div class="profile-avatar">
                ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Avatar">` : '<i class="fas fa-user-astronaut"></i>'}
            </div>
            <div class="profile-main-info">
                <h1>
                    ${agent.name} 
                    ${hasActiveCompetition ? '<span class="status-badge active">مسابقة نشطة</span>' : ''}
                    ${birthdayIndicator}
                    ${hasInactiveCompetition ? '<span class="status-badge inactive">مسابقة غير نشطة</span>' : ''}
                </h1>
                <p>رقم الوكالة: <strong class="agent-id-text" title="نسخ الرقم">${agent.agent_id}</strong> | التصنيف: ${agent.classification} | المرتبة: ${agent.rank || 'غير محدد'}</p>
                <p>روابط التلجرام: ${agent.telegram_channel_url ? `<a href="${agent.telegram_channel_url}" target="_blank">القناة</a>` : 'القناة (غير محدد)'} | ${agent.telegram_group_url ? `<a href="${agent.telegram_group_url}" target="_blank">الجروب</a>` : 'الجروب (غير محدد)'}</p>
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
                    </div>
                </div>
            </div>
        </div>
        <div id="tab-details" class="tab-content">
            <h2>تفاصيل الوكيل</h2>
            <div id="details-content"></div>
        </div>
        <div id="tab-agent-competitions" class="tab-content">
            <h2>مسابقات الوكيل</h2>
            <div id="agent-competitions-content"></div>
        </div>
        <div id="tab-log" class="tab-content">
            <h2>سجل النشاط</h2>
            <p>لا توجد سجلات حالياً لهذا الوكيل.</p>
        </div>
    `;
 
    startRenewalCountdown(agent);

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

    // Birthday Greeting Button
    const birthdayBtn = document.getElementById('send-birthday-greeting-btn');
    if (birthdayBtn) {
        birthdayBtn.addEventListener('click', () => {
            const clicheText = `🎉 عيد ميلاد سعيد لشريكنا المميز ${agent.name}! 🎉

تتمنى لك أسرة inzo يوماً رائعاً وعاماً مليئاً بالنجاح والتألق. 🎂`;

            showConfirmationModal(
                `<p>هل أنت متأكد من إرسال تهنئة عيد الميلاد إلى قناة التلجرام؟</p>
                 <textarea class="modal-textarea-preview" readonly>${clicheText}</textarea>`,
                async () => {
                    try {
                        const response = await fetch('/api/post-announcement', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: clicheText })
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.message || 'فشل الاتصال بالخادم.');

                        showToast('تم إرسال تهنئة عيد الميلاد بنجاح.', 'success');
                        await logAgentActivity(agent.id, 'BIRTHDAY_GREETING_SENT', 'تم إرسال تهنئة عيد الميلاد إلى تلجرام.');
                    } catch (error) {
                        showToast(`فشل إرسال التهنئة: ${error.message}`, 'error');
                    }
                },
                {
                    title: 'تهنئة عيد ميلاد',
                    confirmText: 'إرسال التهنئة',
                    confirmClass: 'btn-primary'
                }
            );
        });
    }

    document.getElementById('create-agent-competition').addEventListener('click', () => {
        window.location.hash = `competitions/new?agentId=${agent.id}`;
    });

    document.getElementById('send-bonus-cliche-btn').addEventListener('click', async () => {
        // 1. Construct the message
        const renewalPeriodMap = {
            'weekly': 'أسبوعي',
            'biweekly': 'كل أسبوعين',
            'monthly': 'شهري'
        };
        const renewalText = renewalPeriodMap[agent.renewal_period] || 'تداولي';

        const clicheText = `دمت بخير شريكنا العزيز ${agent.name} ...
يسرنا ان نحيطك علما بأن حضرتك كوكيل لدى شركة انزو تتمتع برصيد مسابقات (${renewalText}) قيمته ${agent.remaining_balance || 0}$ و ${agent.deposit_bonus_percentage || 0}% بونص ايداع لـ ${agent.remaining_deposit_bonus || 0} مرات.
بامكانك الاستفادة منه من خلال انشاء مسابقات اسبوعية لتنمية وتطوير العملاء التابعين للوكالة. هل ترغب بارسال مسابقة لحضرتك؟`;

        // 2. Show confirmation modal before sending
        showConfirmationModal(
            `<p>هل أنت متأكد من إرسال رسالة تذكير البونص إلى قناة التلجرام؟</p>
             <textarea class="modal-textarea-preview" readonly>${clicheText}</textarea>`,
            async () => {
                // 3. Send to backend on confirmation
                try {
                    const response = await fetch('/api/post-announcement', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: clicheText })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'فشل الاتصال بالخادم.');

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
        const clicheText = `دمت بخير شريكنا العزيز ${agent.name}،

يرجى اختيار الفائزين بالمسابقة الاخيرة التي تم انتهاء مدة المشاركة بها 
وتزويدنا بفيديو الروليت والاسم الثلاثي و معلومات الحساب لكل فائز قبل الاعلان عنهم في قناتكم كي يتم التحقق منهم من قبل القسم المختص

كما يجب اختيار الفائزين بالقرعة لشفافية الاختيار.`;

        // Show confirmation modal before sending
        showConfirmationModal(
            `<p>هل أنت متأكد من إرسال طلب اختيار الفائزين إلى قناة التلجرام؟</p>
             <textarea class="modal-textarea-preview" readonly>${clicheText}</textarea>`,
            async () => {
                // Send to backend on confirmation
                try {
                    const response = await fetch('/api/post-announcement', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: clicheText })
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
    editBtn.addEventListener('click', () => {
        renderEditProfileHeader(agent, appContent);
    });

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
    const logTabContent = document.getElementById('tab-log');
    if (agentLogs && agentLogs.length > 0) {
        logTabContent.innerHTML = generateActivityLogHTML(agentLogs);
    }

    // Render competitions in the new "agent-competitions" tab
    const agentCompetitionsContent = document.getElementById('agent-competitions-content');
    if (agentCompetitions && agentCompetitions.length > 0) {
        agentCompetitionsContent.innerHTML = `
            <div class="competitions-grid">
                ${agentCompetitions.map(comp => {
                    const endDate = agent.winner_selection_date ? new Date(agent.winner_selection_date) : null;
                    let countdownHtml = '';
                    if (endDate) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const diffTime = endDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        let countdownText = '';
                        if (diffDays > 0) countdownText = `(متبقي ${diffDays} أيام)`;
                        else if (diffDays === 0) countdownText = `(تنتهي اليوم)`;
                        else countdownText = `(منتهية)`;
                        countdownHtml = `<p><i class="fas fa-calendar-alt"></i><div><strong>تاريخ الانتهاء:</strong> ${endDate.toLocaleDateString('ar-EG')} ${countdownText}</div></p>`;
                    }

                    return `
                    <div class="competition-card">
                        <div class="competition-card-header">
                            <h3>${comp.name}</h3>
                            <span class="status-badge ${comp.is_active ? 'active' : 'inactive'}">${comp.is_active ? 'نشطة' : 'غير نشطة'}</span>
                        </div>
                        <div class="competition-card-body">
                            ${countdownHtml}
                            <p class="description"><i class="fas fa-info-circle"></i><div><strong>الوصف:</strong> ${comp.description || '<em>لا يوجد وصف</em>'}</div></p>
                        </div>
                        <div class="competition-card-footer">
                            <button class="btn-secondary edit-btn" onclick="window.location.hash='#competitions/edit/${comp.id}'"><i class="fas fa-edit"></i> تعديل</button>
                            <button class="btn-danger delete-competition-btn" data-id="${comp.id}"><i class="fas fa-trash-alt"></i> حذف</button>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    } else {
        agentCompetitionsContent.innerHTML = '<p>لا توجد مسابقات خاصة بهذا الوكيل بعد.</p>';
    }

    agentCompetitionsContent.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-competition-btn');
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

    // Render the content for the details tab
    renderDetailsView(agent);
}

function generateActivityLogHTML(logs) {
    const getLogIconDetails = (actionType) => {
        if (actionType.includes('CREATED')) return { icon: 'fa-user-plus', colorClass: 'log-icon-create' };
        if (actionType.includes('DELETED')) return { icon: 'fa-user-slash', colorClass: 'log-icon-delete' };
        if (actionType.includes('PROFILE_UPDATE')) return { icon: 'fa-user-edit', colorClass: 'log-icon-profile' };
        if (actionType.includes('DETAILS_UPDATE')) return { icon: 'fa-cogs', colorClass: 'log-icon-details' };
        if (actionType.includes('COMPETITION_CREATED')) return { icon: 'fa-trophy', colorClass: 'log-icon-competition' };
        if (actionType.includes('BONUS_CLICHE_SENT')) return { icon: 'fa-paper-plane', colorClass: 'log-icon-telegram' };
        if (actionType.includes('BIRTHDAY_GREETING_SENT')) return { icon: 'fa-birthday-cake', colorClass: 'log-icon-birthday' };
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
                                <p class="log-timestamp">${new Date(log.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
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
    const container = document.getElementById('details-content');
    if (!container) return;

    const createFieldHTML = (label, value, fieldName, isEditable = true) => {
        const numericFields = ['competition_bonus', 'deposit_bonus_count', 'deposit_bonus_percentage', 'consumed_balance', 'remaining_balance', 'used_deposit_bonus', 'remaining_deposit_bonus', 'single_competition_balance', 'winners_count', 'prize_per_winner', 'competitions_per_week'];
        let displayValue;
        let iconHtml;

        if (isEditable) {
            iconHtml = `<span class="inline-edit-trigger" title="قابل للتعديل"><i class="fas fa-pen"></i></span>`;
        } else {
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

    container.innerHTML = `
        <div class="details-grid">
            <h3 class="details-section-title">المرتبة والمكافآت</h3>
            ${createFieldHTML('المرتبة', agent.rank, 'rank', true)}
            ${createFieldHTML('بونص المسابقات (تداولي)', agent.competition_bonus, 'competition_bonus', false)}
            ${createFieldHTML('مرات بونص الإيداع', agent.deposit_bonus_count, 'deposit_bonus_count', false)}
            ${createFieldHTML('نسبة بونص الإيداع', agent.deposit_bonus_percentage, 'deposit_bonus_percentage', false)}
            
            <h3 class="details-section-title">الأرصدة</h3>
            ${createFieldHTML('رصيد مستهلك', agent.consumed_balance, 'consumed_balance', false)}
            ${createFieldHTML('رصيد متبقي', agent.remaining_balance, 'remaining_balance', false)}            
            ${createFieldHTML('بونص إيداع مستخدم', agent.used_deposit_bonus, 'used_deposit_bonus', false)}
            ${createFieldHTML('بونص إيداع متبقي', agent.remaining_deposit_bonus, 'remaining_deposit_bonus', false)}

            <h3 class="details-section-title">إعدادات المسابقة الواحدة</h3>
            ${createFieldHTML('رصيد المسابقة الواحدة', agent.single_competition_balance, 'single_competition_balance', true)}
            ${createFieldHTML('عدد الفائزين', agent.winners_count, 'winners_count', true)}
            ${createFieldHTML('جائزة كل فائز', agent.prize_per_winner, 'prize_per_winner', false)}
            
            <h3 class="details-section-title">التجديد والمدة</h3>
            ${createFieldHTML('يجدد كل', agent.renewal_period, 'renewal_period', true)}
            ${createFieldHTML('عدد المسابقات كل أسبوع', agent.competitions_per_week, 'competitions_per_week', true)}
            ${createFieldHTML('مدة المسابقة', agent.competition_duration, 'competition_duration', false)}
            ${createFieldHTML('تاريخ آخر مسابقة', agent.last_competition_date, 'last_competition_date', false)}
            ${createFieldHTML('تاريخ اختيار الفائز', agent.winner_selection_date, 'winner_selection_date', false)}
        </div>
    `;

    // Use event delegation on the container
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    newContainer.addEventListener('click', (e) => {
        const trigger = e.target.closest('.inline-edit-trigger');
        if (trigger) {
            const group = trigger.closest('.details-group');
            renderInlineEditor(group, agent);
        }
    });

}



function renderInlineEditor(groupElement, agent) {
    const fieldName = groupElement.dataset.field;
    const originalContent = groupElement.innerHTML;
    const currentValue = agent[fieldName];
    const label = groupElement.querySelector('label').textContent;

    let editorHtml = '';

    // Special cases for read-only fields
    if (['competition_bonus', 'deposit_bonus_percentage', 'deposit_bonus_count', 'remaining_balance', 'remaining_deposit_bonus', 'winner_selection_date', 'prize_per_winner', 'competition_duration', 'consumed_balance', 'used_deposit_bonus', 'last_competition_date'].includes(fieldName)) {
        showToast('يتم حساب هذا الحقل تلقائياً.', 'info');
        return;
    }

    switch (fieldName) {
        case 'rank':
            editorHtml = `<select id="inline-edit-input">
                <option value="">-- اختر --</option>
                <optgroup label="⁕ مراتب الوكالة الأعتيادية ⁖">
                ${Object.keys(RANKS_DATA).slice(0, 4).map(rank => `<option value="${rank}" ${currentValue === rank ? 'selected' : ''}>${rank}</option>`).join('')}
                </optgroup>
                <optgroup label="⁕ مراتب الوكالة الحصرية ⁖">
                ${Object.keys(RANKS_DATA).slice(4).map(rank => `<option value="${rank}" ${currentValue === rank ? 'selected' : ''}>${rank}</option>`).join('')}
                </optgroup>
            </select>`;
            break;
        case 'renewal_period':
            editorHtml = `<select id="inline-edit-input"><option value="weekly" ${currentValue === 'weekly' ? 'selected' : ''}>أسبوع</option><option value="biweekly" ${currentValue === 'biweekly' ? 'selected' : ''}>أسبوعين</option><option value="monthly" ${currentValue === 'monthly' ? 'selected' : ''}>شهر</option></select>`;
            break;
        case 'competitions_per_week':
            editorHtml = `<select id="inline-edit-input"><option value="1" ${currentValue == 1 ? 'selected' : ''}>1</option><option value="2" ${currentValue == 2 ? 'selected' : ''}>2</option><option value="3" ${currentValue == 3 ? 'selected' : ''}>3</option></select>`;
            break;
        case 'last_competition_date':
            editorHtml = `<input type="date" id="inline-edit-input" value="${currentValue || ''}">`;
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
            updateData.remaining_balance = (rankData.competition_bonus || 0) - (currentAgent.consumed_balance || 0);
            updateData.remaining_deposit_bonus = (rankData.deposit_bonus_count || 0) - (currentAgent.used_deposit_bonus || 0);
        } else {
            let finalValue;
            if (fieldName.includes('_date')) {
                finalValue = newValue === '' ? null : newValue;
            } else {
                const parsedValue = parseFloat(newValue);
                finalValue = newValue === '' ? null : (isNaN(parsedValue) ? newValue : parsedValue);
            }
            updateData[fieldName] = finalValue;

            // Interconnected logic on save
            if (fieldName === 'consumed_balance') {
                updateData.remaining_balance = (currentAgent.competition_bonus || 0) - (finalValue || 0);
            } else if (fieldName === 'used_deposit_bonus') {
                updateData.remaining_deposit_bonus = (currentAgent.deposit_bonus_count || 0) - (finalValue || 0);
            } else if (fieldName === 'last_competition_date') {
                const duration = currentAgent.competition_duration;
                if (duration && finalValue) {
                    const durationMap = { '24h': 1, '48h': 2, 'monthly': 30 };
                    const durationDays = durationMap[duration] || 0;
                    const newDate = new Date(finalValue);
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

        const { data: updatedAgent, error } = await supabase.from('agents').update(updateData).eq('id', agent.id).select().single();

        if (error) {
            console.error('Error updating field:', error);
            showToast(`فشل تحديث الحقل: ${error.message}`, 'error');
            renderDetailsView(agent); // Revert on error
        } else {
            const oldValue = currentAgent[fieldName];
            const description = `تم تحديث "${label}" من "${oldValue || 'فارغ'}" إلى "${newValue || 'فارغ'}".`;
            await logAgentActivity(agent.id, 'DETAILS_UPDATE', description, { field: label, from: oldValue, to: newValue });
            showToast('تم حفظ التغيير بنجاح.', 'success');
            // If rank was changed, a full re-render is needed to update all dependent fields (bonuses, balances, etc.)
            if (fieldName === 'rank') {
                renderAgentProfilePage(agent.id, { activeTab: 'details' });
            } else {
                renderDetailsView(updatedAgent); // For other fields, just re-render the details view to avoid page jump
            }
        }
    });
}

function stopRenewalCountdown() {
    if (renewalCountdownInterval) {
        clearInterval(renewalCountdownInterval);
        renewalCountdownInterval = null;
        console.log('[Debug] Profile countdown timer cleared.');
    }
}

let renewalCountdownInterval;
function startRenewalCountdown(agent) {
    const countdownElement = document.getElementById('renewal-countdown-timer');
    if (!countdownElement || !agent.renewal_period || agent.renewal_period === 'none') {
        if(countdownElement) countdownElement.style.display = 'none';
        return;
    }

    // Clear any existing interval
    stopRenewalCountdown();

    // If last_renewal_date is null, it means it has never been renewed.
    // We should treat the "start" of the countdown from now, or from the last renewal date if it exists.
    const lastRenewal = !agent.last_renewal_date ? new Date() : new Date(agent.last_renewal_date);
    let nextRenewalDate = new Date(lastRenewal);

    if (agent.renewal_period === 'weekly') nextRenewalDate.setDate(lastRenewal.getDate() + 7);
    else if (agent.renewal_period === 'biweekly') nextRenewalDate.setDate(lastRenewal.getDate() + 14);
    else if (agent.renewal_period === 'monthly') nextRenewalDate.setMonth(lastRenewal.getMonth() + 1);
    else {
        countdownElement.style.display = 'none';
        return;
    }

    countdownElement.style.display = 'flex';

    function updateCountdown() {
        const now = new Date();
        const distance = nextRenewalDate - now;

        if (distance < 0) {
            countdownElement.innerHTML = `<i class="fas fa-hourglass-end"></i> <span>انتهت مدة التجديد</span>`;
            clearInterval(renewalCountdownInterval);
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        countdownElement.innerHTML = `<i class="fas fa-clock"></i> <span>التجديد خلال: ${days}ي ${hours}س ${minutes}د ${seconds}ث</span>`;
    }

    updateCountdown(); // Initial call
    renewalCountdownInterval = setInterval(updateCountdown, 1000);
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
                <div class="form-group"><label for="edit-agent-birth-date">تاريخ الميلاد</label><input type="date" id="edit-agent-birth-date" value="${agent.birth_date || ''}"></div>
                <div class="form-group"><label for="telegram-group-url">رابط جروب التلجرام</label><input type="text" id="telegram-group-url" value="${agent.telegram_group_url || ''}"></div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>أيام التدقيق</label>
                    <div class="days-selector">
                        ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((day, index) => `
                            <label class="day-checkbox"><input type="checkbox" value="${index}" ${(agent.audit_days || []).includes(index) ? 'checked' : ''}> <span>${day}</span></label>
                        `).join('')}
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

        const selectedDays = Array.from(headerV2.querySelectorAll('.days-selector input:checked')).map(input => parseInt(input.value, 10));

        // 3. Prepare the data to update in the 'agents' table
        const updatedData = {
            name: headerV2.querySelector('#edit-agent-name').value,
            agent_id: newAgentId,
            classification: headerV2.querySelector('#edit-agent-classification').value,
            audit_days: selectedDays,
            telegram_channel_url: headerV2.querySelector('#telegram-channel-url').value || null,
            telegram_group_url: headerV2.querySelector('#telegram-group-url').value || null,
            birth_date: headerV2.querySelector('#edit-agent-birth-date').value || null,
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
                    birth_date: 'تاريخ الميلاد',
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
            // Manually re-render the page to reflect changes instantly,
            // and clean the URL if it was in edit mode.
            history.replaceState(null, '', `#profile/${agent.id}`);
            renderAgentProfilePage(agent.id);
        }
    });
}