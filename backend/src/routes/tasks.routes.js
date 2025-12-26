const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks.controller'); // Import controller
const taskController = require('../controllers/task.controller'); // Import task controller (with getTodayTasks)

// --- Route to update a task ---
router.post('/', tasksController.updateTask);

// --- Route to reset all tasks ---
router.post('/reset-all', tasksController.resetAllTasks);

// --- Get agents with tasks for today (using proper controller with audit_days filtering) ---
router.get('/today', taskController.getTodayTasks);

module.exports = router;
