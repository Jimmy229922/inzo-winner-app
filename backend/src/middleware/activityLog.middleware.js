const { logActivity } = require('../utils/logActivity');

// Simple sanitizer to avoid logging secrets
function sanitize(obj = {}) {
    const clone = {};
    const blacklist = ['password', 'confirm_password', 'authToken', 'token', 'access_token', 'refresh_token'];
    try {
        for (const k of Object.keys(obj)) {
            if (blacklist.includes(k.toLowerCase())) continue;
            const v = obj[k];
            // If nested object, stringify safely
            if (typeof v === 'object') {
                try { clone[k] = JSON.parse(JSON.stringify(v)); } catch (e) { clone[k] = String(v); }
            } else clone[k] = v;
        }
    } catch (e) {
        return {};
    }
    return clone;
}

// Map API endpoints to Arabic descriptions
function generateArabicDescription(method, path, userName, status) {
    const cleanPath = path.split('?')[0].replace(/\/$/, '');
    const parts = cleanPath.split('/').filter(Boolean);
    const user = userName || 'مستخدم';
    
    // Resource mapping
    const resourceMap = {
        'agents': { singular: 'وكيل', plural: 'وكلاء' },
        'agent': { singular: 'وكيل', plural: 'وكلاء' },
        'users': { singular: 'مستخدم', plural: 'مستخدمين' },
        'user': { singular: 'مستخدم', plural: 'مستخدمين' },
        'competitions': { singular: 'مسابقة', plural: 'مسابقات' },
        'competition': { singular: 'مسابقة', plural: 'مسابقات' },
        'templates': { singular: 'قالب', plural: 'قوالب' },
        'template': { singular: 'قالب', plural: 'قوالب' },
        'tasks': { singular: 'مهمة', plural: 'مهام' },
        'task': { singular: 'مهمة', plural: 'مهام' },
        'calendar': { singular: 'التقويم', plural: 'التقويم' },
        'stats': { singular: 'إحصائيات', plural: 'إحصائيات' },
        'logs': { singular: 'سجل', plural: 'سجلات' },
        'dashboard': { singular: 'لوحة التحكم', plural: 'لوحة التحكم' },
        'insights': { singular: 'رؤى', plural: 'رؤى' }
    };
    
    // Check for specific patterns
    if (/\/api\/agents\/\w+\/renew/i.test(cleanPath)) {
        return `${user} قام بتجديد رصيد وكيل`;
    }
    if (/\/api\/agents\/bulk-renew/i.test(cleanPath)) {
        return `${user} قام بتجديد رصيد جماعي للوكلاء`;
    }
    if (/\/api\/agents\/bulk-delete/i.test(cleanPath)) {
        return `${user} قام بحذف جماعي للوكلاء`;
    }
    if (/\/api\/competitions\/\w+\/archive/i.test(cleanPath)) {
        return `${user} قام بأرشفة مسابقة`;
    }
    if (/\/api\/competitions\/\w+\/restore/i.test(cleanPath)) {
        return `${user} قام باستعادة مسابقة من الأرشيف`;
    }
    
    // Find resource name from path
    let resource = null;
    for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        // Skip IDs (MongoDB ObjectIds are 24 chars hex, but also skip numeric IDs)
        if (/^[0-9a-f]{24}$/i.test(part) || /^\d+$/.test(part)) continue;
        if (resourceMap[part]) {
            resource = resourceMap[part];
            break;
        }
    }
    
    // Generate description based on method
    if (resource) {
        switch (method) {
            case 'POST':
                return `${user} قام بإنشاء ${resource.singular}`;
            case 'PUT':
            case 'PATCH':
                return `${user} قام بتحديث ${resource.singular}`;
            case 'DELETE':
                return `${user} قام بحذف ${resource.singular}`;
            case 'GET':
                // Check if it's listing or viewing single item
                const hasId = parts.some(p => /^[0-9a-f]{24}$/i.test(p) || /^\d+$/.test(p));
                if (hasId) {
                    return `${user} قام بعرض ${resource.singular}`;
                } else {
                    return `${user} قام بعرض ${resource.plural}`;
                }
        }
    }
    
    // Generic fallback
    const methodMap = {
        'GET': 'جلب بيانات',
        'POST': 'إضافة بيانات',
        'PUT': 'تحديث بيانات',
        'PATCH': 'تعديل بيانات',
        'DELETE': 'حذف بيانات'
    };
    
    return `${user} قام بـ ${methodMap[method] || 'عملية'} (${cleanPath})`;
}

