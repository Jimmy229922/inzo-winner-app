// --- NEW: Handler for presence updates ---
const handlePresenceUpdateForUsersPage = () => {
    if (window.updateUserPresenceIndicators) {
        window.updateUserPresenceIndicators();
    }
};

async function renderUsersPage() {
    // --- NEW: Clean up previous listener and add a new one for this page instance ---
    window.removeEventListener('presence-update', handlePresenceUpdateForUsersPage);
    window.addEventListener('presence-update', handlePresenceUpdateForUsersPage);

    const appContent = document.getElementById('app-content');

    // --- MODIFICATION: Allow both super_admin and admin to access this page ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = currentUserProfile?.role === 'admin';
    if (!isSuperAdmin && !isAdmin) {
        appContent.innerHTML = `
            <div class="access-denied-container">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية وصول</h2>
                <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
            </div>`;
        return;
    }

    // --- MODIFICATION: Only show the "Add User" button if the user has permission (admin or super_admin) ---
    const canAddUser = isSuperAdmin || isAdmin;
    const addUserButtonHtml = canAddUser ? `<button id="add-new-user-btn" class="btn-primary"><i class="fas fa-user-plus"></i> إضافة مستخدم جديد</button>` : '';
    
    // --- NEW: Purge all users button (super_admin only) ---
    const purgeUsersButtonHtml = isSuperAdmin ? `<button id="purge-all-users-btn" class="btn-danger" style="margin-right: 10px;"><i class="fas fa-trash-alt"></i> حذف جميع الحسابات</button>` : '';

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
                <div style="display: flex; gap: 10px;">
                    ${purgeUsersButtonHtml}
                    ${addUserButtonHtml}
                </div>
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
    const addUserBtn = document.getElementById('add-new-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', renderCreateUserModal);
    }
    
    // Add listener for purge all users button (super_admin only)
    const purgeUsersBtn = document.getElementById('purge-all-users-btn');
    if (purgeUsersBtn) {
        purgeUsersBtn.addEventListener('click', handlePurgeAllUsers);
    }
    
    // Attach event listeners for actions (delete, role change) to the persistent container
    attachUserActionListeners();

    // Attach search listeners
    setupUserPageFilters([]); // Setup with empty array initially

    // NEW: Fetch data asynchronously
    fetchUsersData();
}

async function fetchUsersData() {
    try {
        const response = await authedFetch('/api/users');
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message);
        }
        const { users } = await response.json();

        setupUserPageFilters(users); // Re-setup filters with the complete data
    } catch (error) {
        document.getElementById('users-list-container').innerHTML = `<p class="error">فشل جلب المستخدمين: ${error.message}</p>`;
    }
}

