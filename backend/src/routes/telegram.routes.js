const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegram.controller');

// Route to post an announcement
router.post('/post-announcement', telegramController.postAnnouncement);

router.get('/get-chat-info', telegramController.getChatInfo);

router.get('/status', telegramController.getStatus);

module.exports = router;