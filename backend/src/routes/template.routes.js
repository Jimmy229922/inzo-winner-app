const express = require('express');
const router = express.Router();
const templateController = require('../controllers/template.controller');
const { authenticate } = require('../api/middleware/auth.middleware');
const telegramController = require('../controllers/telegram.controller'); // Assuming this is the telegram controller

// --- FIX: Add authentication middleware to the get-chat-info route ---
router.get('/get-chat-info', authenticate, telegramController.getChatInfo);

module.exports = router;