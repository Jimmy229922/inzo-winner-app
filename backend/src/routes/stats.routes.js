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

// GET /api/stats/competitions-by-day/:dayOfWeek - Fetches competitions sent on a specific day of week
router.get('/competitions-by-day/:dayOfWeek', statsController.getCompetitionsByDayOfWeek);

// GET /api/stats/rank-changes - Fetches agent rank changes for analytics
router.get('/rank-changes', statsController.getRankChanges);

// DELETE /api/stats/rank-changes/:id - Delete a single rank change (Super Admin only)
router.delete('/rank-changes/:id', statsController.deleteRankChange);

// DELETE /api/stats/rank-changes - Purge all rank changes (Super Admin only)
router.delete('/rank-changes', statsController.purgeAllRankChanges);

// GET /api/stats/interactive-competitions - Aggregated interactive competitions
router.get('/interactive-competitions', statsController.getInteractiveCompetitions);

// GET /api/stats/agents-competitions - Fetches all agents with their competitions and compliance rate
router.get('/agents-competitions', statsController.getAgentsCompetitions);

// GET /api/stats/completed-competition-recipients - List agents who received a competition (by question)
router.get('/completed-competition-recipients', statsController.getCompletedCompetitionRecipients);

module.exports = router;