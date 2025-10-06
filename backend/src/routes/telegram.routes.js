const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegram.controller');
const { authenticate } = require('../api/middleware/auth.middleware');

// Route to post an announcement
router.post('/post-announcement', authenticate, telegramController.postAnnouncement);

router.get('/get-chat-info', authenticate, telegramController.getChatInfo);

module.exports = router;