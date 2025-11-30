const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');

router.get('/home', statsController.getHomePageStats);
router.get('/analytics', statsController.getAnalyticsData);
router.get('/interactive-competitions', statsController.getInteractiveCompetitions);

module.exports = router;