async function renderUsersPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <!-- NEW: Stats Cards Section -->
        <div class="dashboard-grid-v2" id="user-stats-container" style="margin-bottom: 20px;">
            <div class="stat-card-v2 color-1"><div class="stat-card-v2-icon-bg"><i class="fas fa-users"></i></div><p id="total-users-stat" class="stat-card-v2-value">0</p><h3 class="stat-card-v2-title">إجمالي المستخدمين</h3></div>
            <div class="stat-card-v2 color-2"><div class="stat-card-v2-icon-bg"><i class="fas fa-user-check"></i></div><p id="active-users-stat" class="stat-card-v2-value">0</p><h3 class="stat-card-v2-title">المستخدمون النشطون</h3></div>
            <div class="stat-card-v2 color-3"><div class="stat-card-v2-icon-bg"><i class="fas fa-user-shield"></i></div><p id="admin-users-stat" class="stat-card-v2-value">0</p><h3 class="stat-card-v2-title">المسؤولون</h3></div>
            <div class="stat-card-v2 color-4"><div class="stat-card-v2-icon-bg"><i class="fas fa-user-slash"></i></div><p id="inactive-users-stat" class="stat-card-v2-value">0</p><h3 class="stat-card-v2-title">المستخدمون المعطلون</h3></div>
        </div>

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
                <div class="filter-buttons">
                    <button class="filter-btn active" data-status-filter="all">الكل</button>
                    <button class="filter-btn" data-status-filter="active">النشطون</button>
                    <button class="filter-btn" data-status-filter="inactive">المعطلون</button>
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
        const response = await authedFetch('/api/users');
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message);
        }
        const responseData = await response.json();
        const authUsers = responseData.users || [];
        const profiles = responseData.profiles || [];

        // --- FIX: Merge auth users with their profiles ---
        const profilesMap = profiles.reduce((map, profile) => {
            map[profile.id] = profile;
            return map;
        }, {});

        const mergedUsers = authUsers.map(user => {
            const profile = profilesMap[user.id] || {};
            // Combine data, giving profile data precedence for fields like 'full_name'
            return { ...user, ...profile };
        });

        setupUserPageFilters(mergedUsers); // Re-setup filters with the complete data
    } catch (error) {
        document.getElementById('users-list-container').innerHTML = `<p class="error">فشل جلب المستخدمين: ${error.message}</p>`;
        return;
    }
}

function renderUserRow(user) {
    const isCurrentUser = currentUserProfile && user.id === currentUserProfile.id;
    const isTargetAdmin = user.role === 'admin';
    const isCurrentUserAdmin = currentUserProfile?.role === 'admin';
    const isCurrentUserSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isTargetSuperAdmin = user.role === 'super_admin';

    // --- إصلاح: تعريف متغير الحالة في بداية الدالة لتجنب أخطاء الوصول ---
    const isInactive = user.status === 'inactive';

    const lastLogin = user.last_sign_in_at 
        ? new Date(user.last_sign_in_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
        : 'لم يسجل دخول';

    const avatarName = encodeURIComponent(user.full_name || user.email || 'User');
    const avatarHtml = user.avatar_url
        ? `<img src="${user.avatar_url}" alt="Avatar" class="avatar-small" loading="lazy">`
        : `<img src="https://ui-avatars.com/api/?name=${avatarName}&background=8A2BE2&color=fff" alt="Avatar" class="avatar-small" loading="lazy">`;

    // NEW: Add a crown icon for admins
    const adminIconHtml = isTargetSuperAdmin ? '<div class="admin-crown-icon super-admin" title="مدير عام"><i class="fas fa-gem"></i></div>' : (isTargetAdmin ? '<div class="admin-crown-icon" title="مسؤول"><i class="fas fa-crown"></i></div>' : '');
    // NEW: Add a badge for admins
    const adminBadgeHtml = isTargetSuperAdmin ? '<span class="admin-badge super-admin">مدير عام</span>' : (isTargetAdmin ? '<span class="admin-badge">مسؤول</span>' : null);
    // NEW: Add a badge for employees
    const employeeBadgeHtml = user.role === 'user' ? '<span class="employee-badge">موظف</span>' : '';

    // NEW: Add status badge and styles for inactive users
    const statusBadgeHtml = isInactive ? '<span class="status-badge inactive">معطل</span>' : '';
    
    // NEW: Realtime presence indicator
    const onlineIndicatorHtml = `<div class="online-status-indicator" id="online-status-${user.id}" title="غير متصل"></div>`;

    return `
        <tr data-user-id="${user.id}" data-user-name="${user.full_name || 'مستخدم'}" data-user-email="${user.email || ''}" class="${isInactive ? 'inactive-row' : ''}">
            <td data-label="المستخدم">
                <div class="table-user-cell">
                    <div class="user-avatar-container">
                        ${onlineIndicatorHtml}
                        ${avatarHtml}
                        ${adminIconHtml}
                    </div>
                    <div class="user-details">
                        <span class="user-name">${user.full_name || '<em>لم يحدد</em>'} ${adminBadgeHtml || employeeBadgeHtml} ${statusBadgeHtml}</span>
                        <span class="user-email">${user.email || '<em>غير متوفر</em>'}</span>
                    </div>
                </div>
            </td>
            <td data-label="الصلاحية">
                ${(() => {
                    // --- تعديل: فقط المدير العام يمكنه تغيير الصلاحيات ---
                    const canChangeRoles = isCurrentUserSuperAdmin;
                    const roleSelectDisabled = isCurrentUser || !canChangeRoles || isTargetAdmin; // لا يمكن للمدير العام تغيير صلاحية مسؤول آخر
                    const roleSelectTitle = canChangeRoles ? 'تغيير الصلاحية' : 'فقط المدير العام يمكنه تغيير الصلاحيات';

                    if (isTargetSuperAdmin) {
                        return `<span class="role-display super-admin" title="لا يمكن تغيير صلاحية المدير العام">مدير عام</span>`;
                    }
                    return `<select class="role-select" data-user-id="${user.id}" ${roleSelectDisabled ? 'disabled' : ''} title="${roleSelectTitle}">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>موظف</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مسؤول</option>
                    </select>`;
                })()}
            </td>
            <td data-label="آخر تسجيل دخول">${lastLogin}</td>
            ${(() => {
                const isAdmin = isCurrentUserAdmin || isCurrentUserSuperAdmin;
                if (!isAdmin) return ''; // لا تعرض العمود لغير المسؤولين
                                return `<td class="actions-cell">
                ${(() => {
                    // --- تعديل: تحديد صلاحيات الإجراءات بدقة ---
                    // لا يمكن للمسؤول العادي اتخاذ أي إجراء على المدير العام
                    if (isCurrentUserAdmin && isTargetSuperAdmin) {
                        return ''; // إرجاع خلية فارغة
                    }
                    
                    if (isCurrentUser) {
                        // For the current user (Super Admin), hide the main action buttons
                        return `<label class="custom-checkbox toggle-switch small-toggle" title="لا يمكن تعطيل حسابك الخاص" ${isCurrentUser ? 'style="display:none;"' : ''}>
                                    <input type="checkbox" class="status-toggle" data-user-id="${user.id}" ${!isInactive ? 'checked' : ''} disabled>
                                    <span class="slider round"></span>
                                </label>`;
                    }
                    
                    return `<button class="btn-secondary edit-user-btn" data-user-id="${user.id}" title="تعديل بيانات المستخدم">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn-primary permissions-user-btn" data-user-id="${user.id}" title="إدارة الصلاحيات">
                        <i class="fas fa-shield-alt"></i> الصلاحيات
                    </button>
                    <button class="btn-danger delete-user-btn" data-user-id="${user.id}" title="حذف المستخدم نهائياً" ${!isCurrentUserSuperAdmin ? 'disabled' : ''}>
                        <i class="fas fa-trash-alt"></i> حذف
                    </button>
                    <label class="custom-checkbox toggle-switch small-toggle" title="${isInactive ? 'تفعيل الحساب' : 'تعطيل الحساب'}">
                        <input type="checkbox" class="status-toggle" data-user-id="${user.id}" ${!isInactive ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>`;
                })()}


            </td>`;
            })()}
        </tr>
    `;
}

let allUsersCache = []; // Cache for user data
function setupUserPageFilters(allUsers) {
    const searchInput = document.getElementById('user-search-input');
    const clearBtn = document.getElementById('user-search-clear');
    const userCountEl = document.getElementById('user-count');
    const statusFilterButtons = document.querySelectorAll('.filter-buttons .filter-btn');
    const container = document.getElementById('users-list-container'); // The persistent container

    if (!searchInput || !container) return;
    allUsersCache = allUsers; // Store users in cache

    // --- إصلاح: تعريف متغير صلاحية المدير العام في النطاق الصحيح ---
    const isCurrentUserSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isCurrentUserAdmin = currentUserProfile?.role === 'admin';

    const applyFilters = () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeStatusFilter = document.querySelector('.filter-buttons .filter-btn.active').dataset.statusFilter;

        const filteredUsers = allUsers.filter(user => {
            const name = (user.full_name || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
            const matchesStatus = activeStatusFilter === 'all' || (user.status || 'active') === activeStatusFilter;
            return matchesSearch && matchesStatus;
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
                            <th class="user-column">المستخدم</th>
                                <th>الصلاحية</th>
                                <th>آخر تسجيل دخول</th>
                                ${isCurrentUserSuperAdmin || isCurrentUserAdmin ? '<th class="actions-column">الإجراءات</th>' : ''}
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

        // NEW: Update stats cards based on the full user list
        document.getElementById('total-users-stat').textContent = formatNumber(allUsers.length);
        document.getElementById('active-users-stat').textContent = formatNumber(allUsers.filter(u => u.status !== 'inactive').length);
        document.getElementById('admin-users-stat').textContent = formatNumber(allUsers.filter(u => u.role === 'admin').length);
        document.getElementById('inactive-users-stat').textContent = formatNumber(allUsers.filter(u => u.status === 'inactive').length);

    };

    searchInput.addEventListener('input', applyFilters);

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            applyFilters();
            searchInput.focus();
        });
    }

    if (statusFilterButtons.length) {
        statusFilterButtons.forEach(button => {
            button.addEventListener('click', () => {
                statusFilterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                applyFilters();
            });
        });
    }

    // Initial call to set up the count and table
    applyFilters();

    // NEW: Function to update online status indicators on the page
    window.updateUserPresenceIndicators = () => {
        if (!window.onlineUsers) return;
        allUsers.forEach(user => {
            const indicator = document.getElementById(`online-status-${user.id}`);
            if (indicator) {
                if (window.onlineUsers.has(user.id)) {
                    indicator.classList.add('online');
                    indicator.title = 'متصل الآن';
                } else {
                    indicator.classList.remove('online');
                    indicator.title = 'غير متصل';
                }
            }
        });
    };
    window.updateUserPresenceIndicators(); // Initial update
}

