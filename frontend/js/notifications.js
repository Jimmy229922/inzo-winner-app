
// ==========================
// Notification System
// ==========================
const NotificationSystem = {
    init: function() {
        this.notificationList = document.getElementById('notification-list');
        this.notificationCount = document.getElementById('notification-count');
        this.clearAllBtn = document.getElementById('clear-all-notifications');
        
        if (this.clearAllBtn) {
            this.clearAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent dropdown from closing
                this.deleteAllNotifications();
            });
        }

        // Initial fetch
        if (currentUserProfile) {
            this.fetchNotifications();
        }
    },

    fetchNotifications: async function() {
        if (!currentUserProfile) return;
        
        try {
            const response = await window.utils.authedFetch('/api/notifications');
            if (response.ok) {
                const result = await response.json();
                this.renderNotifications(result.data || []);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    },

    renderNotifications: function(notifications) {
        if (!this.notificationList) return;

        if (notifications.length === 0) {
            this.notificationList.innerHTML = '<div class="text-center p-3 text-muted">لا توجد إشعارات</div>';
            if (this.notificationCount) {
                this.notificationCount.style.display = 'none';
                this.notificationCount.textContent = '0';
            }
            return;
        }

        if (this.notificationCount) {
            this.notificationCount.textContent = notifications.length;
            this.notificationCount.style.display = 'inline-block';
        }

        this.notificationList.innerHTML = notifications.map(notif => `
            <div class="dropdown-item notification-item ${notif.is_read ? 'read' : 'unread'}" style="white-space: normal; border-bottom: 1px solid #eee; padding: 10px;">
                <div class="d-flex justify-content-between align-items-start">
                    <div style="flex: 1;">
                        <p class="mb-1" style="font-size: 0.9rem; color: ${this.getColorForType(notif.type)}">
                            <i class="${this.getIconForType(notif.type)}"></i> ${notif.message}
                        </p>
                        <small class="text-muted">${new Date(notif.createdAt).toLocaleString('ar-EG')}</small>
                    </div>
                    <button class="btn btn-link text-danger p-0 ml-2 delete-notification-btn" data-id="${notif._id}" style="font-size: 1.2rem; line-height: 1;">&times;</button>
                </div>
            </div>
        `).join('');

        // Attach delete listeners
        this.notificationList.querySelectorAll('.delete-notification-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.deleteNotification(btn.dataset.id);
            });
        });
    },

    getColorForType: function(type) {
        switch(type) {
            case 'success': return '#28a745';
            case 'warning': return '#ffc107';
            case 'error': return '#dc3545';
            default: return '#17a2b8';
        }
    },

    getIconForType: function(type) {
        switch(type) {
            case 'success': return 'fas fa-check-circle';
            case 'warning': return 'fas fa-exclamation-triangle';
            case 'error': return 'fas fa-times-circle';
            default: return 'fas fa-info-circle';
        }
    },

    deleteNotification: async function(id) {
        try {
            const response = await window.utils.authedFetch(`/api/notifications/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                this.fetchNotifications(); // Refresh list
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    },

    deleteAllNotifications: async function() {
        if (!confirm('هل أنت متأكد من حذف جميع الإشعارات؟')) return;
        
        try {
            const response = await window.utils.authedFetch('/api/notifications', {
                method: 'DELETE'
            });
            if (response.ok) {
                this.fetchNotifications(); // Refresh list
            }
        } catch (error) {
            console.error('Error deleting all notifications:', error);
        }
    }
};

// Expose globally
window.NotificationSystem = NotificationSystem;
