async function renderTasksPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header">
            <h1>مهمات اليوم</h1>
        </div>
        <div id="task-list-container"></div>
    `;

    await renderTaskList();
}

async function renderManageAgentsPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header">
            <h1>إدارة الوكلاء</h1>
            <button id="add-agent-btn" class="btn-primary"><i class="fas fa-plus"></i> إضافة وكيل جديد</button>
        </div>
        <div id="agent-table-container"></div>
    `;

    document.getElementById('add-agent-btn').addEventListener('click', () => {
        setActiveNav(null);
        window.location.hash = 'add-agent?returnTo=manage-agents';
    });

    if (!supabase) {
        appContent.innerHTML = `<p class="error">لا يمكن عرض الوكلاء، لم يتم الاتصال بقاعدة البيانات.</p>`;
        return;
    }

    const { data: agents, error } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching agents:", error);
        document.getElementById('agent-table-container').innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات الوكلاء.</p>`;
        return;
    }

    document.getElementById('agent-table-container').innerHTML = `
        <table class="agent-list-table">
            <thead>
                <tr>
                    <th>اسم الوكيل</th>
                    <th>رقم الوكالة</th>
                    <th>التصنيف</th>
                    <th>إجراء</th>
                </tr>
            </thead>
            <tbody>
                ${agents.map(agent => `
                    <tr data-agent-id="${agent.id}" class="clickable-row">
                        <td class="agent-name-cell">${agent.name}</td>
                        <td>${agent.agent_id}</td>
                        <td>${agent.classification}</td>
                        <td class="actions-cell">
                            <button class="edit-btn" title="تعديل الوكيل"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn" title="حذف الوكيل"><i class="fas fa-trash-alt"></i></button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    // Add event listener for the row
    appContent.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.closest('.actions-cell')) return; // Don't navigate if an action button was clicked
            window.location.hash = `profile/${row.dataset.agentId}`;
        });
    });

    // Add edit listeners
    appContent.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const row = e.currentTarget.closest('tr');
            const agentId = row.dataset.agentId;
            window.location.hash = `profile/${agentId}/edit`;
        });
    });

    // Add delete listeners
    appContent.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const row = e.currentTarget.closest('tr');
            const agentId = row.dataset.agentId;
            const agentName = row.cells[0].textContent;

            showConfirmationModal(`هل أنت متأكد من رغبتك في حذف الوكيل "${agentName}"؟ هذا الإجراء لا يمكن التراجع عنه.`, async () => {
                if (!supabase) return showToast('لا يمكن الحذف، لم يتم الاتصال بقاعدة البيانات.', 'error');
                
                // Log the deletion action before deleting. This requires the foreign key to be ON DELETE SET NULL.
                await logAgentActivity(agentId, 'AGENT_DELETED', `تم حذف الوكيل: ${agentName} (ID: ${agentId}).`);
                
                const { error } = await supabase.from('agents').delete().eq('id', agentId);

                if (error) {
                    // Log the full error object for better debugging
                    console.error('Error deleting agent:', JSON.stringify(error, null, 2));
                    const userMessage = error.message.includes('violates foreign key constraint')
                        ? 'فشل الحذف لوجود بيانات مرتبطة بالوكيل. قم بتشغيل سكربت تحديث قاعدة البيانات.'
                        : 'فشل حذف الوكيل.';
                    showToast(userMessage, 'error');
                } else {
                    showToast('تم حذف الوكيل بنجاح.', 'success');
                    row.style.transition = 'opacity 0.4s ease-out';
                    row.style.opacity = '0';
                    setTimeout(() => row.remove(), 400);
                }
            });
        });
    });
}

async function renderTaskList() {
    const container = document.getElementById('task-list-container');
    if (!container) return;

    if (!supabase) {
        container.innerHTML = `<p class="error">لا يمكن عرض المهام، لم يتم الاتصال بقاعدة البيانات.</p>`;
        return;
    }

    const today = new Date().getDay(); // 0 for Sunday, 1 for Monday, etc.

    let query = supabase
        .from('agents')
        .select('*')
        .contains('audit_days', [today]); // Filter for today's tasks

    const { data: filteredAgents, error } = await query.order('classification')
        .order('name');

    if (error) {
        console.error("Error fetching agents for tasks:", error);
        container.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات المهام.</p>`;
        return;
    }

    // Fetch today's tasks status
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: tasks, error: tasksError } = await supabase.from('daily_tasks').select('*').eq('task_date', todayStr);
    if (tasksError) {
        console.error("Error fetching daily tasks:", tasksError);
    }
    const tasksMap = (tasks || []).reduce((acc, task) => {
        acc[task.agent_id] = task;
        return acc;
    }, {});

    // Group agents by classification
    const classifications = ['R', 'A', 'B', 'C'];
    const groupedAgents = classifications.reduce((acc, classification) => {
        acc[classification] = filteredAgents.filter(a => a.classification === classification);
        return acc;
    }, {});

    let html = '';
    if (filteredAgents.length === 0) {
        html = '<p>لا توجد مهام مجدولة لهذا اليوم.</p>';
    } else {
        for (const classification of classifications) {
            if (groupedAgents[classification].length > 0) {
                html += `<h2 class="agent-category-title">${classification}</h2>`;
                html += groupedAgents[classification].map(agent => {
                    const task = tasksMap[agent.id] || {};
                    return `
                    <div class="agent-card ${task.audited ? 'audited' : ''} ${task.competition_sent ? 'competition-sent' : ''}" data-agent-id="${agent.id}">
                        <div class="agent-info">
                            <h3>${agent.name}</h3>
                            <p>
                                رقم الوكالة: <span>${agent.agent_id}</span>
                                <button class="copy-btn" title="نسخ الرقم"><i class="fas fa-copy"></i></button>
                            </p>
                        </div>
                        <div class="agent-actions">
                            <label class="custom-checkbox">
                                <input type="checkbox" class="audit-check" data-agent-id="${agent.id}" ${task.audited ? 'checked' : ''}>
                                <span class="checkmark"></span>
                                تم التدقيق
                            </label>
                            <label class="custom-checkbox">
                                <input type="checkbox" class="competition-check" data-agent-id="${agent.id}" ${task.competition_sent ? 'checked' : ''}>
                                <span class="checkmark"></span>
                                تم إرسال مسابقة
                            </label>
                        </div>
                    </div>
                `}).join('');
            }
        }
    }

    container.innerHTML = html;

    // Add event listeners after rendering
    container.querySelectorAll('.agent-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't navigate if a button or checkbox was clicked
            if (e.target.closest('button, .custom-checkbox')) return;
            const agentId = card.dataset.agentId;
            window.location.hash = `profile/${agentId}`;
        });
    });

    container.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const agentIdText = e.currentTarget.previousElementSibling.textContent;
            navigator.clipboard.writeText(agentIdText).then(() => showToast(`تم نسخ الرقم: ${agentIdText}`, 'info'));
        });
    });

    container.querySelectorAll('.audit-check, .competition-check').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const card = e.target.closest('.agent-card');
            const agentId = e.target.dataset.agentId;
            
            const isAudited = e.target.classList.contains('audit-check');
            const isChecked = e.target.checked;
            
            const updateData = {};
            const taskIdentifier = { agent_id: agentId, task_date: todayStr };

            if (isAudited) {
                updateData.audited = isChecked;
                card.classList.toggle('audited', isChecked);
            } else {
                updateData.competition_sent = isChecked;
                card.classList.toggle('competition-sent', isChecked);
            }

            if (!supabase) return showToast('لا يمكن تحديث الحالة، لم يتم الاتصال بقاعدة البيانات.', 'error');

            // Upsert: update if exists, insert if not
            const { error } = await supabase
                .from('daily_tasks')
                .upsert({ ...taskIdentifier, ...updateData }, { onConflict: 'agent_id, task_date' });

            if (error) {
                console.error('Error updating agent status:', error);
                showToast('فشل تحديث حالة الوكيل.', 'error');
                // Revert checkbox state on error
                e.target.checked = !isChecked;
                card.classList.toggle(isAudited ? 'audited' : 'competition-sent', !isChecked);
            }
        });
    });
}

