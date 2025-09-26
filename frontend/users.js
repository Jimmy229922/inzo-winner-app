async function renderUsersPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header">
            <h1><i class="fas fa-users-cog"></i> إدارة المستخدمين</h1>
        </div>
        <div id="users-list-container">
            <div class="loader-container"><div class="spinner"></div></div>
        </div>
    `;

    if (!supabase) {
        document.getElementById('users-list-container').innerHTML = '<p class="error">لا يمكن عرض المستخدمين، لم يتم الاتصال بقاعدة البيانات.</p>';
        return;
    }

    // Fetch all users. This works because the current user is an admin
    // and we have a policy that allows admins to read the 'users' table.
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        document.getElementById('users-list-container').innerHTML = `<p class="error">فشل جلب المستخدمين: ${error.message}</p>`;
        return;
    }

    const container = document.getElementById('users-list-container');
    if (users.length === 0) {
        container.innerHTML = '<p class="no-results-message">لا يوجد مستخدمون لعرضهم.</p>';
        return;
    }

    container.innerHTML = `
        <div class="table-responsive-container">
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>الاسم الكامل</th>
                        <th>البريد الإلكتروني (من المصادقة)</th>
                        <th>الصلاحية</th>
                        <th class="actions-column">الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => renderUserRow(user)).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Add event listeners after rendering
    attachUserActionListeners();
}

function renderUserRow(user) {
    // We need to fetch the email from the auth schema, as it's not in our public profiles table.
    // This is a placeholder. A more robust solution would join this data on the backend.
    // For now, we'll fetch it on demand or show the ID.
    // Let's assume we can't easily get the email here and will add it later if needed.
    // For now, we will show the user ID as a placeholder for email.
    const isCurrentUser = currentUserProfile && user.id === currentUserProfile.id;

    return `
        <tr data-user-id="${user.id}" data-user-name="${user.full_name || 'مستخدم'}">
            <td data-label="الاسم الكامل">${user.full_name || '<em>لم يحدد</em>'}</td>
            <td data-label="معرف المستخدم">${user.id}</td>
            <td data-label="الصلاحية">
                <select class="role-select" data-user-id="${user.id}" ${isCurrentUser ? 'disabled' : ''}>
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>موظف</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مسؤول</option>
                </select>
            </td>
            <td class="actions-cell">
                <button class="btn-danger delete-user-btn" data-user-id="${user.id}" ${isCurrentUser ? 'disabled' : ''}>
                    <i class="fas fa-trash-alt"></i> حذف
                </button>
            </td>
        </tr>
    `;
}

function attachUserActionListeners() {
    const container = document.getElementById('users-list-container');

    container.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-user-btn');
        if (deleteBtn && !deleteBtn.disabled) {
            const userId = deleteBtn.dataset.userId;
            const row = deleteBtn.closest('tr');
            const userName = row.dataset.userName;

            showConfirmationModal(
                `هل أنت متأكد من حذف المستخدم "<strong>${userName}</strong>"؟<br><small>سيتم حذفه نهائياً من النظام.</small>`,
                async () => {
                    try {
                        const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.message);

                        showToast('تم حذف المستخدم بنجاح.', 'success');
                        row.remove(); // Remove from UI
                    } catch (error) {
                        showToast(`فشل حذف المستخدم: ${error.message}`, 'error');
                    }
                },
                { title: 'تأكيد الحذف', confirmText: 'حذف', confirmClass: 'btn-danger' }
            );
        }
    });

    container.addEventListener('change', async (e) => {
        const roleSelect = e.target.closest('.role-select');
        if (roleSelect && !roleSelect.disabled) {
            const userId = roleSelect.dataset.userId;
            const newRole = roleSelect.value;

            try {
                const response = await fetch(`/api/users/${userId}/role`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: newRole })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                showToast('تم تحديث صلاحية المستخدم بنجاح.', 'success');
            } catch (error) {
                showToast(`فشل تحديث الصلاحية: ${error.message}`, 'error');
                // Revert the select box to the previous value on error
                renderUsersPage();
            }
        }
    });
}