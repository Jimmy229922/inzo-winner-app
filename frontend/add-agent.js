const RANKS_DATA = {
    // الاعتيادية
    'Beginning': { competition_bonus: 60, deposit_bonus_percentage: null, deposit_bonus_count: null },
    'Growth': { competition_bonus: 100, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
    'Pro': { competition_bonus: 150, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
    'Elite': { competition_bonus: 200, deposit_bonus_percentage: 50, deposit_bonus_count: 4 },
    // الحصرية
    'Center': { competition_bonus: 300, deposit_bonus_percentage: null, deposit_bonus_count: null },
    'Bronze': { competition_bonus: 150, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
    'Silver': { competition_bonus: 230, deposit_bonus_percentage: 40, deposit_bonus_count: 3 },
    'Gold': { competition_bonus: 300, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
    'Platinum': { competition_bonus: 500, deposit_bonus_percentage: 60, deposit_bonus_count: 4 },
    'Diamond': { competition_bonus: 800, deposit_bonus_percentage: 75, deposit_bonus_count: 4 },
    'Sapphire': { competition_bonus: 1100, deposit_bonus_percentage: 85, deposit_bonus_count: 4 },
    'Emerald': { competition_bonus: 2000, deposit_bonus_percentage: 90, deposit_bonus_count: 4 },
    'King': { competition_bonus: 2500, deposit_bonus_percentage: 95, deposit_bonus_count: 4 },
    'Legend': { competition_bonus: Infinity, deposit_bonus_percentage: 100, deposit_bonus_count: Infinity },
    'وكيل حصري بدون مرتبة': { competition_bonus: 60, deposit_bonus_percentage: null, deposit_bonus_count: null },
};

function renderAddAgentForm() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const returnPage = urlParams.get('returnTo') || 'manage-agents';

    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header"><h1><i class="fas fa-user-plus"></i> إضافة وكيل جديد</h1></div>
        <div class="form-container-v2">
            <form id="add-agent-form">
                <div class="form-section avatar-section">
                    <div class="profile-avatar-edit large-avatar">
                        <img src="https://ui-avatars.com/api/?name=?&background=8A2BE2&color=fff&size=128" alt="Avatar" id="avatar-preview">
                        <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="details-section-title"><i class="fas fa-id-card"></i> المعلومات الأساسية</h3>
                    <div class="details-grid">
                        <div class="form-group"><label for="agent-name">اسم الوكيل</label><input type="text" id="agent-name" required></div>
                        <div class="form-group">
                            <label for="agent-id">رقم الوكالة</label><input type="text" id="agent-id" required>
                            <div id="agent-id-validation" class="validation-message"></div>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="details-section-title"><i class="fab fa-telegram-plane"></i> بيانات التلجرام</h3>
                    <div class="details-grid">
                        <div class="form-group"><label for="telegram-channel-url">رابط قناة التلجرام</label><input type="text" id="telegram-channel-url"></div>
                        <div class="form-group"><label for="telegram-group-url">رابط جروب التلجرام</label><input type="text" id="telegram-group-url"></div>
                        <div class="form-group"><label for="telegram-chat-id">معرف الدردشة (Chat ID)</label><input type="text" id="telegram-chat-id" placeholder="مثال: -100123456789"></div>
                        <div class="form-group"><label for="telegram-group-name">اسم مجموعة التلجرام</label><input type="text" id="telegram-group-name"></div>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="details-section-title"><i class="fas fa-cogs"></i> إعدادات النظام</h3>
                    <div class="details-grid">
                        <div class="form-group">
                            <label for="agent-classification">التصنيف</label>
                            <select id="agent-classification"><option value="R">R</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
                        </div>
                        <div class="form-group">
                            <label for="agent-rank">المرتبة</label>
                            <select id="agent-rank">
                                <optgroup label="⁕ مراتب الوكلاء الاعتيادية ⁖">
                                    ${Object.keys(RANKS_DATA).filter(r => ['Beginning', 'Growth', 'Pro', 'Elite'].includes(r)).map((rank, index) => `<option value="${rank}" ${index === 0 ? 'selected' : ''}>🔸 ${rank}</option>`).join('')}
                                </optgroup>
                                <optgroup label="⁕ مراتب الوكالة الحصرية ⁖">
                                    <option value="وكيل حصري بدون مرتبة">⭐ وكيل حصري بدون مرتبة</option>
                                    <option disabled>──────────</option>
                                    ${Object.keys(RANKS_DATA).filter(r => ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Sapphire', 'Emerald', 'King', 'Legend'].includes(r)).map(rank => `<option value="${rank}">⭐ ${rank}</option>`).join('')}
                                </optgroup>
                                <optgroup label="⁕ المراكز ⁖">
                                    <option value="Center">🏢 Center</option>
                                </optgroup>
                            </select>
                            <div id="rank-hint" class="form-hint">
                                <!-- Rank details will be shown here -->
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="agent-renewal-period">فترة تجديد الرصيد</label>
                            <select id="agent-renewal-period">
                                <option value="none" selected>بدون تجديد</option>
                                <option value="weekly">أسبوعي</option>
                                <option value="biweekly">كل أسبوعين</option>
                                <option value="monthly">شهري</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top: 20px;">
                        <label style="margin-bottom: 10px;">أيام التدقيق</label>
                        <div class="days-selector-v2">
                            ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day, index) => `
                                <div class="day-toggle-wrapper">
                                    <input type="checkbox" id="day-${index}" value="${index}" class="day-toggle-input">
                                    <label for="day-${index}" class="day-toggle-btn">${day}</label>
                                </div>`).join('')}
                        </div>
                    </div>
                </div>

                <div class="form-actions-v2">
                    <button type="submit" id="save-agent-btn" class="btn-primary">حفظ الوكيل</button>
                    <button type="button" id="cancel-add-agent" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;

    // Avatar preview logic
    const avatarUploadInput = document.getElementById('avatar-upload');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarContainer = avatarPreview.closest('.profile-avatar-edit');

    if (avatarContainer) {
        avatarContainer.addEventListener('click', () => avatarUploadInput.click());
    }

    avatarUploadInput.addEventListener('change', () => {
        const file = avatarUploadInput.files[0];
        if (file) {
            avatarPreview.src = URL.createObjectURL(file);
        }
    });

    // --- الاقتراح أ: التحقق الفوري من رقم الوكالة ---
    const agentIdInput = document.getElementById('agent-id');
    const agentIdValidation = document.getElementById('agent-id-validation');
    agentIdInput.addEventListener('blur', async () => {
        const agentId = agentIdInput.value.trim();
        if (!agentId) {
            agentIdValidation.innerHTML = '';
            agentIdInput.classList.remove('invalid');
            return;
        }
        agentIdValidation.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';
        const { data, error } = await supabase.from('agents').select('id').eq('agent_id', agentId);
        if (error) {
            agentIdValidation.innerHTML = '<span class="error-text">خطأ في التحقق</span>';
        } else if (data.length > 0) {
            agentIdValidation.innerHTML = '<span class="error-text"><i class="fas fa-times-circle"></i> رقم الوكالة مستخدم بالفعل</span>';
            agentIdInput.classList.add('invalid');
        } else {
            agentIdValidation.innerHTML = '<span class="success-text"><i class="fas fa-check-circle"></i> الرقم متاح</span>';
            agentIdInput.classList.remove('invalid');
        }
    });

    // --- الاقتراح ب: إظهار تلميح عند اختيار المرتبة ---
    const rankSelect = document.getElementById('agent-rank');
    const rankHint = document.getElementById('rank-hint');
    const updateRankHint = () => {
        const rank = rankSelect.value;
        const rankData = RANKS_DATA[rank] || {};
        let hintText = '';
        if (rankData.competition_bonus) {
            const bonus = rankData.competition_bonus === Infinity ? 'غير محدود' : `$${rankData.competition_bonus}`;
            hintText += `💰 بونص المسابقات: <strong>${bonus}</strong>`;
        }
        if (rankData.deposit_bonus_count) {
            const count = rankData.deposit_bonus_count === Infinity ? 'غير محدود' : rankData.deposit_bonus_count;
            hintText += ` | 🎁 بونص الإيداع: <strong>${count} مرات</strong> بنسبة <strong>${rankData.deposit_bonus_percentage}%</strong>`;
        }
        if (hintText) {
            rankHint.innerHTML = hintText;
            rankHint.style.display = 'block';
        } else {
            rankHint.style.display = 'none';
        }
    };

    rankSelect.addEventListener('change', updateRankHint);
    updateRankHint(); // استدعاء أولي لعرض بيانات المرتبة الافتراضية

    document.getElementById('agent-name').addEventListener('input', (e) => {
        avatarPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(e.target.value) || '?'}&background=8A2BE2&color=fff&size=128`;
    });

    const cancelButton = document.getElementById('cancel-add-agent');
    cancelButton.addEventListener('click', () => {
        const nameInput = document.getElementById('agent-name');
        const idInput = document.getElementById('agent-id');

        if (nameInput.value.trim() !== '' || idInput.value.trim() !== '') {
            showConfirmationModal(
                'توجد بيانات غير محفوظة. هل تريد المتابعة وإلغاء الإضافة؟',
                () => {
                    window.location.hash = `#${returnPage}`;
                }, {
                    title: 'تأكيد الإلغاء',
                    confirmText: 'نعم، إلغاء',
                    confirmClass: 'btn-danger'
                });
        } else {
            window.location.hash = `#${returnPage}`;
        }
    });

    document.getElementById('add-agent-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabase) return showToast('لا يمكن إضافة وكيل، لم يتم الاتصال بقاعدة البيانات.', 'error');

        const rank = document.getElementById('agent-rank').value;
        const rankData = RANKS_DATA[rank] || {};

        const selectedDays = Array.from(document.querySelectorAll('.days-selector-v2 input:checked')).map(input => parseInt(input.value, 10));

        const newAgentData = {
            name: document.getElementById('agent-name').value,
            agent_id: document.getElementById('agent-id').value,
            classification: document.getElementById('agent-classification').value,
            audit_days: selectedDays,
            rank: rank,
            telegram_channel_url: document.getElementById('telegram-channel-url').value || null,
            telegram_group_url: document.getElementById('telegram-group-url').value || null,
            telegram_chat_id: document.getElementById('telegram-chat-id').value || null,
            telegram_group_name: document.getElementById('telegram-group-name').value || null,
            renewal_period: document.getElementById('agent-renewal-period').value,
            competition_bonus: rankData.competition_bonus,
            deposit_bonus_percentage: rankData.deposit_bonus_percentage,
            deposit_bonus_count: rankData.deposit_bonus_count,
            remaining_balance: rankData.competition_bonus,
            remaining_deposit_bonus: rankData.deposit_bonus_count,
        };

        // --- الاقتراح د: تأكيد قبل الحفظ ---
        const summaryHtml = `
            <div class="confirmation-summary">
                <p><strong>الاسم:</strong> ${newAgentData.name}</p>
                <p><strong>رقم الوكالة:</strong> ${newAgentData.agent_id}</p>
                <p><strong>المرتبة:</strong> ${newAgentData.rank}</p>
            </div>
            <p>هل أنت متأكد من أن البيانات صحيحة؟</p>
        `;

        showConfirmationModal(
            summaryHtml,
            async () => {
                await saveAgent(newAgentData);
            }, {
                title: 'مراجعة بيانات الوكيل',
                confirmText: 'نعم، حفظ',
                confirmClass: 'btn-primary'
            }
        );
    });
}

