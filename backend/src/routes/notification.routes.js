const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../api/middleware/auth.middleware');

router.use(authMiddleware); // Protect all routes

router.get('/', notificationController.getNotifications);
router.delete('/:id', notificationController.deleteNotification);
router.delete('/', notificationController.deleteAllNotifications);
router.put('/:id/read', notificationController.markAsRead);

module.exports = router;
