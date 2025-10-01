const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');

// GET /api/tasks/today - جلب جميع المهام لليوم الحالي
router.get('/today', taskController.getTodayTasks);

// GET /api/tasks/stats/today - جلب إحصائيات مهام اليوم
router.get('/stats/today', taskController.getTodayTaskStats);

// POST /api/tasks - إنشاء أو تحديث حالة مهمة لوكيل معين
router.post('/', taskController.updateTaskStatus);

module.exports = router;