function renderAddAgentForm() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const returnPage = urlParams.get('returnTo') || 'manage-agents';

    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <h1>إضافة وكيل جديد</h1>
        <form id="add-agent-form" class="form-layout">
            <div class="form-group"><label for="agent-name">اسم الوكيل</label><input type="text" id="agent-name" required></div>
            <div class="form-group"><label for="agent-id">رقم الوكالة</label><input type="text" id="agent-id" required></div>
            <div class="form-group">
                <label for="agent-classification">التصنيف</label>
                <select id="agent-classification"><option value="R">R</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
            </div>
            <div class="form-group">
                <label>أيام التدقيق</label>
                <div class="days-selector">
                    ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((day, index) => `
                        <label class="day-checkbox"><input type="checkbox" value="${index}"> <span>${day}</span></label>
                    `).join('')}
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" id="save-agent-btn" class="btn-primary">حفظ الوكيل</button>
                <button type="button" id="cancel-add-agent" class="btn-secondary">إلغاء</button>
            </div>
        </form>
    `;

    const cancelButton = document.getElementById('cancel-add-agent');
    cancelButton.addEventListener('click', () => {
        const nameInput = document.getElementById('agent-name');
        const idInput = document.getElementById('agent-id');

        if (nameInput.value.trim() !== '' || idInput.value.trim() !== '') {
            showConfirmationModal('لديك بيانات غير محفوظة. هل أنت متأكد من الإلغاء؟', () => {
                window.location.hash = `#${returnPage}`;
            });
        } else {
            window.location.hash = `#${returnPage}`;
        }
    });
    document.getElementById('add-agent-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabase) return showToast('لا يمكن إضافة وكيل، لم يتم الاتصال بقاعدة البيانات.', 'error');

        const saveBtn = document.getElementById('save-agent-btn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        const selectedDays = [];
        document.querySelectorAll('.days-selector input:checked').forEach(input => {
            selectedDays.push(parseInt(input.value, 10));
        });

        const newAgent = {
            name: document.getElementById('agent-name').value,
            agent_id: document.getElementById('agent-id').value,
            classification: document.getElementById('agent-classification').value,
            audit_days: selectedDays,
        };

        // Check for uniqueness of agent_id
        const { data: existingAgent, error: checkError } = await supabase
            .from('agents')
            .select('id')
            .eq('agent_id', newAgent.agent_id)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116: "exact-one" violation, which is fine if no agent is found. We only care if an agent *is* found.
            console.error('Error checking for existing agent:', checkError);
            showToast('حدث خطأ أثناء التحقق من رقم الوكالة.', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'حفظ الوكيل';
            return;
        }

        if (existingAgent) {
            showToast('رقم الوكالة هذا مستخدم بالفعل لوكيل آخر.', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'حفظ الوكيل';
            return;
        }

        const { data: insertedAgent, error } = await supabase.from('agents').insert([newAgent]).select().single();

        if (error) {
            console.error('Error adding agent:', error);
            showToast(`فشل إضافة الوكيل: ${error.message}`, 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'حفظ الوكيل';
        } else {
            await logAgentActivity(insertedAgent.id, 'AGENT_CREATED', `تم إنشاء وكيل جديد: ${insertedAgent.name}.`);
            showToast('تمت إضافة الوكيل بنجاح!', 'success');
            window.location.hash = returnPage;
        }
    });
}