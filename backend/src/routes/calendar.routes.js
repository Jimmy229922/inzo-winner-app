const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');

// GET /api/calendar/data - Fetches all data for the calendar page
router.get('/data', calendarController.getCalendarData);

// POST /api/calendar/tasks - Creates or updates a task
router.post('/tasks', calendarController.updateTask);

module.exports = router;