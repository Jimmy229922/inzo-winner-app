const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');

// GET /api/stats/home - Fetches all stats for the home page
router.get('/home', statsController.getHomeStats);

// GET /api/stats/agent-analytics/:id - Fetches analytics for a single agent
router.get('/agent-analytics/:id', statsController.getAgentAnalytics);

// GET /api/stats/top-agents - Fetches top performing agents
router.get('/top-agents', statsController.getTopAgents);

// GET /api/analytics - General analytics used by the frontend analytics dashboard
// Note: This endpoint is exposed at /api/analytics by mounting in app.js (we'll also support it here for internal use)
router.get('/analytics', statsController.getAnalytics);

module.exports = router;