/**
 * Middleware to auto-log user actions.
 * Logs POST/PUT/PATCH/DELETE requests and skips obvious sensitive routes.
 * Also skips GET requests for viewing agents/stats to reduce noise.
 */
module.exports = function activityLogger(req, res, next) {
    try {
        const start = Date.now();
        const method = req.method.toUpperCase();

        // We'll log most requests but skip some internal/public endpoints to avoid noise/loops
        const skipPaths = [
            '/api/competitions/upload-image',
            '/api/auth',
            '/api/logs',
            '/api/tasks',            // استثناء كل عمليات المهام حسب الطلب
            '/uploads',
            '/dist'
        ];
        if (skipPaths.some(p => req.originalUrl.startsWith(p))) return next();

        // Skip GET requests that are considered "view-only" noise (page data fetching)
        // امتداد لتصفية السجلات: عدم تسجيل الطلبات التي تحدث عند مجرد فتح الصفحات مثل التقويم أو التحليلات
        if (method === 'GET') {
            const skipGetPaths = [
                '/api/agents',        // عرض قائمة الوكلاء
                '/api/users',         // طلبات المستخدمين (قائمة/مفرد)
                '/api/templates',     // القوالب (قائمة/مفرد)
                '/api/competitions',  // المسابقات (قائمة/مفرد)
                '/api/stats',         // الإحصائيات العامة
                '/api/calendar',      // بيانات التقويم (/api/calendar/data ...)
                '/api/analytics',     // طلبات التحليلات (/api/analytics?range=30)
                '/api/logs',          // جلب سجل النشاط نفسه
                '/api/auth/me'        // التحقق من الجلسة
            ];
            if (skipGetPaths.some(p => req.originalUrl.startsWith(p))) return next();
        }

        // Skip POST/PUT/DELETE for agents - controllers handle detailed logging
        // تجنب التسجيل المزدوج: الـ controllers تسجل بتفاصيل أفضل
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            const skipMutationPaths = [
                '/api/agents'         // عمليات إنشاء/تعديل/حذف الوكلاء (يسجلها الـ controller)
            ];
            if (skipMutationPaths.some(p => req.originalUrl.startsWith(p))) return next();
        }

        // Attach a finish listener so we capture response status and duration
        res.on('finish', () => {
            try {
                const duration = Date.now() - start;
                const status = res.statusCode;
                const user = req.user && (req.user._id || req.user.id) ? (req.user._id || req.user.id) : null;
                const userName = req.user?.full_name || null;
                const agentId = req.params?.agentId || req.params?.id || req.body?.agent_id || req.body?.agentId || null;

                // Generate Arabic action type from path
                const pathParts = req.path.split('/').filter(Boolean);
                const resource = pathParts[pathParts.length - 1] || 'ACTION';

                // إذا كان المورد ACTION (حالة عامة غير مفهومة) وتحديداً في عمليات الإنشاء، نتجاهل التسجيل لتقليل الضوضاء
                if (resource === 'ACTION' && method === 'POST') return; // لا تسجل "إنشاء ACTION"
                const actionType = (req.body && req.body.action_type) ? 
                    req.body.action_type : 
                    `${method}_${resource}`.toUpperCase();

                // Generate friendly Arabic description
                const description = generateArabicDescription(method, req.originalUrl, userName, status);

                const metadata = {
                    method,
                    url: req.originalUrl,
                    query: sanitize(req.query),
                    body: sanitize(req.body),
                    ip: req.ip || req.headers['x-forwarded-for'] || null,
                    status,
                    duration
                };

                // Fire-and-forget logging
                logActivity(user, agentId, actionType, description, metadata).catch(() => {});
            } catch (e) {
                // swallow logging errors
            }
        });
    } catch (err) {
        console.warn('[ActivityLogger] failed to initialize logger', err && err.message);
    }
    return next();
};
