const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');
const authenticate = require('../middleware/auth.middleware');

// Basic CRUD routes
router.get('/', agentController.getAllAgents);
router.post('/', agentController.createAgent);

// Special routes
router.get('/check-uniqueness', agentController.checkUniqueness);
router.post('/bulk-insert', agentController.bulkInsertAgents);
router.post('/bulk-renew', agentController.bulkRenewBalances);
router.post('/bulk-broadcast-balance', agentController.bulkBroadcastBalance); // NEW: Server-side bulk broadcast
router.post('/bulk-broadcast-message', agentController.bulkSendMessage); // NEW: Server-side bulk custom message
router.put('/bulk-update', agentController.bulkUpdateAgents);
router.delete('/delete-all', agentController.deleteAllAgents);

// Individual agent routes
router.get('/:id', agentController.getAgentById);
router.get('/:id/winners', agentController.getAgentWinners); // Added route for fetching winners
router.get('/:id/transactions', agentController.getAgentTransactions); // Added
router.get('/:id/competitions-summary', agentController.getAgentCompetitionsSummary);
router.put('/:id', agentController.updateAgent);
router.delete('/:id', agentController.deleteAgent);
router.post('/:id/renew', agentController.renewSingleAgentBalance);
router.post('/:id/rank-change', agentController.recordRankChange);
router.post('/:id/classification-change', agentController.recordClassificationChange);
router.patch('/:id/toggle-auditing', authenticate, agentController.toggleAuditing);
router.post('/:agentId/send-winners-report', authenticate, agentController.sendWinnersReport); // Added
router.post('/:agentId/send-winners-details', authenticate, agentController.sendWinnersDetails);
router.post('/validate-winners-images', authenticate, agentController.validateWinnersImages); // NEW

module.exports = router;