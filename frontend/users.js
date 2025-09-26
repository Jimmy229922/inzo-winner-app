async function renderUsersPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1><i class="fas fa-users-cog"></i> إدارة المستخدمين</h1>
                <button id="add-new-user-btn" class="btn-primary"><i class="fas fa-user-plus"></i> إضافة مستخدم جديد</button>
            </div>
            <div class="filters-container">
                <div class="filter-search-container">
                    <input type="search" id="user-search-input" placeholder="بحث بالاسم أو البريد الإلكتروني..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="user-search-clear"></i>
                </div>
                <div id="user-count" class="item-count-display"></div>
            </div>
        </div>
        <div id="users-list-container">
            <div class="loader-container"><div class="spinner"></div></div>
        </div>
    `;

    // Add listener for the new user button
    document.getElementById('add-new-user-btn').addEventListener('click', renderCreateUserModal);
    
    // Attach event listeners for actions (delete, role change) to the persistent container
    attachUserActionListeners();

    // Attach search listeners
    setupUserPageFilters([]); // Setup with empty array initially

    // NEW: Fetch data asynchronously
    fetchUsersData();
}

async function fetchUsersData() {
    if (!supabase) {
        document.getElementById('users-list-container').innerHTML = '<p class="error">لا يمكن عرض المستخدمين، لم يتم الاتصال بقاعدة البيانات.</p>';
        return;
    }

    // NEW: Fetch all users from our custom backend endpoint to get emails
    try {
        console.time('[Performance] Fetch Users API');
        const response = await fetch('/api/users');
        console.timeEnd('[Performance] Fetch Users API');
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message);
        }
        const users = await response.json();
        setupUserPageFilters(users); // Re-setup filters with the fetched data
    } catch (error) {
        document.getElementById('users-list-container').innerHTML = `<p class="error">فشل جلب المستخدمين: ${error.message}</p>`;
        return;
    }
}

function renderUserRow(user) {
    const isCurrentUser = currentUserProfile && user.id === currentUserProfile.id;
    const lastLogin = user.last_sign_in_at 
        ? new Date(user.last_sign_in_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
        : 'لم يسجل دخول';

    return `
        <tr data-user-id="${user.id}" data-user-name="${user.full_name || 'مستخدم'}" data-user-email="${user.email || ''}">
            <td data-label="الاسم الكامل">${user.full_name || '<em>لم يحدد</em>'}</td>
            <td data-label="البريد الإلكتروني">${user.email || '<em>غير متوفر</em>'}</td>
            <td data-label="الصلاحية">
                <select class="role-select" data-user-id="${user.id}" ${isCurrentUser ? 'disabled' : ''}>
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>موظف</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مسؤول</option>
                </select>
            </td>
            <td data-label="آخر تسجيل دخول">${lastLogin}</td>
            <td class="actions-cell">
                <button class="btn-danger delete-user-btn" data-user-id="${user.id}" ${isCurrentUser ? 'disabled' : ''}>
                    <i class="fas fa-trash-alt"></i> حذف
                </button>
            </td>
        </tr>
    `;
}

function setupUserPageFilters(allUsers) {
    const searchInput = document.getElementById('user-search-input');
    const clearBtn = document.getElementById('user-search-clear');
    const userCountEl = document.getElementById('user-count');
    const container = document.getElementById('users-list-container'); // The persistent container

    if (!searchInput || !container) return;

    const applyFilters = () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        }

        const searchTerm = searchInput.value.toLowerCase().trim();

        const filteredUsers = allUsers.filter(user => {
            const name = (user.full_name || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            return name.includes(searchTerm) || email.includes(searchTerm);
        });

        // Re-render the table with filtered users
        if (filteredUsers.length === 0) {
            container.innerHTML = '<p class="no-results-message">لا يوجد مستخدمون يطابقون بحثك.</p>';
        } else {
            container.innerHTML = `
                <div class="table-responsive-container">
                    <table class="modern-table">
                        <thead>
                            <tr>
                                <th>الاسم الكامل</th>
                                <th>البريد الإلكتروني</th>
                                <th>الصلاحية</th>
                                <th>آخر تسجيل دخول</th>
                                <th class="actions-column">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredUsers.map(user => renderUserRow(user)).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        // Update user count
        if (userCountEl) {
            userCountEl.textContent = `إجمالي: ${filteredUsers.length} مستخدم`;
        }
    };

    searchInput.addEventListener('input', applyFilters);

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            applyFilters();
            searchInput.focus();
        });
    }

    // Initial call to set up the count and table
    applyFilters();
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

function renderCreateUserModal() {
    const modalContent = `
        <form id="create-user-form" class="form-layout" style="text-align: right;">
            <div class="form-group">
                <label for="new-user-fullname">الاسم الكامل</label>
                <input type="text" id="new-user-fullname" required>
            </div>
            <div class="form-group">
                <label for="new-user-email">البريد الإلكتروني</label>
                <input type="email" id="new-user-email" required>
            </div>
            <div class="form-group">
                <label for="new-user-password">كلمة المرور</label>
                <input type="password" id="new-user-password" required minlength="6">
            </div>
            <div class="form-group">
                <label for="new-user-role">الصلاحية</label>
                <select id="new-user-role">
                    <option value="user" selected>موظف</option>
                    <option value="admin">مسؤول</option>
                </select>
            </div>
        </form>
    `;

    showConfirmationModal(
        modalContent,
        async () => {
            // This function is called when the confirm button is clicked.
            // We will handle the submission inside the form's event listener instead.
            // We need to trigger the form submission here.
            document.getElementById('create-user-form').dispatchEvent(new Event('submit', { cancelable: true }));
        },
        {
            title: 'إنشاء مستخدم جديد',
            confirmText: 'إنشاء',
            confirmClass: 'btn-primary',
            onRender: (modal) => {
                const form = modal.querySelector('#create-user-form');
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const confirmBtn = document.getElementById('confirm-btn'); // The button in the modal
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                    const newUser = {
                        full_name: document.getElementById('new-user-fullname').value,
                        email: document.getElementById('new-user-email').value,
                        password: document.getElementById('new-user-password').value,
                        role: document.getElementById('new-user-role').value,
                    };

                    try {
                        const response = await fetch('/api/users', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newUser)
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.message);

                        showToast('تم إنشاء المستخدم بنجاح.', 'success');
                        modal.closest('.modal-overlay').remove(); // Close the modal on success
                        await renderUsersPage(); // Refresh the user list
                    } catch (error) {
                        showToast(`فشل إنشاء المستخدم: ${error.message}`, 'error');
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = 'إنشاء';
                    }
                });
            }
        }
    );
}