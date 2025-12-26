const express = require('express');
const router = express.Router();
const questionSuggestionController = require('../controllers/questionSuggestion.controller');
const { submitSuggestion, getAllSuggestions, getPublicApprovedSuggestions, evaluateSuggestion, deleteSuggestion } = require('../controllers/questionSuggestion.controller');
const { authenticate } = require('../api/middleware/auth.middleware');
const { requireRole } = require('../api/middleware/roles.middleware');

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

// عرض جميع الاقتراحات - متاح للجميع (موظف، أدمن، سوبر أدمن)
router.get(
    '/all',
    authenticate,
    questionSuggestionController.getAllSuggestions
);

// عدد الاقتراحات غير المقروءة - متاح للسوبر أدمن
router.get(
    '/unread-count',
    authenticate,
    requireRole('super_admin'),
    questionSuggestionController.getUnreadCount
);
    
// Public endpoint for employees to view approved suggestions only
router.get('/public', authenticate, requireRole('employee', 'admin', 'super_admin'), questionSuggestionController.getPublicApprovedSuggestions);

// تقييم اقتراح - فقط للسوبر أدمن
router.put(
    '/evaluate/:id',
    authenticate,
    requireRole('super_admin'),
    questionSuggestionController.evaluateSuggestion
);

// حذف اقتراح - فقط للسوبر أدمن
router.delete(
    '/:id',
    authenticate,
    requireRole('super_admin'),
    questionSuggestionController.deleteSuggestion
);

// تحديث حالة الإشعار
router.put(
    '/notify/:id',
    authenticate,
    questionSuggestionController.markAsNotified
);

// NEW: Get unread updates count for employee
router.get(
    '/employee-unread-count',
    authenticate,
    questionSuggestionController.getEmployeeUnreadUpdatesCount
);

// NEW: Mark updates as seen for employee
router.post(
    '/mark-seen',
    authenticate,
    questionSuggestionController.markUpdatesAsSeen
);

// أرشفة اقتراح - فقط للسوبر أدمن
router.put(
    '/:id/archive',
    authenticate,
    requireRole('super_admin'),
    questionSuggestionController.archiveSuggestion
);

// تعديل اقتراح - للموظف (عند طلب التعديل)
router.put(
    '/:id/update',
    authenticate,
    questionSuggestionController.updateSuggestion
);

module.exports = router;
