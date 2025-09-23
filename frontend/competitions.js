// --- Main Router for Competitions/Templates Section ---
async function renderCompetitionsPage() {
    const appContent = document.getElementById('app-content');
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const agentId = urlParams.get('agentId');

    if (hash.startsWith('#competitions/new')) {
        await renderCompetitionCreatePage(agentId);
    } else if (hash.startsWith('#competitions/edit/')) {
        const compId = hash.split('/')[2];
        await renderCompetitionEditForm(compId);
    } else {
        await renderAllCompetitionsListPage();
    }
}

// --- 0. All Competitions List Page (New Default) ---
async function renderAllCompetitionsListPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>إدارة المسابقات</h1>
            </div>
            <div class="agent-filters">
                <div class="filter-search-container">
                    <input type="search" id="competition-search-input" placeholder="بحث باسم المسابقة أو الوكيل..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="competition-search-clear"></i>
                </div>
                <div class="filter-buttons" id="status-filter-buttons">
                    <button class="filter-btn active" data-filter="all">الكل</button>
                    <button class="filter-btn" data-filter="active">نشطة</button>
                    <button class="filter-btn" data-filter="inactive">غير نشطة</button>
                </div>
                <div class="filter-separator"></div>
                <div class="filter-buttons" id="classification-filter-buttons">
                    <button class="filter-btn active" data-filter="all">الكل</button>
                    <button class="filter-btn" data-filter="R">R</button>
                    <button class="filter-btn" data-filter="A">A</button>
                    <button class="filter-btn" data-filter="B">B</button>
                    <button class="filter-btn" data-filter="C">C</button>
                </div>
            </div>
        </div>
        <div class="table-responsive-container">
            <table class="modern-table" id="competitions-table">
                <thead>
                    <tr>
                        <th>اسم المسابقة</th>
                        <th>الوكيل المرتبط</th>
                        <th>الحالة</th>
                        <th>تاريخ الإنشاء</th>
                        <th class="actions-column">إجراءات</th>
                    </tr>
                </thead>
                <tbody id="competitions-table-body">
                    <!-- Data will be loaded here -->
                </tbody>
            </table>
        </div>
        <div id="competitions-list-placeholder"></div>
    `;

    const tableBody = document.getElementById('competitions-table-body');

    // Use event delegation for delete buttons
    tableBody.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-competition-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            showConfirmationModal(
                'هل أنت متأكد من حذف هذه المسابقة؟<br><small>هذا الإجراء لا يمكن التراجع عنه.</small>',
                async () => {
                    const { error } = await supabase.from('competitions').delete().eq('id', id);
                    if (error) {
                        showToast('فشل حذف المسابقة.', 'error');
                        console.error('Delete competition error:', error);
                    } else {
                        showToast('تم حذف المسابقة بنجاح.', 'success');
                        renderAllCompetitionsListPage(); // Re-render the page
                    }
                }, {
                    title: 'تأكيد حذف المسابقة',
                    confirmText: 'حذف',
                    confirmClass: 'btn-danger'
                });
        }
    });

    const { data: competitions, error } = await supabase
        .from('competitions')
        .select('*, agents(id, name, classification, avatar_url)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching competitions:", error);
        document.getElementById('competitions-list-placeholder').innerHTML = `<p class="error">حدث خطأ أثناء جلب المسابقات.</p>`;
        return;
    }

    if (competitions.length === 0) {
        document.getElementById('competitions-table').style.display = 'none';
        document.getElementById('competitions-list-placeholder').innerHTML = '<p class="no-results-message">لا توجد مسابقات حالياً. يمكنك إنشاء واحدة من صفحة الوكيل.</p>';
    } else {
        renderCompetitionTableBody(competitions);
    }
    
    setupCompetitionFilters(competitions);
}

function renderCompetitionTableBody(competitions) {
    const tableBody = document.getElementById('competitions-table-body');
    const placeholder = document.getElementById('competitions-list-placeholder');
    if (!tableBody || !placeholder) return;

    if (competitions.length === 0) {
        tableBody.innerHTML = '';
        placeholder.innerHTML = '<p class="no-results-message">لا توجد نتائج تطابق بحثك.</p>';
        return;
    }

    placeholder.innerHTML = '';
    tableBody.innerHTML = competitions.map(comp => {
        const agent = comp.agents;
        const agentInfoHtml = agent
            ? `<a href="#profile/${agent.id}" class="table-agent-cell">
                    ${agent.avatar_url
                        ? `<img src="${agent.avatar_url}" alt="Agent Avatar" class="avatar-small">`
                        : `<div class="avatar-placeholder-small"><i class="fas fa-user"></i></div>`}
                    <span>${agent.name}</span>
               </a>`
            : `<div class="table-agent-cell"><span>(وكيل محذوف)</span></div>`;

        return `
        <tr data-id="${comp.id}">
            <td data-label="اسم المسابقة">
                <div class="competition-name-cell">
                    <strong>${comp.name}</strong>
                    <small>${comp.description ? comp.description.substring(0, 60) + '...' : ''}</small>
                </div>
            </td>
            <td data-label="الوكيل المرتبط">${agentInfoHtml}</td>
            <td data-label="الحالة"><span class="status-badge ${comp.is_active ? 'active' : 'inactive'}">${comp.is_active ? 'نشطة' : 'غير نشطة'}</span></td>
            <td data-label="تاريخ الإنشاء">${new Date(comp.created_at).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
            <td class="actions-cell">
                <button class="btn-secondary btn-small" onclick="window.location.hash='#competitions/edit/${comp.id}'" title="تعديل"><i class="fas fa-edit"></i></button>
                <button class="btn-danger btn-small delete-competition-btn" data-id="${comp.id}" title="حذف"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>
        `;
    }).join('');
}

function setupCompetitionFilters(allCompetitions) {
    const searchInput = document.getElementById('competition-search-input');
    const clearBtn = document.getElementById('competition-search-clear');
    const statusFilterButtons = document.querySelectorAll('#status-filter-buttons .filter-btn');
    const classificationFilterButtons = document.querySelectorAll('#classification-filter-buttons .filter-btn');

    const applyFilters = () => {
        if (!searchInput) return;
        if (clearBtn) clearBtn.style.display = searchInput.value ? 'block' : 'none';
        
        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeStatusFilter = document.querySelector('#status-filter-buttons .filter-btn.active').dataset.filter;
        const activeClassificationFilter = document.querySelector('#classification-filter-buttons .filter-btn.active').dataset.filter;

        const filteredCompetitions = allCompetitions.filter(comp => {
            const name = comp.name.toLowerCase();
            const agentName = comp.agents ? comp.agents.name.toLowerCase() : '';
            const agentClassification = comp.agents ? comp.agents.classification : null;
            const status = comp.is_active ? 'active' : 'inactive';

            const matchesSearch = searchTerm === '' || name.includes(searchTerm) || agentName.includes(searchTerm);
            const matchesStatusFilter = activeStatusFilter === 'all' || status === activeStatusFilter;
            const matchesClassificationFilter = activeClassificationFilter === 'all' || agentClassification === activeClassificationFilter;
            
            return matchesSearch && matchesStatusFilter && matchesClassificationFilter;
        });
        
        renderCompetitionTableBody(filteredCompetitions);
    };

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            applyFilters();
            searchInput.focus();
        });
    }

    statusFilterButtons.forEach(button => {
        button.addEventListener('click', () => {
            statusFilterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            applyFilters();
        });
    });

    classificationFilterButtons.forEach(button => {
        button.addEventListener('click', () => {
            classificationFilterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            applyFilters();
        });
    });
}

async function renderCompetitionCreatePage(agentId) {
    const appContent = document.getElementById('app-content');

    if (!agentId) {
        // This part remains the same, for selecting an agent first.
        const { data: agents, error } = await supabase.from('agents').select('id, name, agent_id, classification, avatar_url').order('name');
        if (error) {
            appContent.innerHTML = `<p class="error">حدث خطأ أثناء جلب الوكلاء.</p>`;
            return;
        }
        appContent.innerHTML = `
            <div class="page-header"><h1>إنشاء مسابقة جديدة</h1></div>
            <h2>الخطوة 1: اختر وكيلاً</h2>
            <p>يجب ربط كل مسابقة بوكيل. اختر وكيلاً من القائمة أدناه للمتابعة.</p>
            <div class="agent-selection-list">
                ${agents.map(a => `
                    <a href="#competitions/new?agentId=${a.id}" class="agent-selection-card">
                        ${a.avatar_url ? `<img src="${a.avatar_url}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : `<div class="avatar-placeholder" style="width: 40px; height: 40px; font-size: 20px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-user"></i></div>`}
                        <div class="agent-info">
                            <h3>${a.name}</h3>
                            <p>#${a.agent_id} | ${a.classification}</p>
                        </div>
                        <i class="fas fa-chevron-left"></i>
                    </a>
                `).join('')}
            </div>
        `;
        return;
    }

    // Fetch agent and template data
    const agentResult = await supabase.from('agents').select('*').eq('id', agentId).single();
    const agent = agentResult.data;
    if (!agent) {
        appContent.innerHTML = `<p class="error">لم يتم العثور على الوكيل.</p>`;
        return;
    }

    const agentClassification = agent.classification || 'R'; // Default to R if not set
    const { data: templates, error: templatesError } = await supabase
        .from('competition_templates')
        .select('id, question, content')
        .or(`classification.eq.${agentClassification},classification.eq.All`)
        .order('question');

    if (templatesError) {
        appContent.innerHTML = `<p class="error">حدث خطأ أثناء جلب قوالب المسابقات.</p>`;
        return;
    }
    
    // New V2 Layout
    appContent.innerHTML = `
        <div class="page-header"><h1><i class="fas fa-magic"></i> إنشاء وإرسال مسابقة</h1></div>
        <p class="page-subtitle">للعميل: <strong>${agent.name}</strong>. قم بتعديل تفاصيل المسابقة أدناه وسيتم تحديث الكليشة تلقائياً.</p>
        
        <div class="create-competition-layout-v3">
            <!-- Agent Info Column -->
            <div class="agent-info-v3 card-style-container">
                <h3><i class="fas fa-user-circle"></i> بيانات الوكيل</h3>
                <div class="agent-info-grid">
                    <div class="action-info-card"><i class="fas fa-star"></i><div class="info"><label>المرتبة</label><p>${agent.rank || 'غير محدد'}</p></div></div>
                    <div class="action-info-card"><i class="fas fa-tag"></i><div class="info"><label>التصنيف</label><p>${agent.classification}</p></div></div>
                    <div class="action-info-card"><i class="fas fa-wallet"></i><div class="info"><label>الرصيد المتبقي</label><p>$${agent.remaining_balance || 0}</p></div></div>
                    <div class="action-info-card"><i class="fas fa-gift"></i><div class="info"><label>بونص إيداع متبقي</label><p>${agent.remaining_deposit_bonus || 0} مرات</p></div></div>
                    <div class="action-info-card"><i class="fas fa-percent"></i><div class="info"><label>نسبة بونص الإيداع</label><p>${agent.deposit_bonus_percentage || 0}%</p></div></div>
                </div>
            </div>

            <!-- Variables Column -->
            <div class="variables-v3 card-style-container">
                <h3><i class="fas fa-cogs"></i> 1. تعديل المتغيرات</h3>
                <div class="form-group">
                    <label for="competition-template-select">اختر القالب</label>
                    <select id="competition-template-select" required>
                        <option value="" disabled selected>-- اختر قالبًا --</option>
                        ${templates.map(t => `<option value="${t.id}">${t.question}</option>`).join('')}
                    </select>
                </div>
                <div class="override-fields-grid">
                    <div class="form-group">
                        <label for="override-trading-winners">عدد الفائزين (تداولي)</label>
                        <input type="number" id="override-trading-winners" value="${agent.winners_count || 0}">
                    </div>
                    <div class="form-group">
                        <label for="override-prize">الجائزة لكل فائز ($)</label>
                        <input type="number" id="override-prize" step="0.01" value="${parseFloat(agent.prize_per_winner || 0).toFixed(2)}">
                    </div>
                    <div class="form-group">
                        <label for="override-deposit-winners">عدد الفائزين (إيداع)</label>
                        <input type="number" id="override-deposit-winners" value="0">
                    </div>
                    <div class="form-group">
                        <label for="override-duration">مدة المسابقة</label>
                        <input type="text" id="override-duration" value="${agent.competition_duration || 'غير محدد'}">
                    </div>
                </div>
                <div id="competition-validation-messages" class="validation-messages"></div>
            </div>

            <!-- Preview Column -->
            <div class="preview-v3 card-style-container">
                <form id="competition-form">
                    <h3><i class="fab fa-telegram-plane"></i> 2. معاينة وإرسال</h3>
                    <div class="telegram-preview-wrapper">
                        <div class="telegram-preview-header">
                            <div class="header-left">
                                <i class="fab fa-telegram"></i>
                                <span>معاينة الرسالة</span>
                            </div>
                        </div>
                        <div class="telegram-preview-body">
                            <textarea id="competition-description" rows="15" required readonly></textarea>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary btn-send-telegram"><i class="fas fa-paper-plane"></i> إرسال إلى تلجرام الآن</button>
                        <button type="button" id="cancel-competition-form" class="btn-secondary">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const form = document.getElementById('competition-form');
    const templateSelect = document.getElementById('competition-template-select');
    const descInput = document.getElementById('competition-description');
    const tradingWinnersInput = document.getElementById('override-trading-winners');
    const prizeInput = document.getElementById('override-prize');
    const depositWinnersInput = document.getElementById('override-deposit-winners');
    const durationInput = document.getElementById('override-duration');
    const validationContainer = document.getElementById('competition-validation-messages');
    const sendBtn = form.querySelector('.btn-send-telegram');

    function numberToArPlural(num) {
        const words = {
            3: 'ثلاث', 4: 'أربع', 5: 'خمس', 6: 'ست', 7: 'سبع', 8: 'ثماني', 9: 'تسع', 10: 'عشر'
        };
        return words[num] || num.toString();
    }

    function updateDescriptionAndPreview() {
        const selectedId = templateSelect.value;
        const selectedTemplate = templates.find(t => t.id == selectedId);

        if (!selectedTemplate) {
            descInput.value = ''; // Clear preview if no template is selected
            return;
        }

        const originalTemplateContent = selectedTemplate.content;
        const selectedTemplateQuestion = selectedTemplate.question;

        const tradingWinners = parseInt(tradingWinnersInput.value) || 0;
        const depositWinners = parseInt(depositWinnersInput.value) || 0;
        const prize = parseFloat(prizeInput.value || 0).toFixed(2);
        const duration = durationInput.value;
        const depositBonusPerc = agent.deposit_bonus_percentage || 0;
        
        // Create a formatted prize string
        let prizeDetailsText = '';
        if (tradingWinners === 1) {
            prizeDetailsText = `${prize}$ لفائز واحد فقط.`;
        } else if (tradingWinners === 2) {
            prizeDetailsText = `${prize}$ لفائزين اثنين فقط.`;
        } else if (tradingWinners >= 3 && tradingWinners <= 10) {
            const numberInArabic = numberToArPlural(tradingWinners);
            prizeDetailsText = `${prize}$ لـ ${numberInArabic} فائزين فقط.`;
        } else if (tradingWinners > 10) {
            prizeDetailsText = `${prize}$ لـ ${tradingWinners} فائزاً فقط.`;
        }

        // Create deposit bonus prize string
        let depositBonusPrizeText = '';
        if (depositWinners > 0 && depositBonusPerc > 0) {
            if (depositWinners === 1) {
                depositBonusPrizeText = `${depositBonusPerc}% لفائز واحد.`;
            } else if (depositWinners === 2) {
                depositBonusPrizeText = `${depositBonusPerc}% لفائزين اثنين.`;
            } else if (depositWinners >= 3 && depositWinners <= 10) {
                depositBonusPrizeText = `${depositBonusPerc}% لـ ${numberToArPlural(depositWinners)} فائزين.`;
            } else if (depositWinners > 10) {
                depositBonusPrizeText = `${depositBonusPerc}% لـ ${depositWinners} فائزاً.`;
            }
        }

        let content = originalTemplateContent;
        content = content.replace(/{{agent_name}}/g, agent.name || '');
        
        if (prizeDetailsText) {
            content = content.replace(/{{prize_details}}/g, prizeDetailsText);
        } else {
            content = content.replace(/^.*{{prize_details}}.*\n?/gm, '');
        }

        if (depositBonusPrizeText) {
            content = content.replace(/{{deposit_bonus_prize_details}}/g, depositBonusPrizeText);
        } else {
            content = content.replace(/^.*{{deposit_bonus_prize_details}}.*\n?/gm, '');
        }

        if (duration && duration.trim() !== '' && duration.trim() !== 'غير محدد') {
            content = content.replace(/{{competition_duration}}/g, duration);
        } else {
            content = content.replace(/^.*{{competition_duration}}.*\n?/gm, '');
        }

        content = content.replace(/{{question}}/g, selectedTemplateQuestion || '');
        content = content.replace(/{{remaining_deposit_bonus}}/g, agent.remaining_deposit_bonus || 0);
        content = content.replace(/{{deposit_bonus_percentage}}/g, agent.deposit_bonus_percentage || 0);
        content = content.replace(/{{winners_count}}/g, tradingWinners);
        content = content.replace(/{{prize_per_winner}}/g, prize);
        
        descInput.value = content;

        // --- Real-time Validation ---
        let validationMessages = [];
        let isInvalid = false;

        const totalCost = tradingWinners * prize;
        if (totalCost > 0 && totalCost > agent.remaining_balance) {
            validationMessages.push(`<div class="validation-error"><i class="fas fa-exclamation-triangle"></i> الرصيد التداولي (${agent.remaining_balance}$) غير كافٍ لتغطية تكلفة المسابقة (${totalCost.toFixed(2)}$).</div>`);
            isInvalid = true;
        }

        if (depositWinners > 0 && depositWinners > agent.remaining_deposit_bonus) {
            validationMessages.push(`<div class="validation-error"><i class="fas fa-exclamation-triangle"></i> عدد مرات بونص الإيداع المتبقية (${agent.remaining_deposit_bonus}) غير كافٍ لـ ${depositWinners} فائزين.</div>`);
            isInvalid = true;
        }

        validationContainer.innerHTML = validationMessages.join('');
        sendBtn.disabled = isInvalid;
    }

    [templateSelect, tradingWinnersInput, prizeInput, depositWinnersInput, durationInput].forEach(input => {
        input.addEventListener('input', updateDescriptionAndPreview);
        input.addEventListener('change', updateDescriptionAndPreview); // Also for select
    });

    document.getElementById('cancel-competition-form').addEventListener('click', () => {
        window.location.hash = `profile/${agent.id}`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sendBtn = e.target.querySelector('.btn-send-telegram');
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

        const selectedTemplateId = templateSelect.value;
        const selectedTemplate = templates.find(t => t.id == selectedTemplateId);
        if (!selectedTemplate) {
            showToast('يرجى اختيار قالب مسابقة صالح.', 'error');
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال إلى تلجرام الآن';
            return;
        }

        const finalDescription = descInput.value;
        const tradingWinnersCount = parseInt(tradingWinnersInput.value) || 0;
        const depositWinnersCount = parseInt(depositWinnersInput.value) || 0;
        const prizePerWinner = parseFloat(prizeInput.value) || 0;
        const totalCost = tradingWinnersCount * prizePerWinner;

        // Re-validate on submit, just in case.
        if (totalCost > 0 && totalCost > agent.remaining_balance) {
            showToast(`الرصيد التداولي للوكيل (${agent.remaining_balance}$) غير كافٍ لتغطية تكلفة المسابقة (${totalCost.toFixed(2)}$).`, 'error');
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال إلى تلجرام الآن';
            return;
        }

        if (depositWinnersCount > 0 && depositWinnersCount > agent.remaining_deposit_bonus) {
            showToast(`عدد مرات بونص الإيداع المتبقية (${agent.remaining_deposit_bonus}) غير كافٍ لـ ${depositWinnersCount} فائزين.`, 'error');
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال إلى تلجرام الآن';
            return;
        }

        try {
            // 1. Save the competition
            const { data: newCompetition, error: competitionError } = await supabase
                .from('competitions')
                .insert({
                    name: selectedTemplate.question,
                    description: finalDescription,
                    is_active: true,
                    agent_id: agent.id,
                })
                .select()
                .single();

            if (competitionError) throw new Error(`فشل حفظ المسابقة: ${competitionError.message}`);

            // 2. Deduct balance
            const newConsumed = (agent.consumed_balance || 0) + totalCost;
            const newRemaining = (agent.competition_bonus || 0) - newConsumed;
            const newUsedDepositBonus = (agent.used_deposit_bonus || 0) + depositWinnersCount;
            const newRemainingDepositBonus = (agent.deposit_bonus_count || 0) - newUsedDepositBonus;

            const { error: agentError } = await supabase
                .from('agents')
                .update({ consumed_balance: newConsumed, remaining_balance: newRemaining, used_deposit_bonus: newUsedDepositBonus, remaining_deposit_bonus: newRemainingDepositBonus })
                .eq('id', agent.id);
            
            if (agentError) throw new Error(`فشل تحديث رصيد الوكيل: ${agentError.message}`);

            // 3. Send to Telegram
            const telegramResponse = await fetch('/api/post-announcement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: finalDescription })
            });

            if (!telegramResponse.ok) {
                const result = await telegramResponse.json();
                throw new Error(`فشل الإرسال إلى تلجرام: ${result.message}`);
            }

            // 4. Log activity
            await logAgentActivity(agent.id, 'COMPETITION_CREATED', `تم إنشاء وإرسال مسابقة "${selectedTemplate.question}" بتكلفة ${totalCost.toFixed(2)}$ و ${depositWinnersCount} بونص إيداع.`);
            
            // 5. Success
            showToast('تم حفظ المسابقة وإرسالها وخصم الرصيد بنجاح.', 'success');
            window.location.hash = `profile/${agent.id}`;

        } catch (error) {
            showToast(error.message, 'error');
            console.error('Competition creation failed:', error);
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال إلى تلجرام الآن';
        }
    });
}

// --- 3. Edit Existing Competition Form ---

async function renderCompetitionEditForm(compId) {
    const appContent = document.getElementById('app-content');
    const { data: competition, error } = await supabase.from('competitions').select('*, agents(*)').eq('id', compId).single();
    
    if (error || !competition) {
        showToast('لم يتم العثور على المسابقة.', 'error');
        window.location.hash = 'competitions';
        return;
    }

    appContent.innerHTML = `
        <div class="form-container">
            <h2>تعديل المسابقة: ${competition.name}</h2>
            <form id="competition-form" class="form-layout">
                <div class="form-group"><label for="competition-name">اسم المسابقة</label><input type="text" id="competition-name" value="${competition.name}" required></div>
                <div class="form-group"><label for="competition-description">الوصف</label><textarea id="competition-description" rows="3">${competition.description || ''}</textarea></div>
                <div class="form-group"><label class="custom-checkbox toggle-switch"><input type="checkbox" id="competition-active" ${competition.is_active ? 'checked' : ''}> <span class="slider"></span><span class="label-text">نشطة</span></label></div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">حفظ التعديلات</button>
                    <button type="button" id="cancel-competition-form" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('cancel-competition-form').addEventListener('click', () => { window.location.hash = 'competitions'; });

    document.getElementById('competition-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            name: document.getElementById('competition-name').value,
            description: document.getElementById('competition-description').value,
            is_active: document.getElementById('competition-active').checked,
        };

        const { error } = await supabase.from('competitions').update(formData).eq('id', compId);

        if (error) {
            showToast('فشل حفظ التعديلات.', 'error');
        } else {
            showToast('تم حفظ التعديلات بنجاح.', 'success');
            if (competition.agent_id) {
                window.location.hash = `profile/${competition.agent_id}`;
            } else {
                window.location.hash = 'competitions';
            }
        }
    });
}

