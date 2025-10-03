const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');

router.get('/home', statsController.getHomeStats);
router.get('/top-agents', statsController.getTopAgentsStats);
router.get('/agent-analytics/:agentId', statsController.getAgentAnalytics);

module.exports = router;