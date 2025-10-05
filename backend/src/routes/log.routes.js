const express = require('express');
const router = express.Router();
const logController = require('../controllers/log.controller');

// GET /api/logs - Fetches all logs with pagination and filtering
router.get('/', logController.getAllLogs);

// --- FIX: Add the missing POST route to create new logs ---
router.post('/', logController.createLog);

module.exports = router;