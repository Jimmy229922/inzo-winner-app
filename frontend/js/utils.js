

// Utility functions for the INZO Winner App

// Ensure window.utils exists and expose helpers for destructuring compatibility
window.utils = window.utils || {};

// Lightweight debug control: enable by setting window.__DEBUG = true or localStorage.debug = 'true'
function __isDebugEnabled() {
    try {
        return !!window.__DEBUG || localStorage.getItem('debug') === 'true';
    } catch (_) {
        return !!window.__DEBUG;
    }
}
window.__isDebugEnabled = __isDebugEnabled;
window.logDebug = function(...args) { if (__isDebugEnabled()) console.debug(...args); };
window.logTrace = function(...args) { if (__isDebugEnabled()) console.trace(...args); };

function translateTelegramError(errorMessage) {
    if (!errorMessage) {
        return 'فشل إرسال غير معروف.';
    }

    const lowerCaseError = errorMessage.toLowerCase();

    if (lowerCaseError.includes('message and chat id are required')) {
        return 'معرف الدردشة (Chat ID) الخاص بالوكيل غير موجود أو غير صحيح. يرجى مراجعته في صفحة تعديل الوكيل.';
    }
    if (lowerCaseError.includes('chat not found')) {
        return 'فشل العثور على المحادثة. يرجى التأكد من أن معرف الدردشة (Chat ID) صحيح وأن الوكيل قد بدأ محادثة مع البوت.';
    }
    if (lowerCaseError.includes('bot was blocked by the user')) {
        return 'قام الوكيل بحظر البوت. لا يمكن إرسال الرسالة.';
    }
    if (lowerCaseError.includes('user is deactivated')) {
        return 'حساب المستخدم غير نشط في تيليجرام.';
    }
    if (lowerCaseError.includes('chat_id is empty') || lowerCaseError.includes('chat id is empty')) {
        return 'معرف الدردشة (Chat ID) فارغ. يرجى إضافته في ملف الوكيل.';
    }
    if (lowerCaseError.includes('message is too long')) {
        return 'الرسالة طويلة جداً. يرجى اختصارها.';
    }
    if (lowerCaseError.includes('wrong file identifier')) {
        return 'معرف الملف (للصور أو المرفقات) غير صحيح.';
    }
    // A more generic bad request
    if (lowerCaseError.includes('bad request')) {
        return 'طلب غير صالح. قد يكون هناك خطأ في تنسيق الرسالة أو معرف الدردشة.';
    }

    // Default fallback
    return `خطأ من تيليجرام: ${errorMessage}`;
}

// Safe ID helper: coerce various id-like values to a stable string without throwing.
function safeId(val) {
    // Treat null/undefined as empty string
    if (val === null || typeof val === 'undefined') return '';
    // If it's an object with a toString (e.g., ObjectId), call it safely
    try {
        return String(val);
    } catch (e) {
        return '';
    }
}

// Global fetch wrapper with proper JSON handling and auth management
async function authedFetch(url, options = {}) {
    const token = localStorage.getItem('authToken');
    
    // Start with default headers for JSON requests
    const defaultHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json;charset=UTF-8'
    };

    // Merge default headers with provided headers
    const headers = { ...defaultHeaders, ...(options.headers || {}) };
    
    // Add auth token if available
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    } else {
        console.warn('[Auth] No token found for request to:', url);
    }

    // If body is an object and Content-Type is JSON, stringify it
    let finalBody = options.body;
    if (finalBody && typeof finalBody === 'object' && !(finalBody instanceof FormData)) {
        if (headers['Content-Type'].includes('application/json')) {
            finalBody = JSON.stringify(finalBody);
        }
    }

    // For FormData, remove Content-Type and let browser set it with boundary
    if (finalBody instanceof FormData) {
        delete headers['Content-Type'];
    }

    // Log request details only if debug is enabled
    if (__isDebugEnabled()) {
        try {
            console.log('DEBUG (Frontend): Request', {
                url,
                method: options.method || 'GET',
                headers,
                finalBodyType: finalBody instanceof FormData ? 'FormData' : typeof finalBody,
                bodyPreview: finalBody && typeof finalBody === 'string' ? finalBody.slice(0, 200) : null
            });
            if (headers['Content-Type'] && headers['Content-Type'].includes('text/plain')) {
                console.warn('[DEBUG] Request Content-Type is text/plain - server may parse body as plain text. URL:', url);
            }
        } catch (e) {
            console.warn('Failed to log debug request details', e);
        }
    }

    const response = await fetch(url, {
        ...options,
        headers,
        body: finalBody
    });

    // Log non-OK responses (helpful for debugging parsing issues server-side)
    if (__isDebugEnabled()) {
        try {
            if (!response.ok) {
                // Clone so calling code can still read response
                const clone = response.clone();
                clone.text().then(text => {
                    console.error('[DEBUG] Non-OK response from', url, 'status:', response.status, 'body preview:', text && text.slice(0, 200));
                }).catch(err => {
                    console.error('[DEBUG] Failed to read response text for', url, err);
                });
            }
        } catch (e) {
            console.warn('Failed to log response debug info', e);
        }
    }

    // Handle unauthorized responses
    if (response.status === 401) {
        console.warn('[Auth] Unauthorized response from:', url);
        // Clear stored credentials
        localStorage.removeItem('authToken');
        localStorage.removeItem('userProfile');
        
        // Only redirect if we're not already on the login page
        if (!window.location.pathname.includes('/login')) {
            window.location.replace('/login.html');
            throw new Error('Unauthorized: Please log in again.');
        }
    }

    return response;
}

// Expose utilities globally
window.safeId = safeId;
window.authedFetch = authedFetch;
window.translateTelegramError = translateTelegramError;
window.utils.authedFetch = authedFetch;
window.utils.translateTelegramError = translateTelegramError;

// Lightweight toast notification helper compatible with components.css styles
if (typeof window.showToast !== 'function') {
    window.showToast = function (message, type = 'info', duration = 4000) {
        try {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            // Icons mapping
            const icons = {
                success: '<i class="fas fa-check-circle"></i>',
                error: '<i class="fas fa-exclamation-circle"></i>',
                warning: '<i class="fas fa-exclamation-triangle"></i>',
                info: '<i class="fas fa-info-circle"></i>',
                cancelled: '<i class="fas fa-ban"></i>'
            };

            // Titles mapping
            const titles = {
                success: 'نجاح',
                error: 'خطأ',
                warning: 'تنبيه',
                info: 'معلومة',
                cancelled: 'إلغاء'
            };

            toast.innerHTML = `
                <div class="toast-icon">${icons[type] || icons.info}</div>
                <div class="toast-content">
                    <div class="toast-title">${titles[type] || 'إشعار'}</div>
                    <div class="toast-message">${message}</div>
                </div>
                <div class="toast-close" onclick="this.parentElement.remove()">×</div>
                <div class="toast-progress">
                    <div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div>
                </div>
            `;

            container.appendChild(toast);

            // Auto remove
            setTimeout(() => {
                toast.style.animation = 'toastSlideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                toast.addEventListener('animationend', () => {
                    if (container.contains(toast)) container.removeChild(toast);
                });
            }, duration);

        } catch (e) {
            // Fallback if DOM not ready
            console.error('Toast Error:', e);
            if (type === 'error' || type === 'warning') {
                alert(message);
            } else {
                console.log(`[${type}] ${message}`);
            }
        }
    };
}

window.utils.showToast = window.showToast;