function attachUserActionListeners() {
    const container = document.getElementById('users-list-container');

    container.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-user-btn');
        const editBtn = e.target.closest('.edit-user-btn');
        const permissionsBtn = e.target.closest('.permissions-user-btn');

        if (editBtn && !editBtn.disabled) {
            const userId = editBtn.dataset.userId;
            // تحسين: استخدام البيانات المخزنة بدلاً من إعادة جلبها
            const userToEdit = allUsersCache.find(u => u.id === userId);
            if (userToEdit) renderEditUserModal(userToEdit);
        }

        if (permissionsBtn && !permissionsBtn.disabled) {
            const userId = permissionsBtn.dataset.userId;
            const userToManage = allUsersCache.find(u => u.id === userId);
            if (userToManage) renderPermissionsModal(userToManage);
        }

        if (deleteBtn && !deleteBtn.disabled) {
            const userId = deleteBtn.dataset.userId;
            const row = deleteBtn.closest('tr');
            const userName = row.dataset.userName;

            showConfirmationModal(
                `هل أنت متأكد من حذف المستخدم "<strong>${userName}</strong>"؟<br><small>سيتم حذفه نهائياً من النظام ولا يمكن التراجع عن هذا الإجراء.</small>`,
                async () => {
                    try {
                        const response = await authedFetch(`/api/users/${userId}`, { method: 'DELETE' });
                        if (!response.ok) {
                            const result = await response.json();
                            throw new Error(result.message);
                        }
                        showToast('تم حذف المستخدم بنجاح.', 'success');
                        await fetchUsersData(); // Refresh list to show changes
                    } catch (error) {
                        showToast(`فشل حذف المستخدم: ${error.message}`, 'error');
                    }
                },
                { title: 'تأكيد الحذف النهائي', confirmText: 'حذف', confirmClass: 'btn-danger' }
            );
        }
    });

    container.addEventListener('change', async (e) => {
        const roleSelect = e.target.closest('.role-select');
        if (roleSelect && !roleSelect.disabled) {
            const userId = roleSelect.dataset.userId;
            const newRole = roleSelect.value;

            try {
                const response = await authedFetch(`/api/users/${userId}/role`, {
                    method: 'PUT',
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

        // NEW: Handle status toggle change
        const statusToggle = e.target.closest('.status-toggle');
        if (statusToggle && !statusToggle.disabled) {
            const userId = statusToggle.dataset.userId;
            const newStatus = statusToggle.checked ? 'active' : 'inactive';

            try {
                const response = await authedFetch(`/api/users/${userId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: newStatus }) // Send status update to backend
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                showToast(`تم ${newStatus === 'active' ? 'تفعيل' : 'تعطيل'} حساب المستخدم.`, 'success');
                await fetchUsersData(); // Refresh list to show changes
            } catch (error) {
                showToast(`فشل تحديث الحالة: ${error.message}`, 'error');
                statusToggle.checked = !statusToggle.checked; // Revert on error
            }
        }
    });
}

function renderCreateUserModal() {
    // --- NEW: Professional Create User Modal ---
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'form-modal-content modal-wide';
    
    modal.innerHTML = `
        <div class="form-modal-header">
            <h2><i class="fas fa-user-plus"></i> إنشاء مستخدم جديد</h2>
            <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
        </div>
        <div class="form-modal-body">
            <form id="create-user-form" class="form-layout-grid">
                <!-- Avatar Section -->
                <div class="form-grid-avatar">
                    <div class="profile-avatar-edit large-avatar">
                        <img src="https://ui-avatars.com/api/?name=?&background=8A2BE2&color=fff&size=128" alt="Avatar" id="avatar-preview">
                        <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                    </div>
                    <!-- NEW: Action buttons for avatar moved outside -->
                    <div class="avatar-action-buttons" id="avatar-action-buttons" style="display: none;">
                        <button type="button" id="change-avatar-btn" class="btn-secondary btn-small"><i class="fas fa-edit"></i> تغيير</button>
                        <button type="button" id="delete-avatar-btn" class="btn-danger btn-small"><i class="fas fa-trash"></i> حذف</button>
                    </div>
                </div>
                <!-- Fields Section -->
                <div class="form-grid-fields">
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
                        <div class="password-input-wrapper">
                            <input type="password" id="new-user-password" required minlength="8">
                            <button type="button" id="password-toggle-btn" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                        </div>
                        <div class="password-strength-meter">
                            <div class="strength-bar"></div>
                        </div>
                        <div class="password-actions">
                            <button type="button" id="generate-password-btn" class="btn-secondary btn-small">إنشاء كلمة مرور قوية</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="new-user-role">الصلاحية</label>
                        <select id="new-user-role">
                            <option value="user" selected>موظف</option>
                            <option value="admin">مسؤول</option>
                        </select>
                    </div>
                </div>
                <!-- Actions Section -->
                <div class="form-grid-actions">
                    <button type="submit" id="create-user-submit-btn" class="btn-primary">
                        <i class="fas fa-check"></i> إنشاء المستخدم
                    </button>
                    <button type="button" id="cancel-create-modal" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    modal.querySelector('#close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('#cancel-create-modal').addEventListener('click', closeModal);

    // --- NEW: Add logic for password features ---
    const passwordInput = modal.querySelector('#new-user-password');
    const passwordToggleBtn = modal.querySelector('#password-toggle-btn');
    const generatePasswordBtn = modal.querySelector('#generate-password-btn');
    const strengthBar = modal.querySelector('.strength-bar');

    passwordToggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggleBtn.querySelector('i').className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'}`;
    });

    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/\d/)) strength++;
        if (password.match(/[^a-zA-Z\d]/)) strength++;
        
        strengthBar.className = 'strength-bar';
        if (strength > 0) strengthBar.classList.add(`strength-${strength}`);
    });

    generatePasswordBtn.addEventListener('click', () => {
        // --- NEW: Guaranteed strong password generation ---
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        const all = lower + upper + numbers + symbols;

        let newPassword = '';
        // Ensure at least one of each type
        newPassword += lower.charAt(Math.floor(Math.random() * lower.length));
        newPassword += upper.charAt(Math.floor(Math.random() * upper.length));
        newPassword += numbers.charAt(Math.floor(Math.random() * numbers.length));
        newPassword += symbols.charAt(Math.floor(Math.random() * symbols.length));

        // Fill the rest of the password
        for (let i = newPassword.length; i < 14; i++) {
            newPassword += all.charAt(Math.floor(Math.random() * all.length));
        }

        // Shuffle the password to make it random
        newPassword = newPassword.split('').sort(() => 0.5 - Math.random()).join('');

        passwordInput.value = newPassword;
        passwordInput.dispatchEvent(new Event('input')); // Trigger strength check
        navigator.clipboard.writeText(newPassword).then(() => {
            showToast('تم إنشاء ونسخ كلمة مرور قوية.', 'success');
        });
    });

    // Avatar preview logic
    const avatarUploadInput = modal.querySelector('#avatar-upload');
    const avatarPreview = modal.querySelector('#avatar-preview');
    const avatarActions = modal.querySelector('#avatar-action-buttons');
    const changeAvatarBtn = modal.querySelector('#change-avatar-btn');
    const deleteAvatarBtn = modal.querySelector('#delete-avatar-btn');

    // NEW: Allow clicking the entire avatar container (including the camera icon overlay) to trigger file upload
    const openFileDialog = () => avatarUploadInput.click();
    avatarPreview.closest('.profile-avatar-edit').addEventListener('click', openFileDialog);
    changeAvatarBtn.addEventListener('click', openFileDialog);

    deleteAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent re-opening the file dialog
        avatarUploadInput.value = null; // Clear the file input
        avatarPreview.src = 'https://ui-avatars.com/api/?name=?&background=8A2BE2&color=fff&size=128';
        avatarActions.style.display = 'none';
    });

    avatarUploadInput.addEventListener('change', () => {
        const file = avatarUploadInput.files[0];
        if (file) {
            avatarPreview.src = URL.createObjectURL(file);
            avatarActions.style.display = 'flex';
        }
        avatarUploadInput.click();
    });

    // Form submission logic
    modal.querySelector('#create-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = modal.querySelector('#create-user-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';

        const newUser = {
            full_name: modal.querySelector('#new-user-fullname').value,
            email: modal.querySelector('#new-user-email').value,
            password: modal.querySelector('#new-user-password').value,
            role: modal.querySelector('#new-user-role').value,
        };

        try {
            const response = await authedFetch('/api/users', {
                method: 'POST',
                body: JSON.stringify(newUser)
            });
            const result = await response.json();
            if (!response.ok || !result.user) throw new Error(result.message);

            const newUserId = result.user.id;
            const avatarFile = modal.querySelector('#avatar-upload').files[0];
            if (avatarFile) {
                const filePath = `user-avatars/${newUserId}-${Date.now()}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile);
                if (uploadError) {
                    showToast('تم إنشاء المستخدم ولكن فشل رفع الصورة.', 'warning');
                } else {
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    await supabase.from('users').update({ avatar_url: urlData.publicUrl }).eq('id', newUserId);
                }
            }

            showToast('تم إنشاء المستخدم بنجاح.', 'success');
            closeModal();
            await fetchUsersData();
        } catch (error) {
            showToast(`فشل إنشاء المستخدم: ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check"></i> إنشاء المستخدم';
        }
    });
}

function renderEditUserModal(user) {
    // --- NEW: Professional Edit User Modal ---
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'form-modal-content modal-wide';
    
    const originalAvatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${user.full_name || user.email}&background=8A2BE2&color=fff&size=128`;
    const isCurrentUserSuperAdmin = currentUserProfile?.role === 'super_admin';

    modal.innerHTML = `
        <div class="form-modal-header">
            <h2><i class="fas fa-user-edit"></i> تعديل المستخدم: ${user.full_name}</h2>
            <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
        </div>
        <div class="form-modal-body">
            <form id="edit-user-form" class="form-layout-grid">
                <!-- Avatar Section -->
                <div class="form-grid-avatar">
                    <div class="profile-avatar-edit large-avatar">
                        <img src="${originalAvatarUrl}" alt="Avatar" id="avatar-preview">
                        <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                    </div>
                    <!-- NEW: Action buttons for avatar moved outside -->
                    <div class="avatar-action-buttons" id="avatar-action-buttons" style="display: none;">
                        <button type="button" id="change-avatar-btn" class="btn-secondary btn-small"><i class="fas fa-edit"></i> تغيير</button>
                        <button type="button" id="delete-avatar-btn" class="btn-danger btn-small"><i class="fas fa-trash"></i> حذف</button>
                    </div>
                </div>
                <!-- Fields Section -->
                <div class="form-grid-fields">
                    <div class="form-group">
                        <label for="edit-user-fullname">الاسم الكامل</label>
                        <input type="text" id="edit-user-fullname" value="${user.full_name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-user-email">البريد الإلكتروني</label>
                        <input type="email" id="edit-user-email" value="${user.email || ''}" disabled>
                    </div>
                    <div class="form-group">
                        <label for="edit-user-password">كلمة المرور الجديدة</label>
                        <input type="password" id="edit-user-password" minlength="8" placeholder="اتركه فارغاً لعدم التغيير">
                    </div>
                </div>
                <!-- Actions Section -->
                <div class="form-grid-actions">
                    <button type="submit" id="edit-user-submit-btn" class="btn-primary">
                        <i class="fas fa-save"></i> حفظ التعديلات
                    </button>
                    <button type="button" id="cancel-edit-modal" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    modal.querySelector('#close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('#cancel-edit-modal').addEventListener('click', closeModal);

    // --- Avatar Logic ---
    const avatarUploadInput = modal.querySelector('#avatar-upload');
    const avatarPreview = modal.querySelector('#avatar-preview');
    const avatarActions = modal.querySelector('#avatar-action-buttons');
    const changeAvatarBtn = modal.querySelector('#change-avatar-btn');
    const deleteAvatarBtn = modal.querySelector('#delete-avatar-btn');

    const openFileDialog = (e) => {
        e.stopPropagation(); // Prevent event bubbling if needed
        avatarUploadInput.click();
    };
    // Allow clicking the entire avatar container to open the file dialog
    avatarPreview.closest('.profile-avatar-edit').addEventListener('click', openFileDialog);
    changeAvatarBtn.addEventListener('click', openFileDialog);

    deleteAvatarBtn.addEventListener('click', () => {
        avatarUploadInput.value = null; // Clear the file input
        avatarPreview.src = originalAvatarUrl;
        avatarActions.style.display = 'none';
    });

    avatarUploadInput.addEventListener('change', () => {
        const file = avatarUploadInput.files[0];
        if (file) {
            avatarPreview.src = URL.createObjectURL(file);
            avatarActions.style.display = 'flex';
        }
    });

    // --- Form Submission Logic ---
    modal.querySelector('#edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = modal.querySelector('#edit-user-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        try {
            // 1. Handle avatar upload first
            const avatarFile = avatarUploadInput.files[0];
            let avatarUrl = user.avatar_url; // Keep old URL by default

            // Check if the delete button was used (input is cleared)
            const isAvatarDeleted = avatarUploadInput.value === '';

            if (avatarFile) {
                const filePath = `user-avatars/${user.id}-${Date.now()}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile);
                if (uploadError) throw new Error('فشل رفع الصورة.');
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                avatarUrl = urlData.publicUrl;
            } else if (isAvatarDeleted) {
                avatarUrl = null; // Set to null if deleted
            }

            // 2. Prepare user data for update
            const userData = {
                full_name: modal.querySelector('#edit-user-fullname').value,
                password: modal.querySelector('#edit-user-password').value,
                avatar_url: avatarUrl,
            };

            // 3. Send update request to backend
            const response = await authedFetch(`/api/users/${user.id}`, {
                method: 'PUT',
                body: JSON.stringify(userData)
            });
            if (!response.ok) throw new Error((await response.json()).message);

            showToast('تم تحديث بيانات المستخدم بنجاح.', 'success');
            closeModal();
            await fetchUsersData(); // Refresh the user list
        } catch (error) {
            showToast(`فشل تحديث المستخدم: ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
        }
    });
}

function renderPermissionsModal(user) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'form-modal-content modal-fullscreen'; // تعديل: استخدام حجم ملء الشاشة

    const p = user.permissions || {}; // Short alias for permissions
    // Set defaults for any missing permission structures
    p.agents = p.agents || { view_financials: false, edit_profile: false, edit_financials: false, can_view_competitions_tab: false, can_renew_all_balances: false };
    p.competitions = p.competitions || { manage_comps: 'none', manage_templates: 'none', can_create: false };

    modal.innerHTML = `
        <div class="form-modal-header">
            <h2><i class="fas fa-shield-alt"></i> إدارة صلاحيات: ${user.full_name}</h2>
            <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
        </div>
        <div class="form-modal-body">
            <form id="permissions-form">
                <div class="table-responsive-container">
                    <table class="permissions-table">
                        <thead>
                            <tr>
                                <th>القسم</th>
                                <th>بدون صلاحية</th>
                                <th>مشاهدة فقط</th>
                                <th>تحكم كامل</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="permission-name">
                                    <i class="fas fa-trophy"></i>
                                    <strong>إدارة المسابقات</strong>
                                    <small>التحكم في عرض وتعديل وحذف المسابقات.</small>
                                </td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_comps" value="none" ${p.competitions.manage_comps === 'none' || !p.competitions.manage_comps ? 'checked' : ''}><span></span></label></td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_comps" value="view" ${p.competitions.manage_comps === 'view' ? 'checked' : ''}><span></span></label></td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_comps" value="full" ${p.competitions.manage_comps === 'full' ? 'checked' : ''}><span></span></label></td>
                            </tr>
                            <tr>
                                <td class="permission-name">
                                    <i class="fas fa-file-alt"></i>
                                    <strong>إدارة القوالب</strong>
                                    <small>التحكم في عرض وتعديل وحذف قوالب المسابقات.</small>
                                </td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_templates" value="none" ${p.competitions.manage_templates === 'none' || !p.competitions.manage_templates ? 'checked' : ''}><span></span></label></td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_templates" value="view" ${p.competitions.manage_templates === 'view' ? 'checked' : ''}><span></span></label></td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_templates" value="full" ${p.competitions.manage_templates === 'full' ? 'checked' : ''}><span></span></label></td>
                            </tr>
                        </tbody>
                    </table>
                    <table class="permissions-table" style="margin-top: 20px;">
                         <thead>
                            <tr>
                                <th>صلاحيات خاصة</th>
                                <th>تفعيل / إلغاء</th>
                            </tr>
                        </thead>
                        <tbody>
                             <tr>
                                <td class="permission-name">
                                    <i class="fas fa-sync-alt"></i>
                                    <strong>تجديد رصيد جميع الوكلاء</strong>
                                    <small>السماح للموظف باستخدام زر "تجديد رصيد الوكلاء" في صفحة إدارة الوكلاء.</small>
                                </td>
                                <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-agents-renew-all" ${p.agents.can_renew_all_balances ? 'checked' : ''}><span class="slider round"></span></label></td>
                            </tr>
                             <tr>
                                <td class="permission-name">
                                    <i class="fas fa-magic"></i>
                                    <strong>إنشاء مسابقة للوكيل</strong>
                                    <small>السماح للموظف باستخدام زر "إنشاء مسابقة" من داخل صفحة ملف الوكيل.</small>
                                </td>
                                <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-competitions-can-create" ${p.competitions.can_create ? 'checked' : ''}><span class="slider round"></span></label></td>
                            </tr>
                            <tr>
                                <td class="permission-name">
                                    <i class="fas fa-list-alt"></i>
                                    <strong>عرض تبويب مسابقات الوكيل</strong>
                                    <small>السماح للموظف برؤية تبويب "المسابقات" وسجلها داخل صفحة ملف الوكيل.</small>
                                </td>
                                <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-agents-view-competitions" ${p.agents.can_view_competitions_tab ? 'checked' : ''}><span class="slider round"></span></label></td>
                            </tr>
                            <tr>
                                <td class="permission-name">
                                    <i class="fas fa-eye"></i>
                                    <strong>عرض التفاصيل المالية للوكيل</strong>
                                    <small>السماح للموظف برؤية تبويب "تفاصيل" الذي يحتوي على البيانات المالية الحساسة للوكيل.</small>
                                </td>
                                <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-agents-view-financials" ${p.agents.view_financials ? 'checked' : ''}><span class="slider round"></span></label></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="form-actions" style="margin-top: 20px;">
                    <button type="submit" id="save-permissions-btn" class="btn-primary"><i class="fas fa-save"></i> حفظ الصلاحيات</button>
                    <button type="button" id="cancel-permissions-modal" class="btn-secondary">إلغاء</button>
                </div>
            </form>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    modal.querySelector('#close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('#cancel-permissions-modal').addEventListener('click', closeModal);

    modal.querySelector('#permissions-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = modal.querySelector('#save-permissions-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        const permissionsData = {
            agents: {
                view_financials: modal.querySelector('#perm-agents-view-financials')?.checked || false,
                edit_profile: false, 
                edit_financials: false, 
                can_view_competitions_tab: modal.querySelector('#perm-agents-view-competitions')?.checked || false, // This will be read from the new toggle
                can_renew_all_balances: modal.querySelector('#perm-agents-renew-all')?.checked || false,
            },
            competitions: {
                manage_comps: modal.querySelector('input[name="perm_manage_comps"]:checked')?.value || 'none',
                manage_templates: modal.querySelector('input[name="perm_manage_templates"]:checked')?.value || 'none',
                can_create: modal.querySelector('#perm-competitions-can-create')?.checked || false,
            }
        };

        try {
            const response = await authedFetch(`/api/users/${user.id}`, {
                method: 'PUT',
                body: JSON.stringify({ permissions: permissionsData })
            });
            if (!response.ok) throw new Error((await response.json()).message);

            showToast('تم تحديث صلاحيات المستخدم بنجاح.', 'success');
            closeModal();
            await fetchUsersData(); // Refresh the user list to reflect changes
        } catch (error) {
            showToast(`فشل تحديث الصلاحيات: ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ الصلاحيات';
        }
    });
}