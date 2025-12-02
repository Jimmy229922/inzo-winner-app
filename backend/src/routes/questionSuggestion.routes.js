const express = require('express');
const router = express.Router();
const questionSuggestionController = require('../controllers/questionSuggestion.controller');
const { authenticate } = require('../api/middleware/auth.middleware');

// ==============================================
// Routes للموظفين (يحتاج authentication فقط)
// ==============================================

// إضافة اقتراح جديد
router.post(
    '/submit',
    authenticate,
    questionSuggestionController.submitSuggestion
);

// عرض اقتراحات الموظف نفسه
router.get(
    '/my-suggestions',
    authenticate,
    questionSuggestionController.getMySuggestions
);

// إحصائيات الموظف
router.get(
    '/my-stats',
    authenticate,
    questionSuggestionController.getMyStats
);

// ==============================================
// Routes للإدارة (admin & super_admin فقط)
// ==============================================

// عرض جميع الاقتراحات
router.get(
    '/all',
    authenticate,
    (req, res, next) => {
        // التحقق من الصلاحيات
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح لك بالوصول'
            });
        }
        next();
    },
    questionSuggestionController.getAllSuggestions
);

// تقييم اقتراح
router.put(
    '/evaluate/:id',
    authenticate,
    (req, res, next) => {
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح لك بالوصول'
            });
        }
        next();
    },
    questionSuggestionController.evaluateSuggestion
);

// حذف اقتراح
router.delete(
    '/:id',
    authenticate,
    (req, res, next) => {
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح لك بالوصول'
            });
        }
        next();
    },
    questionSuggestionController.deleteSuggestion
);

// تحديث حالة الإشعار
router.put(
    '/notify/:id',
    authenticate,
    questionSuggestionController.markAsNotified
);

module.exports = router;
