const express = require('express');
const router = express.Router();
const insightsController = require('../controllers/insights.controller');
const { authenticate } = require('../api/middleware/auth.middleware');
const { requireRole } = require('../api/middleware/roles.middleware');

// All routes are protected and for admins/super_admins
router.get('/dashboard', authenticate, requireRole('admin', 'super_admin'), insightsController.getDashboardInsights);

module.exports = router;