async function saveAgent(newAgentData) {
    const saveBtn = document.getElementById('save-agent-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
        const rank = newAgentData.rank;
        const rankData = RANKS_DATA[rank] || {};

        // إعادة حساب الأرصدة للتأكيد
        newAgentData.competition_bonus = rankData.competition_bonus;
        newAgentData.deposit_bonus_percentage = rankData.deposit_bonus_percentage;
        newAgentData.deposit_bonus_count = rankData.deposit_bonus_count;
        newAgentData.remaining_balance = rankData.competition_bonus;
        newAgentData.remaining_deposit_bonus = rankData.deposit_bonus_count;

        // --- تعديل: منطق خاص لمرتبة "بدون مرتبة حصرية" ---
        if (rank === 'بدون مرتبة حصرية') {
            newAgentData.competition_bonus = 60;
            newAgentData.remaining_balance = 60;
            newAgentData.deposit_bonus_percentage = null;
            newAgentData.deposit_bonus_count = null;
            newAgentData.remaining_deposit_bonus = null;
        }

        // Check for uniqueness of agent_id
        const { data: existingAgents, error: checkError } = await supabase
            .from('agents')
            .select('id')
            .eq('agent_id', newAgentData.agent_id);

        if (checkError) {
            console.error('Error checking for existing agent on create:', checkError);
            showToast('حدث خطأ أثناء التحقق من رقم الوكالة.', 'error');
            throw new Error('Check error');
        }

        if (existingAgents && existingAgents.length > 0) {
            showToast('رقم الوكالة هذا مستخدم بالفعل لوكيل آخر.', 'error');
            throw new Error('Duplicate agent ID');
        }

        // Insert agent data without avatar first to get an ID
        const { data: insertedAgent, error: insertError } = await supabase.from('agents').insert([newAgentData]).select().single();

        if (insertError) {
            throw insertError;
        }

        // If an avatar was selected, upload it and update the agent record
        const avatarFile = document.getElementById('avatar-upload').files[0];
        if (avatarFile) {
            const filePath = `${insertedAgent.id}-${Date.now()}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile);

            if (uploadError) {
                showToast('تم إنشاء الوكيل ولكن فشل رفع الصورة.', 'error');
                console.error('Avatar upload error:', uploadError);
            } else {
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                const { error: updateAvatarError } = await supabase.from('agents').update({ avatar_url: urlData.publicUrl }).eq('id', insertedAgent.id);
                if (updateAvatarError) console.error('Avatar URL update error:', updateAvatarError);
            }
        }

        await logAgentActivity(insertedAgent.id, 'AGENT_CREATED', `تم إنشاء وكيل جديد: ${insertedAgent.name}.`);
        showToast('تمت إضافة الوكيل بنجاح!', 'success');
        allAgentsData = []; // مسح ذاكرة التخزين المؤقت للوكلاء لإعادة جلبها عند العودة
        // Use replace to avoid adding the 'add-agent' page to history
        const newUrl = window.location.pathname + window.location.search + `#profile/${insertedAgent.id}`;
        window.location.replace(newUrl);

    } catch (error) {
        console.error('Error saving agent:', error);
        if (error.message !== 'Duplicate agent ID' && error.message !== 'Check error') {
            showToast(`فشل إضافة الوكيل: ${error.message}`, 'error');
        }
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'حفظ الوكيل';
    }
}

function renderBulkAddAgentsModal() {
    const modalContent = `
        <div class="form-layout" style="gap: 15px;">
            <div class="form-group">
                <label for="bulk-agents-data">
                    <i class="fas fa-paste"></i> الصق بيانات الوكلاء هنا
                </label>
                <p class="form-hint">
                    يجب أن تكون البيانات مفصولة بمسافة Tab (يمكنك نسخها من جدول Excel).<br>
                    الترتيب المطلوب للأعمدة: <strong>الاسم، رقم الوكالة، التصنيف، المرتبة، فترة التجديد، أيام التدقيق، رابط القناة، رابط الجروب، معرف الدردشة، اسم المجموعة</strong>
                </p>
                <textarea id="bulk-agents-data" rows="15" placeholder="مثال:\nأحمد علي\t12345\tR\tGrowth\tweekly\t1,3,5\thttps://t.me/channel\thttps://t.me/group\t-100123\tGroup Name"></textarea>
            </div>
        </div>
    `;

    showConfirmationModal(
        modalContent,
        () => {
            const data = document.getElementById('bulk-agents-data').value;
            handleBulkAddAgents(data);
        },
        {
            title: 'إضافة وكلاء دفعة واحدة',
            confirmText: 'بدء الإضافة',
            confirmClass: 'btn-primary',
            modalClass: 'modal-fullscreen'
        }
    );
}

async function handleBulkAddAgents(data) {
    const lines = data.trim().split('\n');
    if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
        showToast('لم يتم إدخال أي بيانات.', 'info');
        return;
    }

    const agentsToInsert = [];
    const errors = [];
    const validRenewalPeriods = ['none', 'weekly', 'biweekly', 'monthly'];
    
    // --- NEW: Mappings for Arabic input ---
    const renewalPeriodMap = {
        'اسبوع': 'weekly', 'أسبوعي': 'weekly',
        'اسبوعين': 'biweekly', 'كل أسبوعين': 'biweekly',
        'شهر': 'monthly', 'شهري': 'monthly',
        'بدون': 'none'
    };
    const auditDayMap = {
        'الاحد': 0, 'الأحد': 0,
        'الاثنين': 1, 'الإثنين': 1,
        'الثلاثاء': 2,
        'الاربعاء': 3, 'الأربعاء': 3,
        'الخميس': 4,
        'الجمعة': 5,
        'السبت': 6
    };

    lines.forEach((line, index) => {
        const fields = line.split('\t').map(f => f.trim());
        if (fields.length < 4) { // At least Name, ID, Classification, Rank are required
            errors.push(`السطر ${index + 1}: عدد الحقول غير كافٍ.`);
            return;
        }

        const [
            name, agent_id, classification, rank, 
            renewal_period = 'none', 
            audit_days_str = '', 
            telegram_channel_url = '', 
            telegram_group_url = '', 
            telegram_chat_id = '', 
            telegram_group_name = ''] = fields;

        if (!name || !agent_id || !classification || !rank) {
            errors.push(`السطر ${index + 1}: الحقول الأساسية (الاسم، الرقم، التصنيف، المرتبة) مطلوبة.`);
            return;
        }

        if (!RANKS_DATA[rank]) {
            errors.push(`السطر ${index + 1}: المرتبة "${rank}" غير صالحة.`);
            return;
        }

        // --- NEW: Process renewal period with Arabic mapping ---
        const processedRenewalPeriod = renewalPeriodMap[renewal_period.toLowerCase()] || renewal_period.toLowerCase();
        if (!validRenewalPeriods.includes(processedRenewalPeriod)) {
            errors.push(`السطر ${index + 1}: فترة التجديد "${renewal_period}" غير صالحة.`);
            return;
        }

        // --- NEW: Process audit days with Arabic mapping ---
        const audit_days = audit_days_str
            .split(/[,/]/) // Split by comma or slash
            .map(dayName => auditDayMap[dayName.trim()])
            .filter(dayIndex => dayIndex !== undefined && dayIndex >= 0 && dayIndex <= 6);

        const rankData = RANKS_DATA[rank];
        const newAgent = {
            name,
            agent_id,
            classification,
            rank,
            renewal_period: processedRenewalPeriod,
            audit_days,
            telegram_channel_url: telegram_channel_url || null,
            telegram_group_url: telegram_group_url || null,
            telegram_chat_id: telegram_chat_id || null,
            telegram_group_name: telegram_group_name || null,
            competition_bonus: rankData.competition_bonus,
            deposit_bonus_percentage: rankData.deposit_bonus_percentage,
            deposit_bonus_count: rankData.deposit_bonus_count,
            remaining_balance: rankData.competition_bonus,
            remaining_deposit_bonus: rankData.deposit_bonus_count,
            consumed_balance: 0,
            used_deposit_bonus: 0,
        };
        agentsToInsert.push(newAgent);
    });

    if (errors.length > 0) {
        showToast(`تم العثور على ${errors.length} أخطاء في البيانات. يرجى تصحيحها والمحاولة مرة أخرى.`, 'error');
        console.error('Bulk Add Errors:', errors);
        // Optionally, show a modal with all errors
        return;
    }

    if (agentsToInsert.length === 0) {
        showToast('لا توجد بيانات صالحة للإضافة.', 'info');
        return;
    }

    // Show progress modal
    showBulkSendProgressModal(agentsToInsert.length);
    const progressBar = document.getElementById('bulk-send-progress-bar-inner');
    const statusText = document.getElementById('bulk-send-status-text');
    statusText.innerHTML = `جاري إضافة ${agentsToInsert.length} وكيل...`;

    const { data: insertedAgents, error: insertError } = await supabase
        .from('agents')
        .insert(agentsToInsert)
        .select('name');

    if (insertError) {
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = 'var(--danger-color)';
        statusText.innerHTML = `فشل إضافة الوكلاء.<br><small>${insertError.message}</small>`;
        document.querySelector('.modal-no-actions .update-icon').className = 'fas fa-times-circle update-icon';
        showToast('فشل إضافة الوكلاء بشكل جماعي.', 'error');
        console.error('Bulk insert error:', insertError);
    } else {
        const successCount = insertedAgents.length;
        const errorCount = agentsToInsert.length - successCount;

        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = errorCount > 0 ? 'var(--warning-color)' : 'var(--success-color)';
        statusText.innerHTML = `اكتملت العملية.<br><strong>${successCount}</strong> وكيل بنجاح | <strong>${errorCount}</strong> فشل.`;
        document.querySelector('.modal-no-actions .update-icon').className = 'fas fa-check-circle update-icon';
        
        await logAgentActivity(null, 'BULK_AGENT_CREATED', `تمت إضافة ${successCount} وكيل بشكل جماعي.`);
        showToast('اكتملت عملية الإضافة الجماعية.', 'success');

        // Refresh the agents list
        allAgentsData = []; // Clear cache
        await renderManageAgentsPage();
    }

    // Auto-close progress modal
    setTimeout(() => {
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.remove();
        }
    }, 4000);
}