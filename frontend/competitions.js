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
                <div class="filter-buttons">
                    <button class="filter-btn active" data-filter="all">الكل</button>
                    <button class="filter-btn" data-filter="active">نشطة</button>
                    <button class="filter-btn" data-filter="inactive">غير نشطة</button>
                </div>
            </div>
        </div>
        <div id="competitions-list-grid" class="competitions-grid"></div>
    `;

    const grid = document.getElementById('competitions-list-grid');

    // Use event delegation for delete buttons
    grid.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-competition-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            showConfirmationModal(
                'هل أنت متأكد من حذف هذه المسابقة؟ هذا الإجراء لا يمكن التراجع عنه.',
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
                    confirmText: 'نعم، قم بالحذف',
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
        grid.innerHTML = `<p class="error">حدث خطأ أثناء جلب المسابقات.</p>`;
        return;
    }

    if (competitions.length === 0) {
        grid.innerHTML = '<p class="no-results-message">لا توجد مسابقات حالياً. يمكنك إنشاء واحدة من صفحة الوكيل.</p>';
    } else {
        renderCompetitionGrid(competitions);
    }
    
    setupCompetitionFilters(competitions);
}

function renderCompetitionGrid(competitions) {
    const grid = document.getElementById('competitions-list-grid');
    if (!grid) return;

    grid.innerHTML = competitions.length > 0 ? competitions.map(comp => {
        const agent = comp.agents;
        const agentInfoHtml = agent
            ? `<a href="#profile/${agent.id}" class="competition-card-agent-info">
                    ${agent.avatar_url
                        ? `<img src="${agent.avatar_url}" alt="Agent Avatar" class="avatar-small" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`
                        : `<div class="avatar-placeholder-small" style="width: 32px; height: 32px; border-radius: 50%; font-size: 16px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-user"></i></div>`}
                    <div class="agent-details">
                        <span>${agent.name}</span>
                        ${agent.classification ? `<span class="classification-badge classification-${agent.classification.toLowerCase()}">${agent.classification}</span>` : ''}
                    </div>
               </a>`
            : `<div class="competition-card-agent-info"><span>(وكيل محذوف أو غير مرتبط)</span></div>`;

        return `
        <div class="competition-card">
            <div class="competition-card-header">
                <h3>${comp.name}</h3>
                <span class="status-badge ${comp.is_active ? 'active' : 'inactive'}">${comp.is_active ? 'نشطة' : 'غير نشطة'}</span>
            </div>
            ${agentInfoHtml}
            <div class="competition-card-body">
                <p class="description"><i class="fas fa-info-circle"></i><div><strong>الوصف:</strong> ${comp.description ? comp.description.substring(0, 80) + '...' : '<em>لا يوجد وصف</em>'}</div></p>
                <p class="creation-date"><i class="fas fa-calendar-plus"></i><div><strong>تاريخ الإنشاء:</strong> ${new Date(comp.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}</div></p>
            </div>
            <div class="competition-card-footer">
                <button class="btn-secondary edit-btn" onclick="window.location.hash='#competitions/edit/${comp.id}'"><i class="fas fa-edit"></i> تعديل</button>
                <button class="btn-danger delete-competition-btn" data-id="${comp.id}"><i class="fas fa-trash-alt"></i> حذف</button>
            </div>
        </div>
        `;
    }).join('') : '<p class="no-results-message">لا توجد نتائج تطابق بحثك.</p>';
}

function setupCompetitionFilters(allCompetitions) {
    const searchInput = document.getElementById('competition-search-input');
    const clearBtn = document.getElementById('competition-search-clear');
    const filterButtons = document.querySelectorAll('.agent-filters .filter-btn');

    const applyFilters = () => {
        if (!searchInput) return;
        if (clearBtn) clearBtn.style.display = searchInput.value ? 'block' : 'none';
        
        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeFilter = document.querySelector('.agent-filters .filter-btn.active').dataset.filter;

        const filteredCompetitions = allCompetitions.filter(comp => {
            const name = comp.name.toLowerCase();
            const agentName = comp.agents ? comp.agents.name.toLowerCase() : '';
            const status = comp.is_active ? 'active' : 'inactive';

            const matchesSearch = searchTerm === '' || name.includes(searchTerm) || agentName.includes(searchTerm);
            const matchesFilter = activeFilter === 'all' || status === activeFilter;
            return matchesSearch && matchesFilter;
        });
        
        renderCompetitionGrid(filteredCompetitions);
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

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            applyFilters();
        });
    });
}

// --- 2. Create Competition for Agent Page ---

async function renderCompetitionCreatePage(agentId) {
    const appContent = document.getElementById('app-content');

    if (!agentId) {
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
                ${agents.map(agent => `
                    <a href="#competitions/new?agentId=${agent.id}" class="agent-selection-card">
                        ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : `<div class="avatar-placeholder" style="width: 40px; height: 40px; font-size: 20px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-user"></i></div>`}
                        <div class="agent-info">
                            <h3>${agent.name}</h3>
                            <p>#${agent.agent_id} | ${agent.classification}</p>
                        </div>
                        <i class="fas fa-chevron-left"></i>
                    </a>
                `).join('')}
            </div>
        `;
        return;
    }

    const agentResult = await supabase.from('agents').select('*').eq('id', agentId).single();
    const agent = agentResult.data;

    if (!agent) {
        appContent.innerHTML = `<p class="error">لم يتم العثور على الوكيل.</p>`;
        return;
    }

    appContent.innerHTML = `
        <div class="page-header"><h1>إنشاء مسابقة للوكيل: ${agent.name}</h1></div>
        <div class="competition-form-agent-info">
            <h3><i class="fas fa-user-circle"></i> بيانات الوكيل</h3>
            <div class="agent-info-grid">
                <p><strong>المرتبة:</strong> ${agent.rank || 'غير محدد'}</p>
                <p><strong>التصنيف:</strong> ${agent.classification}</p>
                <p><strong>رصيد المسابقات:</strong> ${agent.competition_bonus || 0}$</p>
                <p><strong>الرصيد المتبقي:</strong> ${agent.remaining_balance || 0}$</p>
                <p><strong>مدة المسابقة:</strong> ${agent.competition_duration || 'غير محدد'}</p>
            </div>
        </div>
        
        <form id="competition-form" class="form-layout" style="margin-top: 30px;">
            <h2>تفاصيل المسابقة</h2>
            <div class="form-group"><label for="competition-name">اسم المسابقة</label><input type="text" id="competition-name" required></div>
            <div class="form-group"><label for="competition-description">الوصف (سيتم إرساله للوكيل)</label><textarea id="competition-description" rows="5" required></textarea></div>
            <div class="form-group"><label class="custom-checkbox toggle-switch"><input type="checkbox" id="competition-active" checked> <span class="slider"></span><span class="label-text">نشطة</span></label></div>
            <div class="form-actions">
                <button type="submit" class="btn-primary">حفظ وإنشاء المسابقة</button>
                <button type="button" id="cancel-competition-form" class="btn-secondary">إلغاء</button>
            </div>
        </form>
    `;

    const form = document.getElementById('competition-form');
    const nameInput = document.getElementById('competition-name');
    const descInput = document.getElementById('competition-description');

    document.getElementById('cancel-competition-form').addEventListener('click', () => {
        window.location.hash = `profile/${agent.id}`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            name: nameInput.value,
            description: descInput.value,
            is_active: document.getElementById('competition-active').checked,
            agent_id: agent.id,
        };

        const { error } = await supabase.from('competitions').insert(formData);

        if (error) {
            showToast('فشل حفظ المسابقة.', 'error');
            console.error(error);
        } else {
            const cost = agent.single_competition_balance || 0;
            const newConsumed = (agent.consumed_balance || 0) + cost;
            const newRemaining = (agent.competition_bonus || 0) - newConsumed;

            const { error: agentError } = await supabase
                .from('agents')
                .update({ consumed_balance: newConsumed, remaining_balance: newRemaining })
                .eq('id', agent.id);

            if (agentError) {
                showToast('تم إنشاء المسابقة ولكن فشل تحديث رصيد الوكيل.', 'error');
            } else {
                await logAgentActivity(agent.id, 'COMPETITION_CREATED', `تم إنشاء مسابقة جديدة "${formData.name}" بتكلفة ${cost}$.`);
                showToast('تم حفظ المسابقة وخصم الرصيد بنجاح.', 'success');
            }
            window.location.hash = `profile/${agent.id}`;
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