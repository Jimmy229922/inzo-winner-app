async function renderCompetitionsPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header">
            <h1>إدارة المسابقات</h1>
        </div>
        <div id="competitions-container"></div>
    `;

    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const agentId = urlParams.get('agentId');

    if (hash.startsWith('#competitions/new')) {
        if (agentId) {
            const { data: agent, error } = await supabase.from('agents').select('*').eq('id', agentId).single();
            if (agent) {
                renderCompetitionForm({}, agent);
            } else {
                showToast('لم يتم العثور على الوكيل.', 'error');
                await renderCompetitionsList();
            }
        } else {
            renderCompetitionForm(); // For general competitions
        }
    } else if (hash.startsWith('#competitions/edit/')) {
        const compId = hash.split('/')[2];
        const { data: competition, error } = await supabase.from('competitions').select('*, agents(*)').eq('id', compId).single();
        if (competition) {
            renderCompetitionForm(competition, competition.agents);
        } else {
            showToast('لم يتم العثور على المسابقة.', 'error');
            await renderCompetitionsList();
        }
    } else {
        await renderCompetitionsList();
    }
}

async function renderCompetitionsList() {
    const container = document.getElementById('competitions-container');
    if (!container) return;

    if (!supabase) {
        container.innerHTML = `<p class="error">لا يمكن عرض المسابقات، لم يتم الاتصال بقاعدة البيانات.</p>`;
        return;
    }

    const { data: competitions, error } = await supabase.from('competitions').select('*, agents(name)');

    if (error) {
        console.error("Error fetching competitions:", error);
        container.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات المسابقات.</p>`;
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <h2>المسابقات الحالية</h2>
            <button id="add-competition-btn" class="btn-primary"><i class="fas fa-plus"></i> إضافة مسابقة عامة</button>
        </div>
        <div class="competitions-grid">
            ${competitions.length > 0 ? competitions.map(comp => `
                <div class="competition-card">
                    <div class="competition-card-header">
                        <h3>${comp.name}</h3>
                        <span class="status-badge ${comp.is_active ? 'active' : 'inactive'}">${comp.is_active ? 'نشطة' : 'غير نشطة'}</span>
                    </div>
                    <div class="competition-card-body">
                        <p>
                            <i class="fas fa-user"></i>
                            <div><strong>الوكيل:</strong> ${comp.agents ? comp.agents.name : '<em>(عامة)</em>'}</div>
                        </p>
                        <p class="description">
                            <i class="fas fa-info-circle"></i>
                            <div><strong>الوصف:</strong> ${comp.description || '<em>لا يوجد وصف</em>'}</div>
                        </p>
                    </div>
                    <div class="competition-card-footer">
                        <button class="btn-secondary edit-btn" data-id="${comp.id}" title="تعديل"><i class="fas fa-edit"></i> تعديل</button>
                        <button class="btn-danger delete-btn" data-id="${comp.id}" title="حذف"><i class="fas fa-trash-alt"></i> حذف</button>
                    </div>
                </div>
            `).join('') : '<p>لا توجد مسابقات حالياً.</p>'}
        </div>
    `;

    document.getElementById('add-competition-btn').addEventListener('click', () => window.location.hash = 'competitions/new');

    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.hash = `#competitions/edit/${btn.dataset.id}`;
        });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.competition-card');
            const id = btn.dataset.id;
            showConfirmationModal('هل أنت متأكد من حذف هذه المسابقة؟', async () => {
                const { error } = await supabase.from('competitions').delete().eq('id', id);
                if (error) {
                    showToast('فشل حذف المسابقة.', 'error');
                } else {
                    showToast('تم حذف المسابقة بنجاح.', 'success');
                    card.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.95)';
                    setTimeout(() => card.remove(), 400);
                }
            });
        });
    });
}

async function renderCompetitionForm(competition = {}, agent = null) {
    const container = document.getElementById('competitions-container');
    const isEdit = !!competition.id;

    let agentInfoHtml = '';
    if (agent) {
        agentInfoHtml = `
            <div class="competition-form-agent-info">
                <h3>مسابقة خاصة بالوكيل: ${agent.name}</h3>
                <p>سيتم خصم <strong>${agent.single_competition_balance || 0}$</strong> من رصيد المسابقات عند الحفظ.</p>
            </div>
        `;
    }

    container.innerHTML = `
        <h2>${isEdit ? 'تعديل' : 'إضافة'} مسابقة ${agent ? 'خاصة' : 'عامة'}</h2>
        ${agentInfoHtml}
        <form id="competition-form" class="form-layout">
            <input type="hidden" id="competition-id" value="${competition.id || ''}">
            <div class="form-group"><label for="competition-name">اسم المسابقة</label><input type="text" id="competition-name" value="${competition.name || (agent ? `مسابقة الوكيل ${agent.name}`: '')}" required></div>
            <div class="form-group"><label for="competition-description">الوصف</label><textarea id="competition-description" rows="3">${competition.description || ''}</textarea></div>
            <div class="form-group"><label class="custom-checkbox toggle-switch"><input type="checkbox" id="competition-active" ${competition.is_active !== false ? 'checked' : ''}> <span class="slider"></span><span class="label-text">نشطة</span></label></div>
            <div class="form-actions">
                <button type="submit" class="btn-primary">حفظ</button>
                <button type="button" id="cancel-competition-form" class="btn-secondary">إلغاء</button>
            </div>
        </form>
    `;

    document.getElementById('cancel-competition-form').addEventListener('click', () => { window.location.hash = 'competitions'; });
    document.getElementById('competition-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            name: document.getElementById('competition-name').value,
            description: document.getElementById('competition-description').value,
            is_active: document.getElementById('competition-active').checked,
            agent_id: agent ? agent.id : null,
        };
        const id = document.getElementById('competition-id').value;

        const { data: savedCompetition, error } = id
            ? await supabase.from('competitions').update(formData).eq('id', id)
            : await supabase.from('competitions').insert(formData).select().single();

        if (error) {
            showToast('فشل حفظ المسابقة.', 'error');
            console.error(error);
        } else {
            // If it's a new competition for an agent, update the agent's balance
            if (agent && !isEdit) {
                const cost = agent.single_competition_balance || 0;
                const newConsumed = (agent.consumed_balance || 0) + cost;
                const newRemaining = (agent.competition_bonus || 0) - newConsumed;

                const { error: agentError } = await supabase
                    .from('agents')
                    .update({ consumed_balance: newConsumed, remaining_balance: newRemaining })
                    .eq('id', agent.id);

                if (agentError) {
                    showToast('تم إنشاء المسابقة ولكن فشل تحديث رصيد الوكيل.', 'error');
                    console.error("Agent balance update failed:", agentError);
                } else {
                    await logAgentActivity(agent.id, 'COMPETITION_CREATED', `تم إنشاء مسابقة جديدة "${formData.name}" بتكلفة ${cost}$. الرصيد المستهلك تغير من ${agent.consumed_balance || 0} إلى ${newConsumed}.`);
                    showToast('تم حفظ المسابقة وخصم الرصيد بنجاح.', 'success');
                }
            } else {
                if (isEdit && agent) {
                    const changes = Object.keys(formData).filter(key => formData[key] !== competition[key]).map(key => `"${key}"`).join(', ');
                    if (changes) await logAgentActivity(agent.id, 'COMPETITION_UPDATE', `تم تعديل بيانات المسابقة "${formData.name}": ${changes}.`);
                }
                showToast('تم حفظ المسابقة بنجاح.', 'success');
            }
            window.location.hash = 'competitions';
        }
    });
}