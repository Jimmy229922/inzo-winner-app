/**
 * Telegram Scraper Routes
 * -----------------------
 * Independent routes for the Telegram comment-fetching feature.
 * All routes are prefixed with /api/telegram-scraper
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/telegramScraper.controller');
const { requireRole } = require('../api/middleware/roles.middleware');

// Status check - is MTProto session authenticated?
router.get('/telegram-scraper/status', controller.getStatus);

// Auth flow
router.post('/telegram-scraper/auth/send-code', requireRole('super_admin'), controller.sendCode);
router.post('/telegram-scraper/auth/verify-code', requireRole('super_admin'), controller.verifyCode);
router.post('/telegram-scraper/auth/logout', requireRole('super_admin'), controller.logout);

// Fetch comments from a post
router.post('/telegram-scraper/fetch-comments', controller.fetchComments);

module.exports = router;