// --- 4. Competition Templates Page ---

async function renderCompetitionTemplatesPage() {
    const appContent = document.getElementById('app-content');

    const defaultTemplateContent = `مسابقة جديدة من شركة إنزو للتداول 🏆

✨ هل تملك عينًا خبيرة في قراءة الشارتات؟ اختبر نفسك واربح!

💰 الجائزة: {{prize_details}}
🎁 أو جائزة بونص إيداع: {{deposit_bonus_prize_details}}

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
            <h1><i class="fas fa-file-alt"></i> إدارة قوالب المسابقات</h1>
        </div>
        <div class="templates-layout">
            <div class="template-form-container card-style-container">
                <h2><i class="fas fa-plus-circle"></i> إنشاء قالب جديد</h2>
                <form id="template-form" class="form-layout">
                    <div class="form-group">
                        <label for="template-question">السؤال (سيكون اسم المسابقة)</label>
                        <input type="text" id="template-question" required>
                    </div>
                    <div class="form-group">
                        <label for="template-classification">التصنيف (لمن سيظهر هذا القالب)</label>
                        <select id="template-classification" required>
                            <option value="All" selected>الكل (يظهر لجميع التصنيفات)</option>
                            <option value="R">R</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="template-content">محتوى المسابقة (الوصف)</label>
                        <textarea id="template-content" rows="15" required>${defaultTemplateContent}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary"><i class="fas fa-save"></i> حفظ القالب</button>
                        <button type="button" id="cancel-template-form" class="btn-secondary">إلغاء</button>
                    </div>
                </form>
            </div>
            <div class="templates-list-container">
                <h2><i class="fas fa-archive"></i> القوالب المحفوظة</h2>
                <div id="templates-list" class="templates-grid"></div>
            </div>
        </div>
    `;

    const templatesListDiv = document.getElementById('templates-list');
    const form = document.getElementById('template-form');
    const questionInput = document.getElementById('template-question');
    const contentInput = document.getElementById('template-content');

    async function loadTemplates() {
        const { data: templates, error } = await supabase
            .from('competition_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching templates:', error);
            templatesListDiv.innerHTML = '<p class="error">فشل تحميل القوالب.</p>';
            return;
        }

        if (templates.length === 0) {
            templatesListDiv.innerHTML = '<p class="no-results-message">لا توجد قوالب محفوظة بعد.</p>';
        } else {
            templatesListDiv.innerHTML = templates.map(template => `
                <div class="template-card" data-id="${template.id}">
                    <div class="template-card-header">
                        <h4>${template.question}</h4>
                        <span class="classification-badge classification-${(template.classification || 'all').toLowerCase()}">${template.classification || 'الكل'}</span>
                    </div>
                    <div class="template-card-body">
                        <p>${template.content.substring(0, 120)}...</p>
                    </div>
                    <div class="template-card-footer">
                        <button class="btn-secondary edit-template-btn" data-id="${template.id}"><i class="fas fa-edit"></i> تعديل</button>
                        <button class="btn-danger delete-template-btn" data-id="${template.id}"><i class="fas fa-trash-alt"></i> حذف</button>
                    </div>
                </div>
            `).join('');
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            question: questionInput.value.trim(),
            content: contentInput.value.trim(),
            classification: document.getElementById('template-classification').value,
        };

        if (!formData.question || !formData.content) {
            showToast('يرجى ملء حقلي السؤال والمحتوى.', 'error');
            return;
        }

        const { error } = await supabase.from('competition_templates').insert(formData);

        if (error) {
            showToast('فشل حفظ القالب.', 'error');
            console.error('Template insert error:', error);
        } else {
            showToast('تم حفظ القالب بنجاح.', 'success');
            form.reset();
            await loadTemplates();
        }
    });

    document.getElementById('cancel-template-form').addEventListener('click', () => {
        form.reset();
    });

    templatesListDiv.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-template-btn');
        if (editBtn) {
            const id = editBtn.dataset.id;
            const { data: template, error } = await supabase
                .from('competition_templates')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error || !template) {
                showToast('فشل العثور على القالب.', 'error');
                return;
            }
            
            renderEditTemplateModal(template, loadTemplates);
        }

        const deleteBtn = e.target.closest('.delete-template-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            showConfirmationModal(
                'هل أنت متأكد من حذف هذا القالب؟<br><small>لا يمكن التراجع عن هذا الإجراء.</small>',
                async () => {
                    const { error } = await supabase.from('competition_templates').delete().eq('id', id);
                    if (error) {
                        showToast('فشل حذف القالب.', 'error');
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
}

function renderEditTemplateModal(template, onSaveCallback) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'form-modal-content'; // Use existing style from components.css
    
    modal.innerHTML = `
        <div class="form-modal-header">
            <h2>تعديل قالب مسابقة</h2>
            <button id="close-modal-btn" class="btn-secondary" style="min-width: 40px; padding: 5px 10px;">&times;</button>
        </div>
        <div class="form-modal-body">
            <form id="edit-template-form" class="form-layout">
                <div class="form-group">
                    <label for="edit-template-question">السؤال</label>
                    <input type="text" id="edit-template-question" value="${template.question}" required>
                </div>
                <div class="form-group">
                    <label for="edit-template-classification">التصنيف</label>
                    <select id="edit-template-classification" required>
                        <option value="All" ${template.classification === 'All' ? 'selected' : ''}>الكل</option>
                        <option value="R" ${template.classification === 'R' ? 'selected' : ''}>R</option>
                        <option value="A" ${template.classification === 'A' ? 'selected' : ''}>A</option>
                        <option value="B" ${template.classification === 'B' ? 'selected' : ''}>B</option>
                        <option value="C" ${template.classification === 'C' ? 'selected' : ''}>C</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="edit-template-content">محتوى المسابقة</label>
                    <textarea id="edit-template-content" rows="8" required>${template.content}</textarea>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary"><i class="fas fa-save"></i> حفظ التعديلات</button>
                    <button type="button" id="cancel-edit-modal" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-edit-modal').addEventListener('click', closeModal);
    
    document.getElementById('edit-template-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updatedData = {
            question: document.getElementById('edit-template-question').value.trim(),
            classification: document.getElementById('edit-template-classification').value,
            content: document.getElementById('edit-template-content').value.trim(),
        };

        const { error } = await supabase.from('competition_templates').update(updatedData).eq('id', template.id);
            
        if (error) {
            showToast('فشل حفظ التعديلات.', 'error');
        } else {
            showToast('تم حفظ التعديلات بنجاح.', 'success');
            closeModal();
            if (onSaveCallback) onSaveCallback();
        }
    });
}