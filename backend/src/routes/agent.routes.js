const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Basic CRUD routes
router.get('/', agentController.getAllAgents);
router.post('/', agentController.createAgent);

// Special routes
router.get('/check-uniqueness', agentController.checkUniqueness);
router.post('/bulk-insert', agentController.bulkInsertAgents);
router.post('/bulk-renew', agentController.bulkRenewBalances);
router.put('/bulk-update', agentController.bulkUpdateAgents);
router.delete('/delete-all', agentController.deleteAllAgents);

// Individual agent routes
router.get('/:id', agentController.getAgentById);
router.put('/:id', agentController.updateAgent);
router.delete('/:id', agentController.deleteAgent);
router.post('/:id/renew', agentController.renewSingleAgentBalance);

module.exports = router;

module.exports = router;