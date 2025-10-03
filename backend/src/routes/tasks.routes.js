const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');

// GET /api/tasks/today - جلب جميع المهام لليوم الحالي
router.get('/today', taskController.getTodayTasks);

// POST /api/tasks - إنشاء أو تحديث حالة مهمة لوكيل معين
router.post('/', taskController.updateTaskStatus);

// POST /api/tasks/daily - Legacy route from frontend, now points to the correct controller
router.post('/daily', taskController.updateTaskStatus);

module.exports = router;
