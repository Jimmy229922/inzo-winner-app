const RANKS_DATA = {
    // الاعتيادية
    'BEGINNING': { competition_bonus: 60, deposit_bonus_percentage: null, deposit_bonus_count: null },
    'GROWTH': { competition_bonus: 100, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
    'PRO': { competition_bonus: 150, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
    'ELITE': { competition_bonus: 200, deposit_bonus_percentage: 50, deposit_bonus_count: 4 },
    // الحصرية
    'CENTER': { competition_bonus: 300, deposit_bonus_percentage: null, deposit_bonus_count: null },
    'BRONZE': { competition_bonus: 150, deposit_bonus_percentage: 40, deposit_bonus_count: 2 },
    'SILVER': { competition_bonus: 230, deposit_bonus_percentage: 40, deposit_bonus_count: 3 },
    'GOLD': { competition_bonus: 300, deposit_bonus_percentage: 50, deposit_bonus_count: 3 },
    'PLATINUM': { competition_bonus: 500, deposit_bonus_percentage: 60, deposit_bonus_count: 4 },
    'DIAMOND': { competition_bonus: 800, deposit_bonus_percentage: 75, deposit_bonus_count: 4 },
    'SAPPHIRE': { competition_bonus: 1100, deposit_bonus_percentage: 85, deposit_bonus_count: 4 },
    'EMERALD': { competition_bonus: 2000, deposit_bonus_percentage: 90, deposit_bonus_count: 4 },
    'KING': { competition_bonus: 2500, deposit_bonus_percentage: 95, deposit_bonus_count: 4 },
    'LEGEND': { competition_bonus: Infinity, deposit_bonus_percentage: 100, deposit_bonus_count: Infinity },
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
                                    ${Object.keys(RANKS_DATA).filter(r => ['BEGINNING', 'GROWTH', 'PRO', 'ELITE'].includes(r)).map((rank, index) => `<option value="${rank}" ${index === 0 ? 'selected' : ''}>🔸 ${rank}</option>`).join('')}
                                </optgroup>
                                <optgroup label="⁕ مراتب الوكالة الحصرية ⁖">
                                    <option value="وكيل حصري بدون مرتبة">⭐ وكيل حصري بدون مرتبة</option>
                                    <option disabled>──────────</option>
                                    ${Object.keys(RANKS_DATA).filter(r => ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'SAPPHIRE', 'EMERALD', 'KING', 'LEGEND'].includes(r)).map(rank => `<option value="${rank}">⭐ ${rank}</option>`).join('')}
                                </optgroup>
                                <optgroup label="⁕ المراكز ⁖">
                                    <option value="CENTER">🏢 CENTER</option>
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
                        <div class="form-group" id="competitions-per-week-group">
                            <label for="agent-competitions-per-week">عدد المسابقات كل أسبوع</label>
                            <select id="agent-competitions-per-week">
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
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

    // --- الاقتراح: ربط عدد المسابقات الأسبوعية بالتصنيف تلقائياً ---
    const classificationSelect = document.getElementById('agent-classification');
    const competitionsGroup = document.getElementById('competitions-per-week-group');
    const competitionsPerWeekSelect = document.getElementById('agent-competitions-per-week');

    const updateCompetitionsPerWeek = () => {
        const classification = classificationSelect.value;
        if (classification === 'R' || classification === 'A') {
            competitionsPerWeekSelect.value = '2';
        } else if (classification === 'B' || classification === 'C') {
            competitionsPerWeekSelect.value = '1';
        }
    };

    classificationSelect.addEventListener('change', updateCompetitionsPerWeek);
    // --- MODIFICATION: Call the function on page load to set the initial value and ensure visibility ---
    updateCompetitionsPerWeek();
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
        // --- STEP 3: MIGRATION TO CUSTOM BACKEND ---
        const response = await authedFetch(`/api/agents/check-uniqueness?agent_id=${agentId}`);
        const { exists, error } = await response.json();

        if (error) {
            agentIdValidation.innerHTML = '<span class="error-text">خطأ في التحقق</span>';
        } else if (exists) {
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
        // The check is now implicit in the authedFetch call

        const rank = document.getElementById('agent-rank').value;
        const rankData = RANKS_DATA[rank] || {};

        // --- NEW: Calculate competition_duration based on competitions_per_week ---
        const competitionsPerWeek = parseInt(document.getElementById('agent-competitions-per-week').value, 10);
        let competitionDuration = '48h'; // Default

        if (competitionsPerWeek === 2) {
            competitionDuration = '24h';
        } else if (competitionsPerWeek === 3) {
            // As 16h is not a standard option, we can default to 24h or handle as needed.
            competitionDuration = '24h';
        }

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
            competition_bonus: rankData.competition_bonus,
            deposit_bonus_percentage: rankData.deposit_bonus_percentage,
            deposit_bonus_count: rankData.deposit_bonus_count,
            remaining_balance: rankData.competition_bonus,
            remaining_deposit_bonus: rankData.deposit_bonus_count,
            renewal_period: document.getElementById('agent-renewal-period').value,
            competitions_per_week: competitionsPerWeek, // --- FIX: Ensure this is added to the payload ---
            competition_duration: competitionDuration, // --- NEW: Add calculated duration ---
            prize_per_winner: 30, // --- NEW: Default prize per winner to $30 ---
        };

        // --- الاقتراح د: تأكيد قبل الحفظ ---
        const summaryHtml = `
            <div class="confirmation-summary-grid">
                <div class="summary-item"><strong>الاسم:</strong> ${newAgentData.name}</div>
                <div class="summary-item"><strong>رقم الوكالة:</strong> ${newAgentData.agent_id}</div>
                <div class="summary-item"><strong>المرتبة:</strong> ${newAgentData.rank}</div>
                <div class="summary-item"><strong>التصنيف:</strong> ${newAgentData.classification}</div>
                <hr>
                <div class="summary-item"><strong><i class="fas fa-cogs"></i> بيانات تلقائية:</strong></div>
                <div class="summary-item"><strong>بونص المسابقات:</strong> ${newAgentData.competition_bonus === Infinity ? 'غير محدود' : `$${newAgentData.competition_bonus || 0}`}</div>
                <div class="summary-item"><strong>بونص الإيداع:</strong> ${newAgentData.deposit_bonus_count === Infinity ? 'غير محدود' : (newAgentData.deposit_bonus_count || 0)} مرات بنسبة ${newAgentData.deposit_bonus_percentage || 0}%</div>
                <div class="summary-item"><strong>مدة المسابقة:</strong> ${newAgentData.competition_duration}</div>
                <div class="summary-item"><strong>عدد المسابقات أسبوعياً:</strong> ${newAgentData.competitions_per_week}</div>
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

    // --- STEP 3: MIGRATION TO CUSTOM BACKEND ---
    try {
        const rank = newAgentData.rank;
        const rankData = RANKS_DATA[rank] || {};

        // إعادة حساب الأرصدة للتأكيد
        newAgentData.competition_bonus = rankData.competition_bonus;
        newAgentData.deposit_bonus_percentage = rankData.deposit_bonus_percentage;
        newAgentData.deposit_bonus_count = rankData.deposit_bonus_count;
        newAgentData.remaining_balance = rankData.competition_bonus;
        newAgentData.remaining_deposit_bonus = rankData.deposit_bonus_count;
        // --- FIX: Preserve competitions_per_week and competition_duration from the form ---
        // The original newAgentData object already has these values. We just need to make sure they are not overwritten.
        // No explicit re-assignment is needed if we don't nullify them.
        
        // --- إصلاح: منطق خاص لمرتبة "وكيل حصري بدون مرتبة" ---
        if (rank === 'وكيل حصري بدون مرتبة') {
            newAgentData.competition_bonus = 60;
            newAgentData.remaining_balance = 60;
            newAgentData.deposit_bonus_percentage = null;
            newAgentData.deposit_bonus_count = null;
            newAgentData.remaining_deposit_bonus = null;
        }

        // Send data to our new backend API
        const response = await authedFetch('/api/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAgentData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'فشل حفظ الوكيل.');
        }

        const insertedAgent = result.data;

        // TODO: Re-implement avatar upload. This will require a separate endpoint on the backend
        // that handles file uploads (e.g., using multer) and saves them to a folder or a cloud service like S3.

        await logAgentActivity(currentUserProfile?._id, insertedAgent._id, 'AGENT_CREATED', `تم إنشاء وكيل جديد: ${insertedAgent.name}.`);
        showToast('تمت إضافة الوكيل بنجاح!', 'success');
        window.allAgentsData = []; // مسح ذاكرة التخزين المؤقت للوكلاء لإعادة جلبها عند العودة
        // Use replace to avoid adding the 'add-agent' page to history
        const newUrl = window.location.pathname + window.location.search + `#profile/${insertedAgent._id}`; // Use _id from MongoDB
        window.location.replace(newUrl);

    } catch (error) {
        console.error('Error saving agent:', error);
        showToast(`فشل إضافة الوكيل: ${error.message}`, 'error');
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
                    الترتيب المطلوب للأعمدة: <strong>الاسم، رقم الوكالة، التصنيف، المرتبة، فترة التجديد، أيام التدقيق، رابط القناة، رابط الجروب، معرف الدردشة، اسم المجموعة، مدة المسابقة (24h أو 48h أو 5s للاختبار)</strong>
                </p>
                <textarea id="bulk-agents-data" rows="15" placeholder="مثال:\nأحمد علي\t12345\tR\tGrowth\tweekly\t1,3,5\thttps://t.me/channel\thttps://t.me/group\t-100123\tGroup Name\t48h"></textarea>
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

    const allParsedAgents = [];
    const errors = [];
    const validRenewalPeriods = ['none', 'weekly', 'biweekly', 'monthly'];
    
    // --- NEW: Create a lowercase to correct-case map for ranks ---
    const rankMap = Object.keys(RANKS_DATA).reduce((map, rank) => {
        map[rank.toLowerCase()] = rank;
        return map;
    }, {});
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
    };

    lines.forEach((line, index) => {
        // --- NEW: Skip empty lines ---
        if (!line.trim()) {
            return;
        }

        // --- IMPROVEMENT: Trim trailing empty fields to prevent errors from extra columns in Excel ---
        let fields = line.split('\t').map(f => f.trim());
        while (fields.length > 0 && fields[fields.length - 1] === '') {
            fields.pop();
        }

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
            telegram_group_name = '',
            competition_duration = null,
            competitions_per_week_str = ''] = fields; // --- NEW: Read competitions per week ---

        if (!name || !agent_id || !classification || !rank) { // --- IMPROVEMENT: More specific error message ---
            errors.push(`السطر ${index + 1}: الحقول الأساسية (الاسم، الرقم، التصنيف، المرتبة) مطلوبة.`);
            return;
        }

        const correctRank = rankMap[rank.toLowerCase()];
        if (!correctRank) {
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

        // --- MODIFIED: Validate and normalize competition_duration ---
        let processed_competition_duration = null;
        if (competition_duration) {
            // Normalize input: "24 h" -> "24h", "24" -> "24"
            const normalized = competition_duration.trim().replace(/\s/g, ''); 
            if (normalized === '5s') {
                processed_competition_duration = '5s';
            } else if (normalized.startsWith('24')) {
                processed_competition_duration = '24h';
            } else if (normalized.startsWith('48')) {
                processed_competition_duration = '48h'; // --- IMPROVEMENT: More specific error message ---
            } else {
                errors.push(`السطر ${index + 1}: مدة المسابقة "${competition_duration}" غير صالحة. يجب أن تكون '24h' أو '48h' أو '5s'.`);
                return;
            }
        }

        // --- NEW: Process competitions_per_week ---
        let competitions_per_week = parseInt(competitions_per_week_str, 10);
        if (isNaN(competitions_per_week)) {
            // If not provided or invalid, set it automatically based on classification
            if (classification.toUpperCase() === 'R' || classification.toUpperCase() === 'A') {
                competitions_per_week = 2;
            } else { // B or C
                competitions_per_week = 1;
            }
        }

        // --- NEW: Calculate competition_duration based on competitions_per_week ---
        let competition_duration_calculated = '48h'; // Default
        if (competitions_per_week === 2) {
            competition_duration_calculated = '24h';
        } else if (competitions_per_week === 3) {
            competition_duration_calculated = '24h'; // Fallback for 16h
        }
        // If a duration is explicitly provided in the sheet, it will override the calculated one.
        const final_competition_duration = processed_competition_duration || competition_duration_calculated;

        const rankData = RANKS_DATA[correctRank];
        const newAgent = {
            name,
            agent_id,
            classification: classification.toUpperCase(),
            rank: correctRank,
            renewal_period: processedRenewalPeriod,
            audit_days,
            telegram_channel_url: telegram_channel_url || null,
            telegram_group_url: telegram_group_url || null,
            telegram_chat_id: telegram_chat_id || null,
            telegram_group_name: telegram_group_name || null,
            competition_bonus: rankData.competition_bonus || 0,
            deposit_bonus_percentage: rankData.deposit_bonus_percentage || 0,
            deposit_bonus_count: rankData.deposit_bonus_count || 0,
            remaining_balance: rankData.competition_bonus || 0,
            remaining_deposit_bonus: rankData.deposit_bonus_count || 0,
            consumed_balance: 0,
            used_deposit_bonus: 0,
            status: 'Active',
            competition_duration: final_competition_duration, // --- MODIFIED: Use the final duration ---
            competitions_per_week, // --- NEW: Add the processed value ---
        };
        allParsedAgents.push(newAgent);
    });

    if (errors.length > 0) {
        showToast(`تم العثور على ${errors.length} أخطاء في البيانات. يرجى تصحيحها والمحاولة مرة أخرى.`, 'error'); // --- IMPROVEMENT: More specific error message ---
        // Optionally, show a modal with all errors
        return;
    }

    // --- NEW: Logic to separate agents for insertion and update ---
    const uniqueAgentsMap = new Map();
    for (const agent of allParsedAgents) {
        // Use agent_id as the unique key to de-duplicate the input list, ensuring the last entry wins.
        uniqueAgentsMap.set(agent.agent_id, agent);
    }
    const uniqueAgents = Array.from(uniqueAgentsMap.values());
    const ignoredForInputDuplication = allParsedAgents.length - uniqueAgents.length;

    if (uniqueAgents.length === 0) {
        showToast('لا توجد بيانات صالحة للإضافة أو التحديث.', 'info');
        return;
    }

    // --- MODIFIED: Process in chunks to avoid overly long URLs ---
    const CHUNK_SIZE = 100; // Process 100 agents at a time
    let allExistingAgents = [];
    let checkError = null;

    // --- NEW: Check for existing agents against the database ---
    for (let i = 0; i < uniqueAgents.length; i += CHUNK_SIZE) {
        const chunk = uniqueAgents.slice(i, i + CHUNK_SIZE);
        const agentIds = chunk.map(a => a.agent_id);
        const query = `agent_ids=${agentIds.join(',')}&select=_id,name,agent_id&limit=${CHUNK_SIZE}`;
        const response = await authedFetch(`/api/agents?${query}`);
        const result = await response.json();

        if (!response.ok) {
            checkError = new Error(result.message || 'فشل التحقق من الوكلاء الموجودين.');
            break; // Stop on the first error
        }
        if (result.data) {
            allExistingAgents.push(...result.data);
        }
    }

    if (checkError) {
        showToast(`خطأ: ${checkError.message}`, 'error');
        return;
    }
    
    const existingAgentsMap = new Map();
    allExistingAgents.forEach(agent => {
        // --- IMPROVEMENT: Map by both agent_id and name for more robust checking ---
        existingAgentsMap.set(agent.agent_id, agent);
        existingAgentsMap.set(agent.name, agent);
    });

    const agentsToInsert = [];
    const agentsToUpdate = [];

    uniqueAgents.forEach(agent => {
        const existing = existingAgentsMap.get(agent.agent_id) || existingAgentsMap.get(agent.name);
        if (existing) {
            // Agent exists, add to update list with its database _id
            agentsToUpdate.push({ ...agent, id: existing._id });
        } else {
            // Add to insert list
            agentsToInsert.push(agent);
        }
    });

    const totalOperations = agentsToInsert.length + agentsToUpdate.length;
    if (totalOperations === 0) {
        showToast(`تم تجاهل جميع الوكلاء (${allParsedAgents.length}) لوجودهم مسبقاً أو بسبب تكرار في المدخلات.`, 'warning');
        return;
    }

    let successCount = 0;
    let errorCount = 0;
    let processedCount = 0;

    // --- IMPROVEMENT: More descriptive progress modal ---
    const modalContent = `
        <div class="update-progress-container">
            <i class="fas fa-users-cog update-icon"></i>
            <h3 id="bulk-send-status-text">جاري التهيئة...</h3>
            <div class="progress-bar-outer">
                <div id="bulk-send-progress-bar-inner" class="progress-bar-inner"></div>
            </div>
        </div>
    `;
    const progressModalOverlay = showProgressModal('إضافة وتحديث الوكلاء', modalContent);

    const progressBar = document.getElementById('bulk-send-progress-bar-inner');
    const statusText = document.getElementById('bulk-send-status-text');

    // --- NEW: Process agents one by one to show real-time progress and reduce server load ---
    for (const agent of agentsToInsert) {
        processedCount++;
        statusText.innerHTML = `جاري إضافة وكيل: ${agent.name} (${processedCount}/${totalOperations})`;
        try {
            const response = await authedFetch('/api/agents', { method: 'POST', body: JSON.stringify(agent) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            successCount++;
        } catch (e) {
            errorCount++;
        }
        progressBar.style.width = `${(processedCount / totalOperations) * 100}%`;
        await new Promise(resolve => setTimeout(resolve, 500)); // --- NEW: Add 500ms delay ---
    }

    for (const agent of agentsToUpdate) {
        processedCount++;
        statusText.innerHTML = `جاري تحديث وكيل: ${agent.name} (${processedCount}/${totalOperations})`;
        try {
            // The agent object already contains the 'id' field needed for the URL
            const response = await authedFetch(`/api/agents/${agent.id}`, { method: 'PUT', body: JSON.stringify(agent) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            successCount++;
        } catch (e) {
            errorCount++;
        }
        progressBar.style.width = `${(processedCount / totalOperations) * 100}%`;
        await new Promise(resolve => setTimeout(resolve, 500)); // --- NEW: Add 500ms delay ---
    }

    progressBar.style.backgroundColor = errorCount > 0 ? 'var(--warning-color)' : 'var(--success-color)';
    
    let finalMessage = `اكتملت العملية.<br>`;
    finalMessage += `<strong>${successCount}</strong> عملية ناجحة | <strong>${errorCount}</strong> فشل`;
    const totalIgnored = ignoredForInputDuplication;
    if (totalIgnored > 0) finalMessage += ` | <strong>${totalIgnored}</strong> تم تجاهلهم للتكرار.`;

    statusText.innerHTML = finalMessage;
    document.querySelector('.modal-no-actions .update-icon').className = 'fas fa-check-circle update-icon';
    
    await logAgentActivity(null, 'BULK_AGENT_UPSERT', `إضافة جماعية: ${agentsToInsert.length} جديد, ${agentsToUpdate.length} تحديث, ${totalIgnored} تجاهل.`);
    showToast('اكتملت العملية الجماعية.', 'success');

    // Refresh the agents list
    allAgentsData = []; // Clear cache
    await renderManageAgentsPage();

    // Auto-close progress modal
    setTimeout(() => {
        if (progressModalOverlay) {
            progressModalOverlay.remove();
        }
    }, 4000);
}