function renderUserRow(user) {
    // --- إصلاح: استخدام _id بدلاً من id ---
    const isCurrentUser = currentUserProfile && user._id === currentUserProfile.userId;
    const isTargetAdmin = user.role === 'admin';
    const isCurrentUserAdmin = currentUserProfile?.role === 'admin';
    const isCurrentUserSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isTargetSuperAdmin = user.role === 'super_admin'; // نحتفظ بهذا فقط لعرض الشارة

    // --- إصلاح: تعريف متغير الحالة في بداية الدالة لتجنب أخطاء الوصول ---
    const isInactive = user.status === 'inactive';

    // --- إصلاح: استخدام updatedAt كبديل مؤقت لآخر تسجيل دخول ---
    const lastLogin = user.updatedAt 
        ? new Date(user.updatedAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
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
    const onlineIndicatorHtml = `<div class="online-status-indicator" id="online-status-${user._id}" title="غير متصل"></div>`;

    return `
        <tr data-user-id="${user._id}" data-user-name="${user.full_name || 'مستخدم'}" data-user-email="${user.email || ''}" class="${isInactive ? 'inactive-row' : ''}">
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
                    const roleSelectDisabled = isCurrentUser || !canChangeRoles; // المدير العام يمكنه تغيير صلاحية أي شخص إلا نفسه
                    const roleSelectTitle = canChangeRoles ? 'تغيير الصلاحية' : 'فقط المدير العام يملك صلاحية التغيير';

                    if (isTargetSuperAdmin) {
                        return `<span class="role-display super-admin" title="لا يمكن تغيير صلاحية المدير العام">مدير عام</span>`;
                    }
                    return `<select class="role-select" data-user-id="${user._id}" ${roleSelectDisabled ? 'disabled' : ''} title="${roleSelectTitle}">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>موظف</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مسؤول</option>
                    </select>`;
                })()}
            </td>
            <td data-label="آخر تسجيل دخول">${lastLogin}</td>
            ${(() => {
                const isAdmin = isCurrentUserAdmin || isCurrentUserSuperAdmin;
                if (!isAdmin) return ''; // لا تعرض عمود الإجراءات لغير المسؤولين

                // --- تعديل: عرض خلية فارغة للمدير العام لمنع أي إجراء ---
                // --- NEW: Admins cannot edit other admins or super admins ---
                if (isTargetSuperAdmin || (isCurrentUserAdmin && isTargetAdmin)) {
                    return `<td class="actions-cell"><span class="no-actions-text">${isCurrentUserSuperAdmin ? 'لا يمكن التعديل' : 'صلاحية للمدير العام'}</span></td>`;
                }

                // عرض الأزرار للمستخدمين العاديين والمسؤولين الآخرين
                return `<td class="actions-cell">
                    <button class="btn-secondary edit-user-btn" data-user-id="${user._id}" title="تعديل بيانات المستخدم"><i class="fas fa-edit"></i></button>
                    ${/* --- MODIFICATION: Allow admins to manage permissions for users, but not other admins. --- */ ''}
                    <button class="btn-primary permissions-user-btn" data-user-id="${user._id}" title="إدارة الصلاحيات" 
                        ${(isCurrentUserAdmin && isTargetAdmin) || (!isCurrentUserSuperAdmin && !isCurrentUserAdmin) ? 'disabled' : ''}>
                        <i class="fas fa-shield-alt"></i></button>
                    ${/* --- MODIFICATION: Allow admins to delete users, but not other admins. Super admins can delete anyone except themselves. --- */ ''}
                    <button class="btn-danger delete-user-btn" data-user-id="${user._id}" title="حذف المستخدم نهائياً" 
                        ${(isCurrentUserAdmin && isTargetAdmin) || !isCurrentUserSuperAdmin && !isCurrentUserAdmin ? 'disabled' : ''}>
                        <i class="fas fa-trash-alt"></i></button>
                    <label class="custom-checkbox toggle-switch small-toggle" title="${isInactive ? 'تفعيل الحساب' : 'تعطيل الحساب'}" ${!isCurrentUserSuperAdmin ? 'style="display:none;"' : ''}>
                        <input type="checkbox" class="status-toggle" data-user-id="${user._id}" ${!isInactive ? 'checked' : ''}><span class="slider round"></span>
                    </label>
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
        allUsersCache.forEach(user => {
            const indicator = document.getElementById(`online-status-${user._id}`);
            if (indicator) {
                if (window.onlineUsers.has(user._id)) {
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
            const userToEdit = allUsersCache.find(u => u._id === userId);
            if (userToEdit) renderEditUserModal(userToEdit);
        }

        if (permissionsBtn && !permissionsBtn.disabled) {
            const userId = permissionsBtn.dataset.userId;
            const userToManage = allUsersCache.find(u => u._id === userId);
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
            const originalRole = allUsersCache.find(u => u._id === userId)?.role;

            try {
                const response = await authedFetch(`/api/users/${userId}/role`, {
                    method: 'PUT',
                    body: JSON.stringify({ role: newRole })
                });
                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.message);
                }

                showToast('تم تحديث صلاحية المستخدم بنجاح.', 'success');
                // NEW: Notify the user whose role was changed in real-time
                // This requires a WebSocket setup to be effective.
                notifyUserOfRoleChange(userId, newRole);
            } catch (error) {
                showToast(`فشل تحديث الصلاحية: ${error.message}`, 'error');
                // Revert the select box to the previous value on error without a full page reload
                if (originalRole) {
                    roleSelect.value = originalRole;
                }
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

/**
 * NEW: Notifies a specific user that their role has been changed.
 * This function should send a message via WebSocket to the server,
 * which then relays it to the target user.
 * @param {string} userId The ID of the user to notify.
 * @param {string} newRole The new role assigned to the user.
 */
function notifyUserOfRoleChange(userId, newRole) {
    // This is a placeholder for a real WebSocket implementation.
    // In a real app, you would have a global WebSocket instance, e.g., `socket`.
    // if (socket && socket.readyState === WebSocket.OPEN) {
    //     socket.send(JSON.stringify({
    //         type: 'role_change',
    //         payload: {
    //             targetUserId: userId,
    //             newRole: newRole
    //         }
    //     }));
    // }

    // For now, we can simulate this by logging to the console.
    console.log(`[SIMULATION] Notifying user ${userId} of role change to ${newRole}. This would be sent via WebSocket.`);
}

function renderCreateUserModal() {
    // --- NEW: Professional Create User Modal ---
    const overlay = document.createElement('div');
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';

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
                    ${isSuperAdmin ? `
                        <div class="form-group">
                            <label for="new-user-role">الصلاحية</label>
                            <select id="new-user-role">
                                <option value="user" selected>موظف</option>
                                <option value="admin">مسؤول</option>
                            </select>
                        </div>
                    ` : '<input type="hidden" id="new-user-role" value="user">'
                    }
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
            });
            const result = await response.json();
            if (!response.ok || !result.user) throw new Error(result.message || 'فشل إنشاء المستخدم.');

            // Avatar upload logic will be implemented later

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
    if (isCurrentUserSuperAdmin) {
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
    } else {
        // Hide actions and disable click for non-super-admin editors
        avatarActions.style.display = 'none';
        avatarPreview.closest('.profile-avatar-edit').style.cursor = 'not-allowed';
    }

    // --- Form Submission Logic ---
    modal.querySelector('#edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = modal.querySelector('#edit-user-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        try {
            const avatarFile = modal.querySelector('#avatar-upload').files[0];
            if (avatarFile && isCurrentUserSuperAdmin) {
                const formData = new FormData();
                formData.append('avatar', avatarFile);

                const avatarResponse = await authedFetch(`/api/users/${user._id}/avatar`, {
                    method: 'POST',
                    body: formData
                });
                if (!avatarResponse.ok) {
                    throw new Error('فشل رفع الصورة الرمزية.');
                }
            }

            const userData = {
                full_name: modal.querySelector('#edit-user-fullname').value,
                password: modal.querySelector('#edit-user-password').value,
            };

            // Send other user data update request
            const response = await authedFetch(`/api/users/${user._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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
            <h2><i class="fas fa-shield-alt"></i> إدارة صلاحيات: ${user.full_name} ${user.role === 'super_admin' ? '<span class="admin-badge super-admin" style="font-size: 1rem; vertical-align: middle; margin-right: 10px;">مدير عام</span>' : ''}</h2>
            <button id="close-modal-btn" class="btn-icon-action" title="إغلاق">&times;</button>
        </div>
        <div class="form-modal-body" ${user.role === 'super_admin' ? 'style="pointer-events: none; opacity: 0.7;"' : ''}>
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
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_comps" value="none" ${p.competitions.manage_comps === 'none' || !p.competitions.manage_comps || user.role === 'super_admin' ? 'checked' : ''}><span></span></label></td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_comps" value="view" ${p.competitions.manage_comps === 'view' && user.role !== 'super_admin' ? 'checked' : ''}><span></span></label></td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_comps" value="full" ${p.competitions.manage_comps === 'full' || user.role === 'super_admin' ? 'checked' : ''}><span></span></label></td>
                            </tr>
                            <tr>
                                <td class="permission-name">
                                    <i class="fas fa-file-alt"></i>
                                    <strong>إدارة القوالب</strong>
                                    <small>التحكم في عرض وتعديل وحذف قوالب المسابقات.</small>
                                </td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_templates" value="none" ${p.competitions.manage_templates === 'none' || !p.competitions.manage_templates || user.role === 'super_admin' ? 'checked' : ''}><span></span></label></td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_templates" value="view" ${p.competitions.manage_templates === 'view' && user.role !== 'super_admin' ? 'checked' : ''}><span></span></label></td>
                                <td><label class="custom-radio"><input type="radio" name="perm_manage_templates" value="full" ${p.competitions.manage_templates === 'full' || user.role === 'super_admin' ? 'checked' : ''}><span></span></label></td>
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
                                <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-agents-renew-all" ${p.agents.can_renew_all_balances || user.role === 'super_admin' ? 'checked' : ''}><span class="slider round"></span></label></td>
                            </tr>
                             <tr>
                                <td class="permission-name">
                                    <i class="fas fa-magic"></i>
                                    <strong>إنشاء مسابقة للوكيل</strong>
                                    <small>السماح للموظف بإنشاء مسابقات جديدة للوكلاء.</small>
                                </td>
                                <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-competitions-can-create" ${p.competitions.can_create || user.role === 'super_admin' ? 'checked' : ''}><span class="slider round"></span></label></td>
                            </tr>
                            <tr>
                                <td class="permission-name">
                                    <i class="fas fa-list-alt"></i>
                                    <strong>عرض تبويب مسابقات الوكيل</strong>
                                    <small>السماح للموظف برؤية تبويب "المسابقات" داخل صفحة ملف الوكيل.</small>
                                </td>
                                <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-agents-view-competitions" ${p.agents.can_view_competitions_tab || user.role === 'super_admin' ? 'checked' : ''}><span class="slider round"></span></label></td>
                            </tr>
                            <tr>
                                <td class="permission-name">
                                    <i class="fas fa-eye"></i>
                                    <strong>عرض التفاصيل المالية للوكيل</strong>
                                    <small>السماح للموظف برؤية تبويب "تفاصيل" المالي للوكيل.</small>
                                </td>
                                <td><label class="custom-checkbox toggle-switch"><input type="checkbox" id="perm-agents-view-financials" ${p.agents.view_financials || user.role === 'super_admin' ? 'checked' : ''}><span class="slider round"></span></label></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="form-actions" style="margin-top: 20px;" ${user.role === 'super_admin' ? 'hidden' : ''}>
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
        if (!submitBtn) return;

        // Get original permissions for logging
        const originalPermissions = user.permissions || {};

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        const permissionsData = {
            agents: {
                view_financials: modal.querySelector('#perm-agents-view-financials')?.checked || false,
                edit_profile: false, 
                edit_financials: false, // This permission is not implemented in the UI yet
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
            // The backend will log the change, including old and new values.
            const response = await authedFetch(`/api/users/${user._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions: permissionsData })
            });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || 'فشل تحديث الصلاحيات.');
            }

            showToast('تم تحديث صلاحيات المستخدم بنجاح.', 'success');
            closeModal();
            
            // Important: We must refetch the entire user list so the local cache (`allUsersCache`)
            // is updated with the new permissions. This ensures that if we open the modal
            // again for the same user, it shows the correct, most recent data.
            await fetchUsersData(); // Refresh the user list to reflect changes
        } catch (error) {
            showToast(`فشل تحديث الصلاحيات: ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ الصلاحيات';
        }
    });
}

// NEW: Function to render the user's own profile settings page
async function renderProfileSettingsPage() {
    const appContent = document.getElementById('app-content');

    if (!currentUserProfile) {
        appContent.innerHTML = `<p class="error">يجب تسجيل الدخول لعرض هذه الصفحة.</p>`;
        return;
    }

    const isSuperAdmin = currentUserProfile.role === 'super_admin';
    const isAdmin = currentUserProfile.role === 'admin';
    const roleBadge = isSuperAdmin ? '<span class="admin-badge super-admin">مدير عام</span>' : (isAdmin ? '<span class="admin-badge">مسؤول</span>' : '<span class="employee-badge">موظف</span>');

    appContent.innerHTML = `
        <div class="page-header">
            <h1><i class="fas fa-user-cog"></i> إعدادات الملف الشخصي</h1>
        </div>

        <!-- NEW: Profile Header Section for display -->
        <div class="profile-settings-header">
            <div class="profile-avatar-edit large-avatar">
                <img src="${currentUserProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserProfile.full_name || currentUserProfile.email)}&background=8A2BE2&color=fff&size=128`}" alt="Avatar" id="avatar-preview">
                <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
            </div>
            <div class="profile-header-info">
                <h2 class="profile-name-display">${currentUserProfile.full_name || 'مستخدم'} ${roleBadge}</h2>
                <p class="profile-email-display">${currentUserProfile.email || ''}</p>
            </div>
        </div>

        <div class="form-container" style="max-width: 800px;">
            <form id="profile-settings-form">
                ${currentUserProfile.role === 'admin' ? `
                    <h3 class="details-section-title">المعلومات الأساسية</h3>
                    <div class="details-grid" style="grid-template-columns: 1fr; gap: 20px;"><div class="form-group"><label for="profile-full-name">الاسم الكامل</label><input type="text" id="profile-full-name" class="profile-name-input" value="${currentUserProfile.full_name || ''}" required></div></div>
                ` : ''}
                
                <h3 class="details-section-title">تغيير كلمة المرور</h3>
                <div class="details-grid" style="grid-template-columns: 1fr; gap: 20px;">
                    <div class="form-group">
                        <label for="profile-current-password">كلمة المرور الحالية</label>
                        <div class="password-input-wrapper">
                            <input type="password" id="profile-current-password" placeholder="أدخل كلمة المرور الحالية للتغيير">
                            <button type="button" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                            <div id="current-password-validation-msg" class="validation-status-inline"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="profile-new-password">كلمة المرور الجديدة</label>
                        <div class="password-input-wrapper">
                            <input type="password" id="profile-new-password" placeholder="اتركه فارغاً لعدم التغيير">
                            <button type="button" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                        </div>
                        <div class="password-strength-meter"><div class="strength-bar"></div></div>
                        <div class="password-actions">
                            <button type="button" id="generate-password-btn" class="btn-secondary btn-small">إنشاء كلمة مرور قوية</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="profile-confirm-password">تأكيد كلمة المرور الجديدة</label>
                        <div class="password-input-wrapper">
                            <input type="password" id="profile-confirm-password">
                            <button type="button" class="password-toggle-btn" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                            <div id="password-match-error" class="validation-error-inline" style="display: none;">كلمتا المرور غير متطابقتين.</div>
                        </div>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" id="save-profile-settings-btn" class="btn-primary">
                        <i class="fas fa-save"></i> حفظ التغييرات
                    </button>
                </div>
            </form>
        </div>
    `;

    const form = document.getElementById('profile-settings-form');
    const saveBtn = form.querySelector('#save-profile-settings-btn');
    const newPasswordInput = form.querySelector('#profile-new-password');
    const confirmPasswordInput = form.querySelector('#profile-confirm-password');
    const currentPasswordInput = form.querySelector('#profile-current-password');
    const validationMsgEl = form.querySelector('#current-password-validation-msg');

    // --- NEW: Real-time current password validation on blur ---
    currentPasswordInput.addEventListener('blur', async () => {
        const password = currentPasswordInput.value;

        // Clear previous message if input is empty
        if (!password) {
            validationMsgEl.innerHTML = '';
            validationMsgEl.className = 'validation-status-inline';
            return;
        }

        // Show a loading indicator
        validationMsgEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>جاري التحقق...</span>';
        validationMsgEl.className = 'validation-status-inline checking';

        try {
            const response = await authedFetch('/api/auth/verify-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                validationMsgEl.innerHTML = '<i class="fas fa-times-circle"></i> <span>' + (result.message || 'كلمة المرور الحالية غير صحيحة.') + '</span>';
                validationMsgEl.className = 'validation-status-inline error';
                return;
            }

            validationMsgEl.innerHTML = '<i class="fas fa-check-circle"></i> <span>كلمة المرور صحيحة.</span>';
            validationMsgEl.className = 'validation-status-inline success';
        } catch (e) {
            validationMsgEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>حدث خطأ أثناء التحقق.</span>';
            validationMsgEl.className = 'validation-status-inline error';
        }
    });

    // --- Avatar Logic ---
    const avatarUploadInput = document.getElementById('avatar-upload');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarEditContainer = document.querySelector('.profile-settings-header .profile-avatar-edit');

    if (avatarEditContainer) {
        avatarEditContainer.addEventListener('click', () => {
            // Allow both admin and super_admin to change avatar
            if (currentUserProfile.role === 'admin' || currentUserProfile.role === 'super_admin') {
                avatarUploadInput.click();
            }
        });
    }
    if (avatarUploadInput) {
        avatarUploadInput.addEventListener('change', () => {
            const file = avatarUploadInput.files[0];
            if (file) avatarPreview.src = URL.createObjectURL(file);
        });
    }

    // --- Password Toggles & Strength Meter ---
    form.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.password-input-wrapper').querySelector('input');
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.querySelector('i').className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'}`;
        });
    });
    const strengthBar = form.querySelector('.strength-bar');
    newPasswordInput.addEventListener('input', () => {
        const password = newPasswordInput.value;
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/\d/)) strength++;
        if (password.match(/[^a-zA-Z\d]/)) strength++;
        strengthBar.className = 'strength-bar';
        if (strength > 0) strengthBar.classList.add(`strength-${strength}`);
    });

    // --- Generate Password Button ---
    const generatePasswordBtn = form.querySelector('#generate-password-btn');
    if (generatePasswordBtn) {
        generatePasswordBtn.addEventListener('click', () => {
            const lower = 'abcdefghijklmnopqrstuvwxyz';
            const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const numbers = '0123456789';
            const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
            const all = lower + upper + numbers + symbols;
            let newPassword = '';
            newPassword += lower.charAt(Math.floor(Math.random() * lower.length));
            newPassword += upper.charAt(Math.floor(Math.random() * upper.length));
            newPassword += numbers.charAt(Math.floor(Math.random() * numbers.length));
            newPassword += symbols.charAt(Math.floor(Math.random() * symbols.length));
            for (let i = newPassword.length; i < 14; i++) {
                newPassword += all.charAt(Math.floor(Math.random() * all.length));
            }
            newPassword = newPassword.split('').sort(() => 0.5 - Math.random()).join('');
            newPasswordInput.value = newPassword;
            confirmPasswordInput.value = newPassword;
            newPasswordInput.dispatchEvent(new Event('input')); // Trigger strength check
            navigator.clipboard.writeText(newPassword).then(() => {
                showToast('تم إنشاء ونسخ كلمة مرور قوية.', 'success');
            });
        });
    }

    // --- Real-time password match validation ---
    const passwordMatchError = form.querySelector('#password-match-error');
    const validatePasswordMatch = () => {
        if (newPasswordInput.value && confirmPasswordInput.value && newPasswordInput.value !== confirmPasswordInput.value) {
            passwordMatchError.style.display = 'block';
            saveBtn.disabled = true;
        } else {
            passwordMatchError.style.display = 'none';
            saveBtn.disabled = false;
        }
    };
    newPasswordInput.addEventListener('input', validatePasswordMatch);
    confirmPasswordInput.addEventListener('input', validatePasswordMatch);

    // --- Disable form elements for non-admins ---
    if (currentUserProfile.role !== 'admin' && currentUserProfile.role !== 'super_admin') {
        const fullNameInput = form.querySelector('#profile-full-name');
        if (fullNameInput) fullNameInput.disabled = true;
        avatarEditContainer.style.cursor = 'not-allowed';
        avatarEditContainer.title = 'لا يمكنك تغيير الصورة الشخصية.';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // --- Submission Logic ---
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        const fullNameInput = document.getElementById('profile-full-name');
        const fullName = fullNameInput ? fullNameInput.value : currentUserProfile.full_name;
        const newPassword = newPasswordInput.value; // FIX: Define newPassword variable
        const confirmPassword = document.getElementById('profile-confirm-password').value;
        const currentPassword = document.getElementById('profile-current-password').value;

        try {
            // --- Password Validation ---
            if (newPassword && !currentPassword) {
                throw new Error('يجب إدخال كلمة المرور الحالية لتغييرها.');
            }
            if (newPassword !== confirmPassword) {
                throw new Error('كلمتا المرور الجديدتان غير متطابقتين.');
            }

            // 1. Handle avatar upload if a new file is selected
            const avatarFile = document.getElementById('avatar-upload').files[0];
            let newAvatarUrl = currentUserProfile.avatar_url;

            if (avatarFile) {
                const formData = new FormData();
                formData.append('avatar', avatarFile);

                const uploadResp = await authedFetch(`/api/users/${currentUserProfile._id}/avatar`, {
                    method: 'POST',
                    body: formData
                });
                if (!uploadResp.ok) {
                    const result = await uploadResp.json().catch(() => ({}));
                    throw new Error(result.message || 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.');
                }

                const uploadResult = await uploadResp.json();
                newAvatarUrl = uploadResult.avatar_url || newAvatarUrl;
                // تحديث المعاينة فوراً
                if (newAvatarUrl && avatarPreview) {
                    avatarPreview.src = newAvatarUrl;
                }
            }

            // 2. Update public profile table (users)
            const profileUpdateData = { avatar_url: newAvatarUrl };
            if (currentUserProfile.role === 'admin' && fullNameInput) {
                profileUpdateData.full_name = fullName;
            }

            // TODO: Implement backend endpoint for updating user profile
            const response = await authedFetch(`/api/users/${currentUserProfile._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileUpdateData)
            });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || 'فشل تحديث الملف الشخصي.');
            }


            // 3. If a new password is provided, verify old and update in auth
            if (newPassword && currentPassword) {
                const resp = await authedFetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword, newPassword })
                });

                if (!resp.ok) {
                    const result = await resp.json().catch(() => ({}));
                    throw new Error(result.message || 'فشل تغيير كلمة المرور.');
                }
            }

            // 4. Refresh local user profile data to reflect changes
            await fetchUserProfile();

            showToast('تم تحديث الملف الشخصي بنجاح.', 'success');

            // NEW: If password was changed, clear fields and hide the section
            if (newPassword) {
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
                validationMsgEl.innerHTML = '';
                validationMsgEl.className = 'validation-status-inline';
                form.querySelector('#password-match-error').style.display = 'none';
                form.querySelector('.strength-bar').className = 'strength-bar';
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast(`فشل تحديث الملف الشخصي: ${error.message}`, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التغييرات';
        }
    });
}
// ============================================
// Purge All Users (Super Admin Only)
// ============================================
async function handlePurgeAllUsers() {
    const modal = document.createElement('div');
    modal.id = 'purge-all-users-modal';
    modal.className = 'purge-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-exclamation-triangle"></i> ?????: ??? ???? ????????</h3>
            </div>
            <div class="modal-body">
                <p style="color: var(--error-color); font-weight: bold; font-size: 1.1em;"> ????? ???? ???????!</p>
                <p>??? ??? ??? ??? <strong>???? ?????? ??????????</strong> ?? ??????.</p>
                <p style="margin-top: 15px;"><strong>??????:</strong> ????? ?????? (Super Admin) ????? ??? ??? ????.</p>
                <p style="color: var(--error-color); font-weight: bold; margin-top: 15px;"> ??? ??????? ?? ???? ??????? ???!</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary cancel-purge-btn">
                    <i class="fas fa-times"></i> ?????
                </button>
                <button class="btn btn-danger confirm-purge-btn">
                    <i class="fas fa-trash-alt"></i> ???? ???? ???? ????????
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    const cancelBtn = modal.querySelector('.cancel-purge-btn');
    const overlay = modal.querySelector('.modal-overlay');
    const closeModal = () => { modal.classList.remove('show'); setTimeout(() => modal.remove(), 300); };
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    const confirmBtn = modal.querySelector('.confirm-purge-btn');
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ???? ?????...';
        try {
            const response = await fetch('/api/users/purge-all', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer }{localStorage.getItem('token')}`, 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message || '?? ??? ???? ???????? ?????', 'success');
                closeModal();
                setTimeout(() => renderUsersPage(), 1500);
            } else {
                showToast(data.message || '??? ??? ????????', 'error');
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> ???? ???? ???? ????????';
            }
        } catch (error) {
            console.error('Error purging users:', error);
            showToast('??? ??? ????? ??? ????????', 'error');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> ???? ???? ???? ????????';
        }
    });
}
