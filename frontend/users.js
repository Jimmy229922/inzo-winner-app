async function renderManageUsersPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1><i class="fas fa-users-cog"></i> إدارة المستخدمين</h1>
                <button id="add-user-btn" class="btn-primary"><i class="fas fa-user-plus"></i> إضافة مستخدم جديد</button>
            </div>
        </div>
        <div id="users-table-container" class="table-responsive-container">
            <p>جاري تحميل المستخدمين...</p>
        </div>
    `;

    if (!supabase) {
        document.getElementById('users-table-container').innerHTML = '<p class="error">لا يمكن عرض المستخدمين، لم يتم الاتصال بقاعدة البيانات.</p>';
        return;
    }

    // جلب المستخدمين من جدول users الجديد
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching users:", error);
        if (error.code === '42501') { // RLS permission error
             document.getElementById('users-table-container').innerHTML = `<p class="error">ليس لديك الصلاحية لعرض هذه الصفحة. هذه الصفحة متاحة للمدراء فقط.</p>`;
        } else {
             document.getElementById('users-table-container').innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات المستخدمين.</p>`;
        }
        return;
    }

    displayUsers(users);
}

function displayUsers(users) {
    const container = document.getElementById('users-table-container');
    if (!container) return;

    const tableHtml = users.length > 0 ? `
        <table class="modern-table">
            <thead>
                <tr>
                    <th>المستخدم</th>
                    <th>الدور (الصلاحية)</th>
                    <th>الحالة</th>
                    <th>تاريخ الإنشاء</th>
                    <th class="actions-column">الإجراءات</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => {
                    const avatarHtml = user.avatar_url
                        ? `<img src="${user.avatar_url}" alt="Avatar" class="avatar-small">`
                        : `<div class="avatar-placeholder-small"><i class="fas fa-user-secret"></i></div>`;
                    
                    const roleText = user.role === 'admin' ? 'مدير' : 'موظف';
                    const statusText = user.is_active ? 'نشط' : 'غير نشط';

                    return `
                        <tr data-user-id="${user.id}" data-auth-id="${user.auth_user_id}">
                            <td data-label="المستخدم">
                                <div class="table-agent-cell">
                                    ${avatarHtml}
                                    <div class="agent-details">
                                        <span class="agent-name-link">${user.full_name}</span>
                                    </div>
                                </div>
                            </td>
                            <td data-label="الدور"><span class="role-badge role-${user.role}">${roleText}</span></td>
                            <td data-label="الحالة"><span class="status-badge ${user.is_active ? 'active' : 'inactive'}">${statusText}</span></td>
                            <td data-label="تاريخ الإنشاء">${new Date(user.created_at).toLocaleDateString('ar-EG')}</td>
                            <td class="actions-cell">
                                <button class="btn-secondary btn-small toggle-status-btn" title="${user.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}">
                                    <i class="fas ${user.is_active ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
                                </button>
                                <button class="btn-secondary btn-small change-role-btn" title="تغيير الدور">
                                    <i class="fas fa-user-shield"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    ` : '<p class="no-results-message">لا يوجد مستخدمون حالياً.</p>';

    container.innerHTML = tableHtml;
    attachUserActionListeners();
}

function attachUserActionListeners() {
    document.querySelectorAll('.toggle-status-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const row = e.currentTarget.closest('tr');
            const userId = row.dataset.userId;
            const user = await supabase.from('users').select('is_active, full_name').eq('id', userId).single();
            const newStatus = !user.data.is_active;

            showConfirmationModal(
                `هل أنت متأكد من ${newStatus ? 'تفعيل' : 'تعطيل'} حساب المستخدم "<strong>${user.data.full_name}</strong>"؟`,
                async () => {
                    const { error } = await supabase.from('users').update({ is_active: newStatus }).eq('id', userId);
                    if (error) {
                        showToast('فشل تحديث حالة المستخدم.', 'error');
                    } else {
                        showToast('تم تحديث حالة المستخدم بنجاح.', 'success');
                        renderManageUsersPage(); // Refresh the list
                    }
                }
            );
        });
    });

    document.querySelectorAll('.change-role-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const row = e.currentTarget.closest('tr');
            const userId = row.dataset.userId;
            const user = await supabase.from('users').select('role, full_name').eq('id', userId).single();
            const newRole = user.data.role === 'admin' ? 'employee' : 'admin';
            const newRoleText = newRole === 'admin' ? 'مدير' : 'موظف';

            showConfirmationModal(
                `هل أنت متأكد من تغيير دور المستخدم "<strong>${user.data.full_name}</strong>" إلى <strong>${newRoleText}</strong>؟`,
                async () => {
                    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
                    if (error) {
                        showToast('فشل تغيير دور المستخدم.', 'error');
                    } else {
                        showToast('تم تغيير دور المستخدم بنجاح.', 'success');
                        renderManageUsersPage(); // Refresh the list
                    }
                }
            );
        });
    });
}