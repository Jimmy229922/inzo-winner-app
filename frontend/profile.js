const RANKS_DATA = {
    // الاعتيادية
    'Beginning': { competition_bonus: 60, deposit_bonus_percentage: null, deposit_bonus_count: null },
    'Growth': { competition_bonus: 100, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
    'Pro': { competition_bonus: 150, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
    'Elite': { competition_bonus: 200, deposit_bonus_percentage: 50, deposit_bonus_count: 4 },
    // الحصرية
    'Bronze': { competition_bonus: 150, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
    'Silver': { competition_bonus: 230, deposit_bonus_percentage: 40, deposit_bonus_count: 3 },
    'Gold': { competition_bonus: 300, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
    'Platinum': { competition_bonus: 500, deposit_bonus_percentage: 60, deposit_bonus_count: 4 },
    'Diamond': { competition_bonus: 800, deposit_bonus_percentage: 75, deposit_bonus_count: 4 },
    'Sapphire': { competition_bonus: 1100, deposit_bonus_percentage: 85, deposit_bonus_count: 4 },
    'Emerald': { competition_bonus: 2000, deposit_bonus_percentage: 90, deposit_bonus_count: 4 },
    'King': { competition_bonus: 2500, deposit_bonus_percentage: 95, deposit_bonus_count: 4 },
    'Legend': { competition_bonus: Infinity, deposit_bonus_percentage: 100, deposit_bonus_count: Infinity },
};

async function renderAgentProfilePage(agentId) {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = '';

    if (!supabase) {
        appContent.innerHTML = `<p class="error">لا يمكن عرض الملف الشخصي، لم يتم الاتصال بقاعدة البيانات.</p>`;
        return;
    }

    // Check for edit mode in hash, e.g., #profile/123/edit
    const hashParts = window.location.hash.split('/');
    const startInEditMode = hashParts.length === 3 && hashParts[2] === 'edit';

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

    appContent.innerHTML = `
        <button id="back-btn" class="btn-secondary" style="margin-bottom: 20px;">&larr; عودة</button>
        
        <div class="profile-header-v2">
            <div class="profile-avatar">
                ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Avatar">` : '<i class="fas fa-user-astronaut"></i>'}
            </div>
            <div class="profile-main-info">
                <h1>
                    ${agent.name} 
                    ${hasActiveCompetition ? '<span class="status-badge active">مسابقة نشطة</span>' : ''}
                    ${hasInactiveCompetition ? '<span class="status-badge inactive">مسابقة غير نشطة</span>' : ''}
                </h1>
                <p>رقم الوكالة: ${agent.agent_id} | التصنيف: ${agent.classification} | قناة التلجرام: ${agent.telegram_channel_url ? `<a href="${agent.telegram_channel_url}" target="_blank">زيارة</a>` : 'غير محدد'}</p>
            </div>
            <div class="profile-header-actions">
                 <button id="edit-profile-btn" class="btn-secondary"><i class="fas fa-user-edit"></i> تعديل</button>
            </div>
        </div>

        <div class="tabs">
            <button class="tab-link active" data-tab="action">Action</button>
            <button class="tab-link" data-tab="details">تفاصيل</button>
            <button class="tab-link" data-tab="log">سجل</button>
        </div>

        <div id="tab-action" class="tab-content active">
            <h2>إجراءات سريعة</h2>
            <p>إرسال رسائل أو إنشاء مسابقات خاصة بهذا الوكيل.</p>
            <div class="details-actions">
                <button id="create-agent-competition" class="btn-primary"><i class="fas fa-plus-circle"></i> إنشاء مسابقة جديدة</button>
            </div>
        </div>
        <div id="tab-details" class="tab-content">
            <h2>تفاصيل الوكيل</h2>
            <div id="details-content"></div>
        </div>
        <div id="tab-log" class="tab-content">
            <h2>سجل النشاط</h2>
            <p>لا توجد سجلات حالياً لهذا الوكيل.</p>
        </div>
    `;
 
    document.getElementById('back-btn').addEventListener('click', () => history.back());

    document.getElementById('create-agent-competition').addEventListener('click', () => {
        if (hasActiveCompetition) {
            const activeComp = agentCompetitions.find(c => c.is_active);
            const endDate = agent.winner_selection_date ? new Date(agent.winner_selection_date).toLocaleDateString('ar-EG') : 'غير محدد';
            showToast(`لا يمكن إضافة مسابقة جديدة، توجد مسابقة نشطة بالفعل ستنتهي يوم ${endDate}.`, 'error');
            return;
        }
        window.location.hash = `competitions/new?agentId=${agent.id}`;
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

    // Render competitions in the log tab
    const logTabContent = document.getElementById('tab-log');
    if (agentLogs && agentLogs.length > 0) {
        logTabContent.innerHTML = `
            <h2>سجل النشاط</h2>
            <div class="log-timeline">
                ${agentLogs.map(log => {
                    let icon = 'fa-history';
                    if (log.action_type.includes('PROFILE')) icon = 'fa-user-edit';
                    if (log.action_type.includes('DETAILS')) icon = 'fa-cogs';
                    if (log.action_type.includes('COMPETITION')) icon = 'fa-trophy';
                    return `
                        <div class="log-item">
                            <div class="log-item-icon"><i class="fas ${icon}"></i></div>
                            <div class="log-item-content">
                                <p>${log.description}</p>
                                <small>${new Date(log.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</small>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Render the content for the details tab
    renderDetailsView(agent);
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
            ${createFieldHTML('مدة المسابقة', agent.competition_duration, 'competition_duration', false)}
            ${createFieldHTML('تاريخ آخر مسابقة', agent.last_competition_date, 'last_competition_date', true)}
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
    if (['competition_bonus', 'deposit_bonus_percentage', 'deposit_bonus_count', 'remaining_balance', 'remaining_deposit_bonus', 'winner_selection_date', 'prize_per_winner', 'competition_duration'].includes(fieldName)) {
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
            renderAgentProfilePage(agent.id); // Re-render the entire profile page for instant log update
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
                <div class="form-group"><label for="telegram-url">رابط قناة التلجرام</label><input type="text" id="telegram-url" value="${agent.telegram_channel_url || ''}"></div>
                <div class="form-group">
                    <label for="edit-agent-classification">التصنيف</label>
                    <select id="edit-agent-classification">
                        <option value="R" ${agent.classification === 'R' ? 'selected' : ''}>R</option>
                        <option value="A" ${agent.classification === 'A' ? 'selected' : ''}>A</option>
                        <option value="B" ${agent.classification === 'B' ? 'selected' : ''}>B</option>
                        <option value="C" ${agent.classification === 'C' ? 'selected' : ''}>C</option>
                    </select>
                </div>
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
            const { data: existingAgent, error: checkError } = await supabase
                .from('agents')
                .select('id')
                .eq('agent_id', newAgentId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116: "exact-one" violation, which is fine if no agent is found.
                console.error('Error checking for existing agent on update:', checkError);
                showToast('حدث خطأ أثناء التحقق من رقم الوكالة.', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
                return;
            }

            if (existingAgent) {
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
            telegram_channel_url: headerV2.querySelector('#telegram-url').value || null,
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
                    telegram_channel_url: 'رابط التلجرام',
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
            history.pushState(null, '', `#profile/${agent.id}`);
            renderAgentProfilePage(agent.id);
        }
    });
}