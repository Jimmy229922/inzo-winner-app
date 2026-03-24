/**
 * utils.js
 * دوال وأدوات مساعدة لصفحة اختيار الفائزين لا تعتمد على الـ State
 */

// Debounce helper - لتأخير التنفيذ حتى يتوقف المستخدم عن الحدث
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle helper - لتقليل عدد مرات تنفيذ الدالة (مثال للحفظ)
export function throttle(func, limit) {
    let inThrottle;
    let lastFunc;
    let lastRan;
    return function (...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            lastRan = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function () {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    }
}
