const express = require('express');
const router = express.Router();
const logController = require('../controllers/log.controller');

// GET /api/logs - Fetches all logs with optional filtering
router.get('/', logController.getAllLogs);

// POST /api/logs - Creates a new log entry
router.post('/', logController.createLog);

module.exports = router;