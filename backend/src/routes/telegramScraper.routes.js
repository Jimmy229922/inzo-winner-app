/**
 * Telegram Scraper Routes
 * -----------------------
 * Independent routes for the Telegram comment-fetching feature.
 * All routes are prefixed with /api/telegram-scraper
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/telegramScraper.controller');

// Status check - is MTProto session authenticated?
router.get('/telegram-scraper/status', controller.getStatus);

// Auth flow
router.post('/telegram-scraper/auth/send-code', controller.sendCode);
router.post('/telegram-scraper/auth/verify-code', controller.verifyCode);
router.post('/telegram-scraper/auth/logout', controller.logout);

// Fetch comments from a post
router.post('/telegram-scraper/fetch-comments', controller.fetchComments);

module.exports = router;